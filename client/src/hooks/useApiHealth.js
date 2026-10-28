import { useCallback, useEffect, useState } from 'react';
import { fetchHealth, getErrorMessage } from '../utils/api.js';

const LOADING = { status: 'loading', data: null, error: null };

/** Pings the backend on mount (also wakes a sleeping Render instance). */
export function useApiHealth() {
  const [state, setState] = useState(LOADING);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;

    fetchHealth()
      .then((data) => {
        if (!ignore) setState({ status: 'ok', data, error: null });
      })
      .catch((error) => {
        if (!ignore) setState({ status: 'error', data: null, error: getErrorMessage(error) });
      });

    return () => {
      ignore = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(LOADING);
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
