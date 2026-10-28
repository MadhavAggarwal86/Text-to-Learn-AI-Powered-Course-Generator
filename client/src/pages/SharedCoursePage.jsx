import { Circle, Link2, PlayCircle, Sparkles } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import { useSharedCourse } from '../hooks/queries.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { getErrorMessage, getErrorStatus } from '../utils/api.js';
import { flattenLessons, lessonPath, sharedCoursePath } from '../utils/courseNav.js';
import { capitalize, difficultyBadgeClass, pluralize } from '../utils/format.js';
import NotFound from './NotFound.jsx';

/** A course someone shared: read-only, open to anyone with the link. */
export default function SharedCoursePage() {
  const { shareId } = useParams();
  const { data: course, isPending, isError, error, refetch } = useSharedCourse(shareId);
  useDocumentTitle(course?.title);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-16" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (isError && [400, 404].includes(getErrorStatus(error)))
    return <NotFound what="shared course" />;
  if (isError) return <ErrorMessage message={getErrorMessage(error)} onRetry={refetch} />;

  const base = sharedCoursePath(shareId);
  const readable = flattenLessons(course, base).filter((entry) => entry.lesson.isEnriched);

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <p className="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
          <Link2 className="mr-1 h-3 w-3" />
          Shared course · read-only
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`badge ${difficultyBadgeClass(course.difficulty)}`}>
            {capitalize(course.difficulty)}
          </span>
          {course.tags.map((tag) => (
            <span
              key={tag}
              className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              #{tag}
            </span>
          ))}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">{course.title}</h1>
        <p className="mt-3 text-lg text-slate-600 dark:text-slate-400">{course.description}</p>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          {pluralize(course.modules.length, 'module')} · {pluralize(readable.length, 'lesson')}{' '}
          available to read
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {readable[0] && (
            <Link to={readable[0].path} className="btn-primary">
              <PlayCircle className="h-4 w-4" />
              Start reading
            </Link>
          )}
          <Link to="/" className="btn-secondary">
            <Sparkles className="h-4 w-4" />
            Create your own course
          </Link>
        </div>
      </header>

      <ol className="mt-10 space-y-4">
        {course.modules.map((module, m) => (
          <li key={module.id} className="card p-5">
            <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
              Module {m + 1}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{module.title}</h2>
            <ol className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {module.lessons.map((lesson, l) => (
                <li key={lesson.id}>
                  {lesson.isEnriched ? (
                    <Link
                      to={lessonPath(course.id, m + 1, l + 1, base)}
                      className="flex items-center gap-3 py-2.5 text-sm hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      <PlayCircle className="h-4 w-4 shrink-0 text-indigo-500" />
                      <span className="text-slate-400 tabular-nums">
                        {m + 1}.{l + 1}
                      </span>
                      <span>{lesson.title}</span>
                    </Link>
                  ) : (
                    <span className="flex items-center gap-3 py-2.5 text-sm text-slate-400 dark:text-slate-500">
                      <Circle className="h-4 w-4 shrink-0 opacity-40" />
                      <span className="tabular-nums">
                        {m + 1}.{l + 1}
                      </span>
                      <span>{lesson.title}</span>
                      <span className="ml-auto text-xs">not written yet</span>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}
