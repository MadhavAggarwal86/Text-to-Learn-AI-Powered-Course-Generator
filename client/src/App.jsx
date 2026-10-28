import { lazy, Suspense, useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import Skeleton from './components/common/Skeleton.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import CoursePage from './pages/CoursePage.jsx';
import Home from './pages/Home.jsx';
import NotFound from './pages/NotFound.jsx';

// The lesson page carries the syntax highlighter, so it loads only when a lesson is opened.
const LessonPage = lazy(() => import('./pages/LessonPage.jsx'));

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="courses/:courseId" element={<CoursePage />} />
          <Route
            path="courses/:courseId/module/:moduleNumber/lesson/:lessonNumber"
            element={
              <Suspense fallback={<Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />}>
                <LessonPage />
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
