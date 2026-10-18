import mongoose from "mongoose";
import Comment from "../models/Comment.js";
import WorkItem from "../models/WorkItem.js";
import Activity from "../models/Activity.js";

const canAccess = (user, teamId) =>
  user.memberships.some(
    (m) => m.team.toString() === teamId.toString()
  );

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });

export const addComment = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { workItemId } = req.params;
    const { text } = req.body;

    if (!mongoose.isValidObjectId(workItemId)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    if (
      typeof text !== "string" ||
      !text.trim() ||
      text.trim().length > 2000
    ) {
      return sendError(
        res,
        400,
        "Comment must contain 1–2000 characters."
      );
    }

    let outcome;

    await session.withTransaction(async () => {
      const item = await WorkItem.findById(workItemId).session(session);

      if (!item) {
        outcome = { status: 404, message: "Work item not found." };
        return;
      }

      if (!canAccess(req.user, item.team)) {
        outcome = {
          status: 403,
          message: "You do not have access to this item.",
        };
        return;
      }

      const [comment] = await Comment.create(
        [{
          workItem: item._id,
          author: req.user._id,
          text: text.trim(),
        }],
        { session }
      );

      await Activity.create(
        [{
          workItem: item._id,
          actor: req.user._id,
          action: "commented",
          changes: { commentText: comment.text },
        }],
        { session }
      );

      outcome = { comment };
    });

    if (outcome?.status) {
      return sendError(res, outcome.status, outcome.message);
    }

    return res.status(201).json({
      success: true,
      data: outcome.comment,
    });
  } catch (error) {
    next(error);
  } finally {
    await session.endSession();
  }
};

export const listComments = async (req, res, next) => {
  try {
    const { workItemId } = req.params;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    if (!mongoose.isValidObjectId(workItemId)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return sendError(res, 400, "Invalid pagination parameters.");
    }

    const item = await WorkItem.findById(workItemId).select("team");

    if (!item) {
      return sendError(res, 404, "Work item not found.");
    }

    if (!canAccess(req.user, item.team)) {
      return sendError(res, 403, "You do not have access to this item.");
    }

    const filter = { workItem: item._id };

    const [comments, total] = await Promise.all([
      Comment.find(filter)
        .populate("author", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Comment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};