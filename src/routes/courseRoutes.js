// import express from "express";
// const router = express.Router();

// import { protect, admin } from "../middleware/authMiddleware.js";
// import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
// import upload from "../middleware/multerMiddleware.js";
// import { uploadOnCloudinary } from "../../utils/cloudinary.js";

// import {
//   getAllCourses,
//   getCourseById,
//   createCourse,
//   updateCourse,
//   deleteCourse,
//   getCourseContent,
//   addContentToCourse,
//   getSingleContentItem,
//   deleteContentFromCourse,
// } from "../controllers/courseController.js";

// // Admin
// router.route("/").post(protect, admin, createCourse).get(getAllCourses);

// /**
//  * ===============================================
//  * @route   /api/v1/courses/:courseId
//  * ===============================================
//  */
// router
//   .route("/:courseId")
//   .get(getCourseById)
//   .put(protect, admin, updateCourse)
//   .delete(protect, admin, deleteCourse);

// /**
//  * ===============================================
//  * @route   /api/v1/courses/:courseId/content
//  * ===============================================
//  */
// router
//   .route("/:courseId/content")
//   .post(protect, admin, upload.single("contentFile"), addContentToCourse)
//   .get(protect, checkSubscription, getCourseContent);

// /**
//  * ===============================================
//  * @route   /api/v1/courses/:courseId/content/:contentId
//  * ===============================================
//  */

// router
//   .route("/:courseId/content/:contentId")
//   .get(protect, checkSubscription, getSingleContentItem)
//   .delete(protect, admin, deleteContentFromCourse);

// // Student
// router.route("/:courseId").get(protect, getCourseById);

// export default router;

import express from "express";
const router = express.Router();

import { protect } from "../middleware/authMiddleware.js";
import { checkSubscription } from "../middleware/subscriptionMiddleware.js";
import {
  getAllCourses,
  getCourseById,
  getCourseContent,
  getSingleContentItem,
} from "../controllers/courseController.js";

// Public
router.get("/", getAllCourses);
router.get("/:courseId", getCourseById);

// Student (protected + subscription)
router.get("/:courseId/content", protect, checkSubscription, getCourseContent);
router.get(
  "/:courseId/content/:contentId",
  protect,
  checkSubscription,
  getSingleContentItem,
);

export default router;
