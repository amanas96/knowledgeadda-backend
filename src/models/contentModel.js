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

// most critical — getCourseContent does: Content.find({ course: courseId })
// without this index every query is a full collection scan
contentSchema.index({ course: 1 });

// getSingleContentItem does: Content.findOne({ _id, course })
// compound index covers both fields in one lookup
contentSchema.index({ course: 1, _id: 1 });

// filter by section within a course (e.g. course content grouped by section)
contentSchema.index({ course: 1, section: 1 });

// sort by creation order within a course
contentSchema.index({ course: 1, createdAt: 1 });

const Content = mongoose.model("Content", contentSchema);
export default Content;
