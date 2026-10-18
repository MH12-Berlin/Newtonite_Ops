export const getTeamMembership = (user, teamId) =>
  user.memberships.find(
    (membership) => membership.team.toString() === teamId
  );

export const requireTeamMembership = (req, res, next) => {
  const teamId = req.params.teamId || req.body.team;

  if (!teamId || !/^[a-f\d]{24}$/i.test(String(teamId))) {
    return res.status(400).json({
      success: false,
      message: "A valid team ID is required.",
    });
  }

  const membership = getTeamMembership(req.user, String(teamId));

  if (!membership) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this team.",
    });
  }

  req.teamMembership = membership;
  next();
};

export const requireTeamLead = (req, res, next) => {
  if (!["admin", "lead"].includes(req.teamMembership?.role)) {
    return res.status(403).json({
      success: false,
      message: "Team lead permissions are required.",
    });
  }

  next();
};