import { describe, expect, it } from 'vitest';
import { Course, CourseModule, Lesson } from '../src/models/index.js';
import {
  createCourseTree,
  deleteCourseTree,
  getCourseTree,
} from '../src/services/course.service.js';
import { useTestDB } from './helpers/db.js';
import { CREATOR, makeOutline } from './helpers/fixtures.js';

useTestDB();

const newCourse = (outline = makeOutline({ moduleCount: 3, lessonsPerModule: 4 })) =>
  createCourseTree({
    outline,
    creator: CREATOR,
    prompt: 'Machine learning',
    difficulty: 'beginner',
  });

async function counts() {
  const [courses, modules, lessons] = await Promise.all([
    Course.countDocuments(),
    CourseModule.countDocuments(),
    Lesson.countDocuments(),
  ]);
  return { courses, modules, lessons };
}

describe('createCourseTree', () => {
  it('saves the course, its modules and lesson stubs', async () => {
    await newCourse();

    expect(await counts()).toEqual({ courses: 1, modules: 3, lessons: 12 });
  });

  it('returns the tree with modules and lessons populated in order', async () => {
    const course = await newCourse();

    expect(course.title).toBe('Introduction to Machine Learning');
    expect(course.creator).toBe(CREATOR);
    expect(course.modules.map((m) => m.title)).toEqual(['Module 1', 'Module 2', 'Module 3']);
    expect(course.modules[1].lessons.map((l) => l.title)).toEqual([
      'Lesson 2.1',
      'Lesson 2.2',
      'Lesson 2.3',
      'Lesson 2.4',
    ]);
    expect(course.modules[1].lessons.every((l) => l.isEnriched === false)).toBe(true);
  });

  it('links every lesson to both its module and its course', async () => {
    const course = await newCourse();
    const module = course.modules[2];

    const lessons = await Lesson.find({ module: module.id });
    expect(lessons).toHaveLength(4);
    expect(lessons.every((l) => l.course.equals(course._id))).toBe(true);
  });

  it('leaves nothing behind when the course itself is invalid', async () => {
    const outline = { ...makeOutline(), title: '' };

    await expect(newCourse(outline)).rejects.toThrow(/title/);
    expect(await counts()).toEqual({ courses: 0, modules: 0, lessons: 0 });
  });

  it('rolls back the course and modules when a lesson fails to save', async () => {
    const outline = makeOutline();
    outline.modules[2].lessons[1] = ''; // lesson title is required

    await expect(newCourse(outline)).rejects.toThrow();
    expect(await counts()).toEqual({ courses: 0, modules: 0, lessons: 0 });
  });
});

describe('getCourseTree', () => {
  it('does not include lesson content in the course outline', async () => {
    const { id } = await newCourse();

    const lesson = (await getCourseTree(id)).modules[0].lessons[0].toJSON();
    // Titles and progress only: the course page doesn't need the (large) lesson content.
    expect(Object.keys(lesson).sort()).toEqual([
      'completedAt',
      'id',
      'isEnriched',
      'order',
      'quizResult',
      'title',
    ]);
  });

  it('returns null for a course that does not exist', async () => {
    expect(await getCourseTree('000000000000000000000000')).toBeNull();
  });
});

describe('deleteCourseTree', () => {
  it('deletes the whole tree and reports what it removed', async () => {
    const { id } = await newCourse();

    expect(await deleteCourseTree(id)).toEqual({ courses: 1, modules: 3, lessons: 12 });
    expect(await counts()).toEqual({ courses: 0, modules: 0, lessons: 0 });
  });

  it('leaves other courses untouched', async () => {
    const keep = await newCourse();
    const remove = await newCourse();

    await deleteCourseTree(remove.id);

    expect(await counts()).toEqual({ courses: 1, modules: 3, lessons: 12 });
    expect(await getCourseTree(keep.id)).not.toBeNull();
  });
});
