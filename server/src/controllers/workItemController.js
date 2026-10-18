import mongoose from "mongoose";
import WorkItem from "../models/WorkItem.js";
import Activity from "../models/Activity.js";
import Team from "../models/Team.js";
import User from "../models/User.js";
import crypto from "node:crypto";
import DuplicateClaim from "../models/DuplicateClaim.js";

const createActivity = (data, session) =>
  Activity.create([data], { session });
const priorities = ["low", "medium", "high", "critical"];
const statuses = ["open", "in_progress", "blocked", "resolved"];


const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeText = (value = "") =>
  value.trim().replace(/\s+/g, " ").toLowerCase();

const getDuplicateFingerprint = ({
  title,
  description,
  team,
  assignee,
  priority,
}) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify([
        normalizeText(title),
        normalizeText(description),
        String(team),
        assignee ? String(assignee) : null,
        priority,
      ])
    )
    .digest("hex");

const allowedTransitions = {
  open: ["in_progress", "blocked", "resolved"],
  in_progress: ["open", "blocked", "resolved"],
  blocked: ["open", "in_progress", "resolved"],
  resolved: [],
};


const canAccess = (user, teamId) =>
  user.memberships.some(
    (m) => m.team.toString() === teamId.toString()
  );

const canManage = (user, teamId) =>
  user.memberships.some(
    (m) =>
      m.team.toString() === teamId.toString() &&
      ["admin", "lead"].includes(m.role)
  );

const validId = (id) => mongoose.isValidObjectId(id);

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, message });


export const getWorkItemById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    const workItem = await WorkItem.findById(id)
      .populate("team", "name")
      .populate("assignee", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!workItem) {
      return sendError(res, 404, "Work item not found.");
    }

    if (!canAccess(req.user, workItem.team._id)) {
      return sendError(
        res,
        403,
        "You do not have access to this work item."
      );
    }

    return res.status(200).json({
      success: true,
      data: workItem,
    });
  } catch (error) {
    next(error);
  }
};


export const getWorkItemActivity = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    const workItem = await WorkItem.findById(id).select("team").lean();

    if (!workItem) {
      return sendError(res, 404, "Work item not found.");
    }

    if (!canAccess(req.user, workItem.team)) {
      return sendError(
        res,
        403,
        "You do not have access to this work item's activity."
      );
    }

    const requestedPage = Number.parseInt(req.query.page, 10) || 1;
    const requestedLimit = Number.parseInt(req.query.limit, 10) || 20;

    const page = Math.max(1, requestedPage);
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const filter = { workItem: workItem._id };

    const [activities, total] = await Promise.all([
      Activity.find(filter)
        .populate("actor", "name")
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Activity.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: activities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};


export const createWorkItem = async (req, res, next) => {
  try {
    const {
      title,
      description = "",
      team,
      assignee = null,
      priority = "medium",
      dueDate,
      confirmDuplicate = false,
    } = req.body;

    // 1. Validate input
    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 150 ||
      typeof description !== "string" ||
      description.length > 5000 ||
      !validId(team) ||
      !priorities.includes(priority) ||
      !dueDate ||
      Number.isNaN(Date.parse(dueDate)) ||
      (assignee !== null && !validId(assignee)) ||
      typeof confirmDuplicate !== "boolean"
    ) {
      return sendError(res, 400, "Invalid work item details.");
    }

    // 2. Check team access
    if (!canAccess(req.user, team)) {
      return sendError(res, 403, "You do not have access to this team.");
    }

    // 3. Validate assignee membership
    if (assignee) {
      const assignedUser = await User.findById(assignee);

      if (!assignedUser || !canAccess(assignedUser, team)) {
        return sendError(
          res,
          400,
          "Assignee must be a member of the selected team."
        );
      }
    }

    const fingerprint = getDuplicateFingerprint({
      title,
      description,
      team,
      assignee,
      priority,
    });

    let claimAcquired = false;

    try {
      // 4. Coordinate duplicate checks unless the user confirms creation.
      if (!confirmDuplicate) {
        try {
          await DuplicateClaim.create({
            fingerprint,
            expiresAt: new Date(Date.now() + 60_000),
          });

          claimAcquired = true;
        } catch (error) {
          if (error.code !== 11000) throw error;

          return res.status(200).json({
            success: true,
            duplicateFound: true,
            duplicate: {
              title: title.trim(),
              status: "being created",
              priority,
              assignee: "Please review the in-progress submission",
            },
            message:
              "An identical work item is currently being submitted. Review before proceeding.",
          });
        }

        // 5. Recheck existing items after acquiring the claim.
        const titlePattern = normalizeText(title)
          .split(/\s+/)
          .map(escapeRegex)
          .join("\\s+");

        const candidates = await WorkItem.find({
          team,
          priority,
          assignee,
          title: { $regex: `^${titlePattern}$`, $options: "i" },
        })
          .select("title description status priority assignee")
          .populate("assignee", "name")
          .limit(50)
          .lean();

        const existing = candidates.find(
          (item) =>
            normalizeText(item.title) === normalizeText(title) &&
            normalizeText(item.description) === normalizeText(description)
        );

        if (existing) {
          return res.status(200).json({
            success: true,
            duplicateFound: true,
            duplicate: {
              _id: existing._id,
              title: existing.title,
              status: existing.status,
              priority: existing.priority,
              assignee: existing.assignee?.name || "Unassigned",
            },
          });
        }
      }

      // 6. Create the work item.

      // 6. Create the work item and activity atomically.
      const session = await mongoose.startSession();
      let workItem;

      try {
        await session.withTransaction(async () => {
          const [createdItem] = await WorkItem.create(
            [{
              title: title.trim(),
              description: description.trim(),
              team,
              assignee,
              priority,
              dueDate: new Date(dueDate),
              createdBy: req.user._id,
            }],
            { session }
          );

          workItem = createdItem;

          await Activity.create(
            [{
              workItem: createdItem._id,
              actor: req.user._id,
              action: "created",
              changes: {
                title: {
                  from: null,
                  to: createdItem.title,
                },
              },
            }],
            { session }
          );
        });
      } finally {
        await session.endSession();
      }

      return res.status(201).json({
        success: true,
        data: workItem,
      });

    } finally {
      // 8. Release the temporary claim on every exit path.
      if (claimAcquired) {
        await DuplicateClaim.deleteOne({ fingerprint }).catch((error) => {
          console.error(
            "Failed to release duplicate claim:",
            error.message
          );
        });
      }
    }
  } catch (error) {
    next(error);
  }
};



export const listWorkItems = async (req, res, next) => {
  try {
    const {
      page = "1",
      limit = "10",
      search = "",
      status,
      priority,
      team,
      assignee,
    } = req.query;

    const pageNumber = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(pageNumber) ||
      pageNumber < 1 ||
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100 ||
      typeof search !== "string" ||
      search.length > 100
    ) {
      return sendError(res, 400, "Invalid pagination or search parameters.");
    }

    if (
      (status && !statuses.includes(status)) ||
      (priority && !priorities.includes(priority)) ||
      (team && !validId(team)) ||
      (assignee && !validId(assignee))
    ) {
      return sendError(res, 400, "Invalid filter.");
    }

    const teamIds = req.user.memberships.map((m) => m.team);

    // Always restrict the query to the authenticated user's teams.
    const filter = { team: { $in: teamIds } };

    if (team) {
      if (!canAccess(req.user, team)) {
        return sendError(res, 403, "You do not have access to this team.");
      }
      filter.team = new mongoose.Types.ObjectId(team);
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    if (assignee) {
      filter.assignee = new mongoose.Types.ObjectId(assignee);
    }

    if (search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [
        { title: { $regex: escaped, $options: "i" } },
        { description: { $regex: escaped, $options: "i" } },
      ];
    }

    const [items, total] = await Promise.all([
      WorkItem.find(filter)
        .populate("team", "name")
        .sort({ updatedAt: -1 })
        .sort({ updatedAt: -1 })
        .skip((pageNumber - 1) * pageSize)
        .limit(pageSize)
        .populate("assignee", "name email")
        .populate("createdBy", "name email")
        .lean(),
      WorkItem.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNumber,
        limit: pageSize,
        total,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    next(error);
  }
};


export const getWorkItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    const item = await WorkItem.findById(id)
      .populate("team", "name")
      .populate("assignee", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!item) {
      return sendError(res, 404, "Work item not found.");
    }

    if (!canAccess(req.user, item.team?._id)) {
      return sendError(res, 403, "You do not have access to this item.");
    }

    return res.status(200).json({
      success: true,
      data: item,
    });
  } catch (error) {
    next(error);
  }
};


export const updateWorkItem = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { version, ...changes } = req.body;

    if (!validId(id)) {
      return sendError(res, 400, "Invalid work item ID.");
    }

    if (!Number.isInteger(version) || version < 0) {
      return sendError(res, 400, "A valid version is required.");
    }

    const allowed = ["title", "description", "priority", "status", "assignee", "dueDate"];
    const keys = Object.keys(changes);

    if (!keys.length || keys.some((key) => !allowed.includes(key))) {
      return sendError(res, 400, "Invalid or empty update.");
    }

    // Validate the request before opening a transaction.
    if (
      "title" in changes &&
      (typeof changes.title !== "string" ||
        !changes.title.trim() ||
        changes.title.trim().length > 150)
    ) {
      return sendError(res, 400, "Invalid title.");
    }

    if (
      "description" in changes &&
      (typeof changes.description !== "string" ||
        changes.description.length > 5000)
    ) {
      return sendError(res, 400, "Invalid description.");
    }

    if ("priority" in changes && !priorities.includes(changes.priority)) {
      return sendError(res, 400, "Invalid priority.");
    }

    if ("status" in changes && !statuses.includes(changes.status)) {
      return sendError(res, 400, "Invalid status.");
    }

    if (
      "assignee" in changes &&
      changes.assignee !== null &&
      !validId(changes.assignee)
    ) {
      return sendError(res, 400, "Invalid assignee ID.");
    }

    if (
      "dueDate" in changes &&
      (
        typeof changes.dueDate !== "string" ||
        Number.isNaN(Date.parse(changes.dueDate))
      )
    ) {
      return sendError(res, 400, "A valid due date is required.");
    }

    if ("dueDate" in changes) {
      changes.dueDate = new Date(changes.dueDate);
    }

    let outcome;

    await session.withTransaction(async () => {
      // Read the authoritative item inside the transaction.
      const item = await WorkItem.findById(id).session(session);

      if (!item) {
        outcome = { status: 404, message: "Work item not found." };
        return;
      }

      const teamId = item.team.toString();

      if (!canAccess(req.user, teamId)) {
        outcome = {
          status: 403,
          message: "You do not have access to this item.",
        };
        return;
      }

      // Check the version before making any changes.
      if (item.version !== version) {
        outcome = {
          status: 409,
          message: "This item has changed. Refresh and retry.",
        };
        return;
      }

      if (
        ("assignee" in changes || "priority" in changes) &&
        !canManage(req.user, teamId)
      ) {
        outcome = {
          status: 403,
          message: "Team lead permissions are required for this change.",
        };
        return;
      }

      // Resolved items are terminal in this workflow.
      if (
        "status" in changes &&
        changes.status !== item.status &&
        !allowedTransitions[item.status]?.includes(changes.status)
      ) {
        outcome = {
          status: 409,
          message: `Cannot transition from ${item.status} to ${changes.status}.`,
        };
        return;
      }

      // Validate assignment against current team membership.
      if ("assignee" in changes && changes.assignee) {
        const assignee = await User.findById(changes.assignee)
          .session(session);

        if (!assignee || !canAccess(assignee, teamId)) {
          outcome = {
            status: 400,
            message: "Assignee must belong to this team.",
          };
          return;
        }
      }

      const updates = {};
      const activityChanges = {};

      for (const key of keys) {
        const nextValue =
          key === "title" || key === "description"
            ? changes[key].trim()
            : changes[key];

        const previousValue =
          key === "assignee"
            ? item.assignee?.toString() ?? null
            : item[key];

        if (String(previousValue ?? "") !== String(nextValue ?? "")) {
          updates[key] = nextValue;
          activityChanges[key] = {
            from: previousValue ?? null,
            to: nextValue,
          };
        }
      }

      if (!Object.keys(updates).length) {
        outcome = { data: item, unchanged: true };
        return;
      }


      if ("assignee" in activityChanges) {
        const [oldAssignee, newAssignee] = await Promise.all([
          activityChanges.assignee.from
            ? User.findById(activityChanges.assignee.from).select("name").session(session).lean()
            : null,

          activityChanges.assignee.to
            ? User.findById(activityChanges.assignee.to).select("name").session(session).lean()
            : null,
        ]);

        activityChanges.assignee = {
          from: oldAssignee
            ? { id: oldAssignee._id, name: oldAssignee.name }
            : null,
          to: newAssignee
            ? { id: newAssignee._id, name: newAssignee.name }
            : null,
        };
      }


      if ("status" in updates) {
        updates.resolvedAt =
          updates.status === "resolved" ? new Date() : null;
      }

      // Compare-and-swap: only the expected version may be changed.
      const updated = await WorkItem.findOneAndUpdate(
        { _id: id, team: item.team, version },
        {
          $set: updates,
          $inc: { version: 1 },
        },
        {
          new: true,
          runValidators: true,
          session,
        }
      );

      if (!updated) {
        outcome = {
          status: 409,
          message: "Concurrent update detected. Refresh and retry.",
        };
        return;
      }

      const changedFields = Object.keys(updates);

      let action = "updated";

      if (changedFields.length === 1) {
        const field = changedFields[0];

        if (field === "status") {
          action = "status_changed";
        } else if (field === "assignee") {
          action = "assigned";
        } else if (field === "priority") {
          action = "priority_changed";
        }
      }

      // Both writes use the same transaction.
      await Activity.create(
        [{
          workItem: updated._id,
          actor: req.user._id,
          action,
          changes: activityChanges,
        }],
        { session }
      );

      outcome = { data: updated };
    });

    if (outcome?.status) {
      return sendError(res, outcome.status, outcome.message);
    }

    return res.json({
      success: true,
      data: outcome.data,
      unchanged: outcome.unchanged ?? false,
    });
    // } catch (error) {
    //   next(error);
    // } finally {
    //   await session.endSession();
    // }
  } catch (error) {
    console.error("PATCH transaction failed:", error);
    next(error);
  } finally {
    await session.endSession();
  }
};