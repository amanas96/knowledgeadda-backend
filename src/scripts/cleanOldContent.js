// scripts/cleanOldContent.js
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

// ── Step 1: Find all content documents ───────────────────────────────────
const contents = await db.collection("contents").find({}).toArray();
console.log(`Found ${contents.length} content documents`);

let deletedFromCloudinary = 0;
let deletedFromDb = 0;

for (const content of contents) {
  // ── Delete video from Cloudinary
  if (content.video?.publicId) {
    try {
      await cloudinary.uploader.destroy(content.video.publicId, {
        resource_type: "video",
      });
      console.log(`✅ Deleted video: ${content.video.publicId}`);
      deletedFromCloudinary++;
    } catch (err) {
      // try as raw
      try {
        await cloudinary.uploader.destroy(content.video.publicId, {
          resource_type: "raw",
        });
        console.log(`✅ Deleted raw video: ${content.video.publicId}`);
        deletedFromCloudinary++;
      } catch (err2) {
        // try as image
        try {
          await cloudinary.uploader.destroy(content.video.publicId, {
            resource_type: "image",
          });
          console.log(`✅ Deleted image video: ${content.video.publicId}`);
          deletedFromCloudinary++;
        } catch (err3) {
          console.log(`⚠️ Could not delete video: ${content.video.publicId}`);
        }
      }
    }
  }

  // ── Delete attachments from Cloudinary
  if (content.attachments?.length > 0) {
    for (const att of content.attachments) {
      if (att.publicId) {
        try {
          await cloudinary.uploader.destroy(att.publicId, {
            resource_type: att.cloudinaryResourceType || "raw",
          });
          console.log(`✅ Deleted attachment: ${att.publicId}`);
          deletedFromCloudinary++;
        } catch (err) {
          // try all resource types
          for (const type of ["raw", "image", "video"]) {
            try {
              await cloudinary.uploader.destroy(att.publicId, {
                resource_type: type,
              });
              console.log(`✅ Deleted attachment (${type}): ${att.publicId}`);
              deletedFromCloudinary++;
              break;
            } catch (e) {
              // continue trying
            }
          }
        }
      }
    }
  }
}

// ── Step 2: Delete all content from DB ───────────────────────────────────
const result = await db.collection("contents").deleteMany({});
deletedFromDb = result.deletedCount;
console.log(`✅ Deleted ${deletedFromDb} content documents from DB`);

// ── Step 3: Delete watch history ─────────────────────────────────────────
const watchResult = await db.collection("watchhistories").deleteMany({});
console.log(`✅ Deleted ${watchResult.deletedCount} watch history documents`);

console.log(`
✅ Cleanup complete
   Cloudinary files deleted: ${deletedFromCloudinary}
   DB content documents deleted: ${deletedFromDb}
`);

await mongoose.disconnect();
