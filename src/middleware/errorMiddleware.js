// import { ApiError } from "../../utils/apiError.js";
// import logger from "../../utils/logger.js";

// const errorHandler = (err, req, res, next) => {
//   let error = err;

//   // Convert unknown errors into ApiError
//   if (!(error instanceof ApiError)) {
//     error = new ApiError(
//       error.statusCode || 500,
//       error.message || "Something went wrong",
//       error.errors || [],
//       error.stack,
//     );
//   }

//   // ✅ log error with Winston
//   logger.error({
//     message: error.message,
//     statusCode: error.statusCode,
//     method: req.method,
//     url: req.originalUrl,
//     ip: req.ip,
//     stack: error.stack,
//   });

//   // Final formatted response
//   const response = {
//     success: false,
//     statusCode: error.statusCode,
//     message: error.message,
//     errors: error.errors,
//     ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
//   };

//   res.status(error.statusCode).json(response);
// };

// export default errorHandler;

import { ApiError } from "../../utils/apiError.js";
import logger from "../../utils/logger.js";

// Known operational error names that should NOT be treated as 500s
const MONGOOSE_ERRORS = new Set([
  "CastError",
  "ValidationError",
  "DocumentNotFoundError",
]);

/**
 * Normalises any thrown value into a clean ApiError.
 * Handles Mongoose, JWT, syntax errors, and unknown crashes.
 */
const normaliseError = (err) => {
  if (err instanceof ApiError) return err;

  // ── Mongoose ─────────────────────────────────────────────────────────────
  if (MONGOOSE_ERRORS.has(err.name)) {
    if (err.name === "CastError") {
      return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
    }
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return new ApiError(422, "Validation failed", errors);
    }
    if (err.name === "DocumentNotFoundError") {
      return new ApiError(404, "Resource not found");
    }
  }

  // ── Mongoose duplicate key (code 11000) ──────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return new ApiError(409, `Duplicate value for '${field}'`);
  }

  // ── JWT ───────────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError") {
    return new ApiError(401, "Invalid token");
  }
  if (err.name === "TokenExpiredError") {
    return new ApiError(401, "Token has expired");
  }

  // ── Body-parser / JSON syntax ─────────────────────────────────────────────
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return new ApiError(400, "Malformed JSON in request body");
  }

  // ── Payload too large ─────────────────────────────────────────────────────
  if (err.type === "entity.too.large") {
    return new ApiError(413, "Request payload too large");
  }

  // ── Fallback: unexpected crash ────────────────────────────────────────────
  return new ApiError(
    typeof err.statusCode === "number" ? err.statusCode : 500,
    err.statusCode ? err.message : "An unexpected error occurred", // don't leak internals on 500
    err.errors ?? [],
    err.stack,
  );
};

// ── Main Middleware ───────────────────────────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  // Guard: if headers already sent, delegate to Express default handler
  if (res.headersSent) {
    return next(err);
  }

  const error = normaliseError(err);
  const isServerError = error.statusCode >= 500;

  // ── Structured logging ────────────────────────────────────────────────────
  const logPayload = {
    message: error.message,
    statusCode: error.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.id, // works if you use express-request-id
    userId: req.user?.id ?? null, // works if you attach user in auth middleware
    ...(isServerError && { stack: error.stack }), // stack only for real errors
  };

  // Use .warn for 4xx (client mistakes), .error for 5xx (our problem)
  isServerError ? logger.error(logPayload) : logger.warn(logPayload);

  // ── Response ──────────────────────────────────────────────────────────────
  const body = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors?.length ? error.errors : undefined, // omit empty array
    requestId: req.id ?? undefined, // lets clients report a traceable ID
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  res.status(error.statusCode).json(body);
};

export default errorHandler;
