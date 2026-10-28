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
 * score appears above the first question. Unknown block types are skipped rather than
 * breaking the page. Give it a `key` per lesson so the quiz resets between lessons.
 */
export default function LessonRenderer({ content }) {
  // Quiz results by block index: true (correct) / false (wrong).
  const [results, setResults] = useState({});
  const mcqIndexes = content.flatMap((block, i) => (block.type === 'mcq' ? [i] : []));

  return (
    <div className="space-y-5">
      {content.map((block, i) => {
        if (block.type === 'mcq') {
          const number = mcqIndexes.indexOf(i) + 1;
          return (
            <Fragment key={i}>
              {number === 1 && <QuizSummary total={mcqIndexes.length} results={results} />}
              <MCQBlock
                {...block}
                number={number}
                onAnswer={(correct) => setResults((current) => ({ ...current, [i]: correct }))}
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

function QuizSummary({ total, results }) {
  const answered = Object.keys(results).length;
  const correct = Object.values(results).filter(Boolean).length;
  const finished = answered === total;

  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-t border-slate-200 pt-8 dark:border-slate-800">
      <h2 className="text-xl font-semibold tracking-tight">Check your understanding</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400" role="status" aria-live="polite">
        {finished
          ? `You scored ${correct} / ${total}${correct === total ? ' 🎉' : ''}`
          : `${answered} of ${total} answered · ${correct} correct`}
      </p>
    </div>
  );
}
