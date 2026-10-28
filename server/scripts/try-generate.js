// Manual check of the AI pipeline against the real Gemini API (needs GEMINI_API_KEY).
// For each topic: generate the outline, then the first lesson, and print a summary.
//
//   npm run ai:try
//   npm run ai:try -- "Basics of Copyright Law" "Intro to SQL"
//   GEMINI_MODEL=gemini-3.1-flash-lite npm run ai:try

import { env } from '../src/config/env.js';
import { generateCourseOutline, generateLessonContent } from '../src/services/ai.service.js';

const DEFAULT_TOPICS = [
  'Intro to React Hooks',
  'Basics of Copyright Law',
  'How Photosynthesis Works',
  'Personal Finance for Beginners',
  'Introduction to Machine Learning',
];

const topics = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TOPICS;

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;
const countWords = (blocks) =>
  blocks
    .filter((block) => block.type === 'paragraph')
    .reduce((sum, block) => sum + block.text.split(/\s+/).length, 0);

console.log(`Models: ${env.GEMINI_MODEL} (fallback: ${env.GEMINI_FALLBACK_MODEL || 'none'})\n`);

let failures = 0;
for (const topic of topics) {
  console.log(`▶ ${topic}`);
  try {
    let startedAt = Date.now();
    const outline = await generateCourseOutline({ topic, difficulty: 'beginner' });
    const lessonCounts = outline.modules.map((m) => m.lessons.length).join('/');
    console.log(`  outline ${seconds(Date.now() - startedAt)}: "${outline.title}"`);
    console.log(
      `    ${outline.modules.length} modules, lessons ${lessonCounts}; tags: ${outline.tags.join(', ')}`,
    );

    const firstModule = outline.modules[0];
    startedAt = Date.now();
    const lesson = await generateLessonContent({
      courseTitle: outline.title,
      moduleTitle: firstModule.title,
      lessonTitle: firstModule.lessons[0],
      difficulty: 'beginner',
      siblingLessons: firstModule.lessons,
    });
    const blockCounts = Object.entries(Object.groupBy(lesson.content, (block) => block.type)).map(
      ([type, blocks]) => `${type}×${blocks.length}`,
    );
    console.log(`  lesson ${seconds(Date.now() - startedAt)}: "${lesson.title}"`);
    console.log(`    ${blockCounts.join(' ')}; ~${countWords(lesson.content)} words`);
    console.log(`    video query: "${lesson.content.find((b) => b.type === 'video').query}"`);
    console.log(`    resources: ${lesson.resources.map((r) => r.url).join(' ')}`);
  } catch (err) {
    failures += 1;
    console.log(`  ✖ ${err.statusCode ?? ''} ${err.message}`);
  }
  console.log();
}

console.log(`${topics.length - failures}/${topics.length} topics generated successfully`);
process.exit(failures ? 1 : 0);
