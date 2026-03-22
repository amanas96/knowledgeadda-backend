import express from "express";
import { protect, admin } from "../middleware/authMiddleware.js";
import { getAdminAnalytics } from "../controllers/adminController.js";
import asyncHandler from "express-async-handler";
import User from "../models/user.js";
import UserSubscription from "../models/userSubscription.js";
import {
  adminGetAllTickets,
  adminReplyToTicket,
  closeTicket,
} from "../controllers/contactController.js";
import {
  createCourse,
  updateCourse,
  deleteCourse,
  addContentToCourse,
  deleteContentFromCourse,
  deleteAttachment,
  addAttachmentToContent,
} from "../controllers/courseController.js";
import {
  createQuiz,
  updateQuiz,
  deleteQuiz,
  addQuestionToQuiz,
  updateQuestion,
  deleteQuestion,
  getQuizzesForCourse,
} from "../controllers/quizController.js";
import { getCourseEnrollmentCount } from "../controllers/enrollmentController.js";
import upload from "../middleware/multerMiddleware.js";

const router = express.Router();

router.use(protect, admin); // Protect all routes below and allow only admins

// ── Analytics ──────────────────────────────────────────────────────────────
router.get("/analytics", getAdminAnalytics);

// ── Contact / Tickets ──────────────────────────────────────────────────────
router.get("/tickets", adminGetAllTickets);
router.post("/tickets/reply/:id", adminReplyToTicket);
router.put("/tickets/close/:id", closeTicket);

// ── Courses ────────────────────────────────────────────────────────────────
router.post("/courses", createCourse);
router.put("/courses/:courseId", updateCourse);
router.delete("/courses/:courseId", deleteCourse);

// ── Content ────────────────────────────────────────────────────────────────
router.post(
  "/courses/:courseId/content",
  upload.single("contentFile"),
  addContentToCourse,
);
router.delete("/courses/:courseId/content/:contentId", deleteContentFromCourse);

router.post(
  "/courses/:courseId/content/:contentId/attachments",
  upload.single("attachmentFile"),
  addAttachmentToContent,
);

router.delete(
  "/courses/:courseId/content/:contentId/attachments/:attachmentId",
  deleteAttachment,
);

// ── Quizzes ────────────────────────────────────────────────────────────────
router.post("/quizzes", createQuiz);
router.put("/quizzes/:quizId", updateQuiz);
router.delete("/quizzes/:quizId", deleteQuiz);
router.get("/quizzes/course/:courseId", getQuizzesForCourse);

// ── Questions ──────────────────────────────────────────────────────────────
router.post("/quizzes/:quizId/questions", addQuestionToQuiz);
router.put("/quizzes/:quizId/questions/:questionId", updateQuestion);
router.delete("/quizzes/:quizId/questions/:questionId", deleteQuestion);

// ── All users
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const users = await User.find({ isAdmin: false })
      .select("-password")
      .sort({ date: -1 });
    res.json(users);
  }),
);

// ── Subscribed users with plan details
router.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    console.log("✅ subscriptions route hit"); // ← add this first

    const subscriptions = await UserSubscription.find()
      .populate("user", "name email")
      .populate("plan", "name price")
      .sort({ createdAt: -1 });
    const valid = subscriptions.filter((sub) => sub.user !== null);

    res.json(valid);
  }),
);

// enrollment
router.get(
  "/:courseId/enrollments/count",
  protect,
  admin,
  getCourseEnrollmentCount,
);

export default router;
