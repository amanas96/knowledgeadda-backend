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
  try {
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
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }

    console.error(err);
    return res.status(500).json({ message: "Internal server error" });
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

    if (tokenDoc.userId.toString() !== decoded.id) {
      console.error("⚠️ Refresh Token integrity failure", {
        storedUser: tokenDoc.userId.toString(),
        tokenUser: decoded.id,
      });

      await Token.deleteOne({ _id: tokenDoc._id });

      return res.status(403).json({
        message: "Token integrity error — refresh token invalidated",
      });
    }
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      res.status(401);
      throw new Error("User not found");
    }
    const isSubscribed = await getSubscriptionStatus(user._id);

    // 3. Issue new access token
    const accessToken = generateAccessToken(user);
    res.status(200).json({
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

  const activeSubscription = await UserSubscription.findOne({
    user: req.user._id,
    status: "active",
    endDate: { $gt: new Date() },
  }).populate("plan", "name price durationInDays");

  // 3. Attach details
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

  // ===============================
  // ✅ 3. ADMIN DASHBOARD DATA
  // ===============================
  if (req.user.role === "admin") {
    const myCourses = await Course.find({
      createdBy: req.user._id,
    }).sort({ createdAt: -1 });

    const myContent = await Content.find({
      createdBy: req.user._id,
    })
      .populate("course", "title")
      .sort({ createdAt: -1 });

    return res.json({
      role: "admin",
      user: userObject,
      stats: {
        totalCourses: myCourses.length,
        totalContent: myContent.length,
      },
      myCourses,
      myContent,
    });
  }

  const watchHistory = await WatchHistory.find({
    user: req.user._id,
  })
    .populate("content", "title contentType contentUrl")
    .populate("course", "title thumbnailUrl")
    .sort({ lastWatchedAt: -1 });

  const totalWatchTime = watchHistory.reduce(
    (sum, entry) => sum + (entry.watchTime || 0),
    0
  );

  const totalWatchedContents = watchHistory.length;

  const quizAttempts = await QuizAttempt.find({
    user: req.user._id,
    status: "completed",
  });

  const quizzesCompleted = quizAttempts.length;

  const totalQuizScore = quizAttempts.reduce(
    (sum, attempt) => sum + attempt.score,
    0
  );

  const avgQuizPercentage =
    quizAttempts.length > 0
      ? Math.round(
          quizAttempts.reduce((sum, q) => sum + q.percentage, 0) /
            quizAttempts.length
        )
      : 0;

  return res.json({
    role: "student",
    user: userObject,

    stats: {
      totalWatchTime,
      totalWatchedContents,
      quizzesCompleted,
      totalQuizScore,
      avgQuizPercentage,
    },

    watchHistory,
    quizAttempts,
  });
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

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
export const updateUserProfile = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const { phone, address, city, state, pinCode, landmark } = req.body;

  // Validate (optional but recommended)
  // if (!phone || !address || !city || !state || !pinCode) {
  //   return res.status(400).json({
  //     message: "All required fields must be filled.",
  //   });
  // }

  // Find user
  const user = await User.findById(userId);

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Update fields
  // This allows partial updates (e.g. just updating city)
  if (req.body.phone) user.phone = req.body.phone;
  if (req.body.address) user.address = req.body.address;
  if (req.body.city) user.city = req.body.city;
  if (req.body.state) user.state = req.body.state;
  if (req.body.pinCode) user.pinCode = req.body.pinCode;
  if (req.body.landmark) user.landmark = req.body.landmark;
  if (req.body.name) user.name = req.body.name;

  // Save to DB
  const updatedUser = await user.save();

  res.json({
    message: "Profile updated successfully",
    updatedProfile: {
      name: updatedUser.name,
      phone: updatedUser.phone,
      address: updatedUser.address,
      city: updatedUser.city,
      state: updatedUser.state,
      pinCode: updatedUser.pinCode,
      landmark: updatedUser.landmark,
    },
  });
});
