// Phase 4 placeholder: a plain rendering of each block so lessons are readable end to end.
// Phase 5 replaces this with dedicated block components (syntax-highlighted code,
// embedded YouTube videos, interactive quizzes, **bold** formatting).

export default function LessonRenderer({ content }) {
  return (
    <div className="space-y-4 leading-relaxed">
      {content.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }) {
  switch (block.type) {
    case 'heading':
      return <h2 className="pt-4 text-xl font-semibold">{block.text}</h2>;
    case 'paragraph':
      return <p className="whitespace-pre-line text-slate-700 dark:text-slate-300">{block.text}</p>;
    case 'code':
      return (
        <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
          <code>{block.text}</code>
        </pre>
      );
    case 'video':
      return (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
          🎬 Video: “{block.query}”
        </p>
      );
    case 'mcq':
      return (
        <div className="card p-4">
          <p className="font-medium">{block.question}</p>
          <ol className="mt-2 list-[upper-alpha] space-y-1 pl-6 text-sm">
            {block.options.map((option) => (
              <li key={option}>{option}</li>
            ))}
          </ol>
        </div>
      );
    default:
      return null;
  }
}
