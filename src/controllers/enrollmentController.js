// controllers/enrollmentController.js
import asyncHandler from "express-async-handler";
import Enrollment from "../models/enrollment.js";
import Course from "../models/courseModel.js";
import { findCourseBySlugOrId } from "../helper/courseHelper.js";

// ===============================
// @desc    Enroll in a course
// @route   POST /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const enrollInCourse = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  // check already enrolled
  const existing = await Enrollment.findOne({
    user: req.user._id,
    course: course._id,
  });

  if (existing) {
    return res.status(400).json({ message: "Already enrolled in this course" });
  }

  const enrollment = await Enrollment.create({
    user: req.user._id,
    course: course._id,
  });

  res.status(201).json({ message: "Enrolled successfully", enrollment });
});

// ===============================
// @desc    Unenroll from a course
// @route   DELETE /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const unenrollFromCourse = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const enrollment = await Enrollment.findOneAndDelete({
    user: req.user._id,
    course: course._id,
  });

  if (!enrollment) {
    return res.status(404).json({ message: "Enrollment not found" });
  }

  res.json({ message: "Unenrolled successfully" });
});

// ===============================
// @desc    Check if user is enrolled
// @route   GET /api/v1/courses/:courseId/enroll
// @access  Private
// ===============================
export const getEnrollmentStatus = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const enrollment = await Enrollment.findOne({
    user: req.user._id,
    course: course._id,
  });

  res.json({ isEnrolled: !!enrollment });
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
  res.json(courses);
});

// ===============================
// @desc    Get enrollment count for a course (Admin)
// @route   GET /api/v1/courses/:courseId/enrollments/count
// @access  Private/Admin
// ===============================
export const getCourseEnrollmentCount = asyncHandler(async (req, res) => {
  const course = await findCourseBySlugOrId(req.params.courseId);
  if (!course) {
    res.status(404);
    throw new Error("Course not found");
  }

  const count = await Enrollment.countDocuments({ course: course._id });
  res.json({ count });
});
