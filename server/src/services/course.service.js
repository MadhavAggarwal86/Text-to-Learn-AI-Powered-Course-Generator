import mongoose from 'mongoose';
import { Course, CourseModule, Lesson } from '../models/index.js';

/**
 * Saves a generated course outline as Course → Modules → Lesson stubs.
 *
 * `outline` is the shape the AI outline step returns (Phase 2):
 *   { title, description, tags, modules: [{ title, lessons: ['Lesson title', ...] }] }
 *
 * Ids are created up front so every document can reference the others, which lets the
 * whole tree be written in three inserts. Atlas free tier supports transactions but the
 * in-memory test server does not, so a failure part-way is rolled back by deleting
 * whatever was written.
 */
export async function createCourseTree({ outline, creator, prompt, difficulty }) {
  const courseId = new mongoose.Types.ObjectId();
  const moduleDocs = [];
  const lessonDocs = [];

  outline.modules.forEach((mod, moduleIndex) => {
    const moduleId = new mongoose.Types.ObjectId();
    const lessonIds = mod.lessons.map((lessonTitle, lessonIndex) => {
      const lessonId = new mongoose.Types.ObjectId();
      lessonDocs.push({
        _id: lessonId,
        title: lessonTitle,
        order: lessonIndex,
        module: moduleId,
        course: courseId,
      });
      return lessonId;
    });
    moduleDocs.push({
      _id: moduleId,
      title: mod.title,
      order: moduleIndex,
      course: courseId,
      lessons: lessonIds,
    });
  });

  try {
    // Course first: if its validation fails, nothing else has been written yet.
    await Course.create({
      _id: courseId,
      title: outline.title,
      description: outline.description,
      tags: outline.tags,
      prompt,
      difficulty,
      creator,
      modules: moduleDocs.map((m) => m._id),
    });
    await CourseModule.insertMany(moduleDocs);
    await Lesson.insertMany(lessonDocs);
  } catch (err) {
    await deleteCourseTree(courseId);
    throw err;
  }

  return getCourseTree(courseId);
}

/**
 * A course with its modules (in order) and each module's lesson summaries (in order).
 * Lesson content is left out: the course page only needs titles.
 */
export async function getCourseTree(courseId) {
  return Course.findById(courseId).populate({
    path: 'modules',
    options: { sort: { order: 1 } },
    populate: {
      path: 'lessons',
      select: 'title order isEnriched',
      options: { sort: { order: 1 } },
    },
  });
}

/** Deletes a course and all of its modules and lessons. Safe to call on partial trees. */
export async function deleteCourseTree(courseId) {
  const [lessons, modules, course] = await Promise.all([
    Lesson.deleteMany({ course: courseId }),
    CourseModule.deleteMany({ course: courseId }),
    Course.deleteOne({ _id: courseId }),
  ]);

  return {
    courses: course.deletedCount,
    modules: modules.deletedCount,
    lessons: lessons.deletedCount,
  };
}
