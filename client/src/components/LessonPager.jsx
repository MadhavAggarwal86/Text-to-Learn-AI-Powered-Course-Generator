import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/** Previous / next lesson links (they continue across module boundaries). */
export default function LessonPager({ previous, next }) {
  return (
    <nav
      aria-label="Lesson navigation"
      className="mt-10 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2 dark:border-slate-800"
    >
      {previous ? (
        <Link to={previous.path} className="card flex items-center gap-3 p-4 hover:shadow-md">
          <ChevronLeft className="h-5 w-5 shrink-0 text-slate-400" />
          <span>
            <span className="block text-xs text-slate-500">Previous</span>
            <span className="font-medium">{previous.lesson.title}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link
          to={next.path}
          className="card flex items-center justify-end gap-3 p-4 text-right hover:shadow-md"
        >
          <span>
            <span className="block text-xs text-slate-500">Next</span>
            <span className="font-medium">{next.lesson.title}</span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" />
        </Link>
      )}
    </nav>
  );
}
