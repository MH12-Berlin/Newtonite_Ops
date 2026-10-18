import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import WorkItem from "../models/WorkItem.js";
import Comment from "../models/Comment.js";
import Activity from "../models/Activity.js";

describe("Comment API", () => {
  let user;
  let otherUser;
  let team;
  let item;
  let token;
  let otherToken;

  beforeEach(async () => {
    vi.restoreAllMocks();

    await Promise.all([
      Comment.deleteMany({}),
      Activity.deleteMany({}),
      WorkItem.deleteMany({}),
      Team.deleteMany({}),
      User.deleteMany({}),
    ]);

    user = await User.create({
      name: "Team Member",
      email: "member@example.com",
      password: "test-hash",
    });

    otherUser = await User.create({
      name: "Other Member",
      email: "other@example.com",
      password: "test-hash",
    });

    team = await Team.create({
      name: "Operations",
      createdBy: user._id,
    });

    user.memberships.push({
      team: team._id,
      role: "member",
    });

    await user.save();

    item = await WorkItem.create({
      title: "Investigate payment failure",
      team: team._id,
      createdBy: user._id,
      dueDate: new Date("2026-10-31T00:00:00.000Z"),
    });

    token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET
    );

    otherToken = jwt.sign(
      { userId: otherUser._id.toString() },
      process.env.JWT_SECRET
    );
  });

  it("creates a comment and its activity record", async () => {
    const response = await request(app)
      .post(`/api/work-items/${item._id}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "I started investigating this issue." });

    expect(response.status).toBe(201);
    expect(response.body.data.text).toBe(
      "I started investigating this issue."
    );

    expect(await Comment.countDocuments({ workItem: item._id })).toBe(1);

    const activity = await Activity.findOne({ workItem: item._id });
    expect(activity.action).toBe("commented");
  });

  it("rejects comments from users outside the team", async () => {
    const response = await request(app)
      .post(`/api/work-items/${item._id}/comments`)
      .set("Authorization", `Bearer ${otherToken}`)
      .send({ text: "Unauthorized comment" });

    expect(response.status).toBe(403);
    expect(await Comment.countDocuments({ workItem: item._id })).toBe(0);
    expect(await Activity.countDocuments({ workItem: item._id })).toBe(0);
  });

  it("rolls back a comment if activity logging fails", async () => {
    vi.spyOn(Activity, "create").mockRejectedValueOnce(
      new Error("Simulated activity failure")
    );

    const response = await request(app)
      .post(`/api/work-items/${item._id}/comments`)
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "This comment should roll back." });

    expect(response.status).toBe(500);
    expect(await Comment.countDocuments({ workItem: item._id })).toBe(0);
    expect(await Activity.countDocuments({ workItem: item._id })).toBe(0);
  });
});
