// scripts/cleanCloudinaryUploads.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;

// ── Step 1: Delete all content documents ──────────────────────────────────
const contentResult = await db.collection("contents").deleteMany({});
console.log(`✅ Deleted ${contentResult.deletedCount} content documents`);

// ── Step 2: Delete all files from Cloudinary ──────────────────────────────
console.log("🗑 Deleting files from Cloudinary...");

// delete all resources in knowledgeadda folder
try {
  // delete videos/auto resources
  const autoResult = await cloudinary.api.delete_resources_by_prefix(
    "knowledgeadda",
    { resource_type: "video" },
  );
  console.log("✅ Deleted video resources:", autoResult);
} catch (err) {
  console.log("⚠️ No video resources found:", err.message);
}

try {
  // delete image resources (old PDFs uploaded as image)
  const imageResult = await cloudinary.api.delete_resources_by_prefix(
    "knowledgeadda",
    { resource_type: "image" },
  );
  console.log("✅ Deleted image resources:", imageResult);
} catch (err) {
  console.log("⚠️ No image resources found:", err.message);
}

try {
  // delete raw resources (new PDFs)
  const rawResult = await cloudinary.api.delete_resources_by_prefix(
    "knowledgeadda",
    { resource_type: "raw" },
  );
  console.log("✅ Deleted raw resources:", rawResult);
} catch (err) {
  console.log("⚠️ No raw resources found:", err.message);
}

// ── Step 3: Delete WatchHistory ───────────────────────────────────────────
const watchResult = await db.collection("watchhistories").deleteMany({});
console.log(`✅ Deleted ${watchResult.deletedCount} watch history documents`);

console.log("✅ Cleanup complete — DB and Cloudinary are clean");
await mongoose.disconnect();
