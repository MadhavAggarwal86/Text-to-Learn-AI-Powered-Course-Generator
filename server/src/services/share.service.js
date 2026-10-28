import { randomBytes } from 'node:crypto';
import { Course, Lesson } from '../models/index.js';
import { getCourseTree } from './course.service.js';

// Read-only public links to a course. Visitors see the course and the lessons the owner has
// already opened; they never trigger AI generation (it would spend the owner's quota) and
// never see the owner's id or progress.

/** 16 random bytes → 22 URL-safe characters: unguessable. */
const newShareId = () => randomBytes(16).toString('base64url');

/** Turns sharing on (keeping an existing link) or off. Returns the share id, or null. */
export async function setCourseShared(courseId, creator, shared) {
  const course = await Course.findOne({ _id: courseId, creator }).select('shareId');
  if (!course) return undefined;

  if (!shared) {
    await Course.updateOne({ _id: course._id }, { $unset: { shareId: 1 } });
    return null;
  }
  if (course.shareId) return course.shareId;

  const shareId = newShareId();
  await Course.updateOne({ _id: course._id }, { $set: { shareId } });
  return shareId;
}

const PUBLIC_COURSE_FIELDS = ['id', 'title', 'description', 'difficulty', 'tags', 'shareId'];

/** The shared course's outline, without owner or progress data; null if not shared. */
export async function getSharedCourse(shareId) {
  const found = await Course.findOne({ shareId }).select('_id');
  if (!found) return null;

  const tree = (await getCourseTree(found._id)).toJSON();
  const course = Object.fromEntries(PUBLIC_COURSE_FIELDS.map((key) => [key, tree[key]]));
  course.modules = tree.modules.map((module) => ({
    id: module.id,
    title: module.title,
    order: module.order,
    lessons: module.lessons.map(({ id, title, order, isEnriched }) => ({
      id,
      title,
      order,
      isEnriched,
    })),
  }));
  return course;
}

/**
 * A lesson of a shared course, without the owner's progress. Throws-free: returns
 * { lesson } when readable, { notGenerated: true } if the owner hasn't opened it yet,
 * or null if the course isn't shared or the lesson isn't part of it.
 */
export async function getSharedLesson(shareId, lessonId) {
  const course = await Course.findOne({ shareId }).select('_id');
  if (!course) return null;

  const lesson = await Lesson.findOne({ _id: lessonId, course: course._id }).select(
    '-completedAt -quizResult',
  );
  if (!lesson) return null;
  if (!lesson.isEnriched) return { notGenerated: true };
  return { lesson };
}
