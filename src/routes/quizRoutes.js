import express from "express";
const router = express.Router();

import { protect } from "../middleware/authMiddleware.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
import {
  getAllQuizzes,
  getQuizzesForCourse,
  getQuizById,
  getQuizBySlug,
  getQuizQuestions,
  submitQuiz,
  reviewQuiz,
  getQuizAttemptStatus,
  getQuizLeaderboard,
  getGlobalLeaderboard,
} from "../controllers/quizController.js";

// Public
router.get("/", getAllQuizzes);

// Protected
router.get("/course/:courseId", protect, getQuizzesForCourse);

// ── Attempt routes (protected) ───────────────────────────────────────────────
router.get("/:quizId/attempt-status", protect, getQuizAttemptStatus);
router.get("/:quizId/questions", protect, checkSubscription, getQuizQuestions);
// router.get("/:quizId/review", protect, getQuizById);
router.post("/:quizId/submit", protect, submitQuiz);
router.get("/:quizId/review", protect, reviewQuiz);

router.get("/leaderboard/global", getGlobalLeaderboard);
router.get("/:quizId/leaderboard", getQuizLeaderboard);

// By ID (protected, subscription-checked)
router.get("/:quizId", protect, checkSubscription, getQuizById);

export default router;
