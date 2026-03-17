import express from "express";
const router = express.Router();
import { protect } from "../middleware/authMiddleware.js";

import {
  getAllPlans,
  createSubscriptionOrder,
  checkMockStatus,
  verifyMockPayment,
  getMyTransactions,
} from "../controllers/subscriptionController.js";

// @route   GET /api/v1/subscriptions
// @desc    Get all subscription plans (public)
router.route("/").get(getAllPlans);
router.route("/subscribe").post(protect, createSubscriptionOrder);
router.route("/status").get(checkMockStatus);
router.route("/mock-verify").post(protect, verifyMockPayment);
router.get("/my-transactions", protect, getMyTransactions);

export default router;
