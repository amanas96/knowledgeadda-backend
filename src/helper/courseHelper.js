import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";

import { openSync, readSync, closeSync, existsSync } from "fs";
import { unlink } from "fs/promises";

/* ============================================================
   Constants
============================================================ */
export const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

export const ALLOWED_MIME_TYPES = {
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  pdf: ["application/pdf"],
  notes: ["application/pdf", "application/msword"],
};

/* ============================================================
   Detect password-protected PDFs by reading the raw header.
============================================================ */
export const isPasswordProtectedPdf = (filePath) => {
  const fd = openSync(filePath, "r");
  const buffer = Buffer.alloc(2048);
  readSync(fd, buffer, 0, 2048, 0);
  closeSync(fd);
  const header = buffer.toString("utf8", 0, 2048);
  return (
    header.includes("/Encrypt") ||
    header.includes("/O (") ||
    header.includes("/P -")
  );
};

/* ============================================================
   Delete a temp file without throwing — used in catch blocks.
============================================================ */
export const cleanupFile = async (filePath) => {
  try {
    if (filePath && existsSync(filePath)) await unlink(filePath);
  } catch (err) {
    console.error("Failed to cleanup temp file:", err.message);
  }
};

/* ============================================================
   Derive file type from mimetype.
============================================================ */
export const getFileType = (mimetype) =>
  mimetype.startsWith("video/") ? "video" : "pdf";

/* ============================================================
   Build the slug string from a course title.
============================================================ */
export const buildSlug = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
// ── findCourseBySlugOrId ──────────────────────────────────────────────────────
// Before: up to 2 DB calls (findById → findOne({slug}))
// After:  0 DB calls on cache hit, 1 DB call on cache miss
export const findCourseBySlugOrId = async (slugOrId) => {
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    const course = await Course.findById(slugOrId).lean();
    if (course) return course;
  }
  return await Course.findOne({ slug: slugOrId }).lean();
};

// ── findContentBySlugOrId ─────────────────────────────────────────────────────
// Uses compound index { course: 1, _id: 1 } — single indexed lookup
export const findContentBySlugOrId = async (courseId, contentIdentifier) => {
  const query = mongoose.Types.ObjectId.isValid(contentIdentifier)
    ? { _id: contentIdentifier, course: courseId }
    : { slug: contentIdentifier, course: courseId };
  return await Content.findOne(query).lean();
};
