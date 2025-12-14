import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import User from "../models/user.js";
import {
  getUserProfile,
  updateUserProfile,
} from "../controllers/authController.js";

const router = express.Router();

router
  .route("/me")
  .get(protect, getUserProfile)
  .put(protect, updateUserProfile);

export default router;
