import dotenv from "dotenv";
dotenv.config();
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("CLOUDINARY CONFIG:", {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY ? "EXISTS" : "MISSING",
  api_secret: process.env.CLOUDINARY_API_SECRET ? "EXISTS" : "MISSING",
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      console.log("❌ No local file path provided");
      return null;
    }

    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
      folder: "knowledgeadda",
    });

    fs.unlinkSync(localFilePath);
    console.log("File is uploaded successfully", uploadResult.url);
    return uploadResult;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    return null;
  }
};

export { uploadOnCloudinary };
