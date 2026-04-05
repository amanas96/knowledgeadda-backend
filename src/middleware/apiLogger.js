import logger from "../../utils/logger.js";
import { maskObject, maskUrl, maskEmail, MASK } from "../../utils/maskPii.js";

export const apiLogger = (req, res, next) => {
  const startTime = Date.now();
  const requestSnapshot = maskObject({ ...req.body });

  const originalJson = res.json.bind(res);
  let responseBody = null;
  res.json = (body) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on("finish", () => {
    if (req.path === "/health" || req.path === "/favicon.ico") return;

    const statusCode = res.statusCode;
    const durationMs = Date.now() - startTime;

    const entry = {
      type: "http",
      method: req.method,
      url: maskUrl(req.originalUrl || req.url),
      statusCode,
      statusMessage: res.statusMessage || (statusCode < 400 ? "OK" : "Error"),
      durationMs,
      requestId: req.id ?? undefined,
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
      user: req.user
        ? `id=${MASK} | email=${maskEmail(req.user.email || "")} | role=${req.user.isAdmin ? "admin" : "user"}`
        : "unauthenticated",
      request: {
        params: maskObject({ ...req.params }),
        query: maskObject({ ...req.query }),
        body: requestSnapshot,
      },
      response: maskObject(responseBody),
    };

    const msg = `${req.method} ${entry.url} → ${statusCode} (${durationMs}ms)`;

    if (statusCode >= 500) logger.error({ message: msg, ...entry });
    else if (statusCode >= 400) logger.warn({ message: msg, ...entry });
    else logger.info({ message: msg, ...entry });
  });

  next();
};
