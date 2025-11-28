import { ApiError } from "../../utils/apiError.js";

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Convert unknown errors into ApiError
  if (!(error instanceof ApiError)) {
    error = new ApiError(
      error.statusCode || 500,
      error.message || "Something went wrong",
      error.errors || [],
      error.stack
    );
  }

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
