// Prompt for the audio explanation: a spoken Hinglish summary of a lesson, which is then
// turned into speech. Kept short (~1.5-2 minutes of audio): text-to-speech time and the
// WAV size both grow with length.

export const SCRIPT_WORDS = { min: 180, max: 280 };

const SYSTEM = `You are a friendly Indian teacher who explains topics in Hinglish: Hindi written in Roman (Latin) script, naturally mixed with English, the way students speak in Indian classrooms.
You always reply with a single JSON object that matches the provided schema.`;

/**
 * `source` is the lesson's own explanation (headings and paragraphs, plain text);
 * `objectives` are its learning objectives. The script is read aloud, so it must contain
 * only words to be spoken.
 */
export function generateHinglishPrompt({ lessonTitle, objectives = [], source }) {
  const user = `Write a spoken Hinglish explanation of the lesson "${lessonTitle}" for a student who understands English only partly.

Learning objectives:
${objectives.map((o) => `- ${o}`).join('\n')}

Lesson text (English):
"""
${source}
"""

Rules for "script":
- ${SCRIPT_WORDS.min}-${SCRIPT_WORDS.max} words, in Hinglish (Hindi in Roman script, e.g. "Is lesson mein hum seekhenge ki..."). Never use Devanagari.
- Keep technical terms in English (e.g. "function", "dependency array", "copyright").
- Warm, simple, conversational teaching tone, short sentences, one everyday example or analogy.
- Start with a short greeting and what the lesson is about; end with a one-line recap.
- It will be read aloud: no Markdown, bullet points, emojis, URLs or code. Describe code in words instead of reading it.
- Explain the lesson's ideas faithfully; do not add facts that are not in the lesson.`;

  return { system: SYSTEM, user };
}
