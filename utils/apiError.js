// ── ApiError.js ───────────────────────────────────────────────────────────────

/**
 * Operational errors that are safe to expose to the client.
 * Never use this for unexpected programmer errors — let those bubble to errorHandler.
 */
class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack = "",
  ) {
    super(message);

    // ── Validation ──────────────────────────────────────────────────────────
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      throw new TypeError(`ApiError: invalid statusCode "${statusCode}"`);
    }
    if (!Array.isArray(errors)) {
      throw new TypeError("ApiError: errors must be an array");
    }

    this.name = "ApiError"; // shows "ApiError" in stack traces instead of "Error"
    this.statusCode = statusCode;
    this.errors = errors;
    this.success = false;
    this.isOperational = true; // lets errorHandler distinguish safe errors from crashes

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // ── Convenience factories (avoids magic numbers at call sites) ─────────────
  static badRequest(message = "Bad request", errors = []) {
    return new ApiError(400, message, errors);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }
  static conflict(message = "Conflict") {
    return new ApiError(409, message);
  }
  static unprocessable(message = "Validation failed", errors = []) {
    return new ApiError(422, message, errors);
  }
  static internal(message = "Internal server error") {
    return new ApiError(500, message);
  }

  // ── Serialiser: only expose what the client needs ──────────────────────────
  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      errors: this.errors.length ? this.errors : undefined,
    };
  }
}

export { ApiError };
