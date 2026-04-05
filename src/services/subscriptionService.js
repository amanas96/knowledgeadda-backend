// import Razorpay from "razorpay";
// import mongoose from "mongoose";
// import {
//   verifyRazorpaySignature,
//   verifyWebhookSignature,
//   calcEndDate,
//   activeSubMessage,
// } from "../helper/subscriptionHelper.js";
// import * as repo from "../repository/subscriptionRepository.js";

// /* ============================================================
//    Razorpay client — initialised once, reused across requests.
//    Falls back to mock credentials in non-production so the app
//    boots locally without real keys.
// ============================================================ */
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });

// /* ============================================================
//    Get all active plans
// ============================================================ */
// export const getAllPlansService = async () => {
//   const plans = await repo.findAllPlans();
//   return { status: 200, body: plans };
// };

// /* ============================================================
//    Create a Razorpay order for a chosen plan.
//    Guards against duplicate active subscriptions before hitting
//    the Razorpay API so we never charge a user who is already
//    subscribed.
// ============================================================ */
// export const createSubscriptionOrderService = async (planId, user) => {
//   // ── Guard: already subscribed ────────────────────────────────────────────
//   const existing = await repo.findActiveSubscription(user._id);
//   if (existing) {
//     return {
//       status: 400,
//       body: {
//         message: activeSubMessage(existing.endDate),
//         currentSubscription: existing,
//       },
//     };
//   }

//   const plan = await repo.findPlanById(planId);
//   console.log("PLAN:", plan);
//   if (!plan)
//     return { status: 404, body: { message: "Subscription plan not found" } };

//   // ── Create Razorpay order ────────────────────────────────────────────────
//   const order = await razorpay.orders.create({
//     amount: plan.price * 100,
//     currency: "INR",
//     receipt: `sub_${user._id.toString().slice(-4)}_${Date.now()}`,
//     notes: {
//       planId: plan._id.toString(),
//       userId: user._id.toString(),
//     },
//   });

//   console.log("RAZORPAY ORDER CREATED:", order);

//   return {
//     status: 200,
//     body: {
//       orderId: order.id,
//       amount: order.amount,
//       currency: order.currency,
//       key: process.env.RAZORPAY_KEY_ID,
//       order,
//     },
//   };
// };

// /* ============================================================
//    Verify payment signature and activate subscription.

//    Flow:
//      1. Verify HMAC signature — reject tampered responses early.
//      2. Idempotency check — if this paymentId was already processed
//         (e.g. user hit submit twice), return the existing record.
//      3. Guard active subscription again — race condition safety.
//      4. Atomic transaction: create UserSubscription + set
//         user.isSubscribed = true together.
// ============================================================ */
// export const verifyPaymentService = async ({
//   razorpayOrderId,
//   razorpayPaymentId,
//   razorpaySignature,
//   planId,
//   userId,
// }) => {
//   // ── Step 1: signature verification ──────────────────────────────────────
//   const isValid = verifyRazorpaySignature({
//     orderId: razorpayOrderId,
//     paymentId: razorpayPaymentId,
//     signature: razorpaySignature,
//     secret: process.env.RAZORPAY_KEY_SECRET,
//   });

//   if (!isValid) {
//     return {
//       status: 400,
//       body: {
//         message: "Invalid payment signature. Possible tampering detected.",
//       },
//     };
//   }

//   // ── Step 2: idempotency — already processed? ─────────────────────────────
//   const duplicate = await repo.findSubscriptionByPaymentId(razorpayPaymentId);
//   if (duplicate) {
//     return {
//       status: 200,
//       body: {
//         message: "Subscription already activated.",
//         subscription: duplicate,
//       },
//     };
//   }

//   // ── Step 3: active subscription guard (race condition) ───────────────────
//   const existing = await repo.findActiveSubscription(userId);
//   if (existing) {
//     return {
//       status: 400,
//       body: {
//         message: activeSubMessage(existing.endDate),
//         currentSubscription: existing,
//       },
//     };
//   }

//   const plan = await repo.findPlanById(planId);
//   if (!plan)
//     return { status: 404, body: { message: "Subscription plan not found" } };

//   // ── Step 4: atomic transaction ───────────────────────────────────────────
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const startDate = new Date();
//     const endDate = calcEndDate(startDate, plan.durationInDays);

//     const subscription = await repo.createSubscription(
//       {
//         user: userId,
//         plan: plan._id,
//         startDate,
//         endDate,
//         razorpayOrderId,
//         paymentGatewayPaymentId: razorpayPaymentId,
//         razorpaySignature,
//         status: "active",
//       },
//       session,
//     );

//     await repo.activateUserSubscription(userId, session);

//     await session.commitTransaction();
//     session.endSession();

//     return {
//       status: 201,
//       body: {
//         message: "Payment verified. Subscription activated!",
//         subscription,
//       },
//     };
//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();
//     throw err;
//   }
// };

// /* ============================================================
//    Handle Razorpay webhook events.

//    Razorpay sends async events (payment.captured, payment.failed)
//    to this endpoint. It is separate from the client-side verify
//    flow — it acts as the source of truth for payment state.

//    Security: raw body HMAC check must pass before any DB writes.
// ============================================================ */
// export const handleWebhookService = async ({
//   rawBody,
//   signature,
//   event,
//   payload,
// }) => {
//   // ── Signature check ──────────────────────────────────────────────────────
//   const isValid = verifyWebhookSignature({
//     rawBody,
//     signature,
//     secret: process.env.RAZORPAY_WEBHOOK_SECRET,
//   });

//   if (!isValid) {
//     return { status: 400, body: { message: "Invalid webhook signature" } };
//   }

//   switch (event) {
//     case "payment.captured": {
//       const payment = payload.payment.entity;
//       const orderId = payment.order_id;

//       // Find the pending subscription linked to this order
//       const subscription = await repo.findSubscriptionByOrderId(orderId);
//       if (!subscription) {
//         // Order wasn't created via our flow — ignore safely
//         return { status: 200, body: { received: true } };
//       }

//       // Idempotent — already active, nothing to do
//       if (subscription.status === "active") {
//         return { status: 200, body: { received: true } };
//       }

//       const session = await mongoose.startSession();
//       session.startTransaction();

//       try {
//         await repo.updateSubscriptionStatus(
//           subscription._id,
//           {
//             status: "active",
//             paymentGatewayPaymentId: payment.id,
//           },
//           session,
//         );
//         await repo.activateUserSubscription(subscription.user, session);
//         await session.commitTransaction();
//         session.endSession();
//       } catch (err) {
//         await session.abortTransaction();
//         session.endSession();
//         throw err;
//       }

//       return { status: 200, body: { received: true } };
//     }

//     case "payment.failed": {
//       const payment = payload.payment.entity;
//       const orderId = payment.order_id;

//       const subscription = await repo.findSubscriptionByOrderId(orderId);
//       if (subscription) {
//         await repo.updateSubscriptionStatus(subscription._id, {
//           status: "failed",
//           failureReason: payment.error_description || "Payment failed",
//         });
//       }

//       return { status: 200, body: { received: true } };
//     }

//     default:
//       // Return 200 for unhandled events — Razorpay will keep retrying on non-2xx
//       return { status: 200, body: { received: true } };
//   }
// };

// /* ============================================================
//    Get user's transaction history
// ============================================================ */
// export const getMyTransactionsService = async (userId) => {
//   const transactions = await repo.getUserTransactions(userId);
//   return { status: 200, body: transactions };
// };

// /* ============================================================
//    Get the current user's active subscription (if any)
// ============================================================ */
// export const getMySubscriptionService = async (userId) => {
//   const subscription = await repo.findActiveSubscription(userId);
//   return {
//     status: 200,
//     body: {
//       isActive: !!subscription,
//       subscription: subscription || null,
//     },
//   };
// };

import Razorpay from "razorpay";
import mongoose from "mongoose";
import {
  verifyRazorpaySignature,
  verifyWebhookSignature,
  calcEndDate,
  activeSubMessage,
} from "../helper/subscriptionHelper.js";
import { ApiError } from "../../utils/ApiError.js";
import * as repo from "../repository/subscriptionRepository.js";

/* ============================================================
   Razorpay client — initialised once, reused across requests.
============================================================ */
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* ============================================================
   Get all active plans
============================================================ */
export const getAllPlansService = async () => {
  const plans = await repo.findAllPlans();
  return plans;
};

/* ============================================================
   Create a Razorpay order for a chosen plan.
============================================================ */
export const createSubscriptionOrderService = async (planId, user) => {
  // ── Guard: already subscribed ─────────────────────────────────────────────
  const existing = await repo.findActiveSubscription(user._id);
  if (existing) {
    throw ApiError.conflict(activeSubMessage(existing.endDate));
  }

  const plan = await repo.findPlanById(planId);
  if (!plan) throw ApiError.notFound("Subscription plan not found");

  // ── Create Razorpay order ─────────────────────────────────────────────────
  const order = await razorpay.orders.create({
    amount: plan.price * 100,
    currency: "INR",
    receipt: `sub_${user._id.toString().slice(-4)}_${Date.now()}`,
    notes: {
      planId: plan._id.toString(),
      userId: user._id.toString(),
    },
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    key: process.env.RAZORPAY_KEY_ID,
    order,
  };
};

/* ============================================================
   Verify payment signature and activate subscription.

   Flow:
     1. Verify HMAC signature — reject tampered responses early.
     2. Idempotency check — already processed? return existing.
     3. Guard active subscription again — race condition safety.
     4. Atomic transaction: create UserSubscription + set
        user.isSubscribed = true together.
============================================================ */
export const verifyPaymentService = async ({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  planId,
  userId,
}) => {
  // ── Step 1: signature verification ───────────────────────────────────────
  const isValid = verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
    secret: process.env.RAZORPAY_KEY_SECRET,
  });

  if (!isValid) {
    throw ApiError.badRequest(
      "Invalid payment signature. Possible tampering detected.",
    );
  }

  // ── Step 2: idempotency — already processed? ──────────────────────────────
  const duplicate = await repo.findSubscriptionByPaymentId(razorpayPaymentId);
  if (duplicate) {
    return { alreadyActivated: true, subscription: duplicate };
  }

  // ── Step 3: active subscription guard (race condition) ───────────────────
  const existing = await repo.findActiveSubscription(userId);
  if (existing) {
    throw ApiError.conflict(activeSubMessage(existing.endDate));
  }

  const plan = await repo.findPlanById(planId);
  if (!plan) throw ApiError.notFound("Subscription plan not found");

  // ── Step 4: atomic transaction ────────────────────────────────────────────
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const startDate = new Date();
    const endDate = calcEndDate(startDate, plan.durationInDays);

    const subscription = await repo.createSubscription(
      {
        user: userId,
        plan: plan._id,
        startDate,
        endDate,
        razorpayOrderId,
        paymentGatewayPaymentId: razorpayPaymentId,
        razorpaySignature,
        status: "active",
      },
      session,
    );

    await repo.activateUserSubscription(userId, session);

    await session.commitTransaction();
    session.endSession();

    return { subscription };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

/* ============================================================
   Handle Razorpay webhook events.

   ⚠️  This service intentionally does NOT throw ApiError.
   Razorpay requires a 200 response for all webhook events —
   even invalid ones — otherwise it keeps retrying. Errors are
   handled by returning early, not throwing. The controller
   always responds with { received: true }.
============================================================ */
export const handleWebhookService = async ({
  rawBody,
  signature,
  event,
  payload,
}) => {
  // ── Signature check ───────────────────────────────────────────────────────
  const isValid = verifyWebhookSignature({
    rawBody,
    signature,
    secret: process.env.RAZORPAY_WEBHOOK_SECRET,
  });

  // Return false instead of throwing — controller must still send 200
  if (!isValid) return false;

  switch (event) {
    case "payment.captured": {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;

      const subscription = await repo.findSubscriptionByOrderId(orderId);

      // Order not from our flow, or already active — both are safe to ignore
      if (!subscription || subscription.status === "active") break;

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await repo.updateSubscriptionStatus(
          subscription._id,
          { status: "active", paymentGatewayPaymentId: payment.id },
          session,
        );
        await repo.activateUserSubscription(subscription.user, session);
        await session.commitTransaction();
        session.endSession();
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        throw err;
      }

      break;
    }

    case "payment.failed": {
      const payment = payload.payment.entity;
      const subscription = await repo.findSubscriptionByOrderId(
        payment.order_id,
      );

      if (subscription) {
        await repo.updateSubscriptionStatus(subscription._id, {
          status: "failed",
          failureReason: payment.error_description || "Payment failed",
        });
      }

      break;
    }

    default:
      // Unhandled events — acknowledged silently, Razorpay won't retry
      break;
  }
};

/* ============================================================
   Get user's transaction history
============================================================ */
export const getMyTransactionsService = async (userId) => {
  const transactions = await repo.getUserTransactions(userId);
  return transactions;
};

/* ============================================================
   Get the current user's active subscription (if any)
============================================================ */
export const getMySubscriptionService = async (userId) => {
  const subscription = await repo.findActiveSubscription(userId);
  return {
    isActive: !!subscription,
    subscription: subscription || null,
  };
};
