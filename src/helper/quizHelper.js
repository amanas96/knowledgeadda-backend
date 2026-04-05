import mongoose from "mongoose";
import Quiz from "../models/quiz.js";
import QuizAttempt from "../models/quizAttempt.js";

/* ============================================================
   Reusable query builder — returns QUERY (not document) so
   callers can chain .populate(), .select(), .lean(), etc.
============================================================ */
export const findQuizBySlugOrId = (param) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(param);
  return Quiz.findOne(isObjectId ? { _id: param } : { slug: param });
};

/* ============================================================
   Retrieve a specific attempt by ObjectId OR the latest
   attempt for a quiz slug.
============================================================ */
export const findAttemptByIdOrSlug = async (identifier, userId) => {
  const isObjectId = mongoose.Types.ObjectId.isValid(identifier);

  if (isObjectId) {
    const specificAttempt = await QuizAttempt.findOne({
      _id: identifier,
      user: userId,
    })
      .populate("quiz", "title")
      .populate("answers.question");

    if (specificAttempt) return specificAttempt;
  }

  const quiz = await Quiz.findOne({ slug: identifier });
  if (!quiz) return null;

  return QuizAttempt.findOne({ user: userId, quiz: quiz._id })
    .sort({ createdAt: -1 })
    .populate("quiz", "title")
    .populate("answers.question");
};

/* ============================================================
   Validate a single question object.
   Returns an array of error strings — empty means valid.
============================================================ */
export function validateQuestion(q) {
  const errors = [];

  if (!q?.text?.trim()) {
    errors.push("text is required");
  }

  if (!Array.isArray(q.options) || q.options.length < 2) {
    errors.push("options must be an array with at least 2 items");
  } else if (q.options.length > 6) {
    errors.push("options must have at most 6 items");
  } else {
    const trimmed = q.options.map((o) => String(o).trim());
    if (trimmed.some((o) => !o)) {
      errors.push("options must not contain empty strings");
    } else if (new Set(trimmed).size !== trimmed.length) {
      errors.push("options must be unique");
    }
  }

  if (!q.correctAnswer) {
    errors.push("correctAnswer is required");
  } else if (
    Array.isArray(q.options) &&
    !q.options.map((o) => String(o).trim()).includes(q.correctAnswer)
  ) {
    errors.push("correctAnswer must be one of the provided options");
  }

  if (q.marks !== undefined && q.marks !== null) {
    const m = Number(q.marks);
    if (isNaN(m) || m <= 0) {
      errors.push("marks must be a positive number");
    }
  }

  return errors;
}

/* ============================================================
   Normalise a raw question object into a clean DB document.
   quiz._id must be passed in as quizId.
============================================================ */
export function buildQuestionDoc(q, quizId) {
  return {
    quiz: quizId,
    text: q.text.trim(),
    options: q.options.map((o) => String(o).trim()),
    correctAnswer: String(q.correctAnswer).trim(),
    marks: Number(q.marks) || 1,
    explanation: q.explanation?.trim() || "",
  };
}

/* ============================================================
   Partition an incoming array into { valid, invalid }.
   Each invalid entry carries { index, input, errors }.
============================================================ */
export function partitionQuestions(incoming, quizId) {
  const valid = [];
  const invalid = [];

  incoming.forEach((q, index) => {
    const errors = validateQuestion(q);
    if (errors.length > 0) {
      invalid.push({ index, input: q, errors });
    } else {
      valid.push(buildQuestionDoc(q, quizId));
    }
  });

  return { valid, invalid };
}

/* ============================================================
   Build the standard summary object used in bulk-insert
   responses.
============================================================ */
export function buildBulkSummary(requested, inserted, invalid, dbErrors = []) {
  const totalFailed = invalid.length + dbErrors.length;
  const allSucceeded = totalFailed === 0;
  const noneFailed = totalFailed === requested;

  return {
    summary: {
      requested,
      inserted,
      failed: totalFailed,
      status: allSucceeded
        ? "all_inserted"
        : noneFailed
          ? "none_inserted"
          : "partial_insert",
    },
    statusCode: allSucceeded ? 201 : noneFailed ? 400 : 207,
  };
}
