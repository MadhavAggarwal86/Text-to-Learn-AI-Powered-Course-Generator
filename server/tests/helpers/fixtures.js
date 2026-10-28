/** A course outline in the shape the AI outline step will return (Phase 2). */
export function makeOutline({ moduleCount = 3, lessonsPerModule = 3 } = {}) {
  return {
    title: 'Introduction to Machine Learning',
    description: 'From the core ideas to your first models.',
    tags: ['Machine Learning', ' AI '],
    modules: Array.from({ length: moduleCount }, (_, m) => ({
      title: `Module ${m + 1}`,
      lessons: Array.from({ length: lessonsPerModule }, (_, l) => `Lesson ${m + 1}.${l + 1}`),
    })),
  };
}

export const CREATOR = 'auth0|test-user-1';

export const SAMPLE_CONTENT = [
  { type: 'heading', text: 'What is supervised learning?' },
  { type: 'paragraph', text: 'Supervised learning trains a model on **labelled** examples.' },
  { type: 'code', language: 'python', text: "print('Hello, ML!')" },
  { type: 'video', query: 'supervised learning explained' },
  {
    type: 'mcq',
    question: 'Which data does supervised learning need?',
    options: ['Unlabelled data', 'Labelled data', 'No data'],
    answer: 1,
    explanation: 'It learns the mapping from inputs to known labels.',
  },
];
