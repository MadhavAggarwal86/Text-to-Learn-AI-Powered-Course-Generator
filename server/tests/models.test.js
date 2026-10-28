import mongoose from 'mongoose';
import { describe, expect, it } from 'vitest';
import { Course, CourseModule, Lesson, User, VideoCache } from '../src/models/index.js';
import { useTestDB } from './helpers/db.js';
import { CREATOR, SAMPLE_CONTENT } from './helpers/fixtures.js';

useTestDB();

const objectId = () => new mongoose.Types.ObjectId();

function validCourse(overrides = {}) {
  return { title: 'Intro to React Hooks', prompt: 'React Hooks', creator: CREATOR, ...overrides };
}

function lessonStub(overrides = {}) {
  return {
    title: 'useState basics',
    order: 0,
    module: objectId(),
    course: objectId(),
    ...overrides,
  };
}

describe('Course', () => {
  it('saves with defaults and normalised tags', async () => {
    const course = await Course.create(validCourse({ tags: ['  React ', 'HOOKS'] }));

    expect(course.difficulty).toBe('beginner');
    expect(course.description).toBe('');
    expect(course.tags).toEqual(['react', 'hooks']);
    expect(course.createdAt).toBeInstanceOf(Date);
  });

  it.each([
    ['title', { title: undefined }],
    ['prompt', { prompt: undefined }],
    ['creator', { creator: undefined }],
  ])('requires %s', async (field, overrides) => {
    await expect(Course.create(validCourse(overrides))).rejects.toThrow(field);
  });

  it('rejects an unknown difficulty and a too-short prompt', async () => {
    const err = await Course.create(validCourse({ difficulty: 'expert', prompt: 'ab' })).catch(
      (e) => e,
    );

    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
    expect(Object.keys(err.errors).sort()).toEqual(['difficulty', 'prompt']);
  });

  it('serialises with `id` instead of `_id` and `__v`', async () => {
    const json = (await Course.create(validCourse())).toJSON();

    expect(json.id).toEqual(expect.any(String));
    expect(json).not.toHaveProperty('_id');
    expect(json).not.toHaveProperty('__v');
  });

  it('indexes courses by creator and date for the "my courses" list', async () => {
    const indexes = await Course.collection.indexes();

    expect(indexes.map((i) => i.key)).toContainEqual({ creator: 1, createdAt: -1 });
  });
});

describe('Module', () => {
  it('requires a course and a non-negative order', async () => {
    const err = await CourseModule.create({ title: 'Basics', order: -1 }).catch((e) => e);

    expect(Object.keys(err.errors).sort()).toEqual(['course', 'order']);
  });
});

describe('Lesson', () => {
  it('saves an un-generated stub with empty content', async () => {
    const lesson = await Lesson.create(lessonStub());

    expect(lesson.isEnriched).toBe(false);
    expect(lesson.content).toEqual([]);
    expect(lesson.resources).toEqual([]);
  });

  it('stores every structured block type once enriched', async () => {
    const lesson = await Lesson.create(
      lessonStub({
        isEnriched: true,
        objectives: ['Explain supervised learning'],
        keyTopics: ['labels', 'training data'],
        content: SAMPLE_CONTENT,
        resources: [{ title: 'Scikit-learn guide', url: 'https://scikit-learn.org/stable/' }],
      }),
    );

    const fresh = await Lesson.findById(lesson.id).lean();
    expect(fresh.content).toEqual(SAMPLE_CONTENT);
    expect(fresh.resources).toEqual([
      { title: 'Scikit-learn guide', url: 'https://scikit-learn.org/stable/' },
    ]);
  });

  it('rejects an enriched lesson with no content', async () => {
    await expect(Lesson.create(lessonStub({ isEnriched: true }))).rejects.toThrow(
      /at least one content block/,
    );
  });

  it('rejects content blocks with an unknown or missing type', async () => {
    await expect(Lesson.create(lessonStub({ content: [{ type: 'hologram' }] }))).rejects.toThrow(
      /content block/,
    );
    await expect(Lesson.create(lessonStub({ content: ['just text'] }))).rejects.toThrow(
      /content block/,
    );
  });

  it('rejects resources without an http(s) URL', async () => {
    await expect(
      Lesson.create(lessonStub({ resources: [{ title: 'Bad link', url: 'javascript:alert(1)' }] })),
    ).rejects.toThrow(/url/);
  });
});

describe('User', () => {
  it('enforces one user per Auth0 sub and lowercases email', async () => {
    const user = await User.create({ sub: CREATOR, email: 'Ada@Example.COM', name: 'Ada' });
    expect(user.email).toBe('ada@example.com');

    await expect(User.create({ sub: CREATOR })).rejects.toThrow(/duplicate key/);
  });
});

describe('VideoCache', () => {
  it('normalises the query so equivalent searches share one entry', async () => {
    await VideoCache.create({ query: '  React Hooks Tutorial ', results: [{ videoId: 'abc123' }] });

    const hit = await VideoCache.findOne({ query: 'react hooks tutorial' });
    expect(hit.results[0].videoId).toBe('abc123');
  });

  it('expires entries after 7 days via a TTL index', async () => {
    const indexes = await VideoCache.collection.indexes();
    const ttl = indexes.find((i) => i.key.createdAt === 1);

    expect(ttl.expireAfterSeconds).toBe(7 * 24 * 60 * 60);
  });
});
