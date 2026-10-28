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

describe('LessonRenderer quiz saving', () => {
  /** Answers question N (0-based) with option `option` and checks it. */
  async function answer(user, questionIndex, option) {
    const group = screen.getAllByRole('radiogroup')[questionIndex];
    await user.click(group.querySelectorAll('input')[option]);
    await user.click(screen.getAllByRole('button', { name: 'Check answer' })[0]);
  }

  it('sends the chosen options, in question order, once every question is answered', async () => {
    const user = userEvent.setup();
    const onQuizComplete = vi.fn();
    render(<LessonRenderer content={content} onQuizComplete={onQuizComplete} />);

    await answer(user, 0, 0);
    expect(onQuizComplete).not.toHaveBeenCalled();
    await answer(user, 1, 1);

    expect(onQuizComplete).toHaveBeenCalledTimes(1);
    expect(onQuizComplete).toHaveBeenCalledWith([0, 1]);
  });

  it('shows the best earlier score until the quiz is taken again', () => {
    render(
      <LessonRenderer
        content={content}
        quizResult={{ correct: 1, total: 2, bestCorrect: 2, attempts: 3, takenAt: '2026-10-28' }}
      />,
    );

    expect(
      screen.getByText('Your best: 2 / 2 · last attempt 1 / 2 · 3 attempts'),
    ).toBeInTheDocument();
  });

  it('reports the save and offers a retake that resets the questions', async () => {
    const user = userEvent.setup();
    const onRetake = vi.fn();
    const { rerender } = render(
      <LessonRenderer content={content} onRetake={onRetake} quizSave={{ status: 'idle' }} />,
    );
    await answer(user, 0, 0);
    await answer(user, 1, 2);

    rerender(
      <LessonRenderer
        content={content}
        onRetake={onRetake}
        quizSave={{ status: 'saved', passed: true }}
      />,
    );
    expect(screen.getByText('Score saved · lesson marked as complete')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /retake quiz/i }));

    expect(onRetake).toHaveBeenCalledTimes(1);
    expect(screen.getByText('0 of 2 answered · 0 correct')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Check answer' })).toHaveLength(2);
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeEnabled();
  });

  it('lets the user retry a failed save', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LessonRenderer content={content} quizSave={{ status: 'error', onRetry }} />);
    await answer(user, 0, 0);
    await answer(user, 1, 2);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
