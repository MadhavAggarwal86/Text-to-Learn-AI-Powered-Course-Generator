import { describe, expect, it } from 'vitest';
import {
  countGenerated,
  flattenLessons,
  lessonPath,
  locateLesson,
  nextLessonToStudy,
} from './courseNav.js';

// Two modules: 2 lessons, then 3 lessons. Lesson 1.1 has been opened.
const course = {
  id: 'c1',
  modules: [
    {
      id: 'm1',
      title: 'Basics',
      lessons: [
        { id: 'l11', title: 'One', isEnriched: true },
        { id: 'l12', title: 'Two', isEnriched: false },
      ],
    },
    {
      id: 'm2',
      title: 'More',
      lessons: [
        { id: 'l21', title: 'Three', isEnriched: false },
        { id: 'l22', title: 'Four', isEnriched: false },
        { id: 'l23', title: 'Five', isEnriched: false },
      ],
    },
  ],
};

describe('lessonPath', () => {
  it('builds 1-based lesson URLs', () => {
    expect(lessonPath('c1', 2, 3)).toBe('/courses/c1/module/2/lesson/3');
  });
});

describe('flattenLessons', () => {
  it('lists every lesson in reading order with its position', () => {
    const all = flattenLessons(course);

    expect(all.map((e) => e.lesson.id)).toEqual(['l11', 'l12', 'l21', 'l22', 'l23']);
    expect(all[2]).toMatchObject({
      moduleNumber: 2,
      lessonNumber: 1,
      path: '/courses/c1/module/2/lesson/1',
    });
  });

  it('handles a missing course', () => {
    expect(flattenLessons(undefined)).toEqual([]);
  });
});

describe('locateLesson', () => {
  it('finds a lesson from URL params (strings) with its neighbours', () => {
    const found = locateLesson(course, '2', '2');

    expect(found).toMatchObject({ index: 3, total: 5 });
    expect(found.lesson.id).toBe('l22');
    expect(found.module.id).toBe('m2');
    expect(found.previous.lesson.id).toBe('l21');
    expect(found.next.lesson.id).toBe('l23');
  });

  it('links across module boundaries', () => {
    expect(locateLesson(course, 1, 2).next.lesson.id).toBe('l21');
    expect(locateLesson(course, 2, 1).previous.lesson.id).toBe('l12');
  });

  it('has no previous on the first lesson and no next on the last', () => {
    expect(locateLesson(course, 1, 1).previous).toBeNull();
    expect(locateLesson(course, 2, 3).next).toBeNull();
  });

  it.each([
    ['3', '1'],
    ['1', '3'],
    ['0', '1'],
    ['abc', '1'],
  ])('returns null for out-of-range position module %s lesson %s', (m, l) => {
    expect(locateLesson(course, m, l)).toBeNull();
  });
});

describe('nextLessonToStudy', () => {
  it('picks the first lesson not opened yet', () => {
    expect(nextLessonToStudy(course).lesson.id).toBe('l12');
  });

  it('falls back to the first lesson when everything has been opened', () => {
    const done = {
      ...course,
      modules: course.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({ ...l, isEnriched: true })),
      })),
    };

    expect(nextLessonToStudy(done).lesson.id).toBe('l11');
  });
});

describe('countGenerated', () => {
  it('counts opened lessons', () => {
    expect(countGenerated(course)).toEqual({ total: 5, generated: 1 });
  });
});
