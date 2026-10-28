import { useEffect } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout.jsx';
import CoursePage from './pages/CoursePage.jsx';
import Home from './pages/Home.jsx';
import LessonPage from './pages/LessonPage.jsx';
import NotFound from './pages/NotFound.jsx';

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
            element={<LessonPage />}
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
