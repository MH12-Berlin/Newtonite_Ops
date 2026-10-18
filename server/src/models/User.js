import mongoose from "mongoose";

const membershipSchema = new mongoose.Schema(
  {
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Team",
      required: true,
    },
    role: {
      type: String,
      enum: ["admin", "lead", "member"],
      default: "member",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    memberships: {
      type: [membershipSchema],
      default: [],
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);