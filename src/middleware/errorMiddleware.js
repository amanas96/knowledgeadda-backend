import { ApiError } from "../../utils/apiError.js";
import logger from "../../utils/logger.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert unknown errors into ApiError
  if (!(error instanceof ApiError)) {
    error = new ApiError(
      error.statusCode || 500,
      error.message || "Something went wrong",
      error.errors || [],
      error.stack,
    );
  }

  // ✅ log error with Winston
  logger.error({
    message: error.message,
    statusCode: error.statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: error.stack,
  });

  // Final formatted response
  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors,
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  res.status(error.statusCode).json(response);
};

export default errorHandler;
