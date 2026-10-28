import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePublicView } from '../context/PublicView.jsx';
import {
  deleteCourse,
  fetchAudioTranscript,
  fetchCourse,
  fetchCourses,
  fetchHealth,
  fetchLesson,
  fetchLessonAudio,
  fetchPublicVideos,
  fetchSharedCourse,
  fetchSharedLesson,
  fetchVideos,
  generateCourse,
  regenerateLesson,
  setCourseShared,
  setLessonProgress,
  submitQuiz,
} from '../utils/api.js';

export const queryKeys = {
  health: ['health'],
  courses: ['courses'],
  course: (courseId) => ['course', courseId],
  lesson: (lessonId) => ['lesson', lessonId],
  videos: (query, isPublic = false) => [
    isPublic ? 'publicVideos' : 'videos',
    query.trim().toLowerCase(),
  ],
  sharedCourse: (shareId) => ['sharedCourse', shareId],
  sharedLesson: (shareId, lessonId) => ['sharedLesson', shareId, lessonId],
};

/** Updates one lesson inside a cached course, so the sidebar and course page update at once. */
function patchCourseLesson(queryClient, courseId, lessonId, patch) {
  queryClient.setQueryData(queryKeys.course(courseId), (course) =>
    course
      ? {
          ...course,
          modules: course.modules.map((module) => ({
            ...module,
            lessons: module.lessons.map((lesson) =>
              lesson.id === lessonId ? { ...lesson, ...patch } : lesson,
            ),
          })),
        }
      : course,
  );
}

/** Applies saved progress ({ completedAt, quizResult }) to the cached lesson and course. */
function applyProgress(queryClient, courseId, lessonId, progress) {
  queryClient.setQueryData(queryKeys.lesson(lessonId), (lesson) =>
    lesson ? { ...lesson, ...progress } : lesson,
  );
  patchCourseLesson(queryClient, courseId, lessonId, progress);
  queryClient.invalidateQueries({ queryKey: queryKeys.courses });
}

export function useHealth() {
  return useQuery({ queryKey: queryKeys.health, queryFn: fetchHealth, staleTime: Infinity });
}

export function useCourses() {
  return useQuery({ queryKey: queryKeys.courses, queryFn: fetchCourses });
}

export function useCourse(courseId) {
  return useQuery({
    queryKey: queryKeys.course(courseId),
    queryFn: () => fetchCourse(courseId),
    enabled: Boolean(courseId),
  });
}

/**
 * Lesson content. The first fetch of a lesson generates it on the server (several seconds);
 * after that it never changes unless regenerated, so it is cached for the whole session.
 */
export function useLesson(lessonId, courseId) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.lesson(lessonId),
    queryFn: async () => {
      const lesson = await fetchLesson(lessonId);
      patchCourseLesson(queryClient, courseId, lessonId, { isEnriched: true });
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
      return lesson;
    },
    enabled: Boolean(lessonId),
    staleTime: Infinity,
    // Generation errors are retried by the user, not automatically: each try costs an AI call.
    retry: false,
  });
}

export function useGenerateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: generateCourse,
    onSuccess: (course) => {
      queryClient.setQueryData(queryKeys.course(course.id), course);
      queryClient.invalidateQueries({ queryKey: queryKeys.courses });
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCourse,
    onSuccess: (_, courseId) => {
      queryClient.setQueryData(queryKeys.courses, (courses) =>
        courses?.filter((course) => course.id !== courseId),
      );
      queryClient.removeQueries({ queryKey: queryKeys.course(courseId) });
    },
  });
}

export function useRegenerateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: regenerateLesson,
    onSuccess: (lesson) => {
      queryClient.setQueryData(queryKeys.lesson(lesson.id), lesson);
      // The server deleted the old audio explanation; forget the cached copy too.
      queryClient.removeQueries({ queryKey: ['lessonAudio', lesson.id] });
      queryClient.removeQueries({ queryKey: ['lessonAudioTranscript', lesson.id] });
    },
  });
}

/** YouTube videos for a lesson's video block. Results don't change, so fetch once per session. */
export function useVideos(query) {
  // In a shared course, use the public cache-only lookup (no login, no YouTube quota).
  const isPublic = usePublicView();
  return useQuery({
    queryKey: queryKeys.videos(query, isPublic),
    queryFn: () => (isPublic ? fetchPublicVideos(query) : fetchVideos(query)),
    staleTime: Infinity,
    // The block falls back to a YouTube search link, so don't retry a failing search.
    retry: false,
  });
}

/**
 * The lesson's Hinglish audio as an object URL, fetched only once `requested` is true (the
 * user clicked the button: creating it costs two AI calls). Kept for the session.
 */
export function useLessonAudio(lessonId, requested) {
  return useQuery({
    queryKey: ['lessonAudio', lessonId],
    queryFn: async () => URL.createObjectURL(await fetchLessonAudio(lessonId)),
    enabled: Boolean(lessonId) && requested,
    staleTime: Infinity,
    retry: false,
  });
}

export function useAudioTranscript(lessonId, enabled) {
  return useQuery({
    queryKey: ['lessonAudioTranscript', lessonId],
    queryFn: () => fetchAudioTranscript(lessonId),
    enabled: Boolean(lessonId) && enabled,
    staleTime: Infinity,
    retry: false,
  });
}

export function useSetLessonProgress(lessonId, courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (completed) => setLessonProgress(lessonId, completed),
    onSuccess: (progress) => applyProgress(queryClient, courseId, lessonId, progress),
  });
}

/** Grades a quiz attempt on the server; a pass also marks the lesson completed. */
export function useSubmitQuiz(lessonId, courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (answers) => submitQuiz(lessonId, answers),
    onSuccess: ({ quizResult, completedAt }) =>
      applyProgress(queryClient, courseId, lessonId, { quizResult, completedAt }),
  });
}

/** Turns the public link on or off and stores the new shareId on the cached course. */
export function useSetCourseShared(courseId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (shared) => setCourseShared(courseId, shared),
    onSuccess: ({ shareId }) =>
      queryClient.setQueryData(queryKeys.course(courseId), (course) =>
        course ? { ...course, shareId: shareId ?? undefined } : course,
      ),
  });
}

// A 404 for shared content means "not shared any more" or "not written yet": don't retry.
const noRetryOn404 = (failureCount, error) =>
  failureCount < 1 && error?.response?.status !== 404 && error?.response?.status !== 400;

export function useSharedCourse(shareId) {
  return useQuery({
    queryKey: queryKeys.sharedCourse(shareId),
    queryFn: () => fetchSharedCourse(shareId),
    enabled: Boolean(shareId),
    retry: noRetryOn404,
  });
}

export function useSharedLesson(shareId, lessonId) {
  return useQuery({
    queryKey: queryKeys.sharedLesson(shareId, lessonId),
    queryFn: () => fetchSharedLesson(shareId, lessonId),
    enabled: Boolean(shareId && lessonId),
    staleTime: Infinity,
    retry: noRetryOn404,
  });
}
