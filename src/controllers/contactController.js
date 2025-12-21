import asyncHandler from "express-async-handler";
import Contact from "../models/contactModel.js";
import { validationResult } from "express-validator";

export const submitContactForm = asyncHandler(async (req, res) => {
  const error = validationResult(req);
  if (!error.isEmpty()) {
    return res.status(400).json({ errors: error.array() });
  }

  const { name, email, subject, message } = req.body;

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const recentSubmissions = await Contact.countDocuments({
    email,
    createdAt: { $gte: fiveMinutesAgo }, // Only submissions in last 5 minutes
  });

  if (recentSubmissions >= 3) {
    return res.status(429).json({
      msg: "You have submitted too many requests. Please wait a few minutes before trying again.",
    });
  }

  const contact = await Contact.create({
    name,
    email,
    subject,
    message,
    status: "open",
    assignedTo: null,
  });

  res.status(201).json({ msg: "Contact form submitted successfully", contact });
});

export const getAllContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find()
    .populate("assignedTo", "name email")
    .sort({ createdAt: -1 });
  res.json({
    success: true,
    total: contacts.length,
    contacts,
  });
});

export const replyToContact = asyncHandler(async (req, res) => {
  const error = validationResult(req);
  if (!error.isEmpty()) {
    return res.status(400).json({ errors: error.array() });
  }

  const { id } = req.params;
  const { message } = req.body;
  const adminId = req.user._id;
  const contact = await Contact.findById(id);
  if (!contact) {
    res.status(404);
    throw new Error("Contact message not found");
  }
  if (
    contact.assignedTo &&
    contact.assignedTo.toString() !== adminId.toString()
  ) {
    res.status(403);
    throw new Error("You are not authorized to reply to this message");
  }
  await sendEmail(contact.email, message);

  // Update database fields
  contact.assignedTo = adminId;
  contact.status = "replied";
  contact.repliedAt = new Date();

  await contact.save();

  res.json({
    success: true,
    message: "Reply sent successfully",
    contact,
  });
});

export const updateContactStatus = asyncHandler(async (req, res) => {
  const error = validationResult(req);
  if (!error.isEmpty()) {
    return res.status(400).json({ errors: error.array() });
  }

  const { status } = req.body;
  const contact = await Contact.findById(req.params.id);
  if (!["open", "closed"].includes(status)) {
    return res.status(400).json({ message: "Invalid status value" });
  }

  if (!contact) {
    res.status(404);
    throw new Error("Contact message not found");
  }
  if (status === "closed") {
    contact.closedAt = new Date();
    contact.status = "closed";
  }

  if (status === "open") {
    // Reset assignment if reopened
    contact.status = "open";
    contact.assignedTo = null;
    contact.repliedAt = null;
    contact.closedAt = null;
  }
  const updated = await contact.save();
  res.json({
    success: true,
    message: `Message status updated to ${status}`,
    updated,
  });
});

export const deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    res.status(404);
    throw new Error("Contact message not found");
  } else {
    await contact.remove();
    res.json({ message: "Contact message removed successfully" });
  }
});
