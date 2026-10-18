
import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import WorkItem from "../models/WorkItem.js";

describe("Work item workflow", () => {
  it("rejects reopening a resolved item", async () => {
    const user = await User.create({
      name: "Team Admin",
      email: "workflow-admin@example.com",
      password: "test-hash",
    });

    const team = await Team.create({
      name: "Workflow Team",
      createdBy: user._id,
    });

    user.memberships.push({
      team: team._id,
      role: "admin",
    });
    await user.save();

    const item = await WorkItem.create({
      title: "Resolved request",
      team: team._id,
      createdBy: user._id,
      status: "resolved",
      dueDate: new Date("2026-10-31T00:00:00.000Z"),
      version: 0,
    });

    const token = jwt.sign(
      { userId: user._id.toString() },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .patch(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        version: 0,
        status: "open",
      });

    expect(response.status).toBe(409);

    const saved = await WorkItem.findById(item._id);

    expect(saved.status).toBe("resolved");
    expect(saved.version).toBe(0);
  });
});
