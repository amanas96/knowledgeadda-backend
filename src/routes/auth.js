import express from "express";
import { check } from "express-validator"; // 1. IMPORT
import {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  logoutAllDevices,
  forgotPassword,
  resetPassword,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 2. DEFINE VALIDATION RULES
const registerValidation = [
  check("name", "Name is required").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be 6 or more characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,12}$/,
    )
    .withMessage(
      "Password must include at least one uppercase, lowercase, number, and special character",
    ),
];

const loginValidation = [
  check("email", "Please include a valid email").isEmail(),
  check("password", "Password is required").exists(),
];

const tokenBodyValidation = [
  check("refreshToken", "Refresh token is required").not().isEmpty(),
];

const emailValidation = [
  check("email", "Please include a valid email").isEmail(),
];

const resetPasswordValidation = [
  check("password")
    .isLength({ min: 6 })
    .withMessage("Password must be 6 or more characters long")
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{6,12}$/,
    )
    .withMessage(
      "Password must include at least one uppercase, lowercase, number, and special character",
    ),
];

// 3. APPLY RULES TO ROUTES
router.post("/register", registerValidation, registerUser);
router.post("/login", loginValidation, loginUser);
router.post("/refresh", tokenBodyValidation, refreshAccessToken);
router.post("/logout", tokenBodyValidation, logoutUser);
router.post("/forgot-password", emailValidation, forgotPassword);
router.post("/reset-password/:token", resetPasswordValidation, resetPassword);
router.post("/logout-all", protect, logoutAllDevices);

export default router;
