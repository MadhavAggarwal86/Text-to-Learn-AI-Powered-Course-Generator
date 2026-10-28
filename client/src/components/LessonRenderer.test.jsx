import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithQuery as render } from '../test/render.jsx';
import LessonRenderer from './LessonRenderer.jsx';

// No embedded videos here (VideoBlock.test.jsx covers them): the block shows its fallback.
vi.mock('../utils/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchVideos: vi.fn(async () => []),
}));

const mcq = (question, answer) => ({
  type: 'mcq',
  question,
  options: ['Option A', 'Option B', 'Option C'],
  answer,
  explanation: `Because of ${question}.`,
});

const content = [
  { type: 'heading', text: 'Introduction' },
  { type: 'paragraph', text: 'Hooks let you use **state**.' },
  { type: 'code', language: 'jsx', text: 'const [n, setN] = useState(0);' },
  { type: 'video', query: 'react hooks tutorial' },
  { type: 'hologram', text: 'from the future' },
  mcq('first', 0),
  mcq('second', 2),
];

describe('LessonRenderer', () => {
  it('renders each block type in order', async () => {
    const { container } = render(<LessonRenderer content={content} />);

    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument();
    expect(container.querySelector('strong')).toHaveTextContent('state');
    expect(container.querySelector('pre')).toHaveTextContent('useState(0)');
    expect(await screen.findByText('react hooks tutorial')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Check answer' })).toHaveLength(2);
  });

  it('skips unknown block types instead of crashing', () => {
    render(<LessonRenderer content={content} />);

    expect(screen.queryByText('from the future')).toBeNull();
  });

  it('numbers the questions and keeps a running quiz score', async () => {
    const user = userEvent.setup();
    render(<LessonRenderer content={content} />);
    const score = () => screen.getByText(/answered|You scored/);

    expect(screen.getByRole('heading', { name: 'Check your understanding' })).toBeInTheDocument();
    expect(score()).toHaveTextContent('0 of 2 answered · 0 correct');

    const [first, second] = screen.getAllByRole('radiogroup');
    await user.click(first.querySelectorAll('input')[0]); // correct
    await user.click(screen.getAllByRole('button', { name: 'Check answer' })[0]);
    expect(score()).toHaveTextContent('1 of 2 answered · 1 correct');

    await user.click(second.querySelectorAll('input')[1]); // wrong
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(score()).toHaveTextContent('You scored 1 / 2');
  });

  it('renders a lesson without questions with no quiz section', () => {
    render(<LessonRenderer content={content.slice(0, 4)} />);

    expect(screen.queryByText('Check your understanding')).toBeNull();
  });
});
