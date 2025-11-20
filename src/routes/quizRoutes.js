import express from "express";
const router = express.Router();

import { protect, admin } from "../middleware/authMiddleware.js";
import {
  createQuiz,
  addQuestionToQuiz,
  getQuizQuestions,
  getQuizzesForCourse,
  submitQuiz,
  reviewQuiz,
  getAllQuizzes,
} from "../controllers/quizController.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";

// --- Admin Routes ---

// @route   POST /api/v1/quizzes
// @desc    Create a new quiz
router.route("/").get(getAllQuizzes).post(protect, admin, createQuiz);

router.route("/course/:courseId").get(protect, getQuizzesForCourse); // No subscription required to LIST
router.get("/admin/course/:courseId", protect, admin, getQuizzesForCourse);
// @route   POST /api/v1/quizzes/:quizId/questions
// @desc    Add a question to a specific quiz
router
  .route("/:quizId/questions")
  .post(protect, admin, addQuestionToQuiz)
  .get(protect, checkSubscription, getQuizQuestions);

router.route("/:quizId/submit").post(protect, checkSubscription, submitQuiz);
router.route("/:quizId/review").get(protect, checkSubscription, reviewQuiz);
export default router;
