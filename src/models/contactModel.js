import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderType: {
      type: String,
      enum: ["user", "admin"],
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "messages.senderType",
      required: true,
    },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const contactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    name: { type: String },
    email: { type: String },

    subject: { type: String, required: true },

    messages: [messageSchema],

    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    status: {
      type: String,
      enum: ["open", "replied", "closed"],
      default: "open",
    },

    repliedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Contact", contactSchema);
