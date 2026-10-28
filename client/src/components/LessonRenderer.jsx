import { CheckCircle2, RotateCcw } from 'lucide-react';
import { Fragment, useState } from 'react';
import CodeBlock from './blocks/CodeBlock.jsx';
import HeadingBlock from './blocks/HeadingBlock.jsx';
import MCQBlock from './blocks/MCQBlock.jsx';
import ParagraphBlock from './blocks/ParagraphBlock.jsx';
import VideoBlock from './blocks/VideoBlock.jsx';

const BLOCKS = {
  heading: HeadingBlock,
  paragraph: ParagraphBlock,
  code: CodeBlock,
  video: VideoBlock,
};

/**
 * Renders a lesson's content blocks in order. MCQs form a quiz: a summary with the running
 * score appears above the first question. When every question is answered,
 * `onQuizComplete(answers)` receives the chosen option per question (in order) so the score
 * can be saved; `quizSave` describes that save ({ status, passed, onRetry }) and
 * `quizResult` is the score saved earlier. Unknown block types are skipped. Give it a `key`
 * per lesson version so the quiz resets when the content changes.
 */
export default function LessonRenderer({
  content,
  quizResult = null,
  onQuizComplete,
  onRetake,
  quizSave,
}) {
  const [attempt, setAttempt] = useState(0);
  // This attempt's answers by block index: { correct, chosen }.
  const [answers, setAnswers] = useState({});
  const mcqIndexes = content.flatMap((block, i) => (block.type === 'mcq' ? [i] : []));

  function handleAnswer(blockIndex, correct, chosen) {
    const next = { ...answers, [blockIndex]: { correct, chosen } };
    setAnswers(next);
    if (Object.keys(next).length === mcqIndexes.length) {
      onQuizComplete?.(mcqIndexes.map((index) => next[index].chosen));
    }
  }

  function retake() {
    setAnswers({});
    setAttempt((n) => n + 1); // remounts the questions, clearing their selections
    onRetake?.();
  }

  return (
    <div className="space-y-5">
      {content.map((block, i) => {
        if (block.type === 'mcq') {
          const number = mcqIndexes.indexOf(i) + 1;
          return (
            <Fragment key={i}>
              {number === 1 && (
                <QuizSummary
                  total={mcqIndexes.length}
                  answers={answers}
                  quizResult={quizResult}
                  quizSave={quizSave}
                  onRetake={retake}
                />
              )}
              <MCQBlock
                key={`${i}-${attempt}`}
                {...block}
                number={number}
                onAnswer={(correct, chosen) => handleAnswer(i, correct, chosen)}
              />
            </Fragment>
          );
        }

        const Block = BLOCKS[block.type];
        return Block ? <Block key={i} {...block} /> : null;
      })}
    </div>
  );
}

function QuizSummary({ total, answers, quizResult, quizSave, onRetake }) {
  const answered = Object.keys(answers).length;
  const correct = Object.values(answers).filter((a) => a.correct).length;
  const finished = answered === total;

  return (
    <div className="space-y-2 border-t border-slate-200 pt-8 dark:border-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Check your understanding</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
          {finished
            ? `You scored ${correct} / ${total}${correct === total ? ' 🎉' : ''}`
            : `${answered} of ${total} answered · ${correct} correct`}
        </p>
      </div>

      {quizResult && !finished && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your best: {quizResult.bestCorrect} / {quizResult.total} · last attempt{' '}
          {quizResult.correct} / {quizResult.total} ·{' '}
          {quizResult.attempts === 1 ? '1 attempt' : `${quizResult.attempts} attempts`}
        </p>
      )}

      {finished && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <SaveStatus quizSave={quizSave} />
          <button
            type="button"
            onClick={onRetake}
            className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            <RotateCcw className="h-4 w-4" />
            Retake quiz
          </button>
        </div>
      )}
    </div>
  );
}

function SaveStatus({ quizSave }) {
  if (!quizSave || quizSave.status === 'idle') return null;
  if (quizSave.status === 'saving') {
    return <span className="text-slate-500 dark:text-slate-400">Saving your score…</span>;
  }
  if (quizSave.status === 'error') {
    return (
      <span className="text-red-600 dark:text-red-400">
        Couldn&apos;t save your score.{' '}
        <button type="button" onClick={quizSave.onRetry} className="font-medium underline">
          Try again
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
      <CheckCircle2 className="h-4 w-4" />
      {quizSave.passed ? 'Score saved · lesson marked as complete' : 'Score saved'}
    </span>
  );
}
