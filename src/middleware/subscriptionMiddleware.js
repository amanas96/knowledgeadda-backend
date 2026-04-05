import asyncHandler from "express-async-handler";
import UserSubscription from "../models/userSubscription.js";

// ── In-memory subscription cache ──────────────────────────────────────────────
// Avoids hitting MongoDB on every single protected request.
// Cache entry expires after TTL_MS (5 minutes by default).
// On subscription purchase/cancel, call invalidateSubscriptionCache(userId).

const cache = new Map();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function invalidateSubscriptionCache(userId) {
  cache.delete(String(userId));
}

function getCached(userId) {
  const entry = cache.get(String(userId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(String(userId));
    return null;
  }
  return entry.isSubscribed;
}

function setCached(userId, isSubscribed) {
  cache.set(String(userId), {
    isSubscribed,
    expiresAt: Date.now() + TTL_MS,
  });
}

// ── Middleware ────────────────────────────────────────────────────────────────
export const checkSubscription = asyncHandler(async (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Not authorized, no user");
  }

  // admins always pass
  if (req.user.isAdmin) {
    req.user.isSubscribed = true;
    return next();
  }

  const userId = req.user._id;

  // 1 — check cache first (no DB hit)
  const cached = getCached(userId);
  if (cached !== null) {
    req.user.isSubscribed = cached;
    return next();
  }

  // 2 — cache miss → hit DB once, then cache result
  const activeSubscription = await UserSubscription.findOne(
    {
      user: userId,
      status: "active",
      endDate: { $gt: new Date() },
    },
    { _id: 1 }, // only fetch _id — we just need to know it exists
  ).lean();

  const isSubscribed = Boolean(activeSubscription);
  setCached(userId, isSubscribed);
  req.user.isSubscribed = isSubscribed;

  req.user.isSubscribed = isSubscribed;

  next();
});
