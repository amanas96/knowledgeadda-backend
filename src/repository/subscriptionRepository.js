import SubscriptionPlan from "../models/subscriptionPlan.js";
import UserSubscription from "../models/userSubscription.js";
import User from "../models/user.js";

/* ============================================================
   Plans
============================================================ */

export const findAllPlans = () =>
  SubscriptionPlan.find({ isActive: true }).lean();

export const findPlanById = async (planId) => {
  const plan = await SubscriptionPlan.findById(planId).lean();
  return plan;
};

/* ============================================================
   User subscriptions
============================================================ */

export const findActiveSubscription = (userId) =>
  UserSubscription.findOne({
    user: userId,
    status: "active",
    endDate: { $gt: new Date() },
  }).lean();

export const findSubscriptionByOrderId = (orderId) =>
  UserSubscription.findOne({ razorpayOrderId: orderId });

export const findSubscriptionByPaymentId = (paymentId) =>
  UserSubscription.findOne({ paymentGatewayPaymentId: paymentId }).lean();

export const createSubscription = (data, session) =>
  UserSubscription.create(
    session ? [data] : data,
    session ? { session } : undefined,
  ).then((res) => (session ? res[0] : res));

export const updateSubscriptionStatus = (subscriptionId, update, session) =>
  UserSubscription.findByIdAndUpdate(subscriptionId, update, {
    new: true,
    ...(session && { session }),
  });

export const getUserTransactions = (userId) =>
  UserSubscription.find({ user: userId })
    .populate("plan", "name price durationInDays")
    .sort({ createdAt: -1 })
    .lean();

/* ============================================================
   Mark user as subscribed after successful payment
============================================================ */
export const activateUserSubscription = (userId, session) =>
  User.findByIdAndUpdate(
    userId,
    { isSubscribed: true },
    { new: true, ...(session && { session }) },
  );
