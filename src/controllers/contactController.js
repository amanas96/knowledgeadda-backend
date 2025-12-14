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
  });

  res.status(201).json({ msg: "Contact form submitted successfully", contact });
});
