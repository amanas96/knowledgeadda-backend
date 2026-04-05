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
    quizType: {
      type: String,
      enum: ["course", "standalone", "daily", "mock_test"],
      default: "standalone",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    timeLimit: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    isPremium: { type: Boolean, default: false },
    allowMultipleAttempts: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// ✅ All indexes in one place
// quizSchema.index({ category: 1 });
// quizSchema.index({ isPublished: 1, isPremium: 1 });
// quizSchema.index({ course: 1 });

quizSchema.index({ slug: 1 }, { unique: true });
// ── Per quizType uniqueness rules ─────────────────────────────────────────────

// Course quizzes — unique title per course
quizSchema.index(
  { title: 1, course: 1 },
  {
    unique: true,
    partialFilterExpression: {
      quizType: "course",
      course: { $type: "objectId" },
    },
    name: "unique_title_per_course",
  },
);

// Standalone / daily / mock_test — unique title per type globally
quizSchema.index(
  { title: 1, quizType: 1 },
  {
    unique: true,
    partialFilterExpression: {
      quizType: { $in: ["standalone", "daily", "mock_test"] },
    },
    name: "unique_title_per_type",
  },
);
quizSchema.index({ category: 1 });
quizSchema.index({ isPublished: 1, isPremium: 1 });
quizSchema.index({ course: 1 });
quizSchema.index({ title: "text", description: "text", tags: "text" });
quizSchema.index({ isPublished: 1, quizType: 1, createdAt: -1 });

quizSchema.pre("validate", function (next) {
  if (this.category === "Other" && !this.customCategory) {
    return next(new Error("customCategory is required when category is Other"));
  }

  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
  }

  next();
});

// quizModel.js — pre validate hook
quizSchema.pre("validate", function (next) {
  // course quizzes must have a course
  if (this.quizType === "course" && !this.course) {
    return next(new Error("course is required for quizType 'course'"));
  }

  // non-course quizzes must NOT have a course
  if (this.quizType !== "course" && this.course) {
    return next(
      new Error(`quizType '${this.quizType}' should not have a course`),
    );
  }

  next();
});

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
