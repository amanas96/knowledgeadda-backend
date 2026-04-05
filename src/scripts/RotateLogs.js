// scripts/rotateLogs.js
// Run via cron or manually: node scripts/rotateLogs.js
// Recommended cron: 0 0 * * * node /path/to/scripts/rotateLogs.js

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "../logs");
const KEEP_DAYS = 30; // delete logs older than this

const rotateLogs = () => {
  if (!fs.existsSync(LOG_DIR)) return;

  const files = fs.readdirSync(LOG_DIR).filter((f) => f.endsWith(".log"));
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let deleted = 0;

  files.forEach((file) => {
    const filePath = path.join(LOG_DIR, file);
    const stats = fs.statSync(filePath);
    if (stats.mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      deleted++;
      console.log(`[rotateLogs] Deleted: ${file}`);
    }
  });

  console.log(
    `[rotateLogs] Done. ${deleted} file(s) deleted, ${files.length - deleted} kept.`,
  );
};

rotateLogs();
