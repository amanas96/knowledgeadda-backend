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
    type: [String], // An array of options, e.g., ["A", "B", "C", "D"]
    required: true,
  },
  correctAnswer: {
    type: String,
    required: true, // e.g., "A"
  },
  marks: { type: Number, default: 1 }, // Each question can carry marks
  explanation: { type: String },
});

const Question = mongoose.model("Question", questionSchema);
export default Question;
