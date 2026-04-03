import dotenv from "dotenv";
dotenv.config({ path: "../.env" });
import connectDB from "../src/config/db.js";
import mongoose from "mongoose";
import Quiz from "../src/models/quiz.js";
import QuizAttempt from "../src/models/quizAttempt.js";

async function run() {
  await connectDB();

  const quiz = await Quiz.findOne({ title: "polity" });

  if (!quiz) {
    console.log("Quiz not found");
    process.exit();
  }

  console.log("Quiz:", quiz);

  const questionCount = quiz.questions ? quiz.questions.length : 0;
  console.log("Current Questions in Quiz:", questionCount);

  const attempt = await QuizAttempt.findOne({ quiz: quiz._id });

  if (!attempt) {
    console.log("No attempts found");
    process.exit();
  }

  console.log("Questions in Student Attempt:", attempt.answers?.length || 0);
}

run();
