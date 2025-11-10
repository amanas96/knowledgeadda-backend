// In models/contentModel.js
import mongoose from "mongoose";

const contentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    // This is the link to its parent course
    course: {
      type: mongoose.Schema.Types.ObjectId, // A reference to a Course
      ref: "Course", // The model to use for the reference
      required: true,
    },
    contentType: {
      type: String,
      enum: ["video", "pdf", "quiz"], // Must be one of these values
      required: true,
    },
    // This will be the URL to the video on Vimeo/S3 or the PDF on S3
    contentUrl: {
      type: String,
      required: true,
    },
    isFree: {
      type: Boolean,
      default: false, // By default, content is NOT free
    },
  },
  {
    timestamps: true,
  }
);

const Content = mongoose.model("Content", contentSchema);
export default Content;
