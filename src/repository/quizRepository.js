import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import QuizAttempt from "../models/quizAttempt.js";
import { findQuizBySlugOrId } from "../helper/quizHelper.js";

/* ============================================================
   Quiz queries
============================================================ */

export const findQuiz = (param) => findQuizBySlugOrId(param);

export const findQuizWithCourse = (param) =>
  findQuizBySlugOrId(param).populate("course", "title description").lean();

export const findQuizForStatus = (param) =>
  findQuizBySlugOrId(param).select("allowMultipleAttempts isPremium title");

export const findQuizForSubmit = (param) => findQuizBySlugOrId(param);

export const findQuizForReview = (param) => findQuizBySlugOrId(param);

export const findQuizByTitle = (title, courseId, effectiveType) =>
  Quiz.findOne(
    courseId
      ? { title: title.trim(), course: courseId }
      : { title: title.trim(), quizType: effectiveType, course: null },
  );

export const findQuizBySlug = (slug) => Quiz.findOne({ slug });

export const countQuestionsByQuiz = (quizId) =>
  Question.countDocuments({ quiz: quizId });

export const getQuizzesListPipeline = (filter, page, limit) => {
  const pipeline = [
    { $match: filter },
    { $sort: { createdAt: -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
    {
      $lookup: {
        from: "questions",
        let: { quizId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$quiz", "$$quizId"] } } },
          { $project: { _id: 1 } },
        ],
        as: "questionData",
      },
    },
    { $addFields: { totalQuestions: { $size: "$questionData" } } },
    {
      $project: {
        title: 1,
        slug: 1,
        course: 1,
        category: 1,
        isPremium: 1,
        timeLimit: 1,
        totalMarks: 1,
        createdAt: 1,
        quizType: 1,
        totalQuestions: 1,
      },
    },
  ];
  return Quiz.aggregate(pipeline);
};

export const getQuizzesForCourseDb = (courseId) =>
  Quiz.find({ course: courseId, isPublished: true })
    .sort({ createdAt: -1 })
    .select(
      "title slug course category isPremium timeLimit totalMarks createdAt",
    )
    .lean();

export const createQuizDb = (data, session) => Quiz.create([data], { session });

export const updateQuizDb = (quiz, updates) => {
  Object.assign(quiz, updates);
  return quiz.save();
};

export const deleteQuizDb = async (quiz) => {
  await Question.deleteMany({ quiz: quiz._id });
  return quiz.deleteOne();
};

export const updateQuizAddQuestions = (
  quizId,
  insertedIds,
  newMarks,
  session,
) =>
  Quiz.findByIdAndUpdate(
    quizId,
    {
      $push: { questions: { $each: insertedIds } },
      $inc: { totalMarks: newMarks },
    },
    session ? { session } : {},
  );

export const updateQuizDecreaseMarks = (quizId, marksToRemove) =>
  Quiz.updateOne({ _id: quizId }, { $inc: { totalMarks: -marksToRemove } });

/* ============================================================
   Question queries
============================================================ */

export const getQuizQuestionsDb = (quizId) =>
  Question.find({ quiz: quizId, isDeleted: { $ne: true } })
    .select("-correctAnswer")
    .lean();

export const getAllQuestions = (quizId) => Question.find({ quiz: quizId });

export const findQuestion = (questionId, quizId) =>
  Question.findOne({ _id: questionId, quiz: quizId });

export const findQuestionById = (questionId) =>
  Question.findById(questionId, { isDeleted: true }, { new: true });

export const findQuestionByIdLean = (questionId) =>
  Question.findById(questionId).lean();

export const updateQuestionDb = (question, updates) => {
  Object.assign(question, updates);
  return question.save();
};

export const insertManyQuestions = (docs, session) =>
  Question.insertMany(docs, { session });

export const bulkInsertQuestions = async (docs) => {
  let inserted = [];
  let dbErrors = [];

  try {
    inserted = await Question.insertMany(docs, {
      ordered: false,
      rawResult: false,
    });
  } catch (err) {
    if (err.name === "BulkWriteError" || err.writeErrors) {
      inserted = err.insertedDocs || [];
      dbErrors = (err.writeErrors || []).map((e) => ({
        index: e.index,
        message: e.errmsg || e.message,
      }));
    } else {
      throw err;
    }
  }

  return { inserted, dbErrors };
};

/* ============================================================
   Attempt queries
============================================================ */

export const findPreviousAttempt = (userId, quizId) =>
  QuizAttempt.findOne({ user: userId, quiz: quizId, isRetry: false })
    .sort({ createdAt: -1 })
    .select("score totalQuestions percentage timeTaken createdAt")
    .lean();

export const countAttempts = (userId, quizId) =>
  QuizAttempt.countDocuments({ user: userId, quiz: quizId });

export const createAttempt = (data) => QuizAttempt.create(data);

export const findAttemptPopulated = (attemptId) =>
  QuizAttempt.findById(attemptId)
    .populate("quiz", "title course")
    .populate("answers.question", "text options marks");

export const getAttemptHistoryDb = (userId, quizId) =>
  QuizAttempt.find({ user: userId, quiz: quizId })
    .select("score totalQuestions attemptNumber createdAt")
    .sort({ createdAt: -1 })
    .lean();

export const getAttemptForReview = (query) =>
  QuizAttempt.findOne(query)
    .sort({ createdAt: -1 })
    .populate("answers.question");

export const getAllAttemptsForReview = (query) =>
  QuizAttempt.find(query).sort({ createdAt: 1 }).populate("answers.question");

export const quizLeaderboardAggregation = (quizId) =>
  QuizAttempt.aggregate([
    { $match: { quiz: quizId, status: "completed", isRetry: false } },
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

export const globalLeaderboardAggregation = () =>
  QuizAttempt.aggregate([
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
