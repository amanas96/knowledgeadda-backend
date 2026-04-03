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
      // default: function () {
      //   return this.totalQuestions
      //     ? (this.score / this.totalQuestions) * 100
      //     : 0;
      // },
    },
    timeTaken: {
      type: Number, // in seconds
      default: 0,
    },
    isRetry: {
      type: Boolean,
      default: false, // true = score not counted, just practice
    },
    status: {
      type: String,
      enum: ["completed", "in-progress"],
      default: "completed",
    },
    attemptNumber: { type: Number, default: 1 },
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
  },
);

quizAttemptSchema.pre("save", function (next) {
  if (this.totalQuestions > 0) {
    const rawPercentage = (this.score / this.totalQuestions) * 100;
    this.percentage = Number(Math.min(rawPercentage, 100).toFixed(2));
  } else {
    this.percentage = 0;
  }
  next();
});

quizAttemptSchema.index({ user: 1, quiz: 1, createdAt: -1 });
quizAttemptSchema.index({
  quiz: 1,
  status: 1,
  isRetry: 1,
  score: -1,
  timeTaken: 1,
});

quizAttemptSchema.index({ status: 1, isRetry: 1, user: 1, score: -1 });

const QuizAttempt = mongoose.model("QuizAttempt", quizAttemptSchema);
export default QuizAttempt;
