import express from "express";
import { check } from "express-validator";
import {
  getAllContacts,
  submitContactForm,
  replyToContact,
  updateContactStatus,
  deleteContact,
} from "../controllers/contactController.js";
import { protect, admin } from "../middleware/authMiddleware.js";

const router = express.Router();

const contactValidation = [
  check("name", "Name is required").not().isEmpty(),
  check("email", "Please include a valid email").isEmail(),
  check("subject", "Subject is required").not().isEmpty(),
  check("message", "Message is required").not().isEmpty(),
];

router.post("/", contactValidation, submitContactForm);

router.get("/", protect, admin, getAllContacts);
router.post("/reply/:id", protect, admin, replyToContact);
router.put("/status/:id", protect, admin, updateContactStatus);
router.delete("/:id", protect, admin, deleteContact);

export default router;
