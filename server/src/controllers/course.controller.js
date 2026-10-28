import { Course } from '../models/index.js';
import { generateCourseOutline } from '../services/ai.service.js';
import {
  createCourseTree,
  deleteCourseTree,
  getCourseTree,
  listCourses,
} from '../services/course.service.js';
import { ApiError } from '../utils/ApiError.js';

// Another user's course answers 404, not 403, so ids can't be probed for existence.
const courseNotFound = () => ApiError.notFound('Course not found');

/** POST /api/courses/generate: topic → AI outline → saved course with lesson stubs. */
export async function generateCourse(req, res) {
  const { topic, difficulty } = req.validated.body;

  const outline = await generateCourseOutline({ topic, difficulty });
  const course = await createCourseTree({
    outline,
    creator: req.user.sub,
    prompt: topic,
    difficulty,
  });

  res.status(201).json(course);
}

/** GET /api/courses */
export async function getMyCourses(req, res) {
  res.json(await listCourses(req.user.sub));
}

/** GET /api/courses/:id */
export async function getCourse(req, res) {
  const course = await getCourseTree(req.validated.params.id, { creator: req.user.sub });
  if (!course) throw courseNotFound();
  res.json(course);
}

/** DELETE /api/courses/:id */
export async function deleteCourse(req, res) {
  const owned = await Course.exists({ _id: req.validated.params.id, creator: req.user.sub });
  if (!owned) throw courseNotFound();

  await deleteCourseTree(owned._id);
  res.status(204).end();
}
