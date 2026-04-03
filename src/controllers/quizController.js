import asyncHandler from "express-async-handler";
import {
  createQuizService,
  getAllQuizzesService,
  getQuizByIdService,
  getQuizzesForCourseService,
  getQuizQuestionsService,
  getQuizAttemptStatusService,
  submitQuizService,
  getAttemptHistoryService,
  reviewQuizService,
  updateQuizService,
  deleteQuizService,
  addQuestionToQuizService,
  updateQuestionService,
  deleteQuestionService,
  getAdminSingleQuestionService,
  getQuizLeaderboardService,
  getGlobalLeaderboardService,
  addQuestionToExistingQuizService,
} from "../services/quizService.js";

export { findAttemptByIdOrSlug } from "../helper/quizHelper.js";

/* ── tiny helper so every handler is one line ──────────────── */
const send = (res, { status, body }) => res.status(status).json(body);

/* ============================================================
   Create Quiz (Admin)
============================================================ */
export const createQuiz = asyncHandler(async (req, res) => {
  send(res, await createQuizService(req.body, req.user._id));
});

/* ============================================================
   Get All Quizzes (Public)
============================================================ */
export const getAllQuizzes = asyncHandler(async (req, res) => {
  send(res, await getAllQuizzesService(req.query));
});

/* ============================================================
   Get Quiz By ID or Slug
============================================================ */
export const getQuizById = asyncHandler(async (req, res) => {
  send(res, await getQuizByIdService(req.params.quizId));
});

/* ============================================================
   Get Quiz By Slug (explicit slug route)
============================================================ */
export const getQuizBySlug = asyncHandler(async (req, res) => {
  send(res, await getQuizByIdService(req.params.slug));
});

/* ============================================================
   Get Quizzes For a Course
============================================================ */
export const getQuizzesForCourse = asyncHandler(async (req, res) => {
  send(res, await getQuizzesForCourseService(req.params.courseId));
});

/* ============================================================
   Get Quiz Questions
============================================================ */
export const getQuizQuestions = asyncHandler(async (req, res) => {
  send(res, await getQuizQuestionsService(req.params.quizId));
});

/* ============================================================
   Get Quiz Attempt Status
============================================================ */
export const getQuizAttemptStatus = asyncHandler(async (req, res) => {
  send(res, await getQuizAttemptStatusService(req.params.quizId, req.user));
});

/* ============================================================
   Submit Quiz
============================================================ */
export const submitQuiz = asyncHandler(async (req, res) => {
  send(res, await submitQuizService(req.params.quizId, req.body, req.user));
});

/* ============================================================
   Get Attempt History
============================================================ */
export const getAttemptHistory = asyncHandler(async (req, res) => {
  send(res, await getAttemptHistoryService(req.params.quizId, req.user._id));
});

/* ============================================================
   Review Quiz Attempt
============================================================ */
export const reviewQuiz = asyncHandler(async (req, res) => {
  send(
    res,
    await reviewQuizService(req.params.quizId, req.query.attempt, req.user),
  );
});

/* ============================================================
   Update Quiz (Admin)
============================================================ */
export const updateQuiz = asyncHandler(async (req, res) => {
  send(res, await updateQuizService(req.params.quizId, req.body));
});

/* ============================================================
   Delete Quiz (Admin)
============================================================ */
export const deleteQuiz = asyncHandler(async (req, res) => {
  send(res, await deleteQuizService(req.params.quizId));
});

/* ============================================================
   Add Question(s) to Quiz (Admin)
============================================================ */
export const addQuestionToQuiz = asyncHandler(async (req, res) => {
  send(res, await addQuestionToQuizService(req.params.quizId, req.body));
});

/* ============================================================
   Update Question (Admin)
============================================================ */
export const updateQuestion = asyncHandler(async (req, res) => {
  send(
    res,
    await updateQuestionService(
      req.params.quizId,
      req.params.questionId,
      req.body,
    ),
  );
});

/* ============================================================
   Delete Question (Admin)
============================================================ */
export const deleteQuestion = asyncHandler(async (req, res) => {
  send(res, await deleteQuestionService(req.params.questionId));
});

/* ============================================================
   Get Single Question (Admin)
============================================================ */
export const getAdminSingleQuestion = asyncHandler(async (req, res) => {
  send(res, await getAdminSingleQuestionService(req.params.questionId));
});

/* ============================================================
   Quiz Leaderboard
============================================================ */
export const getQuizLeaderboard = asyncHandler(async (req, res) => {
  send(res, await getQuizLeaderboardService(req.params.quizId));
});

/* ============================================================
   Global Leaderboard
============================================================ */
export const getGlobalLeaderboard = asyncHandler(async (req, res) => {
  send(res, await getGlobalLeaderboardService());
});

/* ============================================================
   Add Questions to Existing Quiz (Admin Maintenance)
============================================================ */
export const addQuestionToExistingQuiz = asyncHandler(async (req, res) => {
  send(
    res,
    await addQuestionToExistingQuizService(req.params.quizId, req.body),
  );
});
