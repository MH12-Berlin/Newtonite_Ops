import { Router } from "express";
import { protect } from "../middleware/auth.js";
import {
  addComment,
  listComments,
} from "../controllers/commentController.js";

const router = Router();

router.use(protect);

router.route("/:workItemId/comments")
  .get(listComments)
  .post(addComment);

export default router;