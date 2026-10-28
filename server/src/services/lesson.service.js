import { Course, CourseModule, Lesson } from '../models/index.js';
import { generateLessonContent } from './ai.service.js';
import { ApiError } from '../utils/ApiError.js';
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

  // The outline's lesson title is kept: the course page already shows it. New content
  // means new quiz questions, so any earlier quiz result no longer applies.
  const update = {
    objectives: generated.objectives,
    keyTopics: generated.keyTopics,
    content: generated.content,
    resources: generated.resources,
    isEnriched: true,
    enrichedAt: new Date(),
    quizResult: null,
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

/**
 * Identifies the current content of a lesson (changes only when it is generated or
 * regenerated, not when progress is saved). Lessons generated before `enrichedAt` existed
 * fall back to updatedAt.
 */
export const contentVersion = (lesson) => (lesson.enrichedAt ?? lesson.updatedAt).toISOString();

// Share of quiz questions to get right for the lesson to count as completed.
export const QUIZ_PASS_RATIO = 0.6;

async function findOwnedGeneratedLesson(lessonId, creator) {
  const owned = await findOwnedLesson(lessonId, creator);
  if (owned && !owned.lesson.isEnriched) {
    throw new ApiError(409, 'Open the lesson first: its content has not been generated yet.');
  }
  return owned;
}

/** Marks a lesson completed (or not). Returns the updated lesson, or null if not owned. */
export async function setLessonCompleted(lessonId, creator, completed) {
  const owned = await findOwnedGeneratedLesson(lessonId, creator);
  if (!owned) return null;
  return Lesson.findByIdAndUpdate(
    owned.lesson._id,
    { $set: { completedAt: completed ? new Date() : null } },
    { returnDocument: 'after' },
  );
}

/**
 * Grades a quiz attempt against the stored answers (the server is the source of truth for
 * the score), saves the latest and best result, and completes the lesson on a pass.
 * `answers` holds the chosen option index for each question, in order.
 */
export async function submitQuiz(lessonId, creator, answers) {
  const owned = await findOwnedGeneratedLesson(lessonId, creator);
  if (!owned) return null;
  const { lesson } = owned;

  const questions = lesson.content.filter((block) => block.type === 'mcq');
  if (questions.length === 0) throw ApiError.badRequest('This lesson has no quiz');
  if (answers.length !== questions.length) {
    throw ApiError.badRequest(`Expected ${questions.length} answers, got ${answers.length}`);
  }
  const invalid = answers.findIndex((answer, i) => answer >= questions[i].options.length);
  if (invalid !== -1) throw ApiError.badRequest(`Answer ${invalid + 1} is not one of the options`);

  const results = questions.map((question, i) => ({
    chosen: answers[i],
    answer: question.answer,
    correct: answers[i] === question.answer,
  }));
  const correct = results.filter((result) => result.correct).length;
  const previous = lesson.quizResult;
  const quizResult = {
    correct,
    total: questions.length,
    bestCorrect: Math.max(correct, previous?.bestCorrect ?? 0),
    attempts: (previous?.attempts ?? 0) + 1,
    takenAt: new Date(),
  };
  const passed = correct / questions.length >= QUIZ_PASS_RATIO;

  const update = { quizResult };
  if (passed && !lesson.completedAt) update.completedAt = new Date();
  const saved = await Lesson.findByIdAndUpdate(
    lesson._id,
    { $set: update },
    { returnDocument: 'after' },
  );

  return { results, passed, quizResult: saved.quizResult, completedAt: saved.completedAt };
}
