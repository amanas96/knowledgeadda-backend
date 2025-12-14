import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import Course from "../models/courseModel.js";
import QuizAttempt from "../models/quizAttempt.js";

/* ============================================================
   Create Quiz (Admin)
============================================================ */
export const createQuiz = asyncHandler(async (req, res) => {
  try {
    console.log("Request body:", req.body); // Log incoming data

    const { title, courseId, timeLimit, totalMarks, isPremium, category } =
      req.body;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid Course ID" });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const existingQuiz = await Quiz.findOne({ title, course: courseId });
    if (existingQuiz) {
      return res.status(400).json({
        message: "A quiz with this title already exists for this course.",
      });
    }

    console.log("Creating quiz with data:", {
      title,
      course: courseId,
      timeLimit: timeLimit || 0,
      totalMarks: totalMarks || 0,
      isPublished: true,
      isPremium: isPremium ?? true,
    });

    const quiz = await Quiz.create({
      title,
      course: courseId,
      timeLimit: timeLimit || 0,
      totalMarks: totalMarks || 0,
      isPublished: true,
      isPremium: isPremium ?? true,
      category: category || "General",
    });

    res.status(201).json(quiz);
  } catch (error) {
    console.error("Quiz creation error:", error); // This will show the actual error
    res.status(500).json({
      message: error.message,
      error: process.env.NODE_ENV === "development" ? error : {},
    });
  }
});

/* ============================================================
   Add Question to Quiz (Admin)
============================================================ */
export const addQuestionToQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { text, options, correctAnswer, marks, explanation } = req.body;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return res.status(400).json({ message: "Invalid Quiz ID" });
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  if (!text || !text.trim()) {
    return res.status(400).json({ message: "Question text is required." });
  }

  if (!Array.isArray(options) || options.length < 2) {
    return res
      .status(400)
      .json({ message: "Question must have at least 2 options." });
  }
  const uniqueOptions = new Set(options);
  if (uniqueOptions.size !== options.length) {
    return res.status(400).json({ message: "Options must be unique." });
  }

  if (!correctAnswer || !options.includes(correctAnswer)) {
    return res
      .status(400)
      .json({ message: "Correct answer must be one of the options." });
  }

  const question = await Question.create({
    quiz: quizId,
    text,
    options,
    correctAnswer,
    marks: marks || 1,
    explanation: explanation || "",
  });

  res.status(201).json(question);
});

/* ============================================================
   @desc    Get all quizzes (Independent Quiz Module)
   @route   GET /api/v1/quizzes
   @access  Public
============================================================ */
export const getAllQuizzes = asyncHandler(async (req, res) => {
  const quizzes = await Quiz.find()
    .sort({ createdAt: -1 })
    .select("title course category isPremium timeLimit totalMarks createdAt");

  res.json(quizzes);
});

/* ============================================================
   Get Quizzes for a Course (Subscribed)
============================================================ */
export const getQuizzesForCourse = asyncHandler(async (req, res) => {
  if (!req.user.isAdmin && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "Subscription required to access quizzes." });
  }

  const { courseId } = req.params;

  const quizzes = await Quiz.find({ course: courseId, isPublished: true })
    .sort({ createdAt: -1 })
    .select("title course timeLimit totalMarks createdAt");

  res.json(quizzes);
});

/* ============================================================
   Get Quiz Questions (check premium)
============================================================ */
export const getQuizQuestions = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return res.status(400).json({ message: "Invalid Quiz ID" });
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  // ⭐ Premium check AFTER loading quiz
  if (quiz.isPremium && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "This quiz is premium. Subscribe to unlock." });
  }

  const questions = await Question.find({ quiz: quizId })
    .select("-correctAnswer -explanation")
    .sort({ _id: 1 });

  res.json({ quizTitle: quiz.title, questions });
});

/* ============================================================
   Submit Quiz Attempt
============================================================ */
export const submitQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { answers } = req.body;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return res.status(400).json({ message: "Invalid Quiz ID" });
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  // ⭐ Premium check
  if (quiz.isPremium && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "Premium quiz. Subscription required." });
  }

  const allQuestions = await Question.find({ quiz: quizId });
  if (allQuestions.length === 0) {
    return res.status(400).json({ message: "No questions in this quiz." });
  }

  const previousAttempt = await QuizAttempt.findOne({
    user: req.user._id,
    quiz: quizId,
  });

  if (previousAttempt) {
    return res
      .status(400)
      .json({ message: "You have already attempted this quiz." });
  }

  let score = 0;
  let detailedResults = [];

  for (const q of allQuestions) {
    const userAnswer = answers.find((a) => a.questionId === q._id.toString());

    const isCorrect =
      userAnswer &&
      String(userAnswer.userAnswer).trim() === String(q.correctAnswer).trim();

    if (isCorrect) score += q.marks || 1;

    detailedResults.push({
      question: q._id,
      userAnswer: userAnswer ? userAnswer.userAnswer : null,
      correctAnswer: q.correctAnswer,
      isCorrect,
    });
  }

  const attempt = await QuizAttempt.create({
    user: req.user._id,
    quiz: quizId,
    score,
    totalQuestions: allQuestions.length,
    answers: detailedResults,
  });

  const populatedAttempt = await QuizAttempt.findById(attempt._id)
    .populate("quiz", "title course")
    .populate("answers.question", "text options marks");

  res.status(201).json({
    message: "Quiz submitted successfully.",
    attempt: populatedAttempt,
  });
});

/* ============================================================
   Review Quiz Attempt
============================================================ */
export const reviewQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return res.status(400).json({ message: "Invalid Quiz ID" });
  }

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  // ⭐ Premium check
  if (quiz.isPremium && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "Review locked. Subscribe to unlock premium quizzes." });
  }

  const attempt = await QuizAttempt.findOne({
    user: req.user._id,
    quiz: quizId,
  })
    .populate({
      path: "answers.question",
      select: "text options correctAnswer explanation marks",
    })
    .populate("quiz", "title course");

  if (!attempt) {
    return res.status(404).json({ message: "Quiz attempt not found." });
  }

  res.json({
    quizTitle: attempt.quiz.title,
    totalQuestions: attempt.totalQuestions,
    score: attempt.score,
    answers: attempt.answers.map((ans) => ({
      question: ans.question.text,
      options: ans.question.options,
      userAnswer: ans.userAnswer,
      correctAnswer: ans.correctAnswer,
      explanation: ans.question.explanation,
      isCorrect: ans.isCorrect,
      marks: ans.question.marks,
    })),
  });
});

// @desc    Get single quiz by ID
// @route   GET /api/v1/quizzes/:quizId
// @access  Private/Admin
export const getQuizById = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  console.log("Getting quiz by ID:", quizId);

  if (!mongoose.Types.ObjectId.isValid(quizId)) {
    return res.status(400).json({ message: "Invalid Quiz ID" });
  }

  const quiz = await Quiz.findById(quizId)
    .populate("course", "title description") // Include course info
    .lean();

  if (!quiz) {
    return res.status(404).json({ message: "Quiz not found" });
  }
  console.log("Quiz found:", quiz);
  res.json(quiz);
});

////////////////////////// update Quiz

export const updateQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const updates = req.body;

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  Object.assign(quiz, updates);

  await quiz.save();
  res.json({ message: "Quiz updated", quiz });
});

///////////////////////////// delete Quiz

export const deleteQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  const quiz = await Quiz.findById(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  await Question.deleteMany({ quiz: quizId });
  await quiz.deleteOne();

  res.json({ message: "Quiz deleted successfully" });
});

////////////////// update question

export const updateQuestion = asyncHandler(async (req, res) => {
  const { quizId, questionId } = req.params;
  const updates = req.body;

  const question = await Question.findOne({ _id: questionId, quiz: quizId });
  if (!question) return res.status(404).json({ message: "Question not found" });

  // If options updated, ensure correctAnswer is still valid
  if (updates.options && !updates.options.includes(updates.correctAnswer)) {
    return res.status(400).json({
      message: "Correct answer must be one of the updated options",
    });
  }

  Object.assign(question, updates);
  await question.save();

  res.json({ message: "Question updated", question });
});

/////////////////// delete question
export const deleteQuestion = asyncHandler(async (req, res) => {
  const { quizId, questionId } = req.params;

  const question = await Question.findOne({ _id: questionId, quiz: quizId });
  if (!question) return res.status(404).json({ message: "Question not found" });

  await question.deleteOne();
  res.json({ message: "Question deleted successfully" });
});
