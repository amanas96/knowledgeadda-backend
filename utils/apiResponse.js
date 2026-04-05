// ── ApiResponse.js ────────────────────────────────────────────────────────────

class ApiResponse {
  // fixed: was "APiResponse" (casing typo)
  constructor(statusCode, data, message = "Success") {
    // ── Validation ──────────────────────────────────────────────────────────
    if (!Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599) {
      throw new TypeError(`ApiResponse: invalid statusCode "${statusCode}"`);
    }

    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    this.data = data ?? null; // explicit null instead of undefined
  }

  // ── Convenience factories ──────────────────────────────────────────────────
  static ok(data, message = "Success") {
    return new ApiResponse(200, data, message);
  }
  static created(data, message = "Created successfully") {
    return new ApiResponse(201, data, message);
  }
  static noContent(message = "Deleted successfully") {
    return new ApiResponse(204, null, message);
  }

  // ── Send directly from a controller ───────────────────────────────────────
  send(res) {
    const json = this.toJSON();

    console.log("API Response:", json);
    return res.status(this.statusCode).json(this.toJSON());
  }

  toJSON() {
    return {
      success: this.success,
      statusCode: this.statusCode,
      message: this.message,
      data: this.data,
    };
  }
}

export default ApiResponse;
