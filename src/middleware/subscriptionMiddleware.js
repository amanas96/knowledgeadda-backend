import asyncHandler from "express-async-handler";
import UserSubscription from "../models/userSubscription.js";

export const checkSubscription = asyncHandler(async (req, res, next) => {
  // We need 'protect' to run first to get req.user
  if (!req.user) {
    res.status(401);
    throw new Error("Not authorized, no user");
  }

  // Find an active subscription for this user
  const activeSubscription = await UserSubscription.findOne({
    user: req.user._id,
    status: "active",
    endDate: { $gt: new Date() }, // Check if end date is in the future
  });

  if (activeSubscription) {
    // Attach subscription status to the request object
    req.user.isSubscribed = true;
  } else {
    req.user.isSubscribed = false;
  }

  next(); // Move on to the next function
});
