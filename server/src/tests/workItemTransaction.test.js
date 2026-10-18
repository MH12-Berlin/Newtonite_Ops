
import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import app from "../app.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import WorkItem from "../models/WorkItem.js";
import Activity from "../models/Activity.js";

describe("Work item transaction safety", () => {
  let user;
  let team;
  let item;
  let token;

  const dueDate = "2026-10-31";

  beforeEach(async () => {
    vi.restoreAllMocks();
    await mongoose.connection.db.dropDatabase();

    user = await User.create({
      name: "Test Admin",
      email: "admin@example.com",
      password: "test-hash",
    });

    team = await Team.create({
      name: "Operations",
      createdBy: user._id,
    });

    user.memberships.push({
      team: team._id,
      role: "admin",
    });

    await user.save();

    item = await WorkItem.create({
      title: "Original title",
      team: team._id,
      createdBy: user._id,
      dueDate: new Date(`${dueDate}T00:00:00.000Z`),
      version: 0,
    });

    token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET
    );
  });

  it("commits the item update and activity together", async () => {
    const response = await request(app)
      .patch(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        version: 0,
        title: "Updated title",
      });

    expect(response.status).toBe(200);

    const savedItem = await WorkItem.findById(item._id);
    const activities = await Activity.find({ workItem: item._id });

    expect(savedItem.title).toBe("Updated title");
    expect(savedItem.version).toBe(1);
    expect(activities).toHaveLength(1);
    expect(activities[0].changes.title.from).toBe("Original title");
    expect(activities[0].changes.title.to).toBe("Updated title");
  });

  it("rolls back the item update when activity logging fails", async () => {
    vi.spyOn(Activity, "create").mockRejectedValueOnce(
      new Error("Simulated activity database failure")
    );

    const response = await request(app)
      .patch(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        version: 0,
        title: "Must not persist",
      });

    expect(response.status).toBe(500);

    const savedItem = await WorkItem.findById(item._id);
    const activities = await Activity.find({ workItem: item._id });

    expect(savedItem.title).toBe("Original title");
    expect(savedItem.version).toBe(0);
    expect(activities).toHaveLength(0);
  });

  it("rolls back work item creation when activity logging fails", async () => {
    vi.spyOn(Activity, "create").mockRejectedValueOnce(
      new Error("Simulated activity creation failure")
    );

    const response = await request(app)
      .post("/api/work-items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Atomic creation test",
        description: "This should not persist",
        team: team._id.toString(),
        priority: "medium",
        dueDate,
      });

    expect(response.status).toBe(500);

    const createdItem = await WorkItem.findOne({
      title: "Atomic creation test",
      team: team._id,
    });

    const activities = await Activity.find({
      action: "created",
    });

    expect(createdItem).toBeNull();
    expect(activities).toHaveLength(0);
  });

  it("detects an existing duplicate without creating another item", async () => {
    const payload = {
      title: "Duplicate detection test",
      description: "Same details",
      team: team._id.toString(),
      priority: "medium",
      dueDate,
    };

    const first = await request(app)
      .post("/api/work-items")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(first.status).toBe(201);

    const countBefore = await WorkItem.countDocuments({
      title: payload.title,
      team: team._id,
    });

    const second = await request(app)
      .post("/api/work-items")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(second.status).toBe(200);
    expect(second.body.duplicateFound).toBe(true);

    const countAfter = await WorkItem.countDocuments({
      title: payload.title,
      team: team._id,
    });

    expect(countAfter).toBe(countBefore);
  });

  it("allows intentional creation after duplicate confirmation", async () => {
    const payload = {
      title: "Intentional duplicate test",
      description: "Same details",
      team: team._id.toString(),
      priority: "medium",
      dueDate,
    };

    const first = await request(app)
      .post("/api/work-items")
      .set("Authorization", `Bearer ${token}`)
      .send(payload);

    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/work-items")
      .set("Authorization", `Bearer ${token}`)
      .send({
        ...payload,
        confirmDuplicate: true,
      });

    expect(second.status).toBe(201);

    const count = await WorkItem.countDocuments({
      title: payload.title,
      team: team._id,
    });

    expect(count).toBe(2);
  });

  it("rejects a stale version without creating activity", async () => {
    await WorkItem.updateOne(
      { _id: item._id },
      { $set: { title: "Changed elsewhere" }, $inc: { version: 1 } }
    );

    const response = await request(app)
      .patch(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        version: 0,
        title: "Stale update",
      });

    expect(response.status).toBe(409);

    const savedItem = await WorkItem.findById(item._id);
    const activities = await Activity.find({ workItem: item._id });

    expect(savedItem.title).toBe("Changed elsewhere");
    expect(savedItem.version).toBe(1);
    expect(activities).toHaveLength(0);
  });
});
