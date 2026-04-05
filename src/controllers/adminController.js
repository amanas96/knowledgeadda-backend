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
  const startOfLast6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // ── Step 1: Get admin's course/quiz IDs (Parallel & Distinct) ──
  // .distinct returns an array of IDs directly: [id1, id2...]
  const [courseIds, quizIds] = await Promise.all([
    Course.distinct("_id", { createdBy: adminId }),
    Quiz.distinct("_id", { createdBy: adminId }),
  ]);

  // ── Step 2: Fire all remaining queries in parallel ────────────────────────
  const [
    totalUsers,
    totalAdmins,
    newUsersThisMonth,
    totalCourses,
    totalContent,
    totalQuizzes,
    totalSubscriptions,
    activeSubscriptions,
    newSubscriptionsThisMonth,
    totalQuizAttempts,
    completedAttempts,
    revenueData,
    revenueThisMonthData,
    monthlyRevenue,
    monthlyUsers,
    avgScoreData,
    topQuizzes,
    topCourses,
  ] = await Promise.all([
    // ── Users (Using 'date') ────────────────────────────────────────────────
    User.countDocuments({ isAdmin: false }),
    User.countDocuments({ isAdmin: true }),
    User.countDocuments({ isAdmin: false, date: { $gte: startOfMonth } }),

    // ── This admin's content ────────────────────────────────────────────────
    Course.countDocuments({ createdBy: adminId }),
    Content.countDocuments({ createdBy: adminId }),
    Quiz.countDocuments({ createdBy: adminId }),

    // ── Subscriptions (Platform Wide) ───────────────────────────────────────
    UserSubscription.countDocuments(),
    UserSubscription.countDocuments({
      status: "active",
      endDate: { $gt: now },
    }),
    UserSubscription.countDocuments({ date: { $gte: startOfMonth } }),

    // ── Quiz attempts (Filtered by Admin's Quizzes) ─────────────────────────
    QuizAttempt.countDocuments({ quiz: { $in: quizIds } }),
    QuizAttempt.countDocuments({ quiz: { $in: quizIds }, status: "completed" }),

    // ── Revenue Aggregations ────────────────────────────────────────────────
    UserSubscription.aggregate([
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "plan",
          foreignField: "_id",
          as: "planDetails",
        },
      },
      { $unwind: "$planDetails" },
      { $group: { _id: null, totalRevenue: { $sum: "$planDetails.price" } } },
    ]),

    UserSubscription.aggregate([
      { $match: { date: { $gte: startOfMonth } } }, // Using 'date'
      {
        $lookup: {
          from: "subscriptionplans",
          localField: "plan",
          foreignField: "_id",
          as: "planDetails",
        },
      },
      { $unwind: "$planDetails" },
      { $group: { _id: null, revenue: { $sum: "$planDetails.price" } } },
    ]),

    // ── Monthly revenue chart (Using 'date') ────────────────────────────────
    UserSubscription.aggregate([
      { $match: { date: { $gte: startOfLast6Months } } },
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
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          revenue: { $sum: "$planDetails.price" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // ── Monthly new users chart (Using 'date') ──────────────────────────────
    User.aggregate([
      {
        $match: {
          isAdmin: false,
          date: { $gte: startOfLast6Months },
        },
      },
      {
        $group: {
          _id: { year: { $year: "$date" }, month: { $month: "$date" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // ── Performance Metrics ─────────────────────────────────────────────────
    QuizAttempt.aggregate([
      { $match: { quiz: { $in: quizIds }, status: "completed" } },
      { $group: { _id: null, avgPercentage: { $avg: "$percentage" } } },
    ]),

    QuizAttempt.aggregate([
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
          as: "q",
        },
      },
      { $unwind: "$q" },
      {
        $project: {
          title: "$q.title",
          attempts: 1,
          avgScore: { $round: ["$avgScore", 1] },
        },
      },
    ]),

    WatchHistory.aggregate([
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
          as: "c",
        },
      },
      { $unwind: "$c" },
      {
        $project: {
          title: "$c.title",
          totalWatchMins: 1,
          totalStudents: { $size: "$totalStudents" },
        },
      },
    ]),
  ]);

  // ── Final Data Cleanup ────────────────────────────────────────────────────
  res.json({
    overview: {
      totalUsers,
      newUsersThisMonth,
      totalSubscriptions,
      activeSubscriptions,
      newSubscriptionsThisMonth,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      revenueThisMonth: revenueThisMonthData[0]?.revenue || 0,
      totalCourses,
      totalContent,
      totalQuizzes,
      totalQuizAttempts,
      completedAttempts,
      avgQuizScore: Math.round(avgScoreData[0]?.avgPercentage || 0),
    },
    charts: {
      monthlyRevenue,
      monthlyUsers,
    },
    topQuizzes,
    topCourses,
  });
});
