import asyncHandler from "express-async-handler";
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

/* ── tiny helper so every handler is one line ──────────────── */
const send = (res, { status, body }) => res.status(status).json(body);

// =============================================================================
// @desc    Get all courses (paginated, sorted)
// @route   GET /api/v1/courses
// @access  Public
// =============================================================================
export const getAllCourses = asyncHandler(async (req, res) => {
  send(res, await getAllCoursesService(req.query));
});

// =============================================================================
// @desc    Get a single course by ID or slug
// @route   GET /api/v1/courses/:courseId
// @access  Public
// =============================================================================
export const getCourseById = asyncHandler(async (req, res) => {
  send(res, await getCourseByIdService(req.params.courseId));
});

// =============================================================================
// @desc    Create a new course
// @route   POST /api/v1/courses
// @access  Private/Admin
// =============================================================================
export const createCourse = asyncHandler(async (req, res) => {
  send(res, await createCourseService(req.body, req.user._id));
});

// =============================================================================
// @desc    Update a course
// @route   PUT /api/v1/courses/:courseId
// @access  Private/Admin
// =============================================================================
export const updateCourse = asyncHandler(async (req, res) => {
  send(res, await updateCourseService(req.params.courseId, req.body));
});

// =============================================================================
// @desc    Delete a course and all related data
// @route   DELETE /api/v1/courses/:courseId
// @access  Private/Admin
// =============================================================================
export const deleteCourse = asyncHandler(async (req, res) => {
  send(res, await deleteCourseService(req.params.courseId));
});

// =============================================================================
// @desc    Get all content for a specific course
// @route   GET /api/v1/courses/:courseId/content
// @access  Private (Paywall)
// =============================================================================
export const getCourseContent = asyncHandler(async (req, res) => {
  const isSubscribed = req.user?.isSubscribed || false;
  send(res, await getCourseContentService(req.params.courseId, isSubscribed));
});

// =============================================================================
// @desc    Add new content to a specific course
// @route   POST /api/v1/courses/:courseId/content
// @access  Private/Admin
// =============================================================================
export const addContentToCourse = asyncHandler(async (req, res) => {
  send(
    res,
    await addContentToCourseService(
      req.params.courseId,
      req.body,
      req.file,
      req.user._id,
    ),
  );
});

// =============================================================================
// @desc    Get a single content item
// @route   GET /api/v1/courses/:courseId/content/:contentId
// @access  Private (Paywall)
// =============================================================================
export const getSingleContentItem = asyncHandler(async (req, res) => {
  send(
    res,
    await getSingleContentItemService(
      req.params.courseId,
      req.params.contentId,
      req.user,
    ),
  );
});

// =============================================================================
// @desc    Delete a specific content item
// @route   DELETE /api/v1/courses/:courseId/content/:contentId
// @access  Private/Admin
// =============================================================================
export const deleteContentFromCourse = asyncHandler(async (req, res) => {
  send(
    res,
    await deleteContentFromCourseService(
      req.params.courseId,
      req.params.contentId,
    ),
  );
});

// =============================================================================
// @desc    Add attachment to existing content
// @route   POST /api/v1/courses/:courseId/content/:contentId/attachments
// @access  Private/Admin
// =============================================================================
export const addAttachmentToContent = asyncHandler(async (req, res) => {
  send(
    res,
    await addAttachmentToContentService(
      req.params.courseId,
      req.params.contentId,
      req.body,
      req.file,
    ),
  );
});

// =============================================================================
// @desc    Delete a specific attachment
// @route   DELETE /api/v1/courses/:courseId/content/:contentId/attachments/:attachmentId
// @access  Private/Admin
// =============================================================================
export const deleteAttachment = asyncHandler(async (req, res) => {
  send(
    res,
    await deleteAttachmentService(
      req.params.courseId,
      req.params.contentId,
      req.params.attachmentId,
    ),
  );
});

// =============================================================================
// @desc    Get content URLs (video + attachments)
// @route   GET /api/v1/courses/:courseId/content/:contentId/signed-url
// @access  Private
// =============================================================================
export const getSignedUrl = asyncHandler(async (req, res) => {
  send(
    res,
    await getSignedUrlService(
      req.params.courseId,
      req.params.contentId,
      req.user,
    ),
  );
});
