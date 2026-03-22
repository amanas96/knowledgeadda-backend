import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// REPLACE THIS with the publicId from your console logs
const TEST_PUBLIC_ID = "knowledgeadda/pdfs/axymjgalntkblubyt9ha.pdf";

const testCombinations = async () => {
  console.log("🚀 Starting Cloudinary Link Tests...\n");

  const configs = [
    { res: "raw", auth: "authenticated" },
    { res: "image", auth: "authenticated" },
    { res: "raw", auth: "upload" },
    { res: "image", auth: "upload" },
  ];

  for (const config of configs) {
    try {
      const url = cloudinary.url(TEST_PUBLIC_ID, {
        resource_type: config.res,
        type: config.auth,
        sign_url: true,
        secure: true,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
      });

      console.log(`--- Test: [${config.res}] + [${config.auth}] ---`);
      console.log(`URL: ${url}\n`);
    } catch (err) {
      console.log(`❌ Failed config: ${config.res}/${config.auth}`);
    }
  }
};

testCombinations();
