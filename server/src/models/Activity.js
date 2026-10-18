import mongoose from "mongoose";

const activitySchema = new mongoose.Schema(
  {
    workItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "WorkItem",
      required: true,
      index: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "assigned",
        "priority_changed",
        "status_changed",
        "commented",
      ],
      required: true,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activitySchema.index({ workItem: 1, createdAt: -1 });

export default mongoose.model("Activity", activitySchema);