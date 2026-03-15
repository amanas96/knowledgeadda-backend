import asyncHandler from "express-async-handler";
import Contact from "../models/contactModel.js";
import { validationResult } from "express-validator";

// ---------------------------------------------
// USER: CREATE TICKET
// ---------------------------------------------
export const createTicket = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const userId = req.user?._id; // if logged in
  const { name, email, subject, message } = req.body;

  const ticket = await Contact.create({
    user: userId || null,
    name,
    email,
    subject,
    messages: [
      {
        senderType: "user",
        sender: userId || null,
        text: message,
      },
    ],
    status: "open",
  });

  res.status(201).json({
    success: true,
    ticket,
    message: "Ticket created successfully",
  });
});

// ---------------------------------------------
// ADMIN: GET ALL TICKETS
// ---------------------------------------------
export const adminGetAllTickets = asyncHandler(async (req, res) => {
  const tickets = await Contact.find()
    .populate("assignedTo", "name email")
    .populate("user", "name email")
    .sort({ updatedAt: -1 });

  res.json({ success: true, tickets });
});

// ---------------------------------------------
// USER: GET MY TICKETS
// ---------------------------------------------
export const userGetMyTickets = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const tickets = await Contact.find({ user: userId }).sort({
    updatedAt: -1,
  });

  res.json({ success: true, tickets });
});

// ---------------------------------------------
// ADMIN: REPLY TO A TICKET
// ---------------------------------------------
export const adminReplyToTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const adminId = req.user._id;

  const ticket = await Contact.findById(id);

  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  if (
    ticket.assignedTo &&
    ticket.assignedTo.toString() !== adminId.toString()
  ) {
    return res.status(403).json({
      message: "This ticket is already assigned to another admin.",
    });
  }

  ticket.messages.push({
    senderType: "admin",
    sender: adminId,
    text,
  });

  ticket.status = "replied";
  ticket.assignedTo = adminId;
  ticket.repliedAt = new Date();

  await ticket.save();

  res.json({
    success: true,
    ticket,
    message: "Reply added successfully",
  });
});

// ---------------------------------------------
// USER: REPLY TO TICKET
// ---------------------------------------------
export const userReplyToTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  const ticket = await Contact.findById(id);

  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  ticket.messages.push({
    senderType: "user",
    sender: userId,
    text,
  });

  ticket.status = "open";
  ticket.repliedAt = null;

  await ticket.save();

  res.json({ success: true, ticket });
});

// ---------------------------------------------
// ADMIN: CLOSE TICKET
// ---------------------------------------------
export const closeTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Contact.findById(id);

  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  ticket.status = "closed";
  ticket.closedAt = new Date();

  await ticket.save();

  res.json({
    success: true,
    message: "Ticket closed successfully",
    ticket,
  });
});

// ---------------------------------------------
// ADMIN/USER: REOPEN TICKET
// ---------------------------------------------
export const reopenTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const ticket = await Contact.findById(id);

  if (!ticket) {
    return res.status(404).json({ message: "Ticket not found" });
  }

  ticket.status = "open";
  ticket.closedAt = null;
  ticket.assignedTo = null;

  await ticket.save();

  res.json({
    success: true,
    message: "Ticket reopened",
    ticket,
  });
});
