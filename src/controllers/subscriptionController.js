// import asyncHandler from "express-async-handler";
// import SubscriptionPlan from "../models/subscriptionPlan.js";
// import Razorpay from "razorpay";
// import crypto from "crypto"; // This is a built-in Node.js module

// // @desc    Get all active subscription plans
// // @route   GET /api/v1/subscriptions
// // @access  Public
// export const getAllPlans = asyncHandler(async (req, res) => {
//   const plans = await SubscriptionPlan.find({});
//   res.json(plans);
// });

// // @desc    Create a Razorpay order for a subscription
// // @route   POST /api/v1/subscriptions/subscribe
// // @access  Private (User must be logged in)
// export const createSubscriptionOrder = asyncHandler(async (req, res) => {
//   // 1. Add your Razorpay keys (add these to your .env file)
//   const razorpay = new Razorpay({
//     key_id: process.env.RAZORPAY_KEY_ID,
//     key_secret: process.env.RAZORPAY_KEY_SECRET,
//   });

//   // 2. Get the plan ID from the user's request
//   const { planId } = req.body;
//   const user = req.user; // We get this from the 'protect' middleware

//   // 3. Find the plan in our database
//   const plan = await SubscriptionPlan.findById(planId);
//   if (!plan) {
//     res.status(404);
//     throw new Error("Subscription plan not found");
//   }

//   // 4. Create the Razorpay order
//   const options = {
//     amount: plan.price * 100, // Amount in smallest currency unit (e.g., 50000 for 500.00)
//     currency: "INR",
//     receipt: `receipt_${user._id}_${new Date().getTime()}`,
//     notes: {
//       planId: plan._id,
//       userId: user._id,
//     },
//   };

//   try {
//     const order = await razorpay.orders.create(options);
//     // 5. Send the order details back to the frontend
//     res.json({
//       orderId: order.id,
//       amount: order.amount,
//       currency: order.currency,
//       key: process.env.RAZORPAY_KEY_ID, // Send key to frontend
//     });
//   } catch (error) {
//     console.error("Razorpay order creation failed:", error);
//     res.status(500);
//     throw new Error("Could not create payment order");
//   }
// });

// @desc    Verify a real payment from Razorpay webhook
// @route   POST /api/v1/subscriptions/verify-payment
// @access  Public (Secured by HMAC signature)
// export const verifyPaymentWebhook = asyncHandler(async (req, res) => {

//   const razorpaySignature = req.headers['x-razorpay-signature'];
//   if (!razorpaySignature) {
//     return res.status(400).json({ message: 'Missing Razorpay signature' });
//   }

//   const shasum = crypto
//     .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
//     .update(JSON.stringify(req.body))
//     .digest('hex');

//   // 3. Compare the signatures
//   if (shasum !== razorpaySignature) {
//     // This is a CRITICAL security check
//     return res.status(401).json({ message: 'Invalid signature' });
//   }

//   // 4. --- SIGNATURE IS VALID ---
//   // The request is genuinely from Razorpay. Now, process the payment.

//   const event = req.body.event;
//   const payment = req.body.payload.payment.entity;

//   // 5. We only care about successful payment events
//   if (event === 'payment.captured') {
//     const { planId, userId } = payment.notes;
//     const paymentId = payment.id;

//     // 6. Find the plan and user
//     const plan = await SubscriptionPlan.findById(planId);
//     const user = await User.findById(userId); // You may need to import User model

//     if (!plan || !user) {
//       // Log this error, as it's a problem
//       console.error(`Webhook Error: Plan or User not found. Plan: ${planId}, User: ${userId}`);
//       // Still send 200, or Razorpay will retry
//       return res.status(200).json({ message: 'Plan or User not found, but acknowledged' });
//     }

//     // 7. Calculate start and end dates
//     const startDate = new Date();
//     const endDate = new Date();
//     endDate.setDate(startDate.getDate() + plan.durationInDays);

//     // 8. Create the official subscription
//     await UserSubscription.create({
//       user: user._id,
//       plan: plan._id,
//       startDate,
//       endDate,
//       paymentGatewayPaymentId: paymentId,
//       status: 'active',
//     });
//   }

//   // 9. IMPORTANT: Acknowledge the webhook with a 200 OK
//   res.status(200).json({ received: true });
// });

/////////////// mock

import asyncHandler from "express-async-handler";
import SubscriptionPlan from "../models/subscriptionPlan.js";
import UserSubscription from "../models/userSubscription.js"; // <-- THIS IS THE FIX
import crypto from "crypto";

export const getAllPlans = asyncHandler(async (req, res) => {
  const plans = await SubscriptionPlan.find({});
  res.json(plans);
});

export const createSubscriptionOrder = asyncHandler(async (req, res) => {
  const { planId } = req.body;
  const user = req.user;
  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    res.status(404);
    throw new Error("Subscription plan not found");
  }

  console.log("--- CREATING MOCK ORDER ---");
  const mockOrderId = `ord_mock_${crypto.randomBytes(12).toString("hex")}`;
  const mockKey = "rzp_test_MOCKKEY";

  const mockOrder = {
    id: mockOrderId,
    amount: plan.price * 100,
    currency: "INR",
    status: "created",
    receipt: `receipt_${user?._id || "test"}_${Date.now()}`,
    notes: {
      planId: plan._id.toString(),
      userId: user?._id?.toString() || "test_user",
    },
  };

  console.log("Created Mock Order:", mockOrder);

  res.json({
    orderId: mockOrderId,
    amount: plan.price * 100,
    currency: "INR",
    key: mockKey,
    order: mockOrder,
    usingMock: true,
  });
});

export const checkMockStatus = asyncHandler(async (req, res) => {
  res.json({
    message: "Razorpay mock mode is active",
    usingMock: true,
  });
});

export const verifyMockPayment = asyncHandler(async (req, res) => {
  const { planId, mockPaymentId } = req.body;
  const user = req.user;

  const plan = await SubscriptionPlan.findById(planId);
  if (!plan) {
    res.status(404);
    throw new Error("Subscription plan not found");
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + plan.durationInDays);

  const subscription = new UserSubscription({
    // <-- This line was crashing
    user: user._id,
    plan: plan._id,
    startDate,
    endDate,
    paymentGatewayPaymentId:
      mockPaymentId || `mock_pay_${crypto.randomBytes(8).toString("hex")}`,
    status: "active",
  });

  await subscription.save();

  res.status(201).json({
    message: "Mock subscription activated!",
    subscription,
  });
});
