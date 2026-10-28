import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound({ what = 'page' }) {
  useDocumentTitle('Not found');

  return (
    <div className="py-20 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-2 text-3xl font-bold">
        {what.charAt(0).toUpperCase() + what.slice(1)} not found
      </h1>
      <p className="mt-2 text-slate-600 dark:text-slate-400">
        It may have been deleted, or the link is wrong.
      </p>
      <Link to="/" className="btn-primary mt-6">
        Back to home
      </Link>
    </div>
  );
}
