import { useNavigate } from 'react-router-dom';
import CourseCard from '../components/CourseCard.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import GenerationProgress from '../components/GenerationProgress.jsx';
import PromptForm from '../components/PromptForm.jsx';
import { useCourses, useDeleteCourse, useGenerateCourse } from '../hooks/queries.js';
import { getErrorMessage } from '../utils/api.js';

export default function Home() {
  const navigate = useNavigate();
  const generate = useGenerateCourse();

  const startGeneration = (input) =>
    generate.mutate(input, { onSuccess: (course) => navigate(`/courses/${course.id}`) });

  return (
    <div className="mx-auto max-w-4xl">
      <section className="text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Turn any topic into a <span className="text-indigo-600 dark:text-indigo-400">course</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
          Type what you want to learn. Text-to-Learn builds a structured course with modules,
          lessons, videos and quizzes.
        </p>
      </section>

      <section className="mt-8">
        <PromptForm onSubmit={startGeneration} isGenerating={generate.isPending} />
        {generate.isPending && <GenerationProgress topic={generate.variables.topic} />}
        {generate.isError && (
          <div className="mt-4">
            <ErrorMessage
              message={getErrorMessage(generate.error)}
              onRetry={() => startGeneration(generate.variables)}
            />
          </div>
        )}
      </section>

      <CourseList />
    </div>
  );
}

function CourseList() {
  const { data: courses, isPending, isError, error, refetch } = useCourses();
  const remove = useDeleteCourse();

  function handleDelete(course) {
    if (window.confirm(`Delete "${course.title}"? This can't be undone.`)) {
      remove.mutate(course.id);
    }
  }

  return (
    <section className="mt-14" aria-labelledby="your-courses">
      <h2 id="your-courses" className="text-xl font-semibold">
        Your courses
      </h2>

      {remove.isError && (
        <div className="mt-4">
          <ErrorMessage message={`Couldn't delete the course: ${getErrorMessage(remove.error)}`} />
        </div>
      )}

      <div className="mt-4">
        {isPending && (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        )}
        {isError && <ErrorMessage message={getErrorMessage(error)} onRetry={refetch} />}
        {courses?.length === 0 && (
          <p className="card p-8 text-center text-slate-500 dark:text-slate-400">
            You haven&apos;t generated any courses yet. Pick a topic above to get started.
          </p>
        )}
        {courses?.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            {courses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                onDelete={handleDelete}
                isDeleting={remove.isPending && remove.variables === course.id}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
