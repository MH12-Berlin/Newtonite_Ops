import mongoose from "mongoose";

const workItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
      index: true,
    },
    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["open", "in_progress", "blocked", "resolved"],
      default: "open",
    },
    version: {
      type: Number,
      default: 0,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    dueDate: {
      type: Date,
      required: [true, "Due date is required."],
      validate: {
        validator: (value) =>
          value instanceof Date && !Number.isNaN(value.getTime()),
        message: "Please provide a valid due date.",
      },
    },
    // idempotencyKey: {
    //   type: String,
    //   trim: true,
    //   maxlength: 128,
    // },
  },
  { timestamps: true }
);

workItemSchema.index({ team: 1, status: 1, priority: 1, updatedAt: -1 });
workItemSchema.index({ team: 1, assignee: 1, status: 1, updatedAt: -1 });
workItemSchema.index(
  { createdBy: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: { $type: "string" },
    },
  }
);

export default mongoose.model("WorkItem", workItemSchema);  