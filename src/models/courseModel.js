import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: [5, "Title must be at least 5 characters long"],
      maxlength: [120, "Title must be at most 120 characters long"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Description must be at most 2000 characters long"],
    },
    thumbnailUrl: {
      type: String,
      required: true,
      validate: {
        validator: (v) => /^https?:\/\/.+/.test(v),
        message: "thumbnailUrl must be a valid URL",
      },
    },
    tags: {
      type: [{ type: String, lowercase: true, trim: true }],
      validate: {
        validator: (v) => v.length <= 10,
        message: "A course can have at most 10 tags",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

courseSchema.index(
  { title: "text", description: "text", tags: "text" },
  { weights: { title: 10, tags: 5, description: 1 } },
);
courseSchema.index({ createdAt: -1 });
courseSchema.index({ title: 1 });

// Generate slug only on creation to preserve stable URLs
courseSchema.pre("validate", function (next) {
  if (this.isNew && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  next();
});

const Course = mongoose.model("Course", courseSchema);
export default Course;
