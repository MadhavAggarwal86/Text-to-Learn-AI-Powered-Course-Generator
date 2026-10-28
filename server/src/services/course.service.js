import mongoose from 'mongoose';
import { Course, CourseModule, Lesson } from '../models/index.js';
import { deleteLessonAudio } from './audioStore.js';

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
 * Lesson content is left out: the course page only needs titles. Pass `creator` to only
 * match a course that user owns.
 */
export async function getCourseTree(courseId, { creator } = {}) {
  return Course.findOne({ _id: courseId, ...(creator && { creator }) }).populate({
    path: 'modules',
    options: { sort: { order: 1 } },
    populate: {
      path: 'lessons',
      select: 'title order isEnriched completedAt quizResult',
      options: { sort: { order: 1 } },
    },
  });
}

const MAX_LISTED_COURSES = 50;

/**
 * A user's courses, newest first, with lesson progress for the course cards:
 * `lessonCount` and `generatedCount` (lessons opened at least once).
 */
export async function listCourses(creator) {
  const courses = await Course.find({ creator })
    .sort({ createdAt: -1 })
    .limit(MAX_LISTED_COURSES)
    .select('title description difficulty tags modules createdAt updatedAt');

  const counts = await Lesson.aggregate([
    { $match: { course: { $in: courses.map((course) => course._id) } } },
    {
      $group: {
        _id: '$course',
        lessonCount: { $sum: 1 },
        generatedCount: { $sum: { $cond: ['$isEnriched', 1, 0] } },
        completedCount: {
          $sum: { $cond: [{ $ne: [{ $ifNull: ['$completedAt', null] }, null] }, 1, 0] },
        },
      },
    },
  ]);
  const countsByCourse = new Map(counts.map((c) => [String(c._id), c]));

  return courses.map((course) => {
    const { modules, ...json } = course.toJSON();
    const count = countsByCourse.get(course.id);
    return {
      ...json,
      moduleCount: modules.length,
      lessonCount: count?.lessonCount ?? 0,
      generatedCount: count?.generatedCount ?? 0,
      completedCount: count?.completedCount ?? 0,
    };
  });
}

/**
 * Deletes a course and all of its modules, lessons and their stored audio. Safe to call on
 * partial trees.
 */
export async function deleteCourseTree(courseId) {
  const lessonIds = await Lesson.find({ course: courseId }).distinct('_id');
  await deleteLessonAudio(lessonIds);

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
