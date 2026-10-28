import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
      <Link
        to="/"
        className="mt-6 inline-block text-indigo-600 hover:underline dark:text-indigo-400"
      >
        Back to home
      </Link>
    </div>
  );
}
