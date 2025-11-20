import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";

// ===============================
// @desc    Get all courses
// @route   GET /api/v1/courses
// @access  Public
// ===============================
export const getAllCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({});
  res.json(courses);
});

// ===============================
// @desc    Get a single course by ID
// @route   GET /api/v1/courses/:courseId
// @access  Private
// ===============================
export const getCourseById = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid course ID");
  }

  const course = await Course.findById(courseId);

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
  });

  res.status(201).json(course);
});

// ===============================
// @desc    Update a course
// @route   PUT /api/v1/courses/:courseId
// @access  Private/Admin
// ===============================
export const updateCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid course ID");
  }

  const { title, description, thumbnailUrl, tags } = req.body;
  const course = await Course.findById(courseId);

  if (!course) {
    res.status(404);
    throw new Error("Course not found");
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

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid course ID");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find all quizzes related to this course
    const quizzes = await Quiz.find({ course: courseId }).session(session);
    const quizIds = quizzes.map((q) => q._id);

    // Delete all questions for those quizzes
    if (quizIds.length > 0) {
      await Question.deleteMany({ quiz: { $in: quizIds } }).session(session);
    }

    // Delete all quizzes
    await Quiz.deleteMany({ course: courseId }).session(session);

    // Delete all content (videos, PDFs)
    await Content.deleteMany({ course: courseId }).session(session);

    // Delete the course itself
    const course = await Course.findByIdAndDelete(courseId).session(session);

    if (!course) {
      await session.abortTransaction();
      res.status(404);
      throw new Error("Course not found");
    }

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
  const { courseId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid course ID");
  }

  const courseExists = await Course.exists({ _id: courseId });
  if (!courseExists) {
    res.status(404);
    throw new Error("Course not found");
  }

  const isSubscribed = req.user?.isSubscribed || false;

  // Get all content for the course
  const allContent = await Content.find({ course: courseId });

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
export const addContentToCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const { title, contentType, contentUrl, isFree } = req.body;

  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid course ID");
  }

  const course = await Course.findById(courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  if (!title || !contentType || !contentUrl) {
    res.status(400);
    throw new Error("Please provide title, contentType, and contentUrl");
  }

  const content = await Content.create({
    title,
    course: courseId,
    contentType,
    contentUrl,
    isFree: isFree || false,
  });

  res.status(201).json(content);
});

// ===============================
// @desc    Get a single content item
// @route   GET /api/v1/courses/:courseId/content/:contentId
// @access  Private (Paywall)
// ===============================
export const getSingleContentItem = asyncHandler(async (req, res) => {
  const { courseId, contentId } = req.params;

  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(contentId)
  ) {
    res.status(400);
    throw new Error("Invalid IDs");
  }

  const content = await Content.findOne({ _id: contentId, course: courseId });

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
  if (
    !mongoose.Types.ObjectId.isValid(courseId) ||
    !mongoose.Types.ObjectId.isValid(contentId)
  ) {
    res.status(400);
    throw new Error("Invalid course ID or content ID");
  }

  // Check if content exists
  const content = await Content.findOne({ _id: contentId, course: courseId });

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
