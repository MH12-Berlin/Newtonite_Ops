import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "../config/db.js";
import User from "../models/User.js";
import Team from "../models/Team.js";

async function bootstrapAdmin() {
  const {
    BOOTSTRAP_ADMIN_NAME: name,
    BOOTSTRAP_ADMIN_EMAIL: email,
    BOOTSTRAP_ADMIN_PASSWORD: password,
    BOOTSTRAP_TEAM_NAME: teamName,
  } = process.env;

  if (!name || !email || !password || !teamName || password.length < 12) {
    throw new Error(
      "Set all BOOTSTRAP variables; password must be at least 12 characters."
    );
  }

  await connectDB();

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const normalizedEmail = email.trim().toLowerCase();

      if (
        await User.findOne({ email: normalizedEmail }).session(session) ||
        await Team.findOne({ name: teamName.trim() }).session(session)
      ) {
        throw new Error(
          "Admin email or team already exists. Bootstrap stopped without changes."
        );
      }

      const [user] = await User.create(
        [{
          name: name.trim(),
          email: normalizedEmail,
          password: await bcrypt.hash(password, 12),
          memberships: [],
        }],
        { session }
      );

      const [team] = await Team.create(
        [{
          name: teamName.trim(),
          createdBy: user._id,
        }],
        { session }
      );

      user.memberships.push({ team: team._id, role: "admin" });
      await user.save({ session });

      console.log(`Bootstrap complete. Admin: ${normalizedEmail}`);
      console.log(`Initial team: ${team.name}`);
    });
  } finally {
    await session.endSession();
    await mongoose.disconnect();
  }
}

bootstrapAdmin().catch((error) => {
  console.error("Bootstrap failed:", error.message);
  process.exitCode = 1;
});