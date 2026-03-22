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
  max: 100,
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
connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server connected to http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.log("Invalid Database connection");
    console.error(err);
  });

export default app;
