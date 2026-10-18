import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../app.js";
import User from "../models/User.js";

describe("Authentication security", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  it("does not allow public registration to assign privileged roles", async () => {
    const response = await request(app)
      .post("/api/auth/register")
      .send({
        name: "Test User",
        email: "security@example.com",
        password: "StrongPassword123!",
        memberships: [
          {
            team: "507f1f77bcf86cd799439011",
            role: "admin",
          },
        ],
        role: "admin",
      });

    expect(response.status).toBe(201);

    const user = await User.findOne({
      email: "security@example.com",
    });

    expect(user.memberships).toHaveLength(0);
  });

  it("rejects duplicate email registrations", async () => {
    const payload = {
      name: "Test User",
      email: "duplicate@example.com",
      password: "StrongPassword123!",
    };

    const first = await request(app)
      .post("/api/auth/register")
      .send(payload);

    const second = await request(app)
      .post("/api/auth/register")
      .send(payload);

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
  });

  it("rejects unauthenticated access to protected user routes", async () => {
    const response = await request(app).get("/api/users/me");

    expect(response.status).toBe(401);
  });
});