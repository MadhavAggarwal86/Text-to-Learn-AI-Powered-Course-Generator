import { useVideos } from '../../hooks/queries.js';
import CodeBlock from '../blocks/CodeBlock.jsx';
import HeadingBlock from '../blocks/HeadingBlock.jsx';
import ParagraphBlock from '../blocks/ParagraphBlock.jsx';
import { renderInline } from '../blocks/richText.jsx';
import { youtubeSearchUrl } from '../blocks/VideoBlock.jsx';

// The PDF is drawn from this copy of the lesson, laid out for A4 paper. Every direct child
// carries data-pdf-block: page breaks are only placed between those, so a paragraph or a
// question is never cut in half (only a block taller than a whole page gets split).
// The copy is always light (.force-light) whatever theme the app is in.

export const PRINT_WIDTH_PX = 720;
const LETTERS = 'ABCDEFGH';

export default function LessonPrintView({
  ref,
  courseTitle,
  moduleNumber,
  moduleTitle,
  lessonNumber,
  lessonCount,
  lesson,
}) {
  const mcqs = lesson.content.filter((block) => block.type === 'mcq');
  const mcqIndexes = lesson.content.flatMap((block, i) => (block.type === 'mcq' ? [i] : []));

  return (
    <div
      ref={ref}
      className="force-light bg-white text-slate-900"
      style={{ width: PRINT_WIDTH_PX }}
      aria-hidden="true"
    >
      <header data-pdf-block className="border-b border-slate-200 pb-5">
        <p className="text-sm text-slate-500">{courseTitle}</p>
        <p className="mt-3 text-xs font-semibold tracking-wide text-indigo-600 uppercase">
          Module {moduleNumber}: {moduleTitle} · Lesson {lessonNumber} of {lessonCount}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{lesson.title}</h1>
      </header>

      <section data-pdf-block className="pt-6">
        <div className="rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold">What you&apos;ll learn</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
            {lesson.objectives.map((objective) => (
              <li key={objective}>{objective}</li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            <span className="font-medium">Key topics:</span> {lesson.keyTopics.join(' · ')}
          </p>
        </div>
      </section>

      {lesson.content.map((block, i) => {
        if (block.type === 'mcq') {
          const questionNumber = mcqIndexes.indexOf(i) + 1;
          return (
            <div key={i} data-pdf-block className="pt-5">
              {questionNumber === 1 && (
                <h2 className="mb-4 border-t border-slate-200 pt-6 text-xl font-semibold">
                  Check your understanding
                </h2>
              )}
              <PrintQuestion number={questionNumber} {...block} />
            </div>
          );
        }
        return (
          <div
            key={i}
            data-pdf-block
            // A heading must stay on the same page as the text it introduces.
            data-pdf-keep-with-next={block.type === 'heading' ? '' : undefined}
            className="pt-5"
          >
            <PrintBlock block={block} />
          </div>
        );
      })}

      {mcqs.length > 0 && (
        <>
          <h2
            data-pdf-block
            data-pdf-keep-with-next=""
            className="mt-8 border-t border-slate-200 pt-6 text-xl font-semibold"
          >
            Answer key
          </h2>
          {mcqs.map((mcq, i) => (
            <p key={i} data-pdf-block className="pt-3 text-sm leading-6 text-slate-700">
              <span className="font-semibold text-slate-900">
                {i + 1}. {LETTERS[mcq.answer]}
              </span>{' '}
              ({renderInline(mcq.options[mcq.answer])}): {renderInline(mcq.explanation)}
            </p>
          ))}
        </>
      )}

      {lesson.resources.length > 0 && (
        <section data-pdf-block className="mt-8 border-t border-slate-200 pt-6">
          <h2 className="text-xl font-semibold">Further reading</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lesson.resources.map((resource) => (
              <li key={resource.url}>
                <a href={resource.url} className="font-medium text-indigo-700">
                  {resource.title}
                </a>
                <span className="block break-all text-slate-500">{resource.url}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PrintBlock({ block }) {
  switch (block.type) {
    case 'heading':
      return <HeadingBlock text={block.text} />;
    case 'paragraph':
      return <ParagraphBlock text={block.text} />;
    case 'code':
      return <CodeBlock language={block.language} text={block.text} showCopy={false} />;
    case 'video':
      return <PrintVideo query={block.query} />;
    default:
      return null;
  }
}

/** A PDF can't play video: show the lesson's video (already looked up on the page) as a link. */
function PrintVideo({ query }) {
  const { data: videos } = useVideos(query);
  const video = videos?.[0];
  const url = video ? `https://www.youtube.com/watch?v=${video.videoId}` : youtubeSearchUrl(query);

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
        ▶ Recommended video
      </p>
      <p className="mt-1 font-medium">{video ? video.title : query}</p>
      {video && <p className="text-sm text-slate-500">{video.channelTitle}</p>}
      <a href={url} className="mt-1 block text-sm break-all text-indigo-700">
        {url}
      </a>
    </div>
  );
}

function PrintQuestion({ number, question, options }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase">
        Question {number}
      </p>
      <p className="mt-1 font-medium">{renderInline(question)}</p>
      <ol className="mt-3 space-y-1.5 text-sm">
        {options.map((option, i) => (
          <li key={i} className="flex gap-2">
            <span className="font-semibold">{LETTERS[i]}.</span>
            <span>{renderInline(option)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
