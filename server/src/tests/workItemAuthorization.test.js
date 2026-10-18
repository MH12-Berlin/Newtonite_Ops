
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";

import app from "../app.js";
import User from "../models/User.js";
import Team from "../models/Team.js";
import WorkItem from "../models/WorkItem.js";
import Activity from "../models/Activity.js";

describe("Work item authorization", () => {
  let owner;
  let outsider;
  let team;
  let item;
  let outsiderToken;

  beforeEach(async () => {
    await Activity.deleteMany({});
    await WorkItem.deleteMany({});
    await Team.deleteMany({});
    await User.deleteMany({});

    owner = await User.create({
      name: "Team Owner",
      email: "owner@example.com",
      password: "test-hash",
    });

    outsider = await User.create({
      name: "Outsider",
      email: "outsider@example.com",
      password: "test-hash",
    });

    team = await Team.create({
      name: "Private Operations",
      createdBy: owner._id,
    });

    owner.memberships.push({
      team: team._id,
      role: "admin",
    });

    await owner.save();

    item = await WorkItem.create({
      title: "Private investigation",
      team: team._id,
      createdBy: owner._id,
      dueDate: new Date("2026-10-31T00:00:00.000Z"),
      version: 0,
    });

    outsiderToken = jwt.sign(
      { userId: outsider._id.toString() },
      process.env.JWT_SECRET
    );
  });

  it("rejects reading another team's work item", async () => {
    const response = await request(app)
      .get(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${outsiderToken}`);

    expect(response.status).toBe(403);
  });

  it("rejects updating another team's work item", async () => {
    const response = await request(app)
      .patch(`/api/work-items/${item._id}`)
      .set("Authorization", `Bearer ${outsiderToken}`)
      .send({
        version: 0,
        title: "Unauthorized modification",
      });

    expect(response.status).toBe(403);

    const savedItem = await WorkItem.findById(item._id);

    expect(savedItem.title).toBe("Private investigation");
    expect(savedItem.version).toBe(0);

    expect(
      await Activity.countDocuments({ workItem: item._id })
    ).toBe(0);
  });
});
