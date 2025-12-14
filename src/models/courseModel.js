// In models/course.js
import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String, // URL to an image
      required: true,
    },
    // We use tags for the recommendation engine later
    tags: {
      type: [String], // An array of strings
      default: [], // e.g., ["UPSC", "History", "Modern India"]
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model("Course", courseSchema);
export default Course;
