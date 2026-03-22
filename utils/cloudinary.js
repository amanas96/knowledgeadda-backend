import { v2 as cloudinary } from "cloudinary";
import { existsSync } from "fs";
import { unlink } from "fs/promises";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (
  localFilePath,
  folder = "knowledgeadda",
) => {
  try {
    if (!localFilePath) return null;
    if (!existsSync(localFilePath)) return null;

    const uploadResult = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto", // ✅ auto detects — image for pdf, video for mp4
      folder: folder,
    });

    await unlink(localFilePath);
    console.log(
      "✅ File uploaded:",
      uploadResult.public_id,
      "type:",
      uploadResult.resource_type,
    );
    return uploadResult;
  } catch (error) {
    console.error("❌ Cloudinary upload error:", error.message);
    if (existsSync(localFilePath)) await unlink(localFilePath);
    return null;
  }
};

export const generateSignedUrl = (
  publicId,
  resourceType = "image",
  expiresInSeconds = 3600,
) => {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const signedUrl = cloudinary.url(publicId, {
    resource_type: resourceType,
    type: "upload",
    sign_url: true,
    expires_at: expiresAt,
    secure: true,
  });

  return { url: signedUrl, expiresAt };
};
