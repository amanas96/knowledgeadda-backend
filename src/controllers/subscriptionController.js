// /////////////// mock

// import asyncHandler from "express-async-handler";
// import SubscriptionPlan from "../models/subscriptionPlan.js";
// import mongoose from "mongoose";
// import UserSubscription from "../models/userSubscription.js"; // <-- THIS IS THE FIX
// import crypto from "crypto";

// export const getAllPlans = asyncHandler(async (req, res) => {
//   const plans = await SubscriptionPlan.find({});
//   res.json(plans);
// });

// export const createSubscriptionOrder = asyncHandler(async (req, res) => {
//   const { planId } = req.body;
//   const user = req.user;

//   const existingActive = await UserSubscription.findOne({
//     user: req.user._id,
//     status: "active",
//     endDate: { $gt: new Date() }, // not expired yet
//   });

//   if (existingActive) {
//     return res.status(400).json({
//       message:
//         "You already have an active subscription. It expires on " +
//         new Date(existingActive.endDate).toLocaleDateString(),
//       currentSubscription: existingActive,
//     });
//   }

//   const plan = await SubscriptionPlan.findById(planId);
//   if (!plan) {
//     res.status(404);
//     throw new Error("Subscription plan not found");
//   }

//   console.log("--- CREATING MOCK ORDER ---");
//   const mockOrderId = `ord_mock_${crypto.randomBytes(12).toString("hex")}`;
//   const mockKey = "rzp_test_MOCKKEY";

//   const mockOrder = {
//     id: mockOrderId,
//     amount: plan.price * 100,
//     currency: "INR",
//     status: "created",
//     receipt: `receipt_${user?._id || "test"}_${Date.now()}`,
//     notes: {
//       planId: plan._id.toString(),
//       userId: user?._id?.toString() || "test_user",
//     },
//   };

//   console.log("Created Mock Order:", mockOrder);

//   res.json({
//     orderId: mockOrderId,
//     amount: plan.price * 100,
//     currency: "INR",
//     key: mockKey,
//     order: mockOrder,
//     usingMock: true,
//   });
// });

// export const checkMockStatus = asyncHandler(async (req, res) => {
//   res.json({
//     message: "Razorpay mock mode is active",
//     usingMock: true,
//   });
// });

// export const verifyMockPayment = asyncHandler(async (req, res) => {
//   const { planId, mockPaymentId } = req.body;
//   const user = req.user;

//   const existingActive = await UserSubscription.findOne({
//     user: user._id,
//     status: "active",
//     endDate: { $gt: new Date() },
//   });

//   if (existingActive) {
//     return res.status(400).json({
//       message:
//         "You already have an active subscription. It expires on " +
//         new Date(existingActive.endDate).toLocaleDateString(),
//       currentSubscription: existingActive,
//     });
//   }

//   const plan = await SubscriptionPlan.findById(planId);
//   if (!plan) {
//     res.status(404);
//     throw new Error("Subscription plan not found");
//   }

//   const startDate = new Date();
//   const endDate = new Date();
//   endDate.setDate(startDate.getDate() + plan.durationInDays);

//   const subscription = new UserSubscription({
//     user: user._id,
//     plan: plan._id,
//     startDate,
//     endDate,
//     paymentGatewayPaymentId:
//       mockPaymentId || `mock_pay_${crypto.randomBytes(8).toString("hex")}`,
//     status: "active",
//   });

//   await subscription.save();

//   res.status(201).json({
//     message: "Mock subscription activated!",
//     subscription,
//   });
// });

// export const getMyTransactions = asyncHandler(async (req, res) => {
//   const user = req.user;

//   const transactions = await UserSubscription.find({ user: user._id })
//     .populate("plan", "name price durationInDays")
//     .sort({ createdAt: -1 });

//   res.json(transactions);
// });

import asyncHandler from "express-async-handler";
import {
  getAllPlansService,
  createSubscriptionOrderService,
  verifyPaymentService,
  handleWebhookService,
  getMyTransactionsService,
  getMySubscriptionService,
} from "../services/subscriptionService.js";

/* ── tiny helper so every handler is one line ──────────────── */
const send = (res, { status, body }) => res.status(status).json(body);

// =============================================================================
// @desc    Get all active subscription plans
// @route   GET /api/v1/subscriptions/plans
// @access  Public
// =============================================================================
export const getAllPlans = asyncHandler(async (req, res) => {
  send(res, await getAllPlansService());
});

// =============================================================================
// @desc    Create a Razorpay order for a plan
// @route   POST /api/v1/subscriptions/create-order
// @access  Private
// =============================================================================
export const createSubscriptionOrder = asyncHandler(async (req, res) => {
  console.log("BODY:", req.body);
  send(res, await createSubscriptionOrderService(req.body.planId, req.user));
});

// =============================================================================
// @desc    Verify Razorpay payment signature and activate subscription
// @route   POST /api/v1/subscriptions/verify-payment
// @access  Private
// =============================================================================
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } =
    req.body;

  send(
    res,
    await verifyPaymentService({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      planId,
      userId: req.user._id,
    }),
  );
});

// =============================================================================
// @desc    Razorpay webhook receiver
// @route   POST /api/v1/subscriptions/webhook
// @access  Public (Razorpay servers only — verified by signature)
//
// IMPORTANT: this route must use express.raw({ type: "application/json" })
// middleware, NOT express.json() — Razorpay signature verification requires
// the unmodified raw body bytes.
//
// In your router:
//   router.post(
//     "/webhook",
//     express.raw({ type: "application/json" }),
//     webhookHandler,
//   );
// =============================================================================
export const webhookHandler = asyncHandler(async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const rawBody = req.body;
  const { event, payload } = JSON.parse(rawBody);

  send(res, await handleWebhookService({ rawBody, signature, event, payload }));
});

// =============================================================================
// @desc    Get the current user's transaction history
// @route   GET /api/v1/subscriptions/transactions
// @access  Private
// =============================================================================
export const getMyTransactions = asyncHandler(async (req, res) => {
  send(res, await getMyTransactionsService(req.user._id));
});

// =============================================================================
// @desc    Get the current user's active subscription status
// @route   GET /api/v1/subscriptions/my-subscription
// @access  Private
// =============================================================================
export const getMySubscription = asyncHandler(async (req, res) => {
  send(res, await getMySubscriptionService(req.user._id));
});
