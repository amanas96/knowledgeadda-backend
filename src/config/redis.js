import { createClient } from "redis";

// ─── Client ───────────────────────────────────────────────────────────────────

const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",

  socket: {
    reconnectStrategy: (retries) => {
      if (retries >= 10) {
        console.error("❌ Redis: max reconnect attempts reached. Giving up.");
        return new Error("Max reconnect attempts reached");
      }
      const delay = Math.min(retries * 200, 10_000);
      console.warn(
        `⚠️  Redis: reconnecting in ${delay}ms (attempt ${retries + 1})…`,
      );
      return delay;
    },
    connectTimeout: 10_000,
  },
});

// ─── Event listeners ─────────────────────────────────────────────────────────

redisClient.on("connect", () => console.log("🔌 Redis: connecting…"));
redisClient.on("ready", () => console.log("✅ Redis: ready"));
redisClient.on("reconnecting", () => console.warn("🔄 Redis: reconnecting…"));
redisClient.on("error", (err) => console.error("❌ Redis error:", err.message));
redisClient.on("end", () => console.log("🔴 Redis: connection closed"));

// ─── Connect ──────────────────────────────────────────────────────────────────
// Call once at startup from server.js inside a try/catch so the server
// can optionally continue even if Redis is unavailable (cache-only use case).

export async function connectRedis() {
  try {
    await redisClient.connect();
  } catch (err) {
    console.error("❌ Redis: failed to connect on startup:", err.message);
    throw err;
  }
}

// ─── Export ───────────────────────────────────────────────────────────────────
// Shutdown (SIGTERM / SIGINT) is handled in server.js to keep all
// process lifecycle logic in one place.

export default redisClient;
