import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // 1. Get token from header
      token = req.headers.authorization.split(" ")[1];

      // 2. THE FIX: Verify token using the new ACCESS secret
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      // 3. THE FIX: Get user ID directly from 'decoded.id'
      // req.user = await User.findById(decoded.id).select("-password");

      ////for more user bypass db verification
      req.user = {
        _id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        isAdmin: decoded.isAdmin,
      };

      if (!req.user) {
        return res.status(401).json({ msg: "Not authorized, user not found" });
      }

      next();
    } catch (error) {
      console.error(error);
      // This will catch expired tokens
      return res.status(401).json({ msg: "Not authorized, token failed" });
    }
  }

  if (!token) {
    return res.status(401).json({ msg: "Not authorized, no token" });
  }
});

// This admin middleware should still be correct
export const admin = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({ msg: "Not authorized as an admin" });
  }
};
