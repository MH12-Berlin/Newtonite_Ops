import mongoose from "mongoose";
import Team from "../models/Team.js";
import User from "../models/User.js";

const isAdmin = (user) =>
  user.memberships.some((m) => m.role === "admin");

export const listTeams = async (req, res, next) => {
  try {
    const ids = req.user.memberships.map((m) => m.team);

    const teams = await Team.find({ _id: { $in: ids } }).lean();

    res.json({ success: true, data: teams });
  } catch (error) {
    next(error);
  }
};

export const createTeam = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({
        success: false,
        message: "Admin permissions are required.",
      });
    }

    const { name } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        success: false,
        message: "Team name must be between 1 and 100 characters.",
      });
    }

    let team;

    await session.withTransaction(async () => {
      const [created] = await Team.create(
        [{ name: name.trim(), createdBy: req.user._id }],
        { session }
      );

      await User.updateOne(
        { _id: req.user._id },
        { $push: { memberships: { team: created._id, role: "admin" } } },
        { session }
      );

      team = created;
    });

    res.status(201).json({ success: true, data: team });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A team with this name already exists.",
      });
    }
    next(error);
  } finally {
    await session.endSession();
  }
};

export const addTeamMember = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const { email, role = "member" } = req.body;

    if (!mongoose.isValidObjectId(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const membership = req.user.memberships.find(
      (m) => m.team.toString() === teamId
    );

    if (!membership || membership.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin permissions for this team are required.",
      });
    }

    if (
      typeof email !== "string" ||
      !email.trim() ||
      !["member", "lead"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid email and role (member or lead) are required.",
      });
    }

    const team = await Team.findById(teamId).select("_id");

    if (!team) {
      return res.status(404).json({
        success: false,
        message: "Team not found.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const userId = await User.findOne({ email: normalizedEmail })
      .select("_id");

    if (!userId) {
      return res.status(404).json({
        success: false,
        message: "User must register before joining a team.",
      });
    }

    // Atomic check-and-add: only one concurrent request can add this team.
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId._id,
        memberships: {
          $not: {
            $elemMatch: { team: team._id },
          },
        },
      },
      {
        $push: { memberships: { team: team._id, role } },
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("name email memberships");

    if (!updatedUser) {
      const existingUser = await User.findById(userId._id).select(
        "memberships"
      );

      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      return res.status(409).json({
        success: false,
        message: "User already belongs to this team.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Team member added.",
      data: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};


export const getTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.isValidObjectId(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const membership = req.user.memberships.find(
      (m) => m.team.toString() === teamId
    );

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this team.",
      });
    }

    const users = await User.find({
      "memberships.team": teamId,
    })
      .select("_id name email memberships")
      .lean();

    const members = users.map((user) => {
      const teamMembership = user.memberships.find(
        (m) => m.team.toString() === teamId
      );

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: teamMembership?.role || "member",
      };
    });

    res.json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
};


export const getEligibleTeamMembers = async (req, res, next) => {
  try {
    const { teamId } = req.params;

    if (!mongoose.isValidObjectId(teamId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid team ID.",
      });
    }

    const membership = req.user.memberships.find(
      (m) => m.team.toString() === teamId
    );

    if (!membership || membership.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin permissions for this team are required.",
      });
    }

    const users = await User.find({
      "memberships.team": { $ne: new mongoose.Types.ObjectId(teamId) },
    })
      .select("_id name email")
      .sort({ name: 1 })
      .lean();

    res.json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
};
