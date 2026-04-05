import mongoose from "mongoose";
import {
  TTL,
  withCache,
  cacheGet,
  cacheSet,
  invalidateCourseListCache,
  invalidateSingleCourseCache,
  invalidateCourseContentCache,
} from "../helper/cacheHelper.js";
import {
  MAX_FILE_SIZE,
  ALLOWED_MIME_TYPES,
  isPasswordProtectedPdf,
  cleanupFile,
  getFileType,
  buildSlug,
} from "../helper/courseHelper.js";
import { ApiError } from "../../utils/ApiError.js";
import * as repo from "../repository/courseRepository.js";

/* ============================================================
   Shared: cached course lookup used by every service method.
============================================================ */
const getCachedCourse = (slugOrId) =>
  withCache(`course:${slugOrId}`, TTL.singleCourse, () =>
    repo.findCourse(slugOrId),
  );

/* ============================================================
   Get All Courses (paginated, sorted, cached)
============================================================ */
export const getAllCoursesService = async (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(50, parseInt(query.limit) || 6);
  const skip = (page - 1) * limit;

  const allowedSortFields = ["title", "createdAt"];
  const sortBy = allowedSortFields.includes(query.sortBy)
    ? query.sortBy
    : "createdAt";
  const sortOrder = query.order === "asc" ? 1 : -1;

  const cacheKey = `courses:all:${page}:${limit}:${sortBy}:${sortOrder}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return { ...cached, source: "cache" };

  const [courses, total] = await Promise.all([
    repo.getCourseListDb(sortBy, sortOrder, skip, limit),
    repo.countCourses(),
  ]);

  const payload = {
    courses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + courses.length < total,
    },
  };

  try {
    await cacheSet(cacheKey, TTL.courseList, payload);
  } catch (err) {
    console.warn("[getAllCoursesService] Cache write failed:", err.message);
  }

  return { ...payload, source: "db" };
};

/* ============================================================
   Get Course by ID or Slug
============================================================ */
export const getCourseByIdService = async (courseId) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");
  return course;
};

/* ============================================================
   Create Course
============================================================ */
export const createCourseService = async (body, userId) => {
  const { title, description, thumbnailUrl, tags } = body;

  if (!title || !description || !thumbnailUrl) {
    throw ApiError.badRequest(
      "Please provide title, description, and thumbnailUrl",
    );
  }

  const course = await repo.createCourseDb({
    title,
    description,
    thumbnailUrl,
    tags: tags || [],
    createdBy: userId,
  });

  await invalidateCourseListCache();

  return course;
};

/* ============================================================
   Update Course
============================================================ */
export const updateCourseService = async (courseId, body) => {
  const course = await repo.findCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const { title, description, thumbnailUrl, tags } = body;

  if (title && title !== course.title) {
    course.slug = buildSlug(title);
  }

  course.title = title || course.title;
  course.description = description || course.description;
  course.thumbnailUrl = thumbnailUrl || course.thumbnailUrl;
  course.tags = tags || course.tags;

  const updatedCourse = await repo.saveCourse(course);

  await Promise.all([
    invalidateSingleCourseCache(courseId),
    invalidateCourseListCache(),
  ]);

  return updatedCourse;
};

/* ============================================================
   Delete Course (transactional — cascades quizzes, content,
   watch history)
============================================================ */
export const deleteCourseService = async (courseId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const course = await repo.findCourseForSession(courseId, session);
    if (!course) {
      await session.abortTransaction();
      session.endSession();
      throw ApiError.notFound("Course not found");
    }

    const quizzes = await repo.findQuizzesByCourse(course._id, session);
    const quizIds = quizzes.map((q) => q._id);

    if (quizIds.length > 0) {
      await repo.deleteQuestionsByQuizIds(quizIds, session);
    }

    await Promise.all([
      repo.deleteQuizzesByCourse(course._id, session),
      repo.deleteContentByCourse(course._id, session),
      repo.deleteWatchHistoryByCourse(course._id, session),
    ]);

    await repo.deleteCourseById(course._id, session);

    await session.commitTransaction();
    session.endSession();

    await Promise.all([
      invalidateSingleCourseCache(courseId),
      invalidateCourseListCache(),
      invalidateCourseContentCache(course._id),
    ]);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    // Re-throw ApiError as-is; wrap unexpected errors
    if (error.isOperational) throw error;
    throw new Error(`Failed to delete course: ${error.message}`);
  }
};

/* ============================================================
   Get Course Content (grouped by section, access-gated)
============================================================ */
export const getCourseContentService = async (courseId, isSubscribed) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const payload = await withCache(
    `course:${course._id}:content:${isSubscribed}`,
    TTL.content,
    async () => {
      const allContent = await repo.getCourseContentDb(course._id);

      const contentWithAccess = allContent.map((item) => ({
        ...item,
        isAccessible: item.isFree || isSubscribed,
      }));

      const grouped = contentWithAccess.reduce((acc, item) => {
        const section = item.section || "General";
        if (!acc[section]) acc[section] = [];
        acc[section].push(item);
        return acc;
      }, {});

      return { items: contentWithAccess, grouped };
    },
  );

  return payload;
};

/* ============================================================
   Add Content to Course (video / PDF upload or URL)
============================================================ */
export const addContentToCourseService = async (
  courseId,
  body,
  file,
  userId,
) => {
  const localFilePath = file?.path;

  try {
    const course = await getCachedCourse(courseId);
    if (!course) throw ApiError.notFound("Course not found");

    const {
      title,
      isFree,
      section,
      attachmentType,
      attachmentName,
      attachmentUrl,
    } = body;

    if (!title) throw ApiError.badRequest("Please provide title");

    let video;
    let attachments = [];

    if (file) {
      const fileType = getFileType(file.mimetype);

      if (file.size > MAX_FILE_SIZE) {
        throw ApiError.badRequest("File size exceeds 200MB limit");
      }

      const allowed = ALLOWED_MIME_TYPES[fileType];
      if (allowed && !allowed.includes(file.mimetype)) {
        throw ApiError.badRequest("Invalid file type");
      }

      if (fileType === "pdf" && isPasswordProtectedPdf(localFilePath)) {
        throw ApiError.badRequest(
          "Password-protected PDFs are not supported. Please remove the password and try again.",
        );
      }

      const folder =
        fileType === "video"
          ? repo.UPLOAD_FOLDERS.video
          : repo.UPLOAD_FOLDERS.pdf;

      const uploadResponse = await repo.uploadFile(localFilePath, folder);
      if (!uploadResponse) {
        throw ApiError.internal("Cloudinary upload failed");
      }

      if (fileType === "video") {
        video = {
          url: uploadResponse.secure_url,
          publicId: uploadResponse.public_id,
          duration: uploadResponse.duration || 0,
          cloudinaryResourceType: uploadResponse.resource_type,
        };
      } else {
        attachments.push({
          type: "pdf",
          name: attachmentName || title,
          url: uploadResponse.secure_url,
          publicId: uploadResponse.public_id,
          cloudinaryResourceType: uploadResponse.resource_type,
        });
      }
    }

    if (attachmentUrl && attachmentType) {
      attachments.push({
        type: attachmentType,
        name: attachmentName || title,
        url: attachmentUrl,
        publicId: "",
      });
    }

    if (!video?.url && attachments.length === 0) {
      throw ApiError.badRequest("Please provide a video, PDF file, or URL");
    }

    const content = await repo.createContent({
      title,
      course: course._id,
      section: section || "General",
      ...(video && { video }),
      attachments,
      isFree: isFree === "true" || isFree === true,
      createdBy: userId,
    });

    await invalidateCourseContentCache(course._id);

    return content;
  } catch (error) {
    await cleanupFile(localFilePath);
    throw error;
  }
};

/* ============================================================
   Get Single Content Item (paywall-gated, tracks watch history)
============================================================ */
export const getSingleContentItemService = async (
  courseId,
  contentId,
  user,
) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const content = await withCache(`content:${contentId}`, TTL.content, () =>
    repo.findContentItem(contentId, course._id),
  );
  if (!content) throw ApiError.notFound("Content not found");

  const isSubscribed = user?.isSubscribed || false;
  if (!content.isFree && !isSubscribed) {
    throw ApiError.forbidden("Subscription required to access this content");
  }

  // Fire-and-forget — must not block the response
  repo
    .upsertWatchHistory(user._id, contentId, course._id)
    .catch((err) => console.error("Watch history update failed:", err.message));

  return content;
};

/* ============================================================
   Delete Content from Course
============================================================ */
export const deleteContentFromCourseService = async (courseId, contentId) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  if (!mongoose.Types.ObjectId.isValid(contentId)) {
    throw ApiError.badRequest("Invalid content ID");
  }

  const content = await repo.findContentForMutation(contentId, course._id);
  if (!content) throw ApiError.notFound("Content not found for this course");

  await Promise.all([
    repo.deleteContentById(contentId),
    repo.deleteWatchHistoryByContent(contentId),
  ]);

  await invalidateCourseContentCache(course._id);

  return { contentId };
};

/* ============================================================
   Add Attachment to Existing Content
============================================================ */
export const addAttachmentToContentService = async (
  courseId,
  contentId,
  body,
  file,
) => {
  const localFilePath = file?.path;

  try {
    const course = await getCachedCourse(courseId);
    if (!course) throw ApiError.notFound("Course not found");

    const content = await repo.findContentForMutation(contentId, course._id);
    if (!content) throw ApiError.notFound("Content not found");

    if (!content.video?.publicId && !content.video?.url) {
      await cleanupFile(localFilePath);
      throw ApiError.badRequest(
        "Attachments can only be added to video content",
      );
    }

    const { attachmentType, attachmentName, attachmentUrl } = body;
    let newAttachment = {};

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        throw ApiError.badRequest("File size exceeds 200MB limit");
      }

      if (
        file.mimetype === "application/pdf" &&
        isPasswordProtectedPdf(localFilePath)
      ) {
        throw ApiError.badRequest("Password-protected PDFs are not supported.");
      }

      const folder =
        repo.UPLOAD_FOLDERS[attachmentType] ?? repo.UPLOAD_FOLDERS.attachments;
      const uploadResponse = await repo.uploadFile(localFilePath, folder);

      if (!uploadResponse) {
        throw ApiError.internal("Cloudinary upload failed");
      }

      newAttachment = {
        type: attachmentType || "pdf",
        name: attachmentName || file.originalname,
        url: uploadResponse.secure_url,
        publicId: uploadResponse.public_id,
        cloudinaryResourceType: uploadResponse.resource_type,
      };
    } else if (attachmentUrl) {
      newAttachment = {
        type: attachmentType || "link",
        name: attachmentName || "Resource",
        url: attachmentUrl,
        publicId: "",
      };
    } else {
      throw ApiError.badRequest("Please provide a file or URL");
    }

    await repo.pushAttachment(contentId, newAttachment);
    const updatedContent = await repo.findContentById(contentId);

    return updatedContent;
  } catch (error) {
    await cleanupFile(localFilePath);
    throw error;
  }
};

/* ============================================================
   Delete Attachment
============================================================ */
export const deleteAttachmentService = async (
  courseId,
  contentId,
  attachmentId,
) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const content = await repo.findContentForMutation(contentId, course._id);
  if (!content) throw ApiError.notFound("Content not found");

  const attachment = content.attachments.id(attachmentId);
  if (!attachment) throw ApiError.notFound("Attachment not found");

  await repo.pullAttachment(contentId, attachmentId);
};

/* ============================================================
   Get Signed URLs (video + attachments, paywall-gated)
============================================================ */
export const getSignedUrlService = async (courseId, contentId, user) => {
  const course = await getCachedCourse(courseId);
  if (!course) throw ApiError.notFound("Course not found");

  const content = await withCache(`content:${contentId}`, TTL.content, () =>
    repo.findContentItem(contentId, course._id),
  );
  if (!content) throw ApiError.notFound("Content not found");

  const isSubscribed = user?.isSubscribed || false;
  if (!content.isFree && !isSubscribed) {
    throw ApiError.forbidden("Subscription required to access this content");
  }

  const urls = {};

  if (content.video?.url?.length) {
    urls.video = { url: content.video.url, expiresAt: null };
  }

  if (content.attachments?.length > 0) {
    urls.attachments = content.attachments.map((att) => ({
      _id: att._id,
      name: att.name,
      type: att.type,
      url: att.url,
      expiresAt: null,
    }));
  }

  return { urls };
};
