import { Course, CourseModule, Lesson } from '../models/index.js';
import { generateLessonContent } from './ai.service.js';
import { deleteLessonAudio } from './audioStore.js';

// Lessons being generated right now, by id. If the same lesson is requested again while
// its generation is running (double click, two tabs, React StrictMode), the second
// request waits for the first instead of paying for another AI call. This covers a single
// server instance; the conditional update below protects the data if there are several.
const inFlight = new Map();

/** The lesson and its course, or null if it doesn't exist or `creator` doesn't own it. */
export async function findOwnedLesson(lessonId, creator) {
  const lesson = await Lesson.findById(lessonId);
  if (!lesson) return null;

  const course = await Course.findOne({ _id: lesson.course, creator }).select('title difficulty');
  return course ? { lesson, course } : null;
}

async function generateAndSave({ lesson, course }, { overwrite }) {
  const module = await CourseModule.findById(lesson.module)
    .select('title lessons')
    .populate({ path: 'lessons', select: 'title', options: { sort: { order: 1 } } });

  const generated = await generateLessonContent({
    courseTitle: course.title,
    moduleTitle: module.title,
    lessonTitle: lesson.title,
    difficulty: course.difficulty,
    siblingLessons: module.lessons.map((sibling) => sibling.title),
  });

  // The outline's lesson title is kept: the course page already shows it.
  const update = {
    objectives: generated.objectives,
    keyTopics: generated.keyTopics,
    content: generated.content,
    resources: generated.resources,
    isEnriched: true,
  };
  // Lazy generation only fills an empty lesson; if another instance got there first,
  // its content wins and is returned.
  const filter = overwrite ? { _id: lesson._id } : { _id: lesson._id, isEnriched: false };
  const saved = await Lesson.findOneAndUpdate(
    filter,
    { $set: update },
    { returnDocument: 'after', runValidators: true },
  );
  return saved ?? Lesson.findById(lesson._id);
}

function generateOnce(owned) {
  const key = owned.lesson.id;
  if (!inFlight.has(key)) {
    const promise = generateAndSave(owned, { overwrite: false }).finally(() =>
      inFlight.delete(key),
    );
    inFlight.set(key, promise);
  }
  return inFlight.get(key);
}

/**
 * A lesson with its full content. The first time a lesson is opened its content is
 * generated and saved (lazy enrichment); after that it is read straight from the database.
 * Returns null if the lesson doesn't exist or belongs to someone else.
 */
export async function getOrGenerateLesson(lessonId, creator) {
  const owned = await findOwnedLesson(lessonId, creator);
  if (!owned) return null;
  if (owned.lesson.isEnriched) return owned.lesson;
  return generateOnce(owned);
}

/** Replaces a lesson's content with a freshly generated version. */
export async function regenerateLesson(lessonId, creator) {
  const owned = await findOwnedLesson(lessonId, creator);
  if (!owned) return null;
  const lesson = await generateAndSave(owned, { overwrite: true });
  // The old audio explains the old content; free its storage now rather than on next play.
  await deleteLessonAudio([lesson._id]);
  return lesson;
}
