import { CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// The server does one AI call for the outline, so these stages are paced by time rather
// than real progress. They tell the user what is happening during a 3-10 second wait.
const STAGES = [
  'Understanding your topic',
  'Designing the modules',
  'Ordering lessons from basics to advanced',
  'Saving your course',
];
const STAGE_MS = 1800;

export default function GenerationProgress({ topic }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(
      () => setStage((current) => Math.min(current + 1, STAGES.length - 1)),
      STAGE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="card mt-6 p-6 text-left" role="status" aria-live="polite">
      <p className="font-medium">
        Building your course on{' '}
        <span className="text-indigo-600 dark:text-indigo-400">{topic}</span>
      </p>
      <ol className="mt-4 space-y-2">
        {STAGES.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 text-sm ${i > stage ? 'text-slate-400 dark:text-slate-600' : ''}`}
          >
            {i < stage ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            ) : i === stage ? (
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
            ) : (
              <span className="h-4 w-4 rounded-full border border-current" />
            )}
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
