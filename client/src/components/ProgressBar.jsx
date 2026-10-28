/**
 * Course progress: completed lessons (solid) and lessons opened but not finished (light),
 * with a one-line summary. Used on the course page and the course cards.
 */
export default function ProgressBar({ completed, opened, total, compact = false }) {
  const percent = (n) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className={compact ? 'mt-2' : 'mt-4'}>
      <div
        className={`flex overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 ${compact ? 'h-1.5' : 'h-2.5'}`}
        role="progressbar"
        aria-label="Lessons completed"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <div className="bg-emerald-500" style={{ width: `${percent(completed)}%` }} />
        <div
          className="bg-indigo-300 dark:bg-indigo-700"
          style={{ width: `${percent(opened - completed)}%` }}
        />
      </div>
      <p className={`mt-1.5 text-slate-500 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
        {completed} of {total} lessons completed ({percent(completed)}%)
        {opened > completed && ` · ${opened - completed} in progress`}
      </p>
    </div>
  );
}
