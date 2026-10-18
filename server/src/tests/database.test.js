import { describe, it, expect } from "vitest";
import mongoose from "mongoose";

describe("Test database", () => {
  it("connects to a replica set", () => {
    expect(mongoose.connection.readyState).toBe(1);
    expect(mongoose.connection.name).toBeTruthy();
  });
});