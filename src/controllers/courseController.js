import asyncHandler from "express-async-handler";
import ApiResponse from "../../utils/ApiResponse.js";
import {
  getAllCoursesService,
  getCourseByIdService,
  createCourseService,
  updateCourseService,
  deleteCourseService,
  getCourseContentService,
  addContentToCourseService,
  getSingleContentItemService,
  deleteContentFromCourseService,
  addAttachmentToContentService,
  deleteAttachmentService,
  getSignedUrlService,
} from "../services/courseService.js";

// =============================================================================
// @desc    Get all courses (paginated, sorted)
// @route   GET /api/v1/courses
// @access  Public
// =============================================================================
export const getAllCourses = asyncHandler(async (req, res) => {
  const data = await getAllCoursesService(req.query);
  new ApiResponse(200, data, "Courses fetched successfully").send(res);
});

// =============================================================================
// @desc    Get a single course by ID or slug
// @route   GET /api/v1/courses/:courseId
// @access  Public
// =============================================================================
export const getCourseById = asyncHandler(async (req, res) => {
  const course = await getCourseByIdService(req.params.courseId);
  new ApiResponse(200, course, "Course fetched successfully").send(res);
});

// =============================================================================
// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private/Admin
// =============================================================================
export const createCourse = asyncHandler(async (req, res) => {
  const course = await createCourseService(req.body, req.user._id);
  new ApiResponse(201, course, "Course created successfully").send(res);
});

// =============================================================================
// @desc    Update a course
// @route   PUT /api/v1/courses/:courseId
// @access  Private/Admin
// =============================================================================
export const updateCourse = asyncHandler(async (req, res) => {
  const course = await updateCourseService(req.params.courseId, req.body);
  new ApiResponse(200, course, "Course updated successfully").send(res);
});

// =============================================================================
// @desc    Delete a course and all related data
// @route   DELETE /api/v1/courses/:courseId
// @access  Private/Admin
// =============================================================================
export const deleteCourse = asyncHandler(async (req, res) => {
  await deleteCourseService(req.params.courseId);
  new ApiResponse(
    200,
    null,
    "Course and all related content deleted successfully",
  ).send(res);
});

// =============================================================================
// @desc    Get all content for a specific course
// @route   GET /api/v1/courses/:courseId/content
// @access  Private (Paywall)
// =============================================================================
export const getCourseContent = asyncHandler(async (req, res) => {
  const isSubscribed = req.user?.isSubscribed ?? false;
  const data = await getCourseContentService(req.params.courseId, isSubscribed);
  new ApiResponse(200, data, "Course content fetched successfully").send(res);
});

// =============================================================================
// @desc    Add new content to a specific course
// @route   POST /api/v1/courses/:courseId/content
// @access  Private/Admin
// =============================================================================
export const addContentToCourse = asyncHandler(async (req, res) => {
  const content = await addContentToCourseService(
    req.params.courseId,
    req.body,
    req.file,
    req.user._id,
  );
  new ApiResponse(201, content, "Content added successfully").send(res);
});

// =============================================================================
// @desc    Get a single content item
// @route   GET /api/v1/courses/:courseId/content/:contentId
// @access  Private (Paywall)
// =============================================================================
export const getSingleContentItem = asyncHandler(async (req, res) => {
  const content = await getSingleContentItemService(
    req.params.courseId,
    req.params.contentId,
    req.user,
  );
  new ApiResponse(200, content, "Content fetched successfully").send(res);
});

// =============================================================================
// @desc    Delete a specific content item
// @route   DELETE /api/v1/courses/:courseId/content/:contentId
// @access  Private/Admin
// =============================================================================
export const deleteContentFromCourse = asyncHandler(async (req, res) => {
  const data = await deleteContentFromCourseService(
    req.params.courseId,
    req.params.contentId,
  );
  new ApiResponse(200, data, "Content deleted successfully").send(res);
});

// =============================================================================
// @desc    Add attachment to existing content
// @route   POST /api/v1/courses/:courseId/content/:contentId/attachments
// @access  Private/Admin
// =============================================================================
export const addAttachmentToContent = asyncHandler(async (req, res) => {
  const content = await addAttachmentToContentService(
    req.params.courseId,
    req.params.contentId,
    req.body,
    req.file,
  );
  new ApiResponse(200, content, "Attachment added successfully").send(res);
});

// =============================================================================
// @desc    Delete a specific attachment
// @route   DELETE /api/v1/courses/:courseId/content/:contentId/attachments/:attachmentId
// @access  Private/Admin
// =============================================================================
export const deleteAttachment = asyncHandler(async (req, res) => {
  await deleteAttachmentService(
    req.params.courseId,
    req.params.contentId,
    req.params.attachmentId,
  );
  new ApiResponse(200, null, "Attachment deleted successfully").send(res);
});

// =============================================================================
// @desc    Get content URLs (video + attachments)
// @route   GET /api/v1/courses/:courseId/content/:contentId/signed-url
// @access  Private
// =============================================================================
export const getSignedUrl = asyncHandler(async (req, res) => {
  const data = await getSignedUrlService(
    req.params.courseId,
    req.params.contentId,
    req.user,
  );
  new ApiResponse(200, data, "Signed URLs fetched successfully").send(res);
});
