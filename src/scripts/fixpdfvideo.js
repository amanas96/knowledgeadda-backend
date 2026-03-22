// scripts/fixPdfVideoField.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;

// ✅ remove video field from PDF content (where video url and publicId are empty)
const result = await db.collection("contents").updateMany(
  {
    "video.url": "",
    "video.publicId": "",
  },
  {
    $unset: { video: "" }, // ✅ completely remove video field
  },
);

console.log(`✅ Fixed ${result.modifiedCount} PDF content documents`);
await mongoose.disconnect();
