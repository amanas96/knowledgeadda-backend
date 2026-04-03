import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  // Link the question to its parent quiz
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true,
  },
  text: {
    type: String,
    required: true, // The question text
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function (arr) {
        return arr.length >= 2;
      },
      message: "Must have at least 2 options",
    },
  },
  correctAnswer: {
    type: String,
    required: true,
    validate: {
      validator: function (answer) {
        return this.options.includes(answer);
      },
      message: "Correct answer must be one of the options",
    },
  },
  marks: { type: Number, default: 1 },
  explanation: { type: String },
  isDeleted: { type: Boolean, default: false },
});

const Question = mongoose.model("Question", questionSchema);
export default Question;
