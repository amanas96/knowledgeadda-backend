// scripts/migrateContent.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../.env") });

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;
const contents = await db.collection("contents").find({}).toArray();

console.log(`Found ${contents.length} content documents`);

for (const content of contents) {
  // skip already migrated
  if (content.video || content.attachments) {
    console.log(`⏭ Already migrated: ${content.title}`);
    continue;
  }

  const update = {
    $set: {
      video: {},
      attachments: [],
      order: 0,
    },
    $unset: {
      contentType: "",
      contentUrl: "",
      publicId: "",
      videoDuration: "",
    },
  };

  // migrate based on old contentType
  if (content.contentType === "video") {
    update.$set.video = {
      url: content.contentUrl || "",
      publicId: content.publicId || "",
      duration: content.videoDuration || 0,
    };
  } else if (
    content.contentType === "pdf" ||
    content.contentType === "notes" ||
    content.contentType === "link"
  ) {
    update.$set.attachments = [
      {
        type: content.contentType,
        name: content.title,
        url: content.contentUrl || "",
        publicId: content.publicId || "",
      },
    ];
  }

  await db.collection("contents").updateOne({ _id: content._id }, update);
  console.log(`✅ Migrated: ${content.title} (${content.contentType})`);
}

console.log("Migration complete");
await mongoose.disconnect();
