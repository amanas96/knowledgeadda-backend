import express from "express";
const router = express.Router();
import { protect } from "../middleware/authMiddleware.js";

import {
  getAllPlans,
  createSubscriptionOrder,
  verifyPayment,
  webhookHandler,
  getMyTransactions,
} from "../controllers/subscriptionController.js";

// @route   GET /api/v1/subscriptions
// @desc    Get all subscription plans (public)
router.route("/plans").get(getAllPlans);
router.route("/create-order").post(protect, createSubscriptionOrder);
router.route("/verify-payment").post(protect, verifyPayment);
router.get("/my-transactions", protect, getMyTransactions);

export default router;
