import { PlayCircle, Trash2 } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import LessonStatusIcon from '../components/LessonStatusIcon.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import ShareCourse from '../components/ShareCourse.jsx';
import { useCourse, useDeleteCourse } from '../hooks/queries.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { getErrorMessage, getErrorStatus } from '../utils/api.js';
import { countProgress, lessonPath, nextLessonToStudy } from '../utils/courseNav.js';
import { capitalize, difficultyBadgeClass, pluralize } from '../utils/format.js';
import NotFound from './NotFound.jsx';

export default function CoursePage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { data: course, isPending, isError, error, refetch } = useCourse(courseId);
  const remove = useDeleteCourse();
  useDocumentTitle(course?.title);

  if (isPending) return <CourseSkeleton />;
  if (isError && [400, 404].includes(getErrorStatus(error))) return <NotFound what="course" />;
  if (isError) return <ErrorMessage message={getErrorMessage(error)} onRetry={refetch} />;

  const { total, completed, opened } = countProgress(course);
  const next = nextLessonToStudy(course);

  function handleDelete() {
    if (window.confirm(`Delete "${course.title}"? This can't be undone.`)) {
      remove.mutate(course.id, { onSuccess: () => navigate('/') });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header>
        <div className="flex flex-wrap gap-2">
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
          {pluralize(course.modules.length, 'module')} · {pluralize(total, 'lesson')}
        </p>
        <ProgressBar completed={completed} opened={opened} total={total} />

        <div className="mt-6 flex flex-wrap gap-3">
          {next && (
            <Link to={next.path} className="btn-primary">
              <PlayCircle className="h-4 w-4" />
              {opened === 0 ? 'Start learning' : 'Continue learning'}
            </Link>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={remove.isPending}
            className="btn-secondary hover:text-red-600"
          >
            <Trash2 className="h-4 w-4" />
            {remove.isPending ? 'Deleting…' : 'Delete course'}
          </button>
          <ShareCourse course={course} />
        </div>
        {remove.isError && (
          <div className="mt-4">
            <ErrorMessage
              message={`Couldn't delete the course: ${getErrorMessage(remove.error)}`}
            />
          </div>
        )}
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
                  <Link
                    to={lessonPath(course.id, m + 1, l + 1)}
                    className="flex items-center gap-3 py-2.5 text-sm hover:text-indigo-700 dark:hover:text-indigo-300"
                  >
                    <LessonStatusIcon lesson={lesson} />
                    <span className="text-slate-400 tabular-nums">
                      {m + 1}.{l + 1}
                    </span>
                    <span>{lesson.title}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </div>
  );
}

function CourseSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-16" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-40 rounded-xl" />
    </div>
  );
}
