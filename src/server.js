import { config } from "dotenv";
config();

import express from "express";
import morgan from "morgan";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import compression from "compression";
import connectDB from "./config/db.js";
import errorHandler from "./middleware/errorMiddleware.js";
import { validateEnv } from "../utils/validateEnv.js";
import sanitizeMiddleware from "./middleware/sanitizeMiddleware.js";

import authRouter from "./routes/auth.js";
import courseRouter from "./routes/courseRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import quizRouter from "./routes/quizRoutes.js";
import contactRouter from "./routes/contactRoute.js";
import profileRouter from "./routes/profile.js";
import adminRouter from "./routes/admin.js";
import userRoutes from "./routes/userRoute.js";
import { connectRedis } from "./config/redis.js";
import { apiLogger } from "./middleware/apiLogger.js";

//  validate env first
validateEnv();

const app = express();
const port = process.env.PORT || 8080;

//  security headers
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));

//  compression
app.use(compression());

//  CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

//  logging
app.use(morgan("tiny"));

//  body parsers
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());

//  sanitization

app.use(sanitizeMiddleware);
app.use(
  hpp({
    whitelist: ["sort", "limit", "page", "type"],
  }),
);

//  rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100000,
  message: { message: "Too many requests, please try again after 15 minutes" },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    message: "Too many login attempts, please try again after 15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//  apply rate limiters
app.use(apiLogger);
app.use("/api", generalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);

//  routes
app.use("/api/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/quizzes", quizRouter);
app.use("/api/contact", contactRouter);
app.use("/api/profile", profileRouter);
app.use("/api/v1/users", userRoutes);
app.use("/api/admin", adminRouter);

//  root route
app.get("/", (req, res) => {
  res.json({ msg: "Hello from Backend" });
});

//  error handler — must be last
app.use(errorHandler);

//  start server

async function startServer() {
  await connectDB();
  console.log("MongoDB connected");

  try {
    await connectRedis();
  } catch (err) {
    console.warn("⚠️  Redis unavailable on startup — running without cache.");
    console.warn("    All requests will be served directly from MongoDB.");
  }
  app.listen(port, () => {
    console.log(`Server connected to http://localhost:${port}`);
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down...`);
  await redisClient.quit();
  console.log("✅ Redis disconnected");
  await mongoose.connection.close();
  console.log("✅ MongoDB disconnected");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

startServer().catch((err) => {
  console.error(" Failed to start server:", err.message);
  process.exit(1);
});

export default app;
