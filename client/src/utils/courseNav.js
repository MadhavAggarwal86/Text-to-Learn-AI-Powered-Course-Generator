// Course navigation helpers. URLs use 1-based positions so they read naturally:
// /courses/:courseId/module/1/lesson/1 is the first lesson of the first module.

export function lessonPath(courseId, moduleNumber, lessonNumber) {
  return `/courses/${courseId}/module/${moduleNumber}/lesson/${lessonNumber}`;
}

/** Every lesson of a course in reading order, with its 1-based position and URL. */
export function flattenLessons(course) {
  if (!course?.modules) return [];
  return course.modules.flatMap((module, m) =>
    module.lessons.map((lesson, l) => ({
      lesson,
      module,
      moduleNumber: m + 1,
      lessonNumber: l + 1,
      path: lessonPath(course.id, m + 1, l + 1),
    })),
  );
}

/**
 * Finds the lesson at a URL position plus its neighbours (across module boundaries).
 * Positions come from URL params, so they may be strings or out of range.
 */
export function locateLesson(course, moduleNumber, lessonNumber) {
  const all = flattenLessons(course);
  const index = all.findIndex(
    (entry) =>
      entry.moduleNumber === Number(moduleNumber) && entry.lessonNumber === Number(lessonNumber),
  );
  if (index === -1) return null;

  return {
    ...all[index],
    index,
    total: all.length,
    previous: all[index - 1] ?? null,
    next: all[index + 1] ?? null,
  };
}

/** Where "Continue learning" should go: the first lesson not opened yet, else the first one. */
export function nextLessonToStudy(course) {
  const all = flattenLessons(course);
  return all.find((entry) => !entry.lesson.isEnriched) ?? all[0] ?? null;
}

export function countGenerated(course) {
  const all = flattenLessons(course);
  return { total: all.length, generated: all.filter((entry) => entry.lesson.isEnriched).length };
}
