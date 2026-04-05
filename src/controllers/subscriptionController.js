import asyncHandler from "express-async-handler";
import ApiResponse from "../../utils/ApiResponse.js";
import {
  getAllPlansService,
  createSubscriptionOrderService,
  verifyPaymentService,
  handleWebhookService,
  getMyTransactionsService,
  getMySubscriptionService,
} from "../services/subscriptionService.js";

// =============================================================================
// @desc    Get all active subscription plans
// @route   GET /api/v1/subscriptions/plans
// @access  Public
// =============================================================================
export const getAllPlans = asyncHandler(async (req, res) => {
  const plans = await getAllPlansService();
  new ApiResponse(200, plans, "Plans fetched successfully").send(res);
});

// =============================================================================
// @desc    Create a Razorpay order for a plan
// @route   POST /api/v1/subscriptions/create-order
// @access  Private
// =============================================================================
export const createSubscriptionOrder = asyncHandler(async (req, res) => {
  const data = await createSubscriptionOrderService(req.body.planId, req.user);
  new ApiResponse(201, data, "Order created successfully").send(res);
});

// =============================================================================
// @desc    Verify Razorpay payment signature and activate subscription
// @route   POST /api/v1/subscriptions/verify-payment
// @access  Private
// =============================================================================
export const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planId } =
    req.body;

  const data = await verifyPaymentService({
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    planId,
    userId: req.user._id,
  });
  const message = data.alreadyActivated
    ? "Subscription already active"
    : "Payment verified and subscription activated !";

  new ApiResponse(200, data, message).send(res);
});

// =============================================================================
// @desc    Razorpay webhook receiver
// @route   POST /api/v1/subscriptions/webhook
// @access  Public (Razorpay servers only — verified by signature)
//
// ⚠️  DO NOT wrap in ApiResponse — Razorpay expects a plain { received: true }
//     acknowledgement, not our standard response shape. Wrapping it would not
//     break anything but adds unnecessary noise for an internal server-to-server
//     endpoint that no frontend ever reads.
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

  await handleWebhookService({ rawBody, signature, event, payload });

  res.status(200).json({ received: true });
});

// =============================================================================
// @desc    Get the current user's transaction history
// @route   GET /api/v1/subscriptions/transactions
// @access  Private
// =============================================================================
export const getMyTransactions = asyncHandler(async (req, res) => {
  const transactions = await getMyTransactionsService(req.user._id);
  new ApiResponse(200, transactions, "Transactions fetched successfully").send(
    res,
  );
});

// =============================================================================
// @desc    Get the current user's active subscription
// @route   GET /api/v1/subscriptions/my-subscription
// @access  Private
// =============================================================================
export const getMySubscription = asyncHandler(async (req, res) => {
  const subscription = await getMySubscriptionService(req.user._id);
  new ApiResponse(200, subscription, "Subscription fetched successfully").send(
    res,
  );
});
