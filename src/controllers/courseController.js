import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import WatchHistory from "../models/watchHistoryModel.js";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";

// helper function
// helper at top of controller
const findCourseBySlugOrId = async (slugOrId) => {
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    const course = await Course.findById(slugOrId);
    if (course) return course;
  }
  return await Course.findOne({ slug: slugOrId });
};

// ===============================
// @desc    Get all courses
// @route   GET /api/v1/courses
// @access  Public
// ===============================
export const getAllCourses = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 6;

  const courses = await Course.find({})
    .sort({ createdAt: -1 })
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
  const allContent = await Content.find({ course: course._id });

  // Add the 'isAccessible' flag
  const contentWithAccess = allContent.map((item) => ({
    ...item.toObject(),
    isAccessible: item.isFree || isSubscribed,
  }));

  res.json(contentWithAccess);
});

// ===============================
// @desc    Add new content to a specific course
// @route   POST /api/v1/courses/:courseId/content
// @access  Private/Admin
// ===============================
const ALLOWED_TYPES = ["video", "pdf", "notes", "link"];
export const addContentToCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { title, contentType, isFree } = req.body;

  const course = await findCourseBySlugOrId(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  if (!title || !contentType) {
    res.status(400);
    throw new Error("Please provide title, contentType");
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    res.status(400);
    throw new Error(
      `Invalid contentType. Allowed: ${ALLOWED_TYPES.join(", ")}`,
    );
  }

  let contentUrl = "";
  let publicId = "";
  let videoDuration = 0;

  if (req.file) {
    // FILE UPLOAD
    console.log("🎥 Processing FILE upload");
    const localFilePath = req.file.path;
    const folder = `knowledgeadda/${contentType}`;

    const uploadResponse = await uploadOnCloudinary(localFilePath, folder);
    console.log("🔵 CLOUDINARY RESPONSE:", uploadResponse);

    if (!uploadResponse) {
      res.status(500);
      throw new Error("Cloudinary upload failed");
    }

    contentUrl = uploadResponse.secure_url;
    publicId = uploadResponse.public_id;
    videoDuration = uploadResponse.duration || 0;

    console.log("✅ Cloudinary URL set to:", contentUrl);
  } else if (req.body.contentUrl) {
    // DIRECT LINK
    console.log("🔗 Processing DIRECT LINK");
    contentUrl = req.body.contentUrl;
    publicId = "";
    videoDuration = 0;

    console.log("✅ Direct URL set to:", contentUrl);
  } else {
    res.status(400);
    throw new Error("No content file or URL provided");
  }

  console.log("💾 SAVING TO DATABASE:", {
    title,
    contentType,
    contentUrl,
    publicId,
    videoDuration,
    isFree: isFree === "true" || isFree === true,
  });

  const content = await Content.create({
    title,
    course: course._id,
    contentType,
    contentUrl,
    publicId,
    videoDuration,
    isFree: isFree === "true" || isFree === true,
    createdBy: req.user._id,
  });

  console.log("✅ CONTENT CREATED:", content);

  res.status(201).json({
    message: "Content added successfully",
    content,
  });
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
    {
      user: req.user._id,
      content: contentId,
    },
    {
      user: req.user._id,
      content: contentId,
      course: course._id,
      lastWatchedAt: new Date(),
    },
    {
      upsert: true,
      new: true,
    },
  );

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
