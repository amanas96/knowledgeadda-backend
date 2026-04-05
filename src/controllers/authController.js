import User from "../models/user.js";
import Token from "../models/tokenModel.js";
import asyncHandler from "express-async-handler";
import { validationResult } from "express-validator";
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
} from "../../utils/generateToken.js";
import { sendPasswordResetEmail } from "../../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import { getSubscriptionStatus } from "../../utils/getSubscriptionStatus.js";
import UserSubscription from "../models/userSubscription.js";
import Course from "../models/courseModel.js";
import Content from "../models/contentModel.js";
import WatchHistory from "../models/watchHistoryModel.js";
import QuizAttempt from "../models/quizAttempt.js";
import { ApiError } from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";

const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: REFRESH_TOKEN_EXPIRY_MS,
};

const clearCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
  maxAge: 0,
  path: "/",
};

// ─── sendTokenResponse: custom shape — DO NOT wrap in ApiResponse ─────────────
// Frontend AuthContext reads accessToken and user directly from response body.
// Changing this shape would break the entire auth flow.
const sendTokenResponse = async (user, statusCode, res) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user._id);

  await Token.create({
    userId: user._id,
    token: refreshToken,
    type: "refresh",
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_MS),
  });

  res.cookie("refreshToken", refreshToken, cookieOptions);

  new ApiResponse(
    statusCode,
    {
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    },
    statusCode === 201 ? "Registered successfully" : "Logged in successfully",
  ).send(res);
};

// ─── Register ─────────────────────────────────────────────────────────────────
export const registerUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) throw ApiError.conflict("User already exists");

  const user = await User.create({ name, email, password, isAdmin: false });

  await sendTokenResponse(user, 201, res);
});

// ─── Login ────────────────────────────────────────────────────────────────────
export const loginUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  await sendTokenResponse(user, 200, res);
});

// ─── Refresh access token ─────────────────────────────────────────────────────
// Response shape intentionally kept raw — AuthContext reads accessToken and
// user directly. Wrapping in ApiResponse would break the frontend auth flow.
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) throw ApiError.unauthorized("No refresh token provided");

  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: "refresh",
  });
  if (!tokenDoc) throw ApiError.unauthorized("Invalid refresh token");

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (tokenDoc.userId.toString() !== decoded.id) {
      await Token.deleteOne({ _id: tokenDoc._id });
      throw ApiError.forbidden("Token integrity error");
    }

    const user = await User.findById(decoded.id).select("-password");
    if (!user) throw ApiError.unauthorized("User not found");

    const isSubscribed = await getSubscriptionStatus(user._id);
    const accessToken = generateAccessToken(user);

    new ApiResponse(
      200,
      {
        accessToken,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          isAdmin: user.isAdmin,
          isSubscribed,
        },
      },
      "Access token refreshed successfully",
    ).send(res);
  } catch (error) {
    if (error.isOperational) throw error;
    throw ApiError.unauthorized("Refresh token is invalid or expired");
  }
});

// ─── Logout ───────────────────────────────────────────────────────────────────
export const logoutUser = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (refreshToken) {
    await Token.deleteOne({ token: refreshToken, type: "refresh" });
  }
  res.clearCookie("refreshToken", clearCookieOptions);
  new ApiResponse(200, null, "Logged out successfully").send(res);
});

// ─── Logout all devices ───────────────────────────────────────────────────────
export const logoutAllDevices = asyncHandler(async (req, res) => {
  await Token.deleteMany({ userId: req.user._id, type: "refresh" });
  res.clearCookie("refreshToken", clearCookieOptions);
  new ApiResponse(200, null, "Logged out from all devices successfully").send(
    res,
  );
});

// ─── Get user profile ─────────────────────────────────────────────────────────
export const getUserProfile = asyncHandler(async (req, res) => {
  const userObject = { ...req.user };

  const activeSubscription = await UserSubscription.findOne({
    user: req.user._id,
    status: "active",
    endDate: { $gt: new Date() },
  }).populate("plan", "name price durationInDays");

  if (activeSubscription) {
    userObject.isSubscribed = true;
    userObject.subscription = {
      planName: activeSubscription.plan.name,
      startDate: activeSubscription.startDate,
      endDate: activeSubscription.endDate,
      status: activeSubscription.status,
    };
  } else {
    userObject.isSubscribed = false;
    userObject.subscription = null;
  }

  if (req.user.role === "admin") {
    const myCourses = await Course.find({ createdBy: req.user._id }).sort({
      createdAt: -1,
    });
    const myContent = await Content.find({ createdBy: req.user._id })
      .populate("course", "title")
      .sort({ createdAt: -1 });

    return new ApiResponse(
      200,
      {
        role: "admin",
        user: userObject,
        stats: {
          totalCourses: myCourses.length,
          totalContent: myContent.length,
        },
        myCourses,
        myContent,
      },
      "Profile fetched successfully",
    ).send(res);
  }

  const watchHistory = await WatchHistory.find({ user: req.user._id })
    .populate("content", "title contentType contentUrl")
    .populate("course", "title thumbnailUrl")
    .sort({ lastWatchedAt: -1 });

  const quizAttempts = await QuizAttempt.find({
    user: req.user._id,
    status: "completed",
  });

  return new ApiResponse(
    200,
    {
      role: "student",
      user: userObject,
      stats: {
        totalWatchTime: watchHistory.reduce(
          (s, e) => s + (e.watchedMinutes || 0),
          0,
        ),
        totalWatchedContents: watchHistory.length,
        quizzesCompleted: quizAttempts.length,
        totalQuizScore: quizAttempts.reduce((s, a) => s + a.score, 0),
        avgQuizPercentage:
          quizAttempts.length > 0
            ? Math.round(
                quizAttempts.reduce((s, q) => s + q.percentage, 0) /
                  quizAttempts.length,
              )
            : 0,
      },
      watchHistory,
      quizAttempts,
    },
    "Profile fetched successfully",
  ).send(res);
});

// ─── Forgot password ──────────────────────────────────────────────────────────
export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { email } = req.body;
  const user = await User.findOne({ email });

  // Intentionally vague — never reveal whether email exists
  if (user) {
    const resetToken = generateResetToken(user._id);
    await Token.create({
      userId: user._id,
      token: resetToken,
      type: "reset",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  new ApiResponse(
    200,
    null,
    "If an account with this email exists, a reset link has been sent.",
  ).send(res);
});

// ─── Reset password ───────────────────────────────────────────────────────────
export const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const { token } = req.params;
  const { password } = req.body;

  const tokenDoc = await Token.findOne({ token, type: "reset" });
  if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
    throw ApiError.badRequest("Token is invalid or has expired");
  }

  const user = await User.findById(tokenDoc.userId);
  if (!user) throw ApiError.badRequest("User not found");

  user.password = password;
  await user.save();
  await Token.deleteOne({ _id: tokenDoc._id });

  new ApiResponse(200, null, "Password reset successfully").send(res);
});

// ─── Update profile ───────────────────────────────────────────────────────────
export const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) throw ApiError.notFound("User not found");

  const fields = [
    "phone",
    "address",
    "city",
    "state",
    "pinCode",
    "landmark",
    "name",
  ];
  fields.forEach((f) => {
    if (req.body[f]) user[f] = req.body[f];
  });

  const updatedUser = await user.save();

  new ApiResponse(
    200,
    {
      name: updatedUser.name,
      phone: updatedUser.phone,
      address: updatedUser.address,
      city: updatedUser.city,
      state: updatedUser.state,
      pinCode: updatedUser.pinCode,
      landmark: updatedUser.landmark,
    },
    "Profile updated successfully",
  ).send(res);
});
