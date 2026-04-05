import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { getMyEnrollments } from "../controllers/enrollmentController.js";

const router = express.Router();

router.get("/my-enrollments", protect, getMyEnrollments);

export default router;
