// // import express from "express";
// // const router = express.Router();

// // import { protect, admin } from "../middleware/authMiddleware.js";
// // import {
// //   createQuiz,
// //   addQuestionToQuiz,
// //   getQuizQuestions,
// //   getQuizzesForCourse,
// //   submitQuiz,
// //   reviewQuiz,
// //   getAllQuizzes,
// // } from "../controllers/quizController.js";
// // import { checkSubscription } from "../middleware/subscriptionMiddleware.js";

// // // --- Admin Routes ---

// // // @route   POST /api/v1/quizzes
// // // @desc    Create a new quiz
// // router.route("/").get(getAllQuizzes).post(protect, admin, createQuiz);

// // router.route("/course/:courseId").get(protect, getQuizzesForCourse);
// // router.get("/admin/course/:courseId", protect, admin, getQuizzesForCourse);
// // // @route   POST /api/v1/quizzes/:quizId/questions
// // // @desc    Add a question to a specific quiz
// // router
// //   .route("/:quizId/questions")
// //   .post(protect, admin, addQuestionToQuiz)
// //   .get(protect, checkSubscription, getQuizQuestions);

// // router.route("/:quizId/submit").post(protect, checkSubscription, submitQuiz);
// // router.route("/:quizId/review").get(protect, checkSubscription, reviewQuiz);
// // export default router;

// import express from "express";
// const router = express.Router();

// import { protect, admin } from "../middleware/authMiddleware.js";
// import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
// import {
//   createQuiz,
//   getAllQuizzes,
//   getQuizzesForCourse,
//   updateQuiz,
//   deleteQuiz,
//   getQuizById,
//   getQuizQuestions,
//   addQuestionToQuiz,
//   updateQuestion,
//   deleteQuestion,
//   submitQuiz,
//   reviewQuiz,
// } from "../controllers/quizController.js";

// // Create + list quizzes
// router.route("/").get(getAllQuizzes).post(protect, admin, createQuiz);

// // IMPORTANT: Specific routes BEFORE generic ones
// router.get("/course/:courseId", protect, getQuizzesForCourse);

// // Single quiz CRUD
// router
//   .route("/:quizId")
//   .get(protect, checkSubscription, getQuizById) // remove admin middleware to allow students to view quiz details
//   .put(protect, admin, updateQuiz)
//   .delete(protect, admin, deleteQuiz);

// // Questions
// router
//   .route("/:quizId/questions")
//   .post(protect, admin, addQuestionToQuiz)
//   .get(protect, checkSubscription, getQuizQuestions);

// router
//   .route("/:quizId/questions/:questionId")
//   .put(protect, admin, updateQuestion)
//   .delete(protect, admin, deleteQuestion);

// // Student actions
// router.post("/:quizId/submit", protect, checkSubscription, submitQuiz);
// router.get("/:quizId/review", protect, checkSubscription, reviewQuiz);

// export default router;

import express from "express";
const router = express.Router();

import { protect } from "../middleware/authMiddleware.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
import {
  getAllQuizzes,
  getQuizzesForCourse,
  getQuizById,
  getQuizQuestions,
  submitQuiz,
  reviewQuiz,
  getQuizAttemptStatus,
} from "../controllers/quizController.js";

// Public
router.get("/", getAllQuizzes);

// Protected
router.get("/course/:courseId", protect, getQuizzesForCourse);
router.get("/:quizId", protect, checkSubscription, getQuizById);
router.get("/:quizId/questions", protect, checkSubscription, getQuizQuestions);
router.get(
  "/:quizId/attempt-status",
  protect,
  checkSubscription,
  getQuizAttemptStatus,
);
router.post("/:quizId/submit", protect, checkSubscription, submitQuiz);
router.get("/:quizId/review", protect, checkSubscription, reviewQuiz);

export default router;
