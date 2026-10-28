import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SharedCoursePage from '../pages/SharedCoursePage.jsx';
import { renderWithQuery } from '../test/render.jsx';
import { fetchSharedCourse, setCourseShared } from '../utils/api.js';
import { flattenLessons, locateLesson, sharedCoursePath } from '../utils/courseNav.js';
import ShareCourse from './ShareCourse.jsx';

vi.mock('../utils/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  setCourseShared: vi.fn(),
  fetchSharedCourse: vi.fn(),
}));

const SHARE_ID = 'AbCdEfGhIjKlMnOpQrStUv';

beforeEach(() => {
  setCourseShared.mockReset();
  fetchSharedCourse.mockReset();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareCourse', () => {
  it('creates a link on request', async () => {
    const user = userEvent.setup();
    setCourseShared.mockResolvedValue({ shareId: SHARE_ID });
    renderWithQuery(<ShareCourse course={{ id: 'c1' }} />);

    await user.click(screen.getByRole('button', { name: 'Share' }));

    expect(setCourseShared).toHaveBeenCalledWith('c1', true);
  });

  it('shows the link with copy, and stops sharing after confirmation', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    setCourseShared.mockResolvedValue({ shareId: null });
    renderWithQuery(<ShareCourse course={{ id: 'c1', shareId: SHARE_ID }} />);

    expect(screen.getByLabelText('Share link')).toHaveValue(
      `${window.location.origin}/share/${SHARE_ID}`,
    );
    await user.click(screen.getByRole('button', { name: /copy link/i }));
    expect(await navigator.clipboard.readText()).toBe(
      `${window.location.origin}/share/${SHARE_ID}`,
    );
    expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Stop sharing' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(setCourseShared).toHaveBeenCalledWith('c1', false);
  });
});

describe('SharedCoursePage', () => {
  it('links only the lessons the owner has written', async () => {
    fetchSharedCourse.mockResolvedValue({
      id: 'c1',
      title: 'Mastering React Hooks',
      description: 'Hooks from basics to patterns.',
      difficulty: 'beginner',
      tags: ['react'],
      shareId: SHARE_ID,
      modules: [
        {
          id: 'm1',
          title: 'Basics',
          lessons: [
            { id: 'l1', title: 'What is state?', isEnriched: true },
            { id: 'l2', title: 'useEffect', isEnriched: false },
          ],
        },
      ],
    });
    renderWithQuery(
      <MemoryRouter initialEntries={[`/share/${SHARE_ID}`]}>
        <Routes>
          <Route path="/share/:shareId" element={<SharedCoursePage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Mastering React Hooks')).toBeInTheDocument();
    expect(screen.getByText('Shared course · read-only')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /What is state\?/ })).toHaveAttribute(
      'href',
      `/share/${SHARE_ID}/module/1/lesson/1`,
    );
    expect(screen.queryByRole('link', { name: /useEffect/ })).toBeNull();
    expect(screen.getByText('not written yet')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start reading/i })).toHaveAttribute(
      'href',
      `/share/${SHARE_ID}/module/1/lesson/1`,
    );
  });
});

describe('course navigation under a shared link', () => {
  const course = {
    id: 'c1',
    modules: [{ id: 'm1', title: 'A', lessons: [{ id: 'l1' }, { id: 'l2' }] }],
  };

  it('builds /share/... paths when given the shared base path', () => {
    const base = sharedCoursePath(SHARE_ID);

    expect(flattenLessons(course, base)[1].path).toBe(`/share/${SHARE_ID}/module/1/lesson/2`);
    expect(locateLesson(course, 1, 1, base).next.path).toBe(`/share/${SHARE_ID}/module/1/lesson/2`);
    expect(flattenLessons(course)[0].path).toBe('/courses/c1/module/1/lesson/1');
  });
});
