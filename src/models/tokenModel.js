import mongoose from "mongoose";

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  token: {
    // This field stores the long token string
    type: String,
    required: true,
  },
  type: {
    // This field stores the type
    type: String,
    required: true,
    enum: ["refresh", "reset"], // <-- The enum belongs here
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// Automatically delete documents when they expire
tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Token = mongoose.model("Token", tokenSchema);
export default Token;
