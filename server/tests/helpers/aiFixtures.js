import { SAMPLE_CONTENT } from './fixtures.js';

/** A valid outline as Gemini would return it. */
export function validOutlineReply() {
  return {
    title: 'Mastering React Hooks',
    description: 'Learn to build modern React components with hooks, from state to custom hooks.',
    tags: ['React', 'hooks', 'react'],
    modules: Array.from({ length: 3 }, (_, m) => ({
      title: `Module ${m + 1} title`,
      lessons: ['First lesson', 'Second lesson', 'Third lesson'],
    })),
  };
}

const extraMcq = {
  type: 'mcq',
  question: 'Which hook stores local state?',
  options: ['useEffect', 'useState', 'useRef'],
  answer: 1,
  explanation: 'useState returns a state value and a setter.',
};

/** A valid lesson as Gemini would return it (SAMPLE_CONTENT has 1 mcq; schema needs 3-5). */
export function validLessonReply() {
  // Deep copy: tests mutate the result and must not leak changes into shared fixtures.
  return structuredClone({
    title: 'useState basics',
    objectives: ['Explain what state is', 'Use the useState hook'],
    keyTopics: ['state', 'useState'],
    content: [...SAMPLE_CONTENT, extraMcq, extraMcq],
    resources: [
      { title: 'React docs: useState', url: 'https://react.dev/reference/react/useState' },
    ],
  });
}

/** What gemini.client's generateJSON resolves with. */
export function reply(body, overrides = {}) {
  return {
    model: 'test-model',
    text: typeof body === 'string' ? body : JSON.stringify(body),
    finishReason: 'STOP',
    durationMs: 5,
    usage: { totalTokenCount: 100 },
    ...overrides,
  };
}
