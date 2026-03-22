// scripts/migrateQuizType.js
import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

await mongoose.connect(process.env.MONGO_URI);

// quizzes with a course → "course"
await Quiz.updateMany(
  { course: { $ne: null }, quizType: { $exists: false } },
  { $set: { quizType: "course" } },
);

// quizzes without a course → "standalone"
await Quiz.updateMany(
  { course: null, quizType: { $exists: false } },
  { $set: { quizType: "standalone" } },
);

console.log("✅ Migration complete");
await mongoose.disconnect();
