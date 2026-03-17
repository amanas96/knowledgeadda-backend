import express from "express";
import {
  createTicket,
  adminGetAllTickets,
  userGetMyTickets,
  adminReplyToTicket,
  userReplyToTicket,
  closeTicket,
  reopenTicket,
} from "../controllers/contactController.js";

import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

// USER creates ticket
router.post("/", protect, createTicket);

// USER sees own tickets
router.get("/my", protect, userGetMyTickets);

// ADMIN gets all tickets
//router.get("/", protect, admin, adminGetAllTickets);

// ADMIN reply
//router.post("/reply/:id", protect, admin, adminReplyToTicket);

// USER reply
router.post("/reply/user/:id", protect, userReplyToTicket);

// CLOSE ticket
//router.put("/close/:id", protect, admin, closeTicket);

// REOPEN ticket
router.put("/reopen/:id", protect, reopenTicket);

export default router;
