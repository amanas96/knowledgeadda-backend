import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import { fileURLToPath } from "url";
import { maskObject, MASK } from "./maskPii.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");

const maskFormat = winston.format((info) => {
  if (typeof info.message === "string") {
    info.message = info.message.replace(/\b[a-f0-9]{24}\b/gi, MASK);
  }
  const { level, message, timestamp, stack, ...meta } = info;
  return { level, message, timestamp, stack, ...maskObject(meta) };
});

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  maskFormat(),
  winston.format.json(),
);

const rotatingTransport = (level) =>
  new DailyRotateFile({
    dirname: LOG_DIR,
    filename: `${level}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    level,
    format: fileFormat,
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "30d",
  });

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "warn" : "info",
  transports: [
    rotatingTransport("error"), // error-YYYY-MM-DD.log
    rotatingTransport("warn"), // warn-YYYY-MM-DD.log
    rotatingTransport("info"), // info-YYYY-MM-DD.log
  ],
});

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: "HH:mm:ss" }),
        winston.format.printf(({ level, message, timestamp, stack }) =>
          stack
            ? `${timestamp} ${level}: ${message}\n${stack}`
            : `${timestamp} ${level}: ${message}`,
        ),
      ),
    }),
  );
}

export default logger;
