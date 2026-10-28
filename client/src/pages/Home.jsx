import ErrorMessage from '../components/common/ErrorMessage.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { useApiHealth } from '../hooks/useApiHealth.js';

const EXAMPLE_TOPICS = [
  'Intro to React Hooks',
  'Basics of Copyright Law',
  'How Photosynthesis Works',
];

export default function Home() {
  const health = useApiHealth();

  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
        Turn any topic into a <span className="text-indigo-600 dark:text-indigo-400">course</span>
      </h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">
        Type what you want to learn. Text-to-Learn builds a structured course with modules, lessons,
        videos and quizzes.
      </p>

      {/* Placeholder: the real PromptForm arrives in Phase 4. */}
      <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
        <input
          type="text"
          disabled
          placeholder="e.g. Intro to React Hooks"
          className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled
          className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white disabled:opacity-60"
        >
          Generate course
        </button>
      </form>
      <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
        {EXAMPLE_TOPICS.map((topic) => (
          <span
            key={topic}
            className="rounded-full bg-slate-200 px-3 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            {topic}
          </span>
        ))}
      </div>

      <section className="mt-12 text-sm" aria-live="polite">
        {health.status === 'loading' && (
          <LoadingSpinner label="Connecting to the API (the first request can take up to a minute)…" />
        )}
        {health.status === 'error' && (
          <ErrorMessage message={`API unreachable: ${health.error}`} onRetry={health.retry} />
        )}
        {health.status === 'ok' && (
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            API: {health.data.status} · database: {health.data.database}
          </p>
        )}
      </section>
    </div>
  );
}
