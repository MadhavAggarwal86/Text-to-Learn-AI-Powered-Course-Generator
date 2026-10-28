import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../test/render.jsx';
import { fetchVideos } from '../../utils/api.js';
import VideoBlock from './VideoBlock.jsx';

vi.mock('../../utils/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchVideos: vi.fn(),
}));

const VIDEOS = [
  {
    videoId: 'abc123',
    title: 'React Hooks in 10 minutes',
    channelTitle: 'Fireship',
    thumbnail: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
  },
  {
    videoId: 'def456',
    title: 'useEffect explained',
    channelTitle: 'Web Dev Simplified',
    thumbnail: 'https://i.ytimg.com/vi/def456/hqdefault.jpg',
  },
];

const QUERY = 'react hooks & state explained';
const SEARCH_URL =
  'https://www.youtube.com/results?search_query=react%20hooks%20%26%20state%20explained';

beforeEach(() => {
  fetchVideos.mockReset();
});

describe('VideoBlock', () => {
  it('shows a loading placeholder while searching', () => {
    fetchVideos.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<VideoBlock query={QUERY} />);

    expect(screen.getByLabelText('Loading video')).toBeInTheDocument();
    expect(fetchVideos).toHaveBeenCalledWith(QUERY);
  });

  it('shows the top video as a thumbnail, without loading the YouTube player', async () => {
    fetchVideos.mockResolvedValue(VIDEOS);
    const { container } = renderWithQuery(<VideoBlock query={QUERY} />);

    expect(await screen.findByText('React Hooks in 10 minutes')).toBeInTheDocument();
    expect(screen.getByText('Fireship')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
    );
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('loads the privacy-enhanced player when the thumbnail is clicked', async () => {
    const user = userEvent.setup();
    fetchVideos.mockResolvedValue(VIDEOS);
    const { container } = renderWithQuery(<VideoBlock query={QUERY} />);

    await user.click(
      await screen.findByRole('button', { name: 'Play video: React Hooks in 10 minutes' }),
    );

    const iframe = container.querySelector('iframe');
    expect(iframe).toHaveAttribute(
      'src',
      'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0',
    );
    expect(iframe).toHaveAttribute('title', 'React Hooks in 10 minutes');
    expect(iframe).toHaveAttribute('allowfullscreen');
  });

  it('switches between the suggested videos', async () => {
    const user = userEvent.setup();
    fetchVideos.mockResolvedValue(VIDEOS);
    const { container } = renderWithQuery(<VideoBlock query={QUERY} />);

    await user.click(
      await screen.findByRole('button', { name: 'Play video: React Hooks in 10 minutes' }),
    );
    await user.click(screen.getByRole('button', { name: 'Video 2' }));

    // Switching shows the new video's thumbnail; the old player is removed.
    expect(screen.getByText('useEffect explained')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Video 2' })).toHaveAttribute('aria-pressed', 'true');
    expect(container.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('link', { name: /more on youtube/i })).toHaveAttribute(
      'href',
      SEARCH_URL,
    );
  });

  it('hides the video switcher when there is only one result', async () => {
    fetchVideos.mockResolvedValue(VIDEOS.slice(0, 1));
    renderWithQuery(<VideoBlock query={QUERY} />);

    await screen.findByText('React Hooks in 10 minutes');
    expect(screen.queryByRole('button', { name: 'Video 1' })).toBeNull();
  });

  it.each([
    ['no videos are found', () => fetchVideos.mockResolvedValue([])],
    ['the search fails', () => fetchVideos.mockRejectedValue(new Error('daily limit'))],
  ])('falls back to a YouTube search link when %s', async (_, setup) => {
    setup();
    renderWithQuery(<VideoBlock query={QUERY} />);

    const fallback = (await screen.findByText(QUERY)).closest('aside');
    expect(within(fallback).getByRole('link', { name: /watch on youtube/i })).toHaveAttribute(
      'href',
      SEARCH_URL,
    );
  });
});
