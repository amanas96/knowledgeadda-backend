import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/user.js";
import { ApiError } from "../../utils/ApiError.js";

export const protect = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw ApiError.unauthorized("Not authorized, no token");
  }

  const token = authHeader.split(" ")[1];

  // jwt.verify throws JsonWebTokenError or TokenExpiredError on failure
  // errorHandler already handles both — no try/catch needed here
  const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

  req.user = {
    _id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    isAdmin: decoded.isAdmin,
  };

  next();
});

export const admin = (req, res, next) => {
  if (req.user?.isAdmin) return next();
  throw ApiError.forbidden("Not authorized as an admin");
};
