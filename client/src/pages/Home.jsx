import { Code2, Layers, ListChecks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider.jsx';
import CourseCard from '../components/CourseCard.jsx';
import ErrorMessage from '../components/common/ErrorMessage.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import Skeleton from '../components/common/Skeleton.jsx';
import GenerationProgress from '../components/GenerationProgress.jsx';
import PromptForm from '../components/PromptForm.jsx';
import { useCourses, useDeleteCourse, useGenerateCourse } from '../hooks/queries.js';
import { getErrorMessage } from '../utils/api.js';

export default function Home() {
  const { isLoading, isAuthenticated } = useAuth();

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

      {isLoading ? (
        <div className="mt-10 text-center text-slate-500">
          <LoadingSpinner label="Checking your session…" />
        </div>
      ) : isAuthenticated ? (
        <>
          <CourseGenerator />
          <CourseList />
        </>
      ) : (
        <Welcome />
      )}
    </div>
  );
}

const FEATURES = [
  {
    icon: Layers,
    title: 'Structured courses',
    text: '3–6 modules that build from basics to advanced.',
  },
  {
    icon: Code2,
    title: 'Rich lessons',
    text: 'Explanations, examples, code and a video per lesson.',
  },
  { icon: ListChecks, title: 'Quizzes', text: 'Check your understanding with instant feedback.' },
];

function Welcome() {
  const { login, signup, error } = useAuth();

  return (
    <section className="mt-10">
      {error && (
        <div className="mb-6">
          <ErrorMessage message={`Login failed: ${error.message}`} />
        </div>
      )}
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => signup()}
          className="btn-primary justify-center px-6 py-3"
        >
          Get started free
        </button>
        <button
          type="button"
          onClick={() => login()}
          className="btn-secondary justify-center px-6 py-3"
        >
          I already have an account
        </button>
      </div>
      <ul className="mt-12 grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <li key={title} className="card p-5">
            <Icon className="h-6 w-6 text-indigo-500" />
            <h2 className="mt-3 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CourseGenerator() {
  const navigate = useNavigate();
  const generate = useGenerateCourse();

  const startGeneration = (input) =>
    generate.mutate(input, { onSuccess: (course) => navigate(`/courses/${course.id}`) });

  return (
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
