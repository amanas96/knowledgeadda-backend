import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
export const findCourseBySlugOrId = async (slugOrId) => {
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    const course = await Course.findById(slugOrId);
    if (course) return course;
  }
  return await Course.findOne({ slug: slugOrId });
};

export const findContentBySlugOrId = async (courseId, contentIdentifier) => {
  const query = mongoose.Types.ObjectId.isValid(contentIdentifier)
    ? { _id: contentIdentifier, course: courseId }
    : { slug: contentIdentifier, course: courseId };
  return await Content.findOne(query);
};
