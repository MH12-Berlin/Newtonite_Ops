import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  createWorkItem,
  listWorkItems,
  getWorkItem,
  updateWorkItem,
} from "../controllers/workItemController.js";
import {
  getWorkItemActivity,
} from "../controllers/workItemController.js";

const router = Router();

router.use(protect);

router.route("/")
  .post(createWorkItem)
  .get(listWorkItems);

router.get("/:id/activity", getWorkItemActivity);

router.route("/:id")
  .get(getWorkItem)
  .patch(updateWorkItem);



export default router;