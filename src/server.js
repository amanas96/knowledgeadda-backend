import { config } from "dotenv";
config();

import express from "express";
import morgan from "morgan";
import cors from "cors";

// --- Import Routers ---
// import mainRouter from "./router/route.js";
import authRouter from "./routes/auth.js";
//import profileRouter from "./routes/profile.js";
import courseRouter from "./routes/courseRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import quizRouter from "./routes/quizRoutes.js";
import connectDB from "./config/db.js";
import errorHandler from "./middleware/errorMiddleware.js";
import contactRouter from "./routes/contactRoute.js";
import profileRouter from "./routes/profile.js";

// Load .env variables

const app = express();

// --- App Middleware ---
app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());
app.use(errorHandler);

// --- App Port ---
const port = process.env.PORT || 8080;

// --- Routes ---
// app.use("/api", mainRouter); // Your existing routes (e.g., /api/test)
app.use("/api/auth", authRouter);
app.use("/api/v1/courses", courseRouter);
app.use("/api/v1/subscriptions", subscriptionRoutes);
app.use("/api/v1/quizzes", quizRouter);
app.use("/api/contact", contactRouter);
app.use("/api/profile", profileRouter);

// Root route
app.get("/", (req, res) => {
  try {
    res.json({ msg: `Hello from Backend` });
  } catch (error) {
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// --- Start Server ---
// Start server only after a valid DB connection
connectDB()
  .then(() => {
    try {
      app.listen(port, () => {
        console.log(`Server connected to http://localhost:${port}`);
      });
    } catch (error) {
      console.log("Cannot connect to the server");
    }
  })
  .catch((err) => {
    console.log("Invalid Database connection");
    console.error(err);
  });
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});
