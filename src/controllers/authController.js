import User from "../models/user.js";
import Token from "../models/tokenModel.js";
import asyncHandler from "express-async-handler";
import { check, validationResult } from "express-validator";
import {
  generateAccessToken,
  generateRefreshToken,
  generateResetToken,
} from "../../utils/generateToken.js";
import { sendPasswordResetEmail } from "../../utils/sendEmail.js";
import jwt from "jsonwebtoken";
import { getSubscriptionStatus } from "../../utils/getSubscriptionStatus.js";

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const registerUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { name, email, password } = req.body;
  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  const user = new User({
    name,
    email,
    password,
    isAdmin: email === "amanasadmin@gmail.com" ? true : false,
  });
  await user.save();

  if (user) {
    // 1. Create tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user._id);

    // 2. Save Refresh Token to database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await Token.create({
      userId: user._id,
      token: refreshToken,
      type: "refresh",
      expiresAt,
    });

    // 3. Send response
    res.status(201).json({
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
      },
    });
  } else {
    res.status(500);
    throw new Error("Invalid user data");
  }
});

// @desc    Auth user & get token (Login)
// @route   POST /api/auth/login
// @access  Public
////////////////// login user ///////////////////////////////
export const loginUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  // 1. Create tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user._id);

  // 2. Save Refresh Token to database
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await Token.create({
    userId: user._id,
    token: refreshToken,
    type: "refresh",
    expiresAt,
  });

  // 3. Send response
  res.json({
    accessToken,
    refreshToken,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin,
    },
  });
});

// @desc    Refresh access token
// @route   POST /api/auth/refresh
// @access  Public

//////////////// refresh access /////////////
export const refreshAccessToken = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { refreshToken } = req.body;
  if (!refreshToken) {
    res.status(401);
    throw new Error("No refresh token provided");
  }

  // 1. Find token in database
  const tokenDoc = await Token.findOne({
    token: refreshToken,
    type: "refresh",
  });
  if (!tokenDoc) {
    res.status(401);
    throw new Error("Invalid refresh token");
  }

  // 2. Verify the token
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("User not found");
    }
    const isSubscribed = await getSubscriptionStatus(user._id);

    // 3. Issue new access token
    const accessToken = generateAccessToken(user);
    res.json({
      accessToken,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        isSubscribed,
      },
    });
  } catch (error) {
    res.status(401);
    throw new Error("Refresh token is invalid or expired");
  }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public (requires token in body)
export const logoutUser = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { refreshToken } = req.body;

  // Delete the refresh token from the database
  const result = await Token.deleteOne({
    token: refreshToken,
    type: "refresh",
  });

  if (result.deletedCount === 0) {
    return res.status(400).json({
      message: "Already logged out or token not found",
    });
  }

  res.json({ message: "Logged out successfully" });
});

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
export const logoutAllDevices = asyncHandler(async (req, res) => {
  // Invalidate all refresh tokens for this user
  await Token.deleteMany({
    userId: req.user._id,
    type: "refresh",
  });

  res.status(200).json({ message: "Logged out from all devices successfully" });
});

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
export const getUserProfile = asyncHandler(async (req, res) => {
  const userObject = { ...req.user };
  const isSubscribed = await getSubscriptionStatus(req.user._id);
  userObject.isSubscribed = isSubscribed;

  res.json(userObject);
});

// --- RESET PASSWORD ---

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (user) {
    // 1. Create a reset token
    const resetToken = generateResetToken(user._id);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 2. Save reset token to DB
    await Token.create({
      userId: user._id,
      token: resetToken,
      type: "reset",
      expiresAt,
    });

    // 3. Create reset URL (Update 3000 if your frontend runs on a different port)
    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    // 4. Send the (mock) email
    await sendPasswordResetEmail(user.email, resetUrl);
  }

  // Always send a success response to prevent email enumeration
  return res.status(200).json({
    success: true,
    message:
      "If an account with this email exists, a reset link has been sent.",
  });
});

// @desc    Reset password
// @route   POST /api/auth/reset-password/:token
// @access  Public
export const resetPassword = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { token } = req.params;
  const { password } = req.body;

  // 1. Find the reset token in the DB
  const tokenDoc = await Token.findOne({ token, type: "reset" });

  // 2. Check if valid and not expired
  if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
    res.status(400);
    throw new Error("Token is invalid or has expired");
  }

  // 3. Find the user
  const user = await User.findById(tokenDoc.userId);
  if (!user) {
    res.status(400);
    throw new Error("User not found");
  }

  // 4. Set new password
  user.password = password;
  await user.save();

  // 5. Delete the used reset token
  await Token.deleteOne({ _id: tokenDoc._id });

  res.json({ message: "Password reset successfully" });
});
