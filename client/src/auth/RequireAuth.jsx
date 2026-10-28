import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { useAuth } from './AuthProvider.jsx';

/** Renders its children only for signed-in users; sends everyone else to Auth0's login. */
export default function RequireAuth({ children }) {
  const { isLoading, isAuthenticated, login } = useAuth();
  const location = useLocation();
  const returnTo = location.pathname + location.search;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) login(returnTo);
  }, [isLoading, isAuthenticated, login, returnTo]);

  if (isAuthenticated) return children;
  return (
    <div className="py-20 text-center text-slate-500 dark:text-slate-400">
      <LoadingSpinner label={isLoading ? 'Checking your session…' : 'Redirecting to log in…'} />
    </div>
  );
}
