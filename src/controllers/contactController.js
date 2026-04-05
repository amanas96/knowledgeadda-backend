import asyncHandler from "express-async-handler";
import Contact from "../models/contactModel.js";
import { validationResult } from "express-validator";
import { ApiError } from "../../utils/ApiError.js";
import ApiResponse from "../../utils/ApiResponse.js";

// ---------------------------------------------
// USER: CREATE TICKET
// ---------------------------------------------
export const createTicket = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ApiError(400, "Validation failed", errors.array());
  }

  const userId = req.user?._id;
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

  new ApiResponse(201, ticket, "Ticket created successfully").send(res);
});

// ---------------------------------------------
// ADMIN: GET ALL TICKETS
// ---------------------------------------------
export const adminGetAllTickets = asyncHandler(async (req, res) => {
  const tickets = await Contact.find()
    .populate("assignedTo", "name email")
    .populate("user", "name email")
    .sort({ updatedAt: -1 });

  new ApiResponse(200, tickets, "Tickets fetched successfully").send(res);
});

// ---------------------------------------------
// USER: GET MY TICKETS
// ---------------------------------------------
export const userGetMyTickets = asyncHandler(async (req, res) => {
  const tickets = await Contact.find({ user: req.user._id }).sort({
    updatedAt: -1,
  });

  new ApiResponse(200, tickets, "Your tickets fetched successfully").send(res);
});

// ---------------------------------------------
// ADMIN: REPLY TO A TICKET
// ---------------------------------------------
export const adminReplyToTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const adminId = req.user._id;

  const ticket = await Contact.findById(id);
  if (!ticket) throw ApiError.notFound("Ticket not found");

  if (
    ticket.assignedTo &&
    ticket.assignedTo.toString() !== adminId.toString()
  ) {
    throw ApiError.forbidden(
      "This ticket is already assigned to another admin.",
    );
  }

  ticket.messages.push({ senderType: "admin", sender: adminId, text });
  ticket.status = "replied";
  ticket.assignedTo = adminId;
  ticket.repliedAt = new Date();

  await ticket.save();

  new ApiResponse(200, ticket, "Reply added successfully").send(res);
});

// ---------------------------------------------
// USER: REPLY TO TICKET
// ---------------------------------------------
export const userReplyToTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const userId = req.user._id;

  const ticket = await Contact.findById(id);
  if (!ticket) throw ApiError.notFound("Ticket not found");

  ticket.messages.push({ senderType: "user", sender: userId, text });
  ticket.status = "open";
  ticket.repliedAt = null;

  await ticket.save();

  new ApiResponse(200, ticket, "Reply added successfully").send(res);
});

// ---------------------------------------------
// ADMIN: CLOSE TICKET
// ---------------------------------------------
export const closeTicket = asyncHandler(async (req, res) => {
  const ticket = await Contact.findById(req.params.id);
  if (!ticket) throw ApiError.notFound("Ticket not found");

  ticket.status = "closed";
  ticket.closedAt = new Date();

  await ticket.save();

  new ApiResponse(200, ticket, "Ticket closed successfully").send(res);
});

// ---------------------------------------------
// ADMIN/USER: REOPEN TICKET
// ---------------------------------------------
export const reopenTicket = asyncHandler(async (req, res) => {
  const ticket = await Contact.findById(req.params.id);
  if (!ticket) throw ApiError.notFound("Ticket not found");

  ticket.status = "open";
  ticket.closedAt = null;
  ticket.assignedTo = null;

  await ticket.save();

  new ApiResponse(200, ticket, "Ticket reopened successfully").send(res);
});
