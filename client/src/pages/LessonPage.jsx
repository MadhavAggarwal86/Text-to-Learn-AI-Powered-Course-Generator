import { ChevronLeft, ChevronRight, ExternalLink, RefreshCw, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import AudioExplainer from '../components/AudioExplainer.jsx';
import LessonRenderer from '../components/LessonRenderer.jsx';
import LessonPDFExporter from '../components/pdf/LessonPDFExporter.jsx';
import { useCourse, useLesson, useRegenerateLesson } from '../hooks/queries.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { getErrorMessage, getErrorStatus } from '../utils/api.js';
import { locateLesson } from '../utils/courseNav.js';
import NotFound from './NotFound.jsx';

export default function LessonPage() {
  const { courseId, moduleNumber, lessonNumber } = useParams();
  const course = useCourse(courseId);
  const position = course.data ? locateLesson(course.data, moduleNumber, lessonNumber) : null;
  const lesson = useLesson(position?.lesson.id, courseId);
  useDocumentTitle(position?.lesson.title);

  if (course.isPending) return <LessonSkeleton />;
  if (course.isError && [400, 404].includes(getErrorStatus(course.error))) {
    return <NotFound what="course" />;
  }
  if (course.isError) {
    return <ErrorMessage message={getErrorMessage(course.error)} onRetry={course.refetch} />;
  }
  if (!position) return <NotFound what="lesson" />;

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
        <Link
          to={`/courses/${courseId}`}
          className="hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {course.data.title}
        </Link>
        <span className="mx-2">›</span>
        <span>
          Module {position.moduleNumber}: {position.module.title}
        </span>
      </nav>

      <header className="mt-3">
        <p className="text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:text-indigo-400">
          Lesson {position.index + 1} of {position.total}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">{position.lesson.title}</h1>
        {lesson.data && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <LessonPDFExporter
              courseTitle={course.data.title}
              position={position}
              lesson={lesson.data}
            />
            {/* Keyed by version so a regenerated lesson starts with a fresh player. */}
            <AudioExplainer
              key={`${lesson.data.id}-${lesson.data.updatedAt}`}
              lesson={lesson.data}
            />
          </div>
        )}
      </header>

      <div className="mt-6">
        {lesson.isPending && <LessonGenerating firstTime={!position.lesson.isEnriched} />}
        {lesson.isError && (
          <ErrorMessage message={getErrorMessage(lesson.error)} onRetry={lesson.refetch} />
        )}
        {lesson.data && <LessonBody lesson={lesson.data} />}
      </div>

      <LessonPager previous={position.previous} next={position.next} />
    </article>
  );
}

function LessonBody({ lesson }) {
  const regenerate = useRegenerateLesson();

  function handleRegenerate() {
    if (window.confirm('Replace this lesson with a newly generated version?')) {
      regenerate.mutate(lesson.id);
    }
  }

  return (
    <>
      <section className="card p-5" aria-labelledby="objectives">
        <h2 id="objectives" className="flex items-center gap-2 font-semibold">
          <Target className="h-4 w-4 text-indigo-500" />
          What you&apos;ll learn
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
          {lesson.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {lesson.keyTopics.map((topic) => (
            <span
              key={topic}
              className="badge bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
            >
              {topic}
            </span>
          ))}
        </div>
      </section>

      <div className="mt-8">
        {/* Keyed by version so the quiz resets after the lesson is regenerated. */}
        <LessonRenderer key={`${lesson.id}-${lesson.updatedAt}`} content={lesson.content} />
      </div>

      {lesson.resources.length > 0 && (
        <section className="mt-10" aria-labelledby="resources">
          <h2 id="resources" className="text-lg font-semibold">
            Further reading
          </h2>
          <ul className="mt-3 space-y-2">
            {lesson.resources.map((resource) => (
              <li key={resource.url}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-indigo-600 hover:underline dark:text-indigo-400"
                >
                  {resource.title}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6 dark:border-slate-800">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerate.isPending}
          className="btn-secondary"
        >
          <RefreshCw className={`h-4 w-4 ${regenerate.isPending ? 'animate-spin' : ''}`} />
          {regenerate.isPending ? 'Regenerating…' : 'Regenerate lesson'}
        </button>
        {regenerate.isError && (
          <span className="text-sm text-red-600 dark:text-red-400">
            {getErrorMessage(regenerate.error)}
          </span>
        )}
      </div>
    </>
  );
}

function LessonGenerating({ firstTime }) {
  return (
    <div aria-busy="true">
      {firstTime && (
        <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          <LoadingSpinner label="Writing this lesson for you. This usually takes about 10 seconds…" />
        </p>
      )}
      <div className="space-y-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    </div>
  );
}

function LessonPager({ previous, next }) {
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

function LessonSkeleton() {
  return (
    <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-4" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}
