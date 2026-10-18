
import mongoose from "mongoose";

const duplicateClaimSchema = new mongoose.Schema(
  {
    fingerprint: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("DuplicateClaim", duplicateClaimSchema);
