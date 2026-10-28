import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import Skeleton from './components/common/Skeleton.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import CoursePage from './pages/CoursePage.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';
import SharedCoursePage from './pages/SharedCoursePage.jsx';

// Lesson pages carry the syntax highlighter, so they load only when a lesson is opened.
const LessonPage = lazy(() => import('./pages/LessonPage.jsx'));
const SharedLessonPage = lazy(() => import('./pages/SharedLessonPage.jsx'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route
            path="courses/:courseId"
            element={
              <RequireAuth>
                <CoursePage />
              </RequireAuth>
            }
          />
          <Route
            path="courses/:courseId/module/:moduleNumber/lesson/:lessonNumber"
            element={
              <RequireAuth>
                <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />}>
                  <LessonPage />
                </Suspense>
              </RequireAuth>
            }
          />
          {/* Shared courses: public and read-only, no login needed. */}
          <Route path="share/:shareId" element={<SharedCoursePage />} />
          <Route
            path="share/:shareId/module/:moduleNumber/lesson/:lessonNumber"
            element={
              <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />}>
                <SharedLessonPage />
              </Suspense>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

/** Start each new page at the top (React Router keeps the old scroll position). */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
