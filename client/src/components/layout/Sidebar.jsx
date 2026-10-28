import { BookOpen, CheckCircle2, Circle, Plus, X } from 'lucide-react';
import { useEffect } from 'react';
import { Link, NavLink, useParams } from 'react-router-dom';
import { useCourse, useCourses } from '../../hooks/queries.js';
import { lessonPath } from '../../utils/courseNav.js';
import Skeleton from '../common/Skeleton.jsx';

/**
 * Inside a course: the course outline with the current lesson highlighted.
 * Elsewhere: the user's courses. A fixed column on large screens, a drawer below that.
 */
export default function Sidebar({ open, onClose }) {
  const { courseId } = useParams();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop for the mobile drawer */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/50 transition-opacity lg:hidden ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 lg:bg-transparent lg:dark:bg-transparent ${open ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Course navigation"
      >
        <div className="flex items-center justify-between px-4 pt-4 lg:hidden">
          <span className="font-semibold">Navigation</span>
          <button
            type="button"
            onClick={onClose}
            className="icon-button"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <Link to="/" onClick={onClose} className="btn-primary w-full justify-center">
            <Plus className="h-4 w-4" />
            New course
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-6">
          {courseId ? (
            <CourseOutlineNav courseId={courseId} onNavigate={onClose} />
          ) : (
            <MyCoursesNav onNavigate={onClose} />
          )}
        </nav>
      </aside>
    </>
  );
}

function NavSkeleton() {
  return (
    <div className="space-y-2 px-2">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-5" />
      ))}
    </div>
  );
}

const navItemClass = ({ isActive }) =>
  `flex items-start gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
    isActive
      ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
  }`;

function MyCoursesNav({ onNavigate }) {
  const { data: courses, isPending, isError } = useCourses();

  return (
    <>
      <h2 className="sidebar-heading">Your courses</h2>
      {isPending && <NavSkeleton />}
      {isError && <p className="px-2 text-sm text-slate-500">Couldn&apos;t load courses.</p>}
      {courses?.length === 0 && (
        <p className="px-2 text-sm text-slate-500">No courses yet. Generate your first one!</p>
      )}
      <ul className="space-y-0.5">
        {courses?.map((course) => (
          <li key={course.id}>
            <NavLink to={`/courses/${course.id}`} onClick={onNavigate} className={navItemClass}>
              <BookOpen className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="line-clamp-2">{course.title}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </>
  );
}

function CourseOutlineNav({ courseId, onNavigate }) {
  const { data: course, isPending, isError } = useCourse(courseId);

  if (isPending) return <NavSkeleton />;
  if (isError)
    return <p className="px-2 text-sm text-slate-500">Couldn&apos;t load this course.</p>;

  return (
    <>
      <NavLink
        to={`/courses/${course.id}`}
        end
        onClick={onNavigate}
        className={({ isActive }) =>
          `mb-3 block rounded-md px-2 py-1.5 font-semibold leading-snug ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'hover:text-indigo-700 dark:hover:text-indigo-300'}`
        }
      >
        {course.title}
      </NavLink>

      <ol className="space-y-4">
        {course.modules.map((module, m) => (
          <li key={module.id}>
            <h2 className="sidebar-heading">
              Module {m + 1} · {module.title}
            </h2>
            <ol className="space-y-0.5">
              {module.lessons.map((lesson, l) => (
                <li key={lesson.id}>
                  <NavLink
                    to={lessonPath(course.id, m + 1, l + 1)}
                    onClick={onNavigate}
                    className={navItemClass}
                  >
                    {lesson.isEnriched ? (
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500"
                        aria-label="Opened"
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 h-4 w-4 shrink-0 opacity-40"
                        aria-label="Not opened yet"
                      />
                    )}
                    <span>{lesson.title}</span>
                  </NavLink>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ol>
    </>
  );
}
