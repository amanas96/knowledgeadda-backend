import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import WatchHistory from "../models/watchHistoryModel.js";
import Quiz from "../models/quiz.js";
import Question from "../models/question.js";
import { uploadOnCloudinary } from "../../utils/cloudinary.js";
import { findCourseBySlugOrId } from "../helper/courseHelper.js";
/* ============================================================
   Course queries
============================================================ */

export const findCourse = (slugOrId) => {
  return findCourseBySlugOrId(slugOrId);
};

export const findCourseForSession = (courseId, session) =>
  mongoose.Types.ObjectId.isValid(courseId)
    ? Course.findById(courseId).session(session).lean()
    : Course.findOne({ slug: courseId }).session(session).lean();

export const getCourseListDb = (sortBy, sortOrder, skip, limit) =>
  Course.find({})
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit)
    .select("title slug thumbnailUrl tags createdAt")
    .lean();

export const countCourses = () => Course.countDocuments({});

export const createCourseDb = (data) => Course.create(data);

export const saveCourse = (course) => course.save();

export const deleteCourseById = (courseId, session) =>
  Course.findByIdAndDelete(courseId).session(session);

/* ============================================================
   Content queries
============================================================ */

export const getCourseContentDb = (courseId) =>
  Content.find({ course: courseId }).sort({ section: 1, createdAt: 1 }).lean();

export const findContentItem = (contentId, courseId) =>
  Content.findOne({ _id: contentId, course: courseId }).lean();

export const findContentForMutation = (contentId, courseId) =>
  Content.findOne({ _id: contentId, course: courseId });

export const findContentById = (contentId) => Content.findById(contentId);

export const createContent = (data) => Content.create(data);

export const deleteContentById = (contentId) =>
  Content.findByIdAndDelete(contentId);

export const pushAttachment = (contentId, attachment) =>
  Content.updateOne({ _id: contentId }, { $push: { attachments: attachment } });

export const pullAttachment = (contentId, attachmentId) =>
  Content.updateOne(
    { _id: contentId },
    { $pull: { attachments: { _id: attachmentId } } },
  );

/* ============================================================
   WatchHistory queries
============================================================ */

export const upsertWatchHistory = (userId, contentId, courseId) =>
  WatchHistory.findOneAndUpdate(
    { user: userId, content: contentId },
    {
      user: userId,
      content: contentId,
      course: courseId,
      lastWatchedAt: new Date(),
    },
    { upsert: true, new: true },
  );

export const deleteWatchHistoryByContent = (contentId) =>
  WatchHistory.deleteMany({ content: contentId });

export const deleteWatchHistoryByCourse = (courseId, session) =>
  WatchHistory.deleteMany({ course: courseId }).session(session);

/* ============================================================
   Quiz / Question cleanup (used when deleting a course)
============================================================ */

export const findQuizzesByCourse = (courseId, session) =>
  Quiz.find({ course: courseId }).session(session);

export const deleteQuestionsByQuizIds = (quizIds, session) =>
  Question.deleteMany({ quiz: { $in: quizIds } }).session(session);

export const deleteQuizzesByCourse = (courseId, session) =>
  Quiz.deleteMany({ course: courseId }).session(session);

export const deleteContentByCourse = (courseId, session) =>
  Content.deleteMany({ course: courseId }).session(session);

/* ============================================================
   Cloudinary uploads
============================================================ */

export const uploadFile = (localPath, folder) =>
  uploadOnCloudinary(localPath, folder);

export const UPLOAD_FOLDERS = {
  video: "knowledgeadda/videos",
  pdf: "knowledgeadda/pdfs",
  notes: "knowledgeadda/notes",
  link: "knowledgeadda/links",
  attachments: "knowledgeadda/attachments",
};
