import { useEffect, useState } from 'react';
import { useHealth } from '../../hooks/queries.js';
import LoadingSpinner from './LoadingSpinner.jsx';

const SLOW_AFTER_MS = 3000;

/**
 * Pings the API once on load. Silent when the server answers quickly; explains the wait
 * when it is slow (Render's free tier sleeps and takes up to a minute to wake), and
 * offers a retry when it can't be reached.
 */
export default function ServerStatusBanner() {
  const { isPending, isError, refetch, isFetching } = useHealth();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, []);

  if (isPending && slow) {
    return (
      <div className="banner border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <LoadingSpinner label="Waking up the server. The first request can take up to a minute…" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="banner border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <span>Can&apos;t reach the server right now.</span>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="ml-3 font-medium underline disabled:opacity-60"
        >
          {isFetching ? 'Retrying…' : 'Retry'}
        </button>
      </div>
    );
  }

  return null;
}
