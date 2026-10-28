import { LESSON_LIMITS } from './schemas.js';

const SYSTEM = `You are an expert teacher writing one lesson of an online course.
You explain ideas clearly with concrete examples and check understanding with good quiz questions.
You always reply with a single JSON object that matches the provided schema: no Markdown fences, no commentary.`;

/**
 * Prompt for stage 2: the full content of one lesson. Only titles are sent (not the whole
 * course) to keep tokens down; sibling lesson titles help the model avoid overlapping them.
 */
export function generateLessonPrompt({
  courseTitle,
  moduleTitle,
  lessonTitle,
  difficulty = 'beginner',
  siblingLessons = [],
}) {
  const others = siblingLessons.filter((title) => title !== lessonTitle);
  const { mcqs, objectives, keyTopics, resources } = LESSON_LIMITS;

  const user = `Write the lesson "${lessonTitle}".

Context:
- Course: "${courseTitle}"
- Module: "${moduleTitle}"
- Audience level: ${difficulty}
${others.length ? `- Other lessons in this module (do not cover their material in depth): ${others.map((t) => `"${t}"`).join(', ')}` : ''}

Return JSON with:
- "title": the lesson title.
- "objectives": ${objectives.min}-${objectives.max} measurable learning objectives, each starting with a verb ("Explain...", "Identify...").
- "keyTopics": ${keyTopics.min}-${keyTopics.max} short key topics covered.
- "content": an ordered array of blocks. Allowed block shapes:
  {"type":"heading","text":"..."}
  {"type":"paragraph","text":"..."}  (plain text; **bold** for key terms; "\\n" line breaks; "- " at the start of a line for list items)
  {"type":"code","language":"python","text":"..."}
  {"type":"video","query":"..."}
  {"type":"mcq","question":"...","options":["...","...","..."],"answer":0,"explanation":"..."}
- "resources": ${resources.min}-${resources.max} further readings as {"title","url"}.

Content rules:
- Start with an introductory paragraph (3-4 sentences) on why this lesson matters.
- Then 3-5 sections. Each section is a heading followed by 2-3 paragraphs of 3-5 full sentences.
- Teach with concrete examples, analogies or worked cases; define every new term when it first appears.
- Write at least 600 words of explanation in total across the paragraphs (up to about 1000). Short, list-like answers are not acceptable.
- Add code blocks only if the topic is about programming or a technical tool; otherwise use none.
- Include exactly one video block: "query" is a YouTube search query of 3-8 words (never a URL).
- End with ${mcqs.min + 1}-${mcqs.max} mcq blocks testing the objectives. Each has 3-4 options, "answer" is the 0-based index of the correct option, and "explanation" says why it is correct. Vary the position of the correct answer.
- Resources: only well-known, stable pages you are confident exist (official documentation, Wikipedia, MDN, Khan Academy, university pages). Prefer top-level pages over deep links.`;

  return { system: SYSTEM, user };
}
