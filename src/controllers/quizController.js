import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import Course from "../models/courseModel.js";
import QuizAttempt from "../models/quizAttempt.js";

/* ============================================================
   ✅ Reusable helper — returns QUERY (not document) so you
   can chain .populate(), .select(), .lean() etc.
============================================================ */
const findQuizBySlugOrId = (param) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(param);
  return Quiz.findOne(isObjectId ? { _id: param } : { slug: param });
};

const findCourseBySlugOrId = async (slugOrId) => {
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    const course = await Course.findById(slugOrId);
    if (course) return course;
  }
  return await Course.findOne({ slug: slugOrId });
};

/* ============================================================
   Create Quiz (Admin)
============================================================ */
export const createQuiz = asyncHandler(async (req, res) => {
  const {
    title,
    slug,
    description,
    courseId,
    timeLimit,
    totalMarks,
    isPremium,
    category,
    customCategory,
    allowMultipleAttempts,
    tags,
    quizType,
  } = req.body;

  if (!title?.trim()) {
    return res.status(400).json({ message: "Title is required" });
  }

  let course = null;
  if (courseId) {
    course = await findCourseBySlugOrId(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });
  }

  // Check duplicate title in same course
  if (course) {
    const existingQuiz = await Quiz.findOne({ title, course: course._id });
    if (existingQuiz) {
      return res.status(400).json({
        message: "A quiz with this title already exists for this course.",
      });
    }
  }

  // Check slug uniqueness
  if (slug) {
    const existingSlug = await Quiz.findOne({ slug });
    if (existingSlug) {
      return res.status(400).json({
        message: "This slug is already taken. Please choose another.",
      });
    }
  }

  if (category === "Other" && !customCategory) {
    return res.status(400).json({
      message: "customCategory is required when category is Other",
    });
  }

  const quiz = await Quiz.create({
    title,
    slug,
    description,
    course: course?._id || null,
    timeLimit: Number(timeLimit) || 0,
    totalMarks: Number(totalMarks) || 0,
    isPublished: false,
    isPremium: isPremium ?? false,
    category: category || "General",
    customCategory: category === "Other" ? customCategory : null,
    quizType: quizType || (courseId ? "course" : "standalone"),
    allowMultipleAttempts: allowMultipleAttempts ?? true,
    tags: tags || [],
    createdBy: req.user._id,
  });

  res.status(201).json(quiz);
});

/* ============================================================
   Get All Quizzes (Public)
============================================================ */
export const getAllQuizzes = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 6;
  const quizType = req.query.type;

  const filter = { isPublished: true };
  if (quizType) filter.quizType = quizType;

  let query = Quiz.find(filter).sort({ createdAt: -1 }).select(
    "title slug course category isPremium timeLimit totalMarks createdAt quizType", // ✅ add quizType to select
  );

  if (limit > 0) {
    query = query.limit(limit);
  }

  const quizzes = await query.lean();

  const quizzesWithCount = await Promise.all(
    quizzes.map(async (quiz) => {
      const totalQuestions = await Question.countDocuments({ quiz: quiz._id });
      return { ...quiz, totalQuestions };
    }),
  );

  res.json(quizzesWithCount);
});

/* ============================================================
   Get Quiz By ID or Slug
============================================================ */
export const getQuizById = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  // ✅ No ObjectId check — findQuizBySlugOrId handles both
  const quiz = await findQuizBySlugOrId(quizId)
    .populate("course", "title description")
    .lean();

  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const totalQuestions = await Question.countDocuments({ quiz: quiz._id });

  res.json({ ...quiz, totalQuestions });
});

/* ============================================================
   Get Quiz By Slug (explicit slug route)
============================================================ */
export const getQuizBySlug = asyncHandler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Just pass slug string — helper handles slug or _id
  const quiz = await findQuizBySlugOrId(slug)
    .populate("course", "title description")
    .lean();

  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const totalQuestions = await Question.countDocuments({ quiz: quiz._id });

  res.json({ ...quiz, totalQuestions });
});

/* ============================================================
   Get Quizzes For a Course
============================================================ */
export const getQuizzesForCourse = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const course = await findCourseBySlugOrId(courseId);
  if (!course) {
    return res.status(404).json({ message: "Course not found" });
  }

  // ✅ Use Quiz.find() directly — not findQuizBySlugOrId
  const quizzes = await Quiz.find({ course: course._id, isPublished: true })
    .sort({ createdAt: -1 })
    .select(
      "title slug course category isPremium timeLimit totalMarks createdAt",
    )
    .lean();

  const quizzesWithCount = await Promise.all(
    quizzes.map(async (quiz) => {
      const totalQuestions = await Question.countDocuments({ quiz: quiz._id });
      return { ...quiz, totalQuestions };
    }),
  );

  res.json(quizzesWithCount);
});

/* ============================================================
   Get Quiz Questions
============================================================ */
export const getQuizQuestions = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  // ✅ Just pass string — helper handles both slug and _id
  const quiz = await findQuizBySlugOrId(quizId).lean();
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const questions = await Question.find({ quiz: quiz._id })
    .select("-correctAnswer") // hide correct answer from students
    .lean();

  res.json({
    quizId: quiz._id, // ✅ always return _id for submit
    quizTitle: quiz.title,
    timeLimit: quiz.timeLimit,
    questions,
  });
});

/* ============================================================
   Get Quiz Attempt Status
============================================================ */
export const getQuizAttemptStatus = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  // ✅ No ObjectId check — supports both slug and _id
  const quiz = await findQuizBySlugOrId(quizId).select(
    "allowMultipleAttempts isPremium title",
  );

  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  if (quiz.isPremium && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "Premium quiz. Subscription required." });
  }

  const previousAttempt = await QuizAttempt.findOne({
    user: req.user._id,
    quiz: quiz._id, // ✅ use quiz._id not the param string
    isRetry: false,
  })
    .sort({ createdAt: -1 })
    .select("score totalQuestions percentage timeTaken createdAt")
    .lean();

  res.json({
    hasAttempted: !!previousAttempt,
    allowMultipleAttempts: quiz.allowMultipleAttempts,
    lastAttempt: previousAttempt || null,
  });
});

/* ============================================================
   Submit Quiz
============================================================ */
export const submitQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { answers, timeTaken = 0 } = req.body;

  // ✅ No ObjectId check — supports both slug and _id
  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  // Premium check
  if (quiz.isPremium && !req.user.isSubscribed) {
    return res
      .status(403)
      .json({ message: "Premium quiz. Subscription required." });
  }

  // Fetch questions using quiz._id
  const allQuestions = await Question.find({ quiz: quiz._id });
  if (!allQuestions.length) {
    return res.status(400).json({ message: "No questions in this quiz." });
  }

  // Evaluate answers FIRST
  let score = 0;
  const detailedResults = allQuestions.map((q) => {
    const userAnswer = answers.find(
      (a) => String(a.questionId) === String(q._id),
    );
    const isCorrect =
      userAnswer &&
      String(userAnswer.userAnswer).trim() === String(q.correctAnswer).trim();

    if (isCorrect) score += q.marks || 1;

    return {
      question: q._id,
      userAnswer: userAnswer ? userAnswer.userAnswer : null,
      correctAnswer: q.correctAnswer,
      isCorrect: !!isCorrect,
    };
  });

  // Check previous attempt AFTER evaluation
  const previousAttempt = await QuizAttempt.findOne({
    user: req.user._id,
    quiz: quiz._id, // ✅ use quiz._id
    isRetry: false,
  });

  // Retry on single-attempt quiz — return score but don't save
  if (previousAttempt && !quiz.allowMultipleAttempts) {
    const percentage = Number(
      Math.min((score / allQuestions.length) * 100, 100).toFixed(2),
    );
    return res.json({
      isRetry: true,
      score,
      totalQuestions: allQuestions.length,
      percentage,
      answers: detailedResults,
      message: "Retry attempt — score not saved",
    });
  }
  const isRetryAttempt = !!previousAttempt;
  // Save real attempt
  const attempt = await QuizAttempt.create({
    user: req.user._id,
    quiz: quiz._id, // ✅ use quiz._id
    score,
    totalQuestions: allQuestions.length,
    timeTaken,
    isRetry: isRetryAttempt,
    status: "completed",
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

  // ✅ No ObjectId check — supports both slug and _id
  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  if (quiz.isPremium && !req.user.isSubscribed) {
    return res.status(403).json({
      message: "Review locked. Subscribe to unlock premium quizzes.",
    });
  }

  const attempt = await QuizAttempt.findOne({
    user: req.user._id,
    quiz: quiz._id, // ✅ use quiz._id
  })
    .populate({
      path: "answers.question",
      select: "text options correctAnswer explanation marks",
    })
    .populate("quiz", "title course");

  if (!attempt) {
    return res.status(404).json({ message: "No attempt found for this quiz." });
  }

  res.json({
    quizTitle: quiz.title,
    totalQuestions: attempt.totalQuestions,
    score: attempt.score,
    percentage: attempt.percentage,
    answers: attempt.answers.map((ans) => ({
      question: ans.question?.text,
      options: ans.question?.options,
      userAnswer: ans.userAnswer,
      correctAnswer: ans.correctAnswer,
      explanation: ans.question?.explanation,
      isCorrect: ans.isCorrect,
      marks: ans.question?.marks,
    })),
  });
});

/* ============================================================
   Update Quiz (Admin)
============================================================ */
export const updateQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const updates = req.body;

  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  if (updates.category === "Other" && !updates.customCategory) {
    return res.status(400).json({
      message: "customCategory is required when category is Other",
    });
  }

  // Clear customCategory if category changed away from Other
  if (updates.category && updates.category !== "Other") {
    updates.customCategory = null;
  }

  // Check slug uniqueness if slug is being changed
  if (updates.slug && updates.slug !== quiz.slug) {
    const existingSlug = await Quiz.findOne({ slug: updates.slug });
    if (existingSlug) {
      return res.status(400).json({
        message: "This slug is already taken. Please choose another.",
      });
    }
  }

  Object.assign(quiz, updates);
  await quiz.save();

  res.json({ message: "Quiz updated", quiz });
});

/* ============================================================
   Delete Quiz (Admin)
============================================================ */
export const deleteQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;

  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  await Question.deleteMany({ quiz: quiz._id }); // ✅ use quiz._id
  await quiz.deleteOne();

  res.json({ message: "Quiz deleted successfully" });
});

/* ============================================================
   Add Question to Quiz (Admin)
============================================================ */
export const addQuestionToQuiz = asyncHandler(async (req, res) => {
  const { quizId } = req.params;
  const { text, options, correctAnswer, marks, explanation } = req.body;

  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  if (!text?.trim()) {
    return res.status(400).json({ message: "Question text is required." });
  }

  if (!Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ message: "At least 2 options required." });
  }

  const uniqueOptions = new Set(options);
  if (uniqueOptions.size !== options.length) {
    return res.status(400).json({ message: "Options must be unique." });
  }

  if (!correctAnswer || !options.includes(correctAnswer)) {
    return res.status(400).json({
      message: "Correct answer must be one of the options.",
    });
  }

  const question = await Question.create({
    quiz: quiz._id, // ✅ use quiz._id
    text,
    options,
    correctAnswer,
    marks: marks || 1,
    explanation: explanation || "",
  });

  res.status(201).json(question);
});

/* ============================================================
   Update Question (Admin)
============================================================ */
export const updateQuestion = asyncHandler(async (req, res) => {
  const { quizId, questionId } = req.params;
  const updates = req.body;

  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const question = await Question.findOne({ _id: questionId, quiz: quiz._id });
  if (!question) return res.status(404).json({ message: "Question not found" });

  if (updates.options && !updates.options.includes(updates.correctAnswer)) {
    return res.status(400).json({
      message: "Correct answer must be one of the updated options",
    });
  }

  Object.assign(question, updates);
  await question.save();

  res.json({ message: "Question updated", question });
});

/* ============================================================
   Delete Question (Admin)
============================================================ */
export const deleteQuestion = asyncHandler(async (req, res) => {
  const { quizId, questionId } = req.params;

  const quiz = await findQuizBySlugOrId(quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const question = await Question.findOne({ _id: questionId, quiz: quiz._id });
  if (!question) return res.status(404).json({ message: "Question not found" });

  await question.deleteOne();
  res.json({ message: "Question deleted successfully" });
});

// ===============================
// @desc    Get leaderboard for a quiz
// @route   GET /api/v1/quizzes/:quizId/leaderboard
// @access  Public
// ===============================
export const getQuizLeaderboard = asyncHandler(async (req, res) => {
  const quiz = await findQuizBySlugOrId(req.params.quizId);
  if (!quiz) return res.status(404).json({ message: "Quiz not found" });

  const leaderboard = await QuizAttempt.aggregate([
    { $match: { quiz: quiz._id, status: "completed", isRetry: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$user",
        score: { $first: "$score" },
        totalQuestions: { $first: "$totalQuestions" },
        percentage: { $first: "$percentage" },
        timeTaken: { $first: "$timeTaken" },
        attemptId: { $first: "$_id" },
        createdAt: { $first: "$createdAt" },
      },
    },
    { $sort: { score: -1, timeTaken: 1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.isAdmin": { $ne: true } } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        score: 1,
        totalQuestions: 1,
        percentage: 1,
        timeTaken: 1,
        createdAt: 1,
      },
    },
  ]);

  res.json({
    quizTitle: quiz.title,
    leaderboard,
  });
});

// ===============================
// @desc    Get global leaderboard across all quizzes
// @route   GET /api/v1/quizzes/leaderboard/global
// @access  Public
// ===============================
export const getGlobalLeaderboard = asyncHandler(async (req, res) => {
  const leaderboard = await QuizAttempt.aggregate([
    { $match: { status: "completed", isRetry: false } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$user",
        totalScore: { $sum: "$score" },
        totalQuizzes: { $sum: 1 },
        avgPercentage: { $avg: "$percentage" },
        totalTimeTaken: { $sum: "$timeTaken" },
      },
    },
    { $sort: { totalScore: -1, avgPercentage: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user",
      },
    },
    { $unwind: "$user" },
    { $match: { "user.isAdmin": { $ne: true } } },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        name: "$user.name",
        totalScore: 1,
        totalQuizzes: 1,
        avgPercentage: { $round: ["$avgPercentage", 2] },
        totalTimeTaken: 1,
      },
    },
  ]);

  res.json({ leaderboard });
});
