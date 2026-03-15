import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false,
    },
    category: {
      type: String,
      enum: ["General", "Polity", "Geography", "History", "Economy", "Science"],
      default: "General",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    timeLimit: { type: Number, default: 0 }, // in minutes
    totalMarks: { type: Number, default: 0 }, // optional summary
    isPublished: { type: Boolean, default: true }, // control visibility
    isPremium: { type: Boolean, default: true },
  },

  {
    timestamps: true,
  },
);

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
