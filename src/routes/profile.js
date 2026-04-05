// import express from "express";
// import { protect } from "../middleware/authMiddleware.js";
// import User from "../models/user.js";
// import {
//   getUserProfile,
//   updateUserProfile,
// } from "../controllers/authController.js";
// import { updateWatchProgress } from "../controllers/watchHistoryController.js";
// import { admin } from "../middleware/authMiddleware.js";
// import { getAdminAnalytics } from "../controllers/adminController.js";
// const router = express.Router();

// router
//   .route("/me")
//   .get(protect, getUserProfile)
//   .put(protect, updateUserProfile);

// router.post("/watch-progress", protect, updateWatchProgress);

// router.get("/admin/analytics", protect, admin, getAdminAnalytics);

// export default router;

import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/authController.js";
import { updateWatchProgress } from "../controllers/watchHistoryController.js";

const router = express.Router();

router
  .route("/me")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

router.post("/watch-progress", protect, updateWatchProgress);

export default router;
