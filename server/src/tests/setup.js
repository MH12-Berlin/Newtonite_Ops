import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { beforeAll, afterAll } from "vitest";

let replicaSet;

beforeAll(async () => {
  process.env.JWT_SECRET = "test-only-secret-not-for-production";

  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
  });

  await mongoose.connect(replicaSet.getUri());
}, 120000);

afterAll(async () => {
  await mongoose.disconnect();
  await replicaSet?.stop();
}, 120000);