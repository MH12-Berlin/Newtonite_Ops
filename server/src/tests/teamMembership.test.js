
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Team from "../models/Team.js";

describe("Concurrent team membership", () => {
  let admin;
  let target;
  let team;
  let token;

  beforeEach(async () => {
    await Team.deleteMany({});
    await User.deleteMany({});

    admin = await User.create({
      name: "Admin",
      email: "admin@example.com",
      password: "test-hash",
    });

    target = await User.create({
      name: "New Member",
      email: "member@example.com",
      password: "test-hash",
    });

    team = await Team.create({
      name: "Operations",
      createdBy: admin._id,
    });

    admin.memberships.push({
      team: team._id,
      role: "admin",
    });

    await admin.save();

    token = jwt.sign(
      { userId: admin._id.toString() },
      process.env.JWT_SECRET
    );
  });

  it("prevents duplicate membership under concurrent requests", async () => {
    const endpoint = `/api/teams/${team._id}/members`;

    const payload = {
      email: target.email,
      role: "member",
    };

    const sendRequest = () =>
      request(app)
        .post(endpoint)
        .set("Authorization", `Bearer ${token}`)
        .send(payload);

    const responses = await Promise.all([
      sendRequest(),
      sendRequest(),
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200,
      409,
    ]);

    const savedUser = await User.findById(target._id);

    expect(savedUser).not.toBeNull();

    const memberships = savedUser.memberships.filter(
      (membership) =>
        membership.team.toString() === team._id.toString()
    );

    expect(memberships).toHaveLength(1);
  });
});
