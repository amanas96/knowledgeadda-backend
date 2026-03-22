import asyncHandler from "express-async-handler";
import { openSync, readSync, closeSync, existsSync } from "fs";
import { unlink } from "fs/promises";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import WatchHistory from "../models/watchHistoryModel.js";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { findCourseBySlugOrId } from "../helper/courseHelper.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 100MB

const allowedMimeTypes = {
  video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
  pdf: ["application/pdf"],
  notes: ["application/pdf", "application/msword"],
};

const isPasswordProtectedPdf = (filePath) => {
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

const cleanupFile = async (filePath) => {
  try {
    if (filePath && existsSync(filePath)) {
      await unlink(filePath);
    }
  } catch (err) {
    console.error("Failed to cleanup temp file:", err.message);
  }
};

// ===============================
// @desc    Get all courses
// @route   GET /api/v1/courses
// @access  Public
// ===============================
export const getAllCourses = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 6;
  const sortBy = req.query.sortBy || "title";
  const sortOrder = req.query.order === "desc" ? -1 : 1;

  const courses = await Course.find({})
    .sort({ [sortBy]: sortOrder })
    .limit(limit)
    .lean();

  res.json(courses);
});

// ===============================
// @desc    Get a single course by ID
// @route   GET /api/v1/courses/:courseId
// @access  Private
// ===============================
export const getCourseById = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }
  res.json(course);
});

// ===============================
// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private/Admin
// ===============================
export const createCourse = asyncHandler(async (req, res) => {
  const { title, description, thumbnailUrl, tags } = req.body;

  if (!title || !description || !thumbnailUrl) {
    res.status(400);
    throw new Error("Please provide title, description, and thumbnailUrl");
  }

  const course = await Course.create({
    title,
    description,
    thumbnailUrl,
    tags: tags || [],
    createdBy: req.user._id,
  });

  res.status(201).json(course);
});

// ===============================
// @desc    Update a course
// @route   PUT /api/v1/courses/:courseId
// @access  Private/Admin
// ===============================
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const { title, description, thumbnailUrl, tags } = req.body;
  if (title && title !== course.title) {
    course.slug = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }
  course.title = title || course.title;
  course.description = description || course.description;
  course.thumbnailUrl = thumbnailUrl || course.thumbnailUrl;
  course.tags = tags || course.tags;

  const updatedCourse = await course.save();
  res.json(updatedCourse);
});

// ===============================
// @desc    Delete a course and all related data
// @route   DELETE /api/v1/courses/:courseId
// @access  Private/Admin
// ===============================

export const deleteCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const course = await findCourseBySlugOrId(courseId);
    if (!course) {
      await session.abortTransaction();
      res.status(404);
      throw new Error("Course not found");
    }

    const quizzes = await Quiz.find({ course: course._id }).session(session);
    const quizIds = quizzes.map((q) => q._id);

    if (quizIds.length > 0) {
      await Question.deleteMany({ quiz: { $in: quizIds } }).session(session);
    }

    await Quiz.deleteMany({ course: course._id }).session(session);
    await Content.deleteMany({ course: course._id }).session(session);
    await Course.findByIdAndDelete(course._id).session(session);

    await session.commitTransaction();
    session.endSession();

    res.json({
      message: "Course and all related content deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw new Error(`Failed to delete course: ${error.message}`);
  }
});

// ===============================
// @desc    Get all content for a specific course
// @route   GET /api/v1/courses/:courseId/content
// @access  Private (Paywall)
// ===============================
export const getCourseContent = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const isSubscribed = req.user?.isSubscribed || false;

  // Get all content for the course
  const allContent = await Content.find({ course: course._id })
    .sort({ section: 1, createdAt: 1 })
    .lean();

  // Add the 'isAccessible' flag
  const contentWithAccess = allContent.map((item) => ({
    ...item,
    isAccessible: item.isFree || isSubscribed,
  }));
  const grouped = contentWithAccess.reduce((acc, item) => {
    const section = item.section || "General";
    if (!acc[section]) acc[section] = [];
    acc[section].push(item);
    return acc;
  }, {});

  res.json({
    items: contentWithAccess,
    grouped,
  });
});

// ===============================
// @desc    Add new content to a specific course
// @route   POST /api/v1/courses/:courseId/content
// @access  Private/Admin
// ===============================

export const addContentToCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const {
    title,
    isFree,
    section,
    attachmentType,
    attachmentName,
    attachmentUrl,
  } = req.body;
  const localFilePath = req.file?.path;

  try {
    const course = await findCourseBySlugOrId(courseId);
    if (!course) {
      res.status(404);
      throw new Error("Course not found");
    }

    if (!title) {
      res.status(400);
      throw new Error("Please provide title");
    }

    let video = undefined;
    let attachments = [];

    if (req.file) {
      const fileType = req.file.mimetype.startsWith("video/") ? "video" : "pdf";

      // ✅ file size check
      if (req.file.size > MAX_FILE_SIZE) {
        res.status(400);
        throw new Error("File size exceeds 200MB limit");
      }

      // ✅ mime type check
      const allowed = allowedMimeTypes[fileType];
      if (allowed && !allowed.includes(req.file.mimetype)) {
        res.status(400);
        throw new Error(`Invalid file type`);
      }

      // ✅ password protected PDF check
      if (fileType === "pdf" && isPasswordProtectedPdf(localFilePath)) {
        res.status(400);
        throw new Error(
          "Password-protected PDFs are not supported. Please remove the password and try again.",
        );
      }

      const folder =
        fileType === "video" ? "knowledgeadda/videos" : "knowledgeadda/pdfs";
      const uploadResponse = await uploadOnCloudinary(localFilePath, folder);

      if (!uploadResponse) {
        res.status(500);
        throw new Error("Cloudinary upload failed");
      }

      if (fileType === "video") {
        // ✅ primary video
        video = {
          url: uploadResponse.secure_url,
          publicId: uploadResponse.public_id,
          duration: uploadResponse.duration || 0,
          cloudinaryResourceType: uploadResponse.resource_type,
        };
      } else {
        attachments.push({
          type: "pdf",
          name: attachmentName || title,
          url: uploadResponse.secure_url,
          publicId: uploadResponse.public_id,
          cloudinaryResourceType: uploadResponse.resource_type,
        });
      }
    }

    // ✅ direct link attachment
    if (attachmentUrl && attachmentType) {
      attachments.push({
        type: attachmentType, // "pdf", "notes", "link"
        name: attachmentName || title,
        url: attachmentUrl,
        publicId: "",
      });
    }

    if (!video?.url && attachments.length === 0) {
      res.status(400);
      throw new Error("Please provide a video, PDF file, or URL");
    }

    const content = await Content.create({
      title,
      course: course._id,
      section: section || "General",
      ...(video && { video }),
      attachments,
      isFree: isFree === "true" || isFree === true,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: "Content added successfully",
      content,
    });
  } catch (error) {
    await cleanupFile(localFilePath);
    throw error;
  }
});

// ===============================
// @desc    Get a single content item
// @route   GET /api/v1/courses/:courseId/content/:contentId
// @access  Private (Paywall)
// ===============================
export const getSingleContentItem = asyncHandler(async (req, res) => {
  const { courseId, contentId } = req.params;
  const course = await findCourseBySlugOrId(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const content = await Content.findOne({ _id: contentId, course: course._id });

  if (!content) {
    res.status(404);
    throw new Error("Content not found");
  }

  // Paywall Check
  const isSubscribed = req.user?.isSubscribed || false;

  if (!content.isFree && !isSubscribed) {
    res.status(403);
    throw new Error("Subscription required to access this content");
  }

  await WatchHistory.findOneAndUpdate(
    { user: req.user._id, content: contentId },
    {
      user: req.user._id,
      content: contentId,
      course: course._id,
      lastWatchedAt: new Date(),
    },
    { upsert: true, new: true },
  );

  /// add striping in production

  res.json(content);
});
// ===============================
// @desc    Delete a specific content item
// @route   DELETE /api/v1/courses/:courseId/content/:contentId
// @access  Private/Admin
// ===============================
export const deleteContentFromCourse = asyncHandler(async (req, res) => {
  const { courseId, contentId } = req.params;

  // Validate IDs
  const course = await findCourseBySlugOrId(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    res.status(400);
    throw new Error("Invalid content ID");
  }

  // Check if content exists
  const content = await Content.findOne({ _id: contentId, course: course._id });

  if (!content) {
    res.status(404);
    throw new Error("Content not found for this course");
  }

  // Delete content
  await Content.findByIdAndDelete(contentId);

  res.json({
    message: "Content deleted successfully",
    contentId,
  });
});

// ===============================
// @desc    Add attachment to existing content
// @route   POST /api/v1/courses/:courseId/content/:contentId/attachments
// @access  Private/Admin
// ===============================
export const addAttachmentToContent = asyncHandler(async (req, res) => {
  console.log("req.file:", req.file); // ← is file here?
  console.log("req.body:", req.body); // ← is attachmentUrl here?
  console.log("attachmentUrl:", req.body.attachmentUrl);

  const { courseId, contentId } = req.params;
  const { attachmentType, attachmentName, attachmentUrl } = req.body;
  const localFilePath = req.file?.path;

  try {
    const course = await findCourseBySlugOrId(courseId);
    if (!course) {
      res.status(404);
      throw new Error("Course not found");
    }

    const content = await Content.findOne({
      _id: contentId,
      course: course._id,
    });
    if (!content) {
      res.status(404);
      throw new Error("Content not found");
    }

    if (!content.video?.publicId && !content.video?.url) {
      await cleanupFile(localFilePath);
      res.status(400);
      throw new Error("Attachments can only be added to video content");
    }
    let newAttachment = {};

    if (req.file) {
      // ✅ file size check
      if (req.file.size > MAX_FILE_SIZE) {
        res.status(400);
        throw new Error("File size exceeds 100MB limit");
      }

      // ✅ password protected PDF check
      if (
        req.file.mimetype === "application/pdf" &&
        isPasswordProtectedPdf(localFilePath)
      ) {
        res.status(400);
        throw new Error("Password-protected PDFs are not supported.");
      }

      const folderMap = {
        pdf: "knowledgeadda/pdfs",
        notes: "knowledgeadda/notes",
        link: "knowledgeadda/links",
      };
      const folder = folderMap[attachmentType] || "knowledgeadda/attachments";
      const uploadResponse = await uploadOnCloudinary(localFilePath, folder);

      console.log("Upload response:", {
        public_id: uploadResponse?.public_id,
        resource_type: uploadResponse?.resource_type,
        secure_url: uploadResponse?.secure_url,
        type: uploadResponse?.type,
      });

      if (!uploadResponse) {
        res.status(500);
        throw new Error("Cloudinary upload failed");
      }

      newAttachment = {
        type: attachmentType || "pdf",
        name: attachmentName || req.file.originalname,
        url: uploadResponse.secure_url,
        publicId: uploadResponse.public_id,
        cloudinaryResourceType: uploadResponse.resource_type,
      };
    } else if (attachmentUrl) {
      newAttachment = {
        type: attachmentType || "link",
        name: attachmentName || "Resource",
        url: attachmentUrl,
        publicId: "",
      };
    } else {
      res.status(400);
      throw new Error("Please provide a file or URL");
    }

    await Content.updateOne(
      { _id: contentId },
      { $push: { attachments: newAttachment } },
    );

    // fetch updated content to return
    const updatedContent = await Content.findById(contentId);

    res.json({
      message: "Attachment added successfully",
      content: updatedContent,
    });
  } catch (error) {
    await cleanupFile(localFilePath);
    throw error;
  }
});

// ===============================
// @desc    Delete a specific attachment
// @route   DELETE /api/v1/courses/:courseId/content/:contentId/attachments/:attachmentId
// @access  Private/Admin
// ===============================
export const deleteAttachment = asyncHandler(async (req, res) => {
  const { contentId, attachmentId } = req.params;

  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const content = await Content.findOne({ _id: contentId, course: course._id });
  if (!content) {
    res.status(404);
    throw new Error("Content not found");
  }

  const attachment = content.attachments.id(attachmentId);
  if (!attachment) {
    res.status(404);
    throw new Error("Attachment not found");
  }

  // ✅ use updateOne to bypass validation
  await Content.updateOne(
    { _id: contentId },
    { $pull: { attachments: { _id: attachmentId } } },
  );

  res.json({ message: "Attachment deleted successfully" });
});

// ===============================
// @desc    Get signed URL for content
// @route   GET /api/v1/courses/:courseId/content/:contentId/signed-url
// @access  Private
// ===============================
export const getSignedUrl = asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const content = await Content.findOne({ _id: contentId, course: course._id });
  if (!content) {
    res.status(404);
    throw new Error("Content not found");
  }

  const isSubscribed = req.user?.isSubscribed || false;
  if (!content.isFree && !isSubscribed) {
    res.status(403);
    throw new Error("Subscription required to access this content");
  }

  const urls = {};

  // ✅ video — return direct URL
  if (content.video?.url?.length) {
    urls.video = { url: content.video.url, expiresAt: null };
  }

  // ✅ attachments — return direct URLs
  if (content.attachments?.length > 0) {
    urls.attachments = content.attachments.map((att) => ({
      _id: att._id,
      name: att.name,
      type: att.type,
      url: att.url,
      expiresAt: null,
    }));
  }

  res.json({ urls });
});
