import mongoose from "mongoose";

const quizSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false,
      index: true,
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

    timeLimit: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    isPremium: { type: Boolean, default: false },
    allowMultipleAttempts: { type: Boolean, default: true },
  },

  {
    timestamps: true,
  },
);

quizSchema.index({ category: 1 });
quizSchema.index({ isPublished: 1, isPremium: 1 });

const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
