// In controllers/courseController.js
import asyncHandler from "express-async-handler";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import mongoose from "mongoose";

// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private/Admin
export const createCourse = asyncHandler(async (req, res) => {
  // 1. Get data from the request body
  const { title, description, thumbnailUrl, tags } = req.body;

  // 2. Simple validation
  if (!title || !description || !thumbnailUrl) {
    res.status(400); // Bad Request
    throw new Error("Please provide title, description, and thumbnailUrl");
  }

  // 3. Create a new course instance
  const course = new Course({
    title,
    description,
    thumbnailUrl,
    tags: tags || [], // Use provided tags or default to an empty array
  });

  // 4. Save to the database
  const createdCourse = await course.save();

  // 5. Send response
  res.status(201).json(createdCourse); // 201 = Resource Created
});

// @desc    Add new content to a specific course
// @route   POST /api/v1/courses/:courseId/content
// @access  Private/Admin
export const addContentToCourse = asyncHandler(async (req, res) => {
  // 1. Get the course ID from the URL parameters
  const { courseId } = req.params;

  // 2. Get content data from the request body
  const { title, contentType, contentUrl, isFree } = req.body;

  // 3. Validate Course ID
  if (!mongoose.Types.ObjectId.isValid(courseId)) {
    res.status(400);
    throw new Error("Invalid Course ID");
  }

  // 4. Find the parent course to make sure it exists
  const course = await Course.findById(courseId);

  if (!course) {
    res.status(404); // Not Found
    throw new Error("Course not found");
  }

  // 5. Validate content data
  if (!title || !contentType || !contentUrl) {
    res.status(400);
    throw new Error("Please provide title, contentType, and contentUrl");
  }

  // 6. Create the new content instance
  const content = new Content({
    title,
    course: courseId, // Link this content to its parent course
    contentType,
    contentUrl,
    isFree: isFree || false, // Default to false if not provided
  });

  // 7. Save to the database
  const createdContent = await content.save();

  // 8. Send response
  res.status(201).json(createdContent);
});

export const getAllCourses = asyncHandler(async (req, res) => {
  const courses = await Course.find({}); // Find all courses
  res.json(courses);
});

export const getCourseById = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.courseId);

  if (course) {
    res.json(course);
  } else {
    res.status(404);
    throw new Error("Course not found");
  }
});

export const getCourseContent = asyncHandler(async (req, res) => {
  let content;

  // checkSubscription middleware adds 'isSubscribed'
  if (req.user.isSubscribed) {
    // --- SUBSCRIBED USER ---
    // Get ALL content for this course
    content = await Content.find({ course: req.params.courseId });
  } else {
    // --- NON-SUBSCRIBED USER ---
    // Get ONLY the free content
    content = await Content.find({
      course: req.params.courseId,
      isFree: true,
    });
  }

  if (content) {
    res.json(content);
  } else {
    res.status(404);
    throw new Error("Content not found for this course");
  }
});

export const getSingleContentItem = asyncHandler(async (req, res) => {
  const { contentId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    res.status(400);
    throw new Error("Invalid Content ID");
  }

  const content = await Content.findById(contentId);

  if (!content) {
    res.status(404);
    throw new Error("Content not found");
  }
  /// PayWall logic
  if (content.isFree) {
    return res.json(content);
  }
  if (req.user.isSubscribed) {
    return res.json(content);
  }

  // 3. If not free and not subscribed, deny access
  res.status(403);
  throw new Error("Subscription required to view this content.");
});
