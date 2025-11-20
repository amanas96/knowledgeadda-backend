import mongoose from "mongoose";

const quizAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    quiz: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    score: {
      type: Number,
      required: true,
    },
    totalQuestions: {
      type: Number,
      required: true,
    },
    percentage: {
      type: Number,
      default: function () {
        return this.totalQuestions
          ? (this.score / this.totalQuestions) * 100
          : 0;
      },
    },
    status: {
      type: String,
      enum: ["completed", "in-progress"],
      default: "completed",
    },
    // We store what the user answered for every question
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
        userAnswer: { type: String },
        correctAnswer: { type: String },
        isCorrect: { type: Boolean },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
export default QuizAttempt;
