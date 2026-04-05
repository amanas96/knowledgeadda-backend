import asyncHandler from "express-async-handler";
import Enrollment from "../models/enrollment.js";
import { findCourseBySlugOrId } from "../helper/courseHelper.js";
import { ApiError } from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";

// ===============================
// @desc    Enroll in a course
// @route   POST /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const enrollInCourse = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const existing = await Enrollment.findOne({
    user: req.user._id,
    course: course._id,
  });
  if (existing) throw ApiError.conflict("Already enrolled in this course");

  const enrollment = await Enrollment.create({
    user: req.user._id,
    course: course._id,
  });

  new ApiResponse(201, enrollment, "Enrolled successfully").send(res);
});

// ===============================
// @desc    Unenroll from a course
// @route   DELETE /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const unenrollFromCourse = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const enrollment = await Enrollment.findOneAndDelete({
    user: req.user._id,
    course: course._id,
  });
  if (!enrollment) throw ApiError.notFound("Enrollment not found");

  new ApiResponse(200, null, "Unenrolled successfully").send(res);
});

// ===============================
// @desc    Check if user is enrolled
// @route   GET /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const getEnrollmentStatus = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const enrollment = await Enrollment.findOne({
    user: req.user._id,
    course: course._id,
  });

  new ApiResponse(
    200,
    { isEnrolled: !!enrollment },
    "Enrollment status fetched successfully",
  ).send(res);
});

// ===============================
// @desc    Get all enrolled courses for user
// @route   GET /api/v1/users/my-enrollments
// @access  Private
// ===============================
export const getMyEnrollments = asyncHandler(async (req, res) => {
  const enrollments = await Enrollment.find({ user: req.user._id })
    .populate("course", "title slug thumbnailUrl description tags")
    .sort({ createdAt: -1 })
    .lean();

  const courses = enrollments.map((e) => e.course);

  new ApiResponse(200, courses, "Enrollments fetched successfully").send(res);
});

// ===============================
// @desc    Get enrollment count for a course (Admin)
// @route   GET /api/v1/courses/:courseId/enrollments/count
// @access  Private/Admin
// ===============================
export const getCourseEnrollmentCount = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const count = await Enrollment.countDocuments({ course: course._id });

  new ApiResponse(200, { count }, "Enrollment count fetched successfully").send(
    res,
  );
});
