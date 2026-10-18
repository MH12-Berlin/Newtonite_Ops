import { Router } from "express";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/me", protect, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      memberships: req.user.memberships,
    },
  });
});

export default router;