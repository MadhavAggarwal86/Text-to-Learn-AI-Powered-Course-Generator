export default function ErrorMessage({ message, onRetry }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-600 px-3 py-1 font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      )}
    </div>
  );
}
