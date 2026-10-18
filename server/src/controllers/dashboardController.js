
import WorkItem from "../models/WorkItem.js";

export async function getDashboardSummary(req, res, next) {
  try {
    const teamIds = (req.user.memberships || []).map(
      (membership) => membership.team
    );

    if (teamIds.length === 0) {
      return res.status(200).json({
        success: true,
        summary: {
          total: 0,
          open: 0,
          inProgress: 0,
          blocked: 0,
          resolved: 0,
          critical: 0,
          assignedToMe: 0,
        },
        recentWorkItems: [],
      });
    }

    const teamFilter = { team: { $in: teamIds } };

    const [
      total,
      open,
      inProgress,
      blocked,
      resolved,
      critical,
      assignedToMe,
      recentWorkItems,
    ] = await Promise.all([
      WorkItem.countDocuments(teamFilter),
      WorkItem.countDocuments({ ...teamFilter, status: "open" }),
      WorkItem.countDocuments({
        ...teamFilter,
        status: "in_progress",
      }),
      WorkItem.countDocuments({ ...teamFilter, status: "blocked" }),
      WorkItem.countDocuments({ ...teamFilter, status: "resolved" }),
      WorkItem.countDocuments({
        ...teamFilter,
        priority: "critical",
        status: { $ne: "resolved" },
      }),
      WorkItem.countDocuments({
        ...teamFilter,
        assignee: req.user._id,
        status: { $ne: "resolved" },
      }),
      WorkItem.find(teamFilter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title status priority assignee team updatedAt")
        .populate("assignee", "name")
        .populate("team", "name")
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      summary: {
        total,
        open,
        inProgress,
        blocked,
        resolved,
        critical,
        assignedToMe,
      },
      recentWorkItems,
    });
  } catch (error) {
    next(error);
  }
}
