import express from "express";
const router = express.Router();

import { protect } from "../middleware/authMiddleware.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
import { getSignedUrl } from "../controllers/courseController.js";

import {
  getAllCourses,
  getCourseById,
  getCourseContent,
  getSingleContentItem,
} from "../controllers/courseController.js";

import {
  enrollInCourse,
  unenrollFromCourse,
  getEnrollmentStatus,
} from "../controllers/enrollmentController.js";

// Public
router.get("/", getAllCourses);
router.get("/:courseId", getCourseById);

// Student (protected + subscription)
router.get("/:courseId/content", protect, checkSubscription, getCourseContent);
router.get(
  "/:courseId/content/:contentId",
  protect,
  checkSubscription,
  getSingleContentItem,
);
router.get("/:courseId/content/:contentId/signed-url", protect, getSignedUrl);

// Enrollment
router
  .route("/:courseId/enroll")
  .get(protect, getEnrollmentStatus)
  .post(protect, enrollInCourse)
  .delete(protect, unenrollFromCourse);

export default router;
