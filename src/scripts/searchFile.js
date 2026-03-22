// find-exact-id.js
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const runDiagnostic = async () => {
  const searchId = "axymjgalntkblubyt9ha"; // The unique part of your ID
  console.log(
    `🔎 Diagnostic: Searching for any asset containing "${searchId}"...`,
  );

  try {
    const result = await cloudinary.search
      .expression(`public_id:*${searchId}*`) // Wildcard search
      .execute();

    if (result.resources.length === 0) {
      console.log(
        "❌ Zero matches. The file might be in a different Cloudinary account or deleted.",
      );
    } else {
      result.resources.forEach((file) => {
        console.log("\n✅ MATCH FOUND:");
        console.log(`- Exact Public ID: ${file.public_id}`);
        console.log(`- Resource Type:   ${file.resource_type}`);
        console.log(`- Delivery Type:   ${file.type}`);
        console.log(`- Folder:          ${file.folder}`);
        console.log(`- Full URL:        ${file.secure_url}`);
      });
    }
  } catch (error) {
    console.error("Search Error:", error.message);
  }
};

runDiagnostic();
