import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  generateCourseOutline,
  generateLessonContent,
  parseAIJson,
} from '../src/services/ai.service.js';
import { generateJSON, GeminiError } from '../src/services/gemini.client.js';
import { verifyResources } from '../src/services/linkCheck.service.js';
import { courseOutlineSchema } from '../src/prompts/schemas.js';
import { reply, validLessonReply, validOutlineReply } from './helpers/aiFixtures.js';

// Replace only the network calls; GeminiError and classifyError stay real.
vi.mock('../src/services/gemini.client.js', async (importOriginal) => ({
  ...(await importOriginal()),
  generateJSON: vi.fn(),
}));
vi.mock('../src/services/linkCheck.service.js', () => ({
  verifyResources: vi.fn(async (resources) => resources),
}));

// Set in vitest.config.js so a developer's .env can't change test behaviour.
const PRIMARY = 'test-primary-model';
const FALLBACK = 'test-fallback-model';
const outlineInput = { topic: 'React Hooks', difficulty: 'beginner' };
const lessonInput = { courseTitle: 'React', moduleTitle: 'Hooks', lessonTitle: 'useState basics' };

const transient = (kind = 'unavailable') => new GeminiError('busy', { kind, status: 503 });
const modelsCalled = () => generateJSON.mock.calls.map(([args]) => args.model);

beforeEach(() => {
  generateJSON.mockReset();
});

describe('parseAIJson', () => {
  it('accepts JSON wrapped in code fences and chatter', () => {
    const text = `Sure! Here is the course:\n\`\`\`json\n${JSON.stringify(validOutlineReply())}\n\`\`\`\nEnjoy.`;

    expect(parseAIJson(text, courseOutlineSchema).success).toBe(true);
  });

  it('explains why a reply was rejected', () => {
    expect(parseAIJson('no json here', courseOutlineSchema).error).toMatch(/no JSON object/);
    expect(parseAIJson('{"title": ', courseOutlineSchema).error).toMatch(
      /no JSON object|not valid JSON/,
    );
    expect(parseAIJson('{"title": "x"}', courseOutlineSchema).error).toMatch(/title|modules/);
  });
});

describe('generateCourseOutline', () => {
  it('returns the validated outline with de-duplicated lowercase tags', async () => {
    generateJSON.mockResolvedValueOnce(reply(validOutlineReply()));

    const outline = await generateCourseOutline(outlineInput);

    expect(outline.modules).toHaveLength(3);
    expect(outline.tags).toEqual(['react', 'hooks']);
    expect(modelsCalled()).toEqual([PRIMARY]);
  });

  it('sends the JSON schema and the user topic to Gemini', async () => {
    generateJSON.mockResolvedValueOnce(reply(validOutlineReply()));

    await generateCourseOutline(outlineInput);

    const [args] = generateJSON.mock.calls[0];
    expect(args.prompt).toContain('<topic>React Hooks</topic>');
    expect(args.jsonSchema.properties.modules.minItems).toBe(3);
  });

  it('retries once with the validation errors when the reply is invalid', async () => {
    generateJSON
      .mockResolvedValueOnce(reply({ title: 'Only a title' }))
      .mockResolvedValueOnce(reply(validOutlineReply()));

    await expect(generateCourseOutline(outlineInput)).resolves.toBeDefined();

    expect(generateJSON).toHaveBeenCalledTimes(2);
    const retryPrompt = generateJSON.mock.calls[1][0].prompt;
    expect(retryPrompt).toMatch(/previous reply was rejected/);
    expect(retryPrompt).toMatch(/modules/);
  });

  it('fails with 502 after two invalid replies', async () => {
    generateJSON.mockResolvedValue(reply('not json at all'));

    await expect(generateCourseOutline(outlineInput)).rejects.toMatchObject({ statusCode: 502 });
    expect(generateJSON).toHaveBeenCalledTimes(2);
  });

  it('falls back to the second model when the first is overloaded or times out', async () => {
    generateJSON
      .mockRejectedValueOnce(transient('timeout'))
      .mockResolvedValueOnce(reply(validOutlineReply()));

    await expect(generateCourseOutline(outlineInput)).resolves.toBeDefined();
    expect(modelsCalled()).toEqual([PRIMARY, FALLBACK]);
  });

  it('answers 503 when every model is unavailable', async () => {
    generateJSON.mockRejectedValue(transient());

    await expect(generateCourseOutline(outlineInput)).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringMatching(/busy/),
    });
    expect(modelsCalled()).toEqual([PRIMARY, FALLBACK]);
  });

  it('does not retry configuration errors such as a bad API key', async () => {
    generateJSON.mockRejectedValue(new GeminiError('API key not valid', { kind: 'config' }));

    await expect(generateCourseOutline(outlineInput)).rejects.toMatchObject({ statusCode: 503 });
    expect(generateJSON).toHaveBeenCalledTimes(1);
  });

  it('answers 422 when Gemini blocks the topic', async () => {
    generateJSON.mockResolvedValueOnce(reply('', { finishReason: 'SAFETY' }));

    await expect(generateCourseOutline(outlineInput)).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('generateLessonContent', () => {
  it('returns validated lesson content', async () => {
    generateJSON.mockResolvedValueOnce(reply(validLessonReply()));

    const lesson = await generateLessonContent(lessonInput);

    expect(lesson.content.filter((block) => block.type === 'mcq')).toHaveLength(3);
    expect(lesson.resources[0].url).toBe('https://react.dev/reference/react/useState');
  });

  it('checks resource links and returns only the ones that survive', async () => {
    generateJSON.mockResolvedValueOnce(reply(validLessonReply()));
    const fallback = [{ title: 'Wikipedia: useState basics', url: 'https://en.wikipedia.org/' }];
    verifyResources.mockResolvedValueOnce(fallback);

    const lesson = await generateLessonContent(lessonInput);

    expect(verifyResources).toHaveBeenCalledWith(validLessonReply().resources, 'useState basics');
    expect(lesson.resources).toEqual(fallback);
  });

  it('treats a truncated reply (MAX_TOKENS) as invalid and retries', async () => {
    const truncated = JSON.stringify(validLessonReply()).slice(0, 200);
    generateJSON
      .mockResolvedValueOnce(reply(truncated, { finishReason: 'MAX_TOKENS' }))
      .mockResolvedValueOnce(reply(validLessonReply()));

    await expect(generateLessonContent(lessonInput)).resolves.toBeDefined();
    expect(generateJSON).toHaveBeenCalledTimes(2);
  });
});
