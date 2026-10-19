
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import connectDB from "../src/config/db.js";
import User from "../src/models/User.js";
import Team from "../src/models/Team.js";
import WorkItem from "../src/models/WorkItem.js";
import Activity from "../src/models/Activity.js";

const DEMO_EMAIL_DOMAIN = "@newtonite.com";

const TEAM_NAMES = [
  "Engineering",
  "Product & Design",
  "Quality Assurance",
];

const ITEM_COUNT = Number(process.env.SEED_WORK_ITEMS || 100);

const names = [
  "Aarav Sharma",
  "Ananya Patel",
  "Rohan Mehta",
  "Isha Deshmukh",
  "Kabir Shah",
  "Priya Nair",
  "Arjun Kulkarni",
  "Meera Joshi",
  "Dev Malhotra",
  "Sana Khan",
];

const priorities = ["low", "medium", "high", "critical"];
const statuses = ["open", "in_progress", "blocked", "resolved"];

const tasks = [
  "Fix authentication timeout",
  "Improve dashboard loading",
  "Add pagination to work items",
  "Resolve notification issue",
  "Optimize database queries",
  "Update team permissions",
  "Improve mobile responsiveness",
  "Add activity timeline",
  "Fix work item validation",
  "Review API error handling",
  "Improve search filters",
  "Add due date reminders",
  "Resolve assignment bug",
  "Update onboarding flow",
  "Add regression tests",
];

const descriptions = [
  "Investigate the issue and implement a reliable fix.",
  "Review the current implementation and improve performance.",
  "Validate the behavior across relevant user roles.",
  "Add appropriate automated tests and verify the result.",
  "Document the change and check for regressions.",
];

function pick(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function randomDate(daysBack = 60) {
  return new Date(
    Date.now() - Math.floor(Math.random() * daysBack * 86400000)
  );
}

function dueDateFor(status) {
  const date = new Date();

  if (status === "resolved") {
    date.setDate(date.getDate() - Math.floor(Math.random() * 20 + 1));
  } else {
    date.setDate(date.getDate() + Math.floor(Math.random() * 30 - 5));
  }

  return date;
}

async function seed() {
  if (!Number.isInteger(ITEM_COUNT) || ITEM_COUNT < 1) {
    throw new Error("SEED_WORK_ITEMS must be a positive integer.");
  }

  await connectDB();

  console.log("Preparing demo data...");

  // Remove only data identified as belonging to this seed script.
  const existingDemoUsers = await User.find({
    email: { $regex: /@seed-demo\.newtonite\.local$/ },
  }).select("_id");

  const demoUserIds = existingDemoUsers.map((user) => user._id);

  const existingDemoTeams = await Team.find({
    name: { $in: TEAM_NAMES },
  }).select("_id");

  const demoTeamIds = existingDemoTeams.map((team) => team._id);

  const existingDemoItems = await WorkItem.find({
    $or: [
      { team: { $in: demoTeamIds } },
      { createdBy: { $in: demoUserIds } },
    ],
  }).select("_id");

  const demoItemIds = existingDemoItems.map((item) => item._id);

  if (demoItemIds.length) {
    await Activity.deleteMany({ workItem: { $in: demoItemIds } });
  }

  if (demoTeamIds.length || demoUserIds.length) {
    await WorkItem.deleteMany({
      $or: [
        { team: { $in: demoTeamIds } },
        { createdBy: { $in: demoUserIds } },
      ],
    });
  }

  // Remove memberships that reference demo teams from remaining users.
  if (demoTeamIds.length) {
    await User.updateMany(
      {},
      { $pull: { memberships: { team: { $in: demoTeamIds } } } }
    );
  }

  await Team.deleteMany({ name: { $in: TEAM_NAMES } });
  await User.deleteMany({
    email: { $regex: /@seed-demo\.newtonite\.local$/ },
  });

  // Create users with hashed demo passwords.
  const passwordHash = await bcrypt.hash("Demo@123", 12);

  const users = await User.insertMany(
    names.map((name, index) => ({
      name,
      email: `user${index + 1}${DEMO_EMAIL_DOMAIN}`,
      password: passwordHash,
      memberships: [],
    }))
  );

  // Create teams. The first user owns Engineering, second owns Product,
  // and third owns QA.
  const teams = await Team.insertMany(
    TEAM_NAMES.map((name, index) => ({
      name,
      createdBy: users[index]._id,
    }))
  );

  // Assign users to teams with admin, lead, and member roles.
  const membershipsByUser = users.map(() => []);

  users.forEach((user, index) => {
    const teamIndex = index % teams.length;

    membershipsByUser[index].push({
      team: teams[teamIndex]._id,
      role: index % 3 === 0 ? "admin" : index % 3 === 1 ? "lead" : "member",
    });

    // Give a few users membership in a second team.
    if (index % 3 === 0) {
      membershipsByUser[index].push({
        team: teams[(teamIndex + 1) % teams.length]._id,
        role: "member",
      });
    }
  });

  await Promise.all(
    users.map((user, index) =>
      User.updateOne(
        { _id: user._id },
        { $set: { memberships: membershipsByUser[index] } }
      )
    )
  );

  // Generate work items with realistic variation.
  const workItems = Array.from({ length: ITEM_COUNT }, (_, index) => {
    const team = teams[index % teams.length];
    const teamMembers = users.filter((user, userIndex) =>
      membershipsByUser[userIndex].some(
        (membership) => membership.team.toString() === team._id.toString()
      )
    );

    const status = pick(statuses);
    const createdAt = randomDate();

    return {
      title: `${pick(tasks)} #${index + 1}`,
      description: pick(descriptions),
      team: team._id,
      assignee: Math.random() < 0.15 ? null : pick(teamMembers)._id,
      createdBy: team.createdBy,
      priority: pick(priorities),
      status,
      version: status === "resolved" ? 2 : 0,
      resolvedAt:
        status === "resolved"
          ? new Date(createdAt.getTime() + 86400000)
          : null,
      dueDate: dueDateFor(status),
      createdAt,
      updatedAt: createdAt,
    };
  });

  const insertedItems = await WorkItem.insertMany(workItems);

  // Add a creation activity for every work item.
  const activities = insertedItems.map((item) => ({
    workItem: item._id,
    actor: item.createdBy,
    action: "created",
    changes: {
      title: item.title,
      status: item.status,
      priority: item.priority,
    },
    createdAt: item.createdAt,
    updatedAt: item.createdAt,
  }));

  await Activity.insertMany(activities);

  console.log("Demo data created successfully.");
  console.log(`Users: ${users.length}`);
  console.log(`Teams: ${teams.length}`);
  console.log(`Work items: ${insertedItems.length}`);
  console.log(`Activities: ${activities.length}`);
  console.log(`Demo password: Demo@123`);
  console.log("Demo user emails:");
  users.forEach((user) => console.log(`- ${user.email}`));
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
