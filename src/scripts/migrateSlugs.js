// scripts/migrateSlugs.js
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

await mongoose.connect(process.env.MONGO_URI);

const courses = await Course.find({ slug: { $exists: false } });
console.log(`Found ${courses.length} courses without slug`);

for (const course of courses) {
  const slug = course.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

  await Course.updateOne({ _id: course._id }, { $set: { slug: slug } });
  console.log(`✅ Fixed: ${course.title} → ${course.slug}`);
}

console.log("Migration complete");
await mongoose.disconnect();
