import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  listTeams,
  createTeam,
  addTeamMember,
  getTeamMembers,
  getEligibleTeamMembers,
} from "../controllers/teamController.js";

const router = Router();

router.use(protect);

router.route("/")
  .get(listTeams)
  .post(createTeam);

router.post("/:teamId/members", addTeamMember);
router.get("/:teamId/eligible-members", getEligibleTeamMembers);
router.get("/:teamId/members", getTeamMembers);

export default router;