import { Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { capitalize, difficultyBadgeClass, formatDate, pluralize } from '../utils/format.js';

export default function CourseCard({ course, onDelete, isDeleting }) {
  const progress = course.lessonCount ? course.generatedCount / course.lessonCount : 0;

  return (
    <article className="card group relative flex flex-col p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className={`badge ${difficultyBadgeClass(course.difficulty)}`}>
          {capitalize(course.difficulty)}
        </span>
        <button
          type="button"
          onClick={() => onDelete(course)}
          disabled={isDeleting}
          className="icon-button relative z-10 -mt-1 -mr-2 h-8 w-8 text-slate-400 hover:text-red-600 disabled:opacity-50"
          aria-label={`Delete course ${course.title}`}
          title="Delete course"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <h3 className="mt-3 font-semibold leading-snug">
        {/* The link's ::after covers the whole card, keeping the delete button separate. */}
        <Link
          to={`/courses/${course.id}`}
          className="after:absolute after:inset-0 group-hover:text-indigo-700 dark:group-hover:text-indigo-300"
        >
          {course.title}
        </Link>
      </h3>
      <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
        {course.description}
      </p>

      <div className="mt-auto pt-4">
        <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>
            {pluralize(course.moduleCount, 'module')} · {pluralize(course.lessonCount, 'lesson')}
          </span>
          <span>{formatDate(course.createdAt)}</span>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
          role="progressbar"
          aria-label="Lessons opened"
          aria-valuemin={0}
          aria-valuemax={course.lessonCount}
          aria-valuenow={course.generatedCount}
        >
          <div
            className="h-full rounded-full bg-indigo-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {course.generatedCount} of {course.lessonCount} lessons opened
        </p>
      </div>
    </article>
  );
}
