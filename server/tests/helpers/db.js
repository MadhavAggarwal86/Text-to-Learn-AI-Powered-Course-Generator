import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';

/**
 * Connects this test file to its own database on the shared in-memory server,
 * so test files can run in parallel without seeing each other's data.
 */
export function useTestDB() {
  beforeAll(async () => {
    await mongoose.connect(inject('mongoUri'), { dbName: `test-${randomUUID()}` });
    // Build indexes (unique, TTL...) before tests rely on them.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  });

  afterEach(async () => {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
}
