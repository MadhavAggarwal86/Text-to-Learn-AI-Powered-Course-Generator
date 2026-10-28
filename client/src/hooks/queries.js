import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteCourse,
  fetchCourse,
  fetchCourses,
  fetchHealth,
  fetchLesson,
  generateCourse,
  regenerateLesson,
} from '../utils/api.js';

export const queryKeys = {
  health: ['health'],
  courses: ['courses'],
  course: (courseId) => ['course', courseId],
  lesson: (lessonId) => ['lesson', lessonId],
};

/** Marks one lesson as generated inside a cached course, so the sidebar updates at once. */
function markLessonGenerated(queryClient, courseId, lessonId) {
  queryClient.setQueryData(queryKeys.course(courseId), (course) =>
    course
      ? {
          ...course,
          modules: course.modules.map((module) => ({
            ...module,
            lessons: module.lessons.map((lesson) =>
              lesson.id === lessonId ? { ...lesson, isEnriched: true } : lesson,
            ),
          })),
        }
      : course,
  );
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
      markLessonGenerated(queryClient, courseId, lessonId);
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
    onSuccess: (lesson) => queryClient.setQueryData(queryKeys.lesson(lesson.id), lesson),
  });
}
