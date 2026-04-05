import asyncHandler from "express-async-handler";
import ApiResponse from "../../utils/ApiResponse.js";
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

/* ============================================================
   Create Quiz (Admin)
============================================================ */
export const createQuiz = asyncHandler(async (req, res) => {
  const data = await createQuizService(req.body, req.user._id);
  new ApiResponse(201, data, "Quiz created successfully").send(res);
});

/* ============================================================
   Get All Quizzes (Public)
============================================================ */
export const getAllQuizzes = asyncHandler(async (req, res) => {
  const data = await getAllQuizzesService(req.query);
  new ApiResponse(200, data, "Quizzes fetched successfully").send(res);
});

/* ============================================================
   Get Quiz By ID or Slug
============================================================ */
export const getQuizById = asyncHandler(async (req, res) => {
  const quiz = await getQuizByIdService(req.params.quizId);
  new ApiResponse(200, quiz, "Quiz fetched successfully").send(res);
});

/* ============================================================
   Get Quiz By Slug (explicit slug route)
============================================================ */
export const getQuizBySlug = asyncHandler(async (req, res) => {
  const quiz = await getQuizByIdService(req.params.slug);
  new ApiResponse(200, quiz, "Quiz fetched successfully").send(res);
});

/* ============================================================
   Get Quizzes For a Course
============================================================ */
export const getQuizzesForCourse = asyncHandler(async (req, res) => {
  const data = await getQuizzesForCourseService(req.params.courseId);
  new ApiResponse(200, data, "Course quizzes fetched successfully").send(res);
});

/* ============================================================
   Get Quiz Questions
============================================================ */
export const getQuizQuestions = asyncHandler(async (req, res) => {
  const data = await getQuizQuestionsService(req.params.quizId);
  new ApiResponse(200, data, "Quiz questions fetched successfully").send(res);
});

/* ============================================================
   Get Quiz Attempt Status
============================================================ */
export const getQuizAttemptStatus = asyncHandler(async (req, res) => {
  const data = await getQuizAttemptStatusService(req.params.quizId, req.user);
  new ApiResponse(200, data, "Attempt status fetched successfully").send(res);
});

/* ============================================================
   Submit Quiz
============================================================ */
export const submitQuiz = asyncHandler(async (req, res) => {
  const data = await submitQuizService(req.params.quizId, req.body, req.user);
  // isRetry means it was a repeat attempt on a single-attempt quiz — still 200
  const message = data.isRetry
    ? "Retry attempt — score not saved"
    : "Quiz submitted successfully";
  new ApiResponse(data.isRetry ? 200 : 201, data, message).send(res);
});

/* ============================================================
   Get Attempt History
============================================================ */
export const getAttemptHistory = asyncHandler(async (req, res) => {
  const data = await getAttemptHistoryService(req.params.quizId, req.user._id);
  new ApiResponse(200, data, "Attempt history fetched successfully").send(res);
});

/* ============================================================
   Review Quiz Attempt
============================================================ */
export const reviewQuiz = asyncHandler(async (req, res) => {
  const data = await reviewQuizService(
    req.params.quizId,
    req.query.attempt,
    req.user,
  );
  new ApiResponse(200, data, "Quiz review fetched successfully").send(res);
});

/* ============================================================
   Update Quiz (Admin)
============================================================ */
export const updateQuiz = asyncHandler(async (req, res) => {
  const quiz = await updateQuizService(req.params.quizId, req.body);
  new ApiResponse(200, quiz, "Quiz updated successfully").send(res);
});

/* ============================================================
   Delete Quiz (Admin)
============================================================ */
export const deleteQuiz = asyncHandler(async (req, res) => {
  await deleteQuizService(req.params.quizId);
  new ApiResponse(200, null, "Quiz deleted successfully").send(res);
});

/* ============================================================
   Add Question(s) to Quiz (Admin)
============================================================ */
export const addQuestionToQuiz = asyncHandler(async (req, res) => {
  const data = await addQuestionToQuizService(req.params.quizId, req.body);
  new ApiResponse(201, data, "Questions added successfully").send(res);
});

/* ============================================================
   Update Question (Admin)
============================================================ */
export const updateQuestion = asyncHandler(async (req, res) => {
  const question = await updateQuestionService(
    req.params.quizId,
    req.params.questionId,
    req.body,
  );
  new ApiResponse(200, question, "Question updated successfully").send(res);
});

/* ============================================================
   Delete Question (Admin)
============================================================ */
export const deleteQuestion = asyncHandler(async (req, res) => {
  await deleteQuestionService(req.params.questionId);
  new ApiResponse(200, null, "Question deleted successfully").send(res);
});

/* ============================================================
   Get Single Question (Admin)
============================================================ */
export const getAdminSingleQuestion = asyncHandler(async (req, res) => {
  const question = await getAdminSingleQuestionService(req.params.questionId);
  new ApiResponse(200, question, "Question fetched successfully").send(res);
});

/* ============================================================
   Quiz Leaderboard
============================================================ */
export const getQuizLeaderboard = asyncHandler(async (req, res) => {
  const data = await getQuizLeaderboardService(req.params.quizId);
  new ApiResponse(200, data, "Leaderboard fetched successfully").send(res);
});

/* ============================================================
   Global Leaderboard
============================================================ */
export const getGlobalLeaderboard = asyncHandler(async (req, res) => {
  const data = await getGlobalLeaderboardService();
  new ApiResponse(200, data, "Global leaderboard fetched successfully").send(
    res,
  );
});

/* ============================================================
   Add Questions to Existing Quiz (Admin Maintenance)
============================================================ */
export const addQuestionToExistingQuiz = asyncHandler(async (req, res) => {
  const data = await addQuestionToExistingQuizService(
    req.params.quizId,
    req.body,
  );
  new ApiResponse(201, data, "Questions added to quiz successfully").send(res);
});
