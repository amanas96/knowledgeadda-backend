import express from "express";
const router = express.Router();

import { protect, admin } from "../middleware/authMiddleware.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";

import {
  createCourse,
  addContentToCourse,
  getAllCourses,
  getCourseById,
  getCourseContent,
} from "../controllers/courseController.js";

// Admin
router.route("/").post(protect, admin, createCourse).get(getAllCourses);

// ...
router
  .route("/:courseId/content")
  .post(protect, admin, addContentToCourse)
  .get(protect, checkSubscription, getCourseContent);

// router.route("/:courseId/content").post(protect, admin, addContentToCourse);

// Student
router.route("/:courseId").get(protect, getCourseById);

// /// Paywall
// router
//   .route("/:courseId/content")
//   .get(protect, checkSubscription, getCourseContent);

export default router;
