import { ApiError } from "../../utils/ApiError.js";
import multer from "multer";
import logger from "../../utils/logger.js";

const MONGOOSE_ERRORS = new Set([
  "CastError",
  "ValidationError",
  "DocumentNotFoundError",
]);

const normaliseError = (err) => {
  if (err instanceof ApiError) return err;

  // ── Mongoose ──────────────────────────────────────────────────────────────
  if (MONGOOSE_ERRORS.has(err.name)) {
    if (err.name === "CastError")
      return new ApiError(400, `Invalid ${err.path}: ${err.value}`);
    if (err.name === "ValidationError") {
      const errors = Object.values(err.errors).map((e) => e.message);
      return new ApiError(422, "Validation failed", errors);
    }
    if (err.name === "DocumentNotFoundError")
      return new ApiError(404, "Resource not found");
  }

  // ── Mongoose duplicate key ────────────────────────────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? "field";
    return new ApiError(409, `Duplicate value for '${field}'`);
  }

  // ── JWT ───────────────────────────────────────────────────────────────────
  if (err.name === "JsonWebTokenError")
    return new ApiError(401, "Invalid token");
  if (err.name === "TokenExpiredError")
    return new ApiError(401, "Token has expired");

  // ── Multer ────────────────────────────────────────────────────────────────
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE")
      return new ApiError(400, "File size exceeds the allowed limit");
    return new ApiError(400, `File upload error: ${err.message}`);
  }

  // ── Body-parser ───────────────────────────────────────────────────────────
  if (err instanceof SyntaxError && err.status === 400 && "body" in err)
    return new ApiError(400, "Malformed JSON in request body");

  // ── Payload too large ─────────────────────────────────────────────────────
  if (err.type === "entity.too.large")
    return new ApiError(413, "Request payload too large");

  // ── Fallback ──────────────────────────────────────────────────────────────
  return new ApiError(
    typeof err.statusCode === "number" ? err.statusCode : 500,
    err.statusCode ? err.message : "An unexpected error occurred",
    err.errors ?? [],
    err.stack,
  );
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const error = normaliseError(err);
  const isServerError = error.statusCode >= 500;

  const logPayload = {
    message: error.message,
    statusCode: error.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    requestId: req.id,
    userId: req.user?.id ?? null,
    ...(isServerError && { stack: error.stack }),
  };

  isServerError ? logger.error(logPayload) : logger.warn(logPayload);

  res.status(error.statusCode).json({
    ...error.toJSON(), // uses ApiError serialiser — stays in sync automatically
    requestId: req.id ?? undefined,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

export default errorHandler;
