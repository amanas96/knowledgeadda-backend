import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["pdf", "notes", "link"],
    required: true,
  },
  name: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String, default: "" },
  cloudinaryResourceType: { type: String, default: "raw" },
});

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },

    section: {
      type: String,
      default: "General", // e.g. "Polity", "History", "Geography"
      trim: true,
    },

    // ── Primary Video ──────────────────────────────────────
    video: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      duration: { type: Number, default: 0 },
    },

    // ── Attachments (pdf, notes, links) ────────────────────
    attachments: [attachmentSchema],

    isFree: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

const Content = mongoose.model("Content", contentSchema);
export default Content;
