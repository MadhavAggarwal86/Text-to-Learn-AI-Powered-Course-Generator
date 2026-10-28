import axios from 'axios';

// Empty in local dev (Vite proxies /api); the Render URL in production.
export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  // Render's free tier can take ~50s to wake from sleep.
  timeout: 60_000,
});

// AI generation can take a while (and may retry on a fallback model on the server).
const GENERATION_TIMEOUT = 120_000;

/** Turns an axios error into a message that is safe to show in the UI. */
export function getErrorMessage(error) {
  if (error.response?.data?.error?.message) return error.response.data.error.message;
  if (error.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (error.request) return 'Could not reach the server. Is it running?';
  return error.message ?? 'Something went wrong.';
}

/** HTTP status of a failed request, or undefined for network errors. */
export const getErrorStatus = (error) => error?.response?.status;

export async function fetchHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function fetchCourses() {
  const { data } = await api.get('/courses');
  return data;
}

export async function fetchCourse(courseId) {
  const { data } = await api.get(`/courses/${courseId}`);
  return data;
}

export async function generateCourse({ topic, difficulty }) {
  const { data } = await api.post(
    '/courses/generate',
    { topic, difficulty },
    { timeout: GENERATION_TIMEOUT },
  );
  return data;
}

export async function deleteCourse(courseId) {
  await api.delete(`/courses/${courseId}`);
}

export async function fetchLesson(lessonId) {
  const { data } = await api.get(`/lessons/${lessonId}`, { timeout: GENERATION_TIMEOUT });
  return data;
}

export async function regenerateLesson(lessonId) {
  const { data } = await api.post(`/lessons/${lessonId}/regenerate`, null, {
    timeout: GENERATION_TIMEOUT,
  });
  return data;
}
