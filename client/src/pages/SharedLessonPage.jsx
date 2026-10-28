import { ExternalLink, Link2, Target } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import LessonPager from '../components/LessonPager.jsx';
import LessonRenderer from '../components/LessonRenderer.jsx';
import LessonPDFExporter from '../components/pdf/LessonPDFExporter.jsx';
import { PublicViewContext } from '../context/PublicView.jsx';
import { useSharedCourse, useSharedLesson } from '../hooks/queries.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { getErrorMessage, getErrorStatus } from '../utils/api.js';
import { locateLesson, sharedCoursePath } from '../utils/courseNav.js';
import NotFound from './NotFound.jsx';

/**
 * A lesson of a shared course, read-only: the quiz works but isn't saved, and audio,
 * regeneration and progress (which need the owner's account) aren't offered. Videos come
 * from the public cache-only lookup (PublicViewContext).
 */
export default function SharedLessonPage() {
  const { shareId, moduleNumber, lessonNumber } = useParams();
  const base = sharedCoursePath(shareId);
  const course = useSharedCourse(shareId);
  const position = course.data ? locateLesson(course.data, moduleNumber, lessonNumber, base) : null;
  const lesson = useSharedLesson(shareId, position?.lesson.isEnriched ? position.lesson.id : null);
  useDocumentTitle(position?.lesson.title);

  if (course.isPending) return <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />;
  if (course.isError && [400, 404].includes(getErrorStatus(course.error))) {
    return <NotFound what="shared course" />;
  }
  if (course.isError) {
    return <ErrorMessage message={getErrorMessage(course.error)} onRetry={course.refetch} />;
  }
  if (!position) return <NotFound what="lesson" />;

  return (
    <PublicViewContext.Provider value>
      <article className="mx-auto max-w-3xl">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
          <Link to={base} className="hover:text-indigo-600 dark:hover:text-indigo-400">
            <Link2 className="mr-1 inline h-3.5 w-3.5" />
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
            <div className="mt-4">
              <LessonPDFExporter
                courseTitle={course.data.title}
                position={position}
                lesson={lesson.data}
              />
            </div>
          )}
        </header>

        <div className="mt-6">
          {!position.lesson.isEnriched && (
            <p className="card p-6 text-center text-slate-500 dark:text-slate-400">
              This lesson hasn&apos;t been written yet.
            </p>
          )}
          {lesson.isPending && position.lesson.isEnriched && (
            <Skeleton className="h-64 rounded-xl" />
          )}
          {lesson.isError && (
            <ErrorMessage message={getErrorMessage(lesson.error)} onRetry={lesson.refetch} />
          )}
          {lesson.data && <SharedLessonBody lesson={lesson.data} />}
        </div>

        <LessonPager previous={position.previous} next={position.next} />
      </article>
    </PublicViewContext.Provider>
  );
}

function SharedLessonBody({ lesson }) {
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
      </section>

      <div className="mt-8">
        <LessonRenderer content={lesson.content} />
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
    </>
  );
}
