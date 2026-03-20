import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      maxlength: 500,
    },
    tags: [{ type: String, lowercase: true, trim: true }],
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    category: {
      type: String,
      enum: [
        "General",
        "Polity",
        "Geography",
        "History",
        "Economy",
        "Science",
        "Other",
      ],
      default: "General",
    },
    customCategory: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    timeLimit: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false }, // ✅ fixed
    isPremium: { type: Boolean, default: false },
    allowMultipleAttempts: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ✅ All indexes in one place
quizSchema.index({ category: 1 });
quizSchema.index({ isPublished: 1, isPremium: 1 });
quizSchema.index({ course: 1 });

quizSchema.pre("validate", function (next) {
  if (this.category === "Other" && !this.customCategory) {
    return next(new Error("customCategory is required when category is Other"));
  }
  next();
});

// ✅ Auto-generate slug only on creation
// ✅ Only generate if admin didn't provide slug
quizSchema.pre("validate", function (next) {
  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }
  next();
});
const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
