import express from "express";
const router = express.Router();
import { protect } from "../middleware/authMiddleware.js";
import {
  getAllPlans,
  createSubscriptionOrder,
  checkMockStatus,
  verifyMockPayment,
} from "../controllers/subscriptionController.js";

// @route   GET /api/v1/subscriptions
// @desc    Get all subscription plans (public)
router.route("/").get(getAllPlans);
router.route("/subscribe").post(protect, createSubscriptionOrder);
router.route("/status").get(checkMockStatus);
router.route("/mock-verify").post(protect, verifyMockPayment);
///// router.route('/verify-payment').post(verifyPaymentWebhook);

// Protected route for a logged-in user to get a course's content

export default router;
