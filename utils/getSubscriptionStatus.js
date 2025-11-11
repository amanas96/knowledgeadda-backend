import UserSubscription from "../src/models/userSubscription.js";

/**
 * Returns true if the user has an active subscription.
 * @param {ObjectId} userId - The user's MongoDB ObjectId.
 * @returns {Promise<boolean>}
 */
export const getSubscriptionStatus = async (userId) => {
  const activeSubscription = await UserSubscription.findOne({
    user: userId,
    status: "active",
    endDate: { $gt: new Date() },
  });

  return !!activeSubscription; // true if found, false otherwise
};
