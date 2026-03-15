import asyncHandler from "express-async-handler";
import UserSubscription from "../models/userSubscription.js";

export const checkSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Not authorized, no user");
  }
  if (req.user.isAdmin) {
    req.user.isSubscribed = true;
    console.log("🟢 Admin detected → bypassing subscription.");
    return next();
  }

  // Find an active subscription for this user
  const activeSubscription = await UserSubscription.findOne({
    user: req.user._id,
    status: "active",
    endDate: { $gt: new Date() }, // Check if end date is in the future
  });

  if (activeSubscription) {
    req.user.isSubscribed = true;
  } else {
    req.user.isSubscribed = false;
  }

  next();
});
