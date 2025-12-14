import express from "express";
import { check } from "express-validator";
import { submitContactForm } from "../controllers/contactController.js";

const router = express.Router();

const contactValidation = [
  check("name", "Name is required").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("subject", "Subject is required").not().isEmpty(),
  check("message", "Message is required").not().isEmpty(),
];

router.post("/", contactValidation, submitContactForm);

export default router;
