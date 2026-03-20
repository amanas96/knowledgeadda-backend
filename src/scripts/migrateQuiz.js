// scripts/migrateQuizSlugs.js
import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

await mongoose.connect(process.env.MONGO_URI);

const quizzes = await Quiz.find({ slug: { $exists: false } });
console.log(`Found ${quizzes.length} quizzes without slug`);

for (const quiz of quizzes) {
  const slug = quiz.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  await Quiz.updateOne({ _id: quiz._id }, { $set: { slug: slug } });

  console.log(`✅ Fixed: ${quiz.title} → ${slug}`);
}

console.log("Migration complete");
await mongoose.disconnect();
