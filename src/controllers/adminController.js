import asyncHandler from "express-async-handler";
import User from "../models/user.js";
import UserSubscription from "../models/userSubscription.js";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import QuizAttempt from "../models/quizAttempt.js";
import WatchHistory from "../models/watchHistoryModel.js";
import Quiz from "../models/quiz.js";

export const getAdminAnalytics = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const now = new Date();

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // ── Platform wide (same for all admins) ───────────────────────────────────
  const totalUsers = await User.countDocuments();
  const newUsersThisMonth = await User.countDocuments({
    date: { $gte: startOfMonth },
  });

  // ── This admin's content only ─────────────────────────────────────────────
  const totalCourses = await Course.countDocuments({ createdBy: adminId });
  const totalContent = await Content.countDocuments({ createdBy: adminId });
  const totalQuizzes = await Quiz.countDocuments({ createdBy: adminId });

  // ── Revenue from subscriptions to THIS admin's courses ────────────────────
  const adminCourseIds = await Course.find({ createdBy: adminId }).select(
    "_id",
  );
  const courseIds = adminCourseIds.map((c) => c._id);

  const totalSubscriptions = await UserSubscription.countDocuments();
  const activeSubscriptions = await UserSubscription.countDocuments({
    status: "active",
    endDate: { $gt: now },
  });
  const newSubscriptionsThisMonth = await UserSubscription.countDocuments({
    createdAt: { $gte: startOfMonth },
  });

  // ── Total revenue (platform wide — all admins see same) ───────────────────
  const revenueData = await UserSubscription.aggregate([
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "plan",
        foreignField: "_id",
        as: "planDetails",
      },
    },
    { $unwind: "$planDetails" },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$planDetails.price" },
      },
    },
  ]);
  const totalRevenue = revenueData[0]?.totalRevenue || 0;

  const revenueThisMonthData = await UserSubscription.aggregate([
    { $match: { createdAt: { $gte: startOfMonth } } },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "plan",
        foreignField: "_id",
        as: "planDetails",
      },
    },
    { $unwind: "$planDetails" },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$planDetails.price" },
      },
    },
  ]);
  const revenueThisMonth = revenueThisMonthData[0]?.revenue || 0;

  // ── Monthly revenue chart (last 6 months) ────────────────────────────────
  const monthlyRevenue = await UserSubscription.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
    },
    {
      $lookup: {
        from: "subscriptionplans",
        localField: "plan",
        foreignField: "_id",
        as: "planDetails",
      },
    },
    { $unwind: "$planDetails" },
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" },
        },
        revenue: { $sum: "$planDetails.price" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  // ── Monthly new users chart (last 6 months) ──────────────────────────────
  const monthlyUsers = await User.aggregate([
    {
      $match: {
        date: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: "$date" },
          month: { $month: "$date" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ]);

  // ── Quiz performance for THIS admin's quizzes ─────────────────────────────
  const adminQuizIds = await Quiz.find({ createdBy: adminId }).select("_id");
  const quizIds = adminQuizIds.map((q) => q._id);

  const totalQuizAttempts = await QuizAttempt.countDocuments({
    quiz: { $in: quizIds },
  });
  const completedAttempts = await QuizAttempt.countDocuments({
    quiz: { $in: quizIds },
    status: "completed",
  });

  const avgScoreData = await QuizAttempt.aggregate([
    { $match: { quiz: { $in: quizIds }, status: "completed" } },
    {
      $group: {
        _id: null,
        avgPercentage: { $avg: "$percentage" },
      },
    },
  ]);
  const avgQuizScore = Math.round(avgScoreData[0]?.avgPercentage || 0);

  // ── Top 5 quizzes by THIS admin ───────────────────────────────────────────
  const topQuizzes = await QuizAttempt.aggregate([
    { $match: { quiz: { $in: quizIds } } },
    {
      $group: {
        _id: "$quiz",
        attempts: { $sum: 1 },
        avgScore: { $avg: "$percentage" },
      },
    },
    { $sort: { attempts: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "quizzes",
        localField: "_id",
        foreignField: "_id",
        as: "quizDetails",
      },
    },
    { $unwind: "$quizDetails" },
    {
      $project: {
        title: "$quizDetails.title",
        attempts: 1,
        avgScore: { $round: ["$avgScore", 1] },
      },
    },
  ]);

  // ── Top 5 courses by THIS admin ───────────────────────────────────────────
  const topCourses = await WatchHistory.aggregate([
    { $match: { course: { $in: courseIds } } },
    {
      $group: {
        _id: "$course",
        totalWatchMins: { $sum: "$watchedMinutes" },
        totalStudents: { $addToSet: "$user" },
      },
    },
    { $sort: { totalWatchMins: -1 } },
    { $limit: 5 },
    {
      $lookup: {
        from: "courses",
        localField: "_id",
        foreignField: "_id",
        as: "courseDetails",
      },
    },
    { $unwind: "$courseDetails" },
    {
      $project: {
        title: "$courseDetails.title",
        totalWatchMins: 1,
        totalStudents: { $size: "$totalStudents" },
      },
    },
  ]);

  res.json({
    overview: {
      totalUsers,
      newUsersThisMonth,
      totalSubscriptions,
      activeSubscriptions,
      newSubscriptionsThisMonth,
      totalRevenue,
      revenueThisMonth,
      totalCourses, // ✅ this admin only
      totalContent, // ✅ this admin only
      totalQuizzes, // ✅ this admin only
      totalQuizAttempts, // ✅ this admin only
      completedAttempts, // ✅ this admin only
      avgQuizScore, // ✅ this admin only
    },
    charts: {
      monthlyRevenue,
      monthlyUsers,
    },
    topQuizzes, // ✅ this admin only
    topCourses, // ✅ this admin only
  });
});
