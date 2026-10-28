import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../test/render.jsx';
import { fetchVideos } from '../../utils/api.js';
import { downloadLessonPdf } from '../../utils/pdf/buildLessonPdf.js';
import LessonPDFExporter from './LessonPDFExporter.jsx';
import LessonPrintView from './LessonPrintView.jsx';

vi.mock('../../utils/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchVideos: vi.fn(),
}));
// jsdom has no canvas, so the real capture/PDF step is checked in the browser instead.
vi.mock('../../utils/pdf/buildLessonPdf.js', () => ({ downloadLessonPdf: vi.fn() }));

const lesson = {
  id: 'l1',
  title: 'The useEffect Hook Basics',
  objectives: ['Explain side effects', 'Use the dependency array'],
  keyTopics: ['side effects', 'cleanup'],
  content: [
    { type: 'heading', text: 'Why effects exist' },
    { type: 'paragraph', text: 'Effects **synchronise** components with outside systems.' },
    { type: 'code', language: 'jsx', text: 'useEffect(() => {}, []);' },
    { type: 'video', query: 'react useeffect tutorial' },
    {
      type: 'mcq',
      question: 'When does an effect with [] run?',
      options: ['Every render', 'Once after mount', 'Never'],
      answer: 1,
      explanation: 'An empty array means no dependencies change.',
    },
    {
      type: 'mcq',
      question: 'What does cleanup do?',
      options: ['Undoes the effect', 'Renders twice'],
      answer: 0,
      explanation: 'It runs before the next effect and on unmount.',
    },
  ],
  resources: [
    { title: 'React docs: useEffect', url: 'https://react.dev/reference/react/useEffect' },
  ],
};

const position = {
  moduleNumber: 2,
  module: { title: 'Side effects' },
  index: 5,
  total: 16,
};

beforeEach(() => {
  fetchVideos.mockReset();
  downloadLessonPdf.mockReset();
  fetchVideos.mockResolvedValue([
    { videoId: 'abc123', title: 'useEffect in 10 minutes', channelTitle: 'Fireship' },
  ]);
});

describe('LessonPrintView', () => {
  function renderView() {
    return renderWithQuery(
      <LessonPrintView
        courseTitle="Mastering React Hooks"
        moduleNumber={2}
        moduleTitle="Side effects"
        lessonNumber={6}
        lessonCount={16}
        lesson={lesson}
      />,
    );
  }

  it('is always light and split into page-break-safe blocks', () => {
    const { container } = renderView();
    const root = container.firstChild;

    expect(root).toHaveClass('force-light');
    // header, objectives, 6 content blocks, answer-key heading, 2 answers, resources
    expect(root.querySelectorAll(':scope > [data-pdf-block]')).toHaveLength(12);
  });

  it('shows where the lesson sits in the course', () => {
    renderView();

    expect(screen.getByText('Mastering React Hooks')).toBeInTheDocument();
    expect(screen.getByText(/Module 2: Side effects · Lesson 6 of 16/)).toBeInTheDocument();
  });

  it('lists questions without answers and puts the answers in a key at the end', () => {
    const { container } = renderView();
    const text = container.textContent;

    expect(screen.getByText('Question 1')).toBeInTheDocument();
    expect(text.indexOf('Answer key')).toBeGreaterThan(text.indexOf('What does cleanup do?'));
    expect(text).toContain('1. B (Once after mount): An empty array means no dependencies change.');
    expect(text).toContain('2. A (Undoes the effect)');
  });

  it('turns the video into a watch link and prints resource URLs', async () => {
    renderView();

    expect(await screen.findByText('useEffect in 10 minutes')).toBeInTheDocument();
    // The print copy is aria-hidden (screen readers use the real page), so include hidden nodes.
    const watchLink = screen.getByRole('link', {
      name: 'https://www.youtube.com/watch?v=abc123',
      hidden: true,
    });
    expect(watchLink).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
    expect(screen.getByText('https://react.dev/reference/react/useEffect')).toBeInTheDocument();
    // No copy button or quiz controls in the printed version.
    expect(screen.queryByRole('button', { hidden: true })).toBeNull();
  });
});

describe('LessonPDFExporter', () => {
  it('renders the print copy off-screen, builds the PDF, then removes the copy', async () => {
    const user = userEvent.setup();
    let resolveDownload;
    downloadLessonPdf.mockImplementation(
      () => new Promise((resolve) => (resolveDownload = resolve)),
    );
    renderWithQuery(
      <LessonPDFExporter courseTitle="Mastering React Hooks" position={position} lesson={lesson} />,
    );

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(screen.getByRole('button', { name: /preparing pdf/i })).toBeDisabled();
    await waitFor(() => expect(downloadLessonPdf).toHaveBeenCalledTimes(1));
    const [element, options] = downloadLessonPdf.mock.calls[0];
    expect(element).toHaveClass('force-light');
    expect(element.isConnected).toBe(true);
    expect(options).toEqual({
      fileName: 'text-to-learn-the-useeffect-hook-basics.pdf',
      footerText: 'Text-to-Learn · Mastering React Hooks',
    });

    resolveDownload({ pageCount: 2 });
    expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeEnabled();
    expect(element.isConnected).toBe(false);
  });

  it('shows an error and lets the user try again when export fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    downloadLessonPdf.mockRejectedValueOnce(new Error('canvas too large'));
    renderWithQuery(
      <LessonPDFExporter courseTitle="Mastering React Hooks" position={position} lesson={lesson} />,
    );

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't create the PDF");
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeEnabled();
  });
});
