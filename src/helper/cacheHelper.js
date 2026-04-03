/**
 * helper/cacheHelper.js
 *
 * A thin wrapper around redisClient that adds:
 *  - Silent fallback to DB if Redis is unavailable
 *  - Centralised TTL constants
 *  - Cache invalidation utilities
 *
 * Controllers never touch redisClient directly — they use these helpers.
 * If Redis is down, every helper degrades gracefully and the request is
 * served straight from MongoDB without crashing or throwing.
 */

import redisClient from "../config/redis.js";

// ─── TTL constants (seconds) ──────────────────────────────────────────────────

export const TTL = {
  courseList: 300, // 5 min  — invalidated on any course write
  singleCourse: 3600, // 1 hr   — stable, invalidated on update/delete
  content: 300, // 5 min  — invalidated on content add/remove
  quizList: 600, // 👈 Add this for "getAllQuizzes"
  singleQuiz: 3600,
  leaderboard: 120, // 2 min  — changes frequently
};

// ─── Redis availability check ─────────────────────────────────────────────────

/**
 * Returns true only when the Redis client is connected and ready.
 * Uses the client's internal status string so we never send commands
 * to a disconnected socket.
 */
function isRedisReady() {
  return redisClient?.isReady === true && redisClient?.isOpen === true;
}

// ─── Core get / set / del ─────────────────────────────────────────────────────

/**
 * Read a value from Redis.
 * Returns the parsed object on hit, null on miss or if Redis is down.
 *
 * @param {string} key
 * @returns {Promise<object|null>}
 */
export async function cacheGet(key) {
  if (!isRedisReady()) {
    console.warn(`[cache] Redis unavailable — cache MISS for key: ${key}`);
    return null;
  }

  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[cache] GET error for key "${key}":`, err.message);
    return null; // treat as miss, fall through to DB
  }
}

/**
 * Write a value to Redis with a TTL.
 * Silently skips if Redis is down — the request still succeeds.
 *
 * @param {string} key
 * @param {number} ttl   seconds
 * @param {object} value will be JSON.stringify'd
 */
export async function cacheSet(key, ttl, value) {
  if (!isRedisReady()) {
    console.warn(`[cache] Redis unavailable — skipping SET for key: ${key}`);
    return;
  }

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (err) {
    console.error(`[cache] SET error for key "${key}":`, err.message);
    // non-fatal — DB already responded, just skip caching
  }
}

/**
 * Delete one or more keys.
 * Silently skips if Redis is down.
 *
 * @param {...string} keys
 */
export async function cacheDel(...keys) {
  if (!isRedisReady()) {
    console.warn(
      `[cache] Redis unavailable — skipping DEL for keys: ${keys.join(", ")}`,
    );
    return;
  }

  try {
    await redisClient.del(keys);
  } catch (err) {
    console.error(
      `[cache] DEL error for keys "${keys.join(", ")}":`,
      err.message,
    );
  }
}

/**
 * Delete all keys matching a glob pattern (e.g. "courses:all:*").
 * Silently skips if Redis is down.
 *
 * NOTE: redisClient.keys() is O(n) — fine for dev and low-key-count envs.
 * For high-traffic production, replace with a Redis Set tracker.
 *
 * @param {string} pattern
 */
export async function cacheDelPattern(pattern) {
  if (!isRedisReady()) {
    console.warn(
      `[cache] Redis unavailable — skipping pattern DEL: ${pattern}`,
    );
    return;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
      console.info(
        `[cache] Invalidated ${keys.length} key(s) matching: ${pattern}`,
      );
    }
  } catch (err) {
    console.error(`[cache] Pattern DEL error for "${pattern}":`, err.message);
  }
}

// ─── Cache-aside helper ───────────────────────────────────────────────────────

/**
 * The standard cache-aside pattern in one call.
 *
 * 1. Try Redis — return cached value if found.
 * 2. On miss (or Redis down) — call fetchFn() to get fresh data from DB.
 * 3. Store result in Redis (if available) with the given TTL.
 * 4. Return the data.
 *
 * Usage in a controller:
 *
 *   const course = await withCache(
 *     `course:${courseId}`,
 *     TTL.singleCourse,
 *     () => findCourseBySlugOrId(courseId)
 *   );
 *
 * @param {string}            key       Redis key
 * @param {number}            ttl       seconds
 * @param {() => Promise<*>}  fetchFn   async function that returns fresh data
 * @returns {Promise<*>}      cached or freshly fetched data
 */
export async function withCache(key, ttl, fetchFn) {
  // 1. Cache read
  const cached = await cacheGet(key);
  if (cached !== null) return cached;

  // 2. DB fallback
  const data = await fetchFn();

  // 3. Cache write (only if we got data worth caching)
  if (data !== null && data !== undefined) {
    await cacheSet(key, ttl, data);
  }

  return data;
}

// ─── Domain-specific invalidation helpers ────────────────────────────────────

/**
 * Wipe all paginated course-list cache entries.
 * Call after any course create / update / delete.
 */
export async function invalidateCourseListCache() {
  await cacheDelPattern("courses:all:*");
}

/**
 * Wipe the single-course cache entry (by id or slug).
 * @param {string} courseId   ObjectId string or slug
 */
export async function invalidateSingleCourseCache(courseId) {
  await cacheDel(`course:${courseId}`);
}

/**
 * Wipe all content cache entries for a course.
 * Call after content is added or removed from a course.
 * @param {string} courseId   ObjectId string
 */
export async function invalidateCourseContentCache(courseId) {
  await cacheDelPattern(`course:${courseId}:content:*`);
}

/**
 * Wipe all paginated quiz list cache entries.
 * Call after any quiz create / update / delete.
 */
export async function invalidateQuizListCache() {
  await cacheDelPattern("quizzes:list:*");
}

/**
 * Invalidate all quiz-related caches.
 * Call after Quiz Update or Delete.
 */
export async function invalidateQuizCache(quizId, slug = null) {
  const keys = [`quiz:${quizId}`, `quiz:${quizId}:questions`];
  if (slug) keys.push(`quiz:${slug}`);

  await Promise.all([
    cacheDel(...keys),
    cacheDelPattern(`leaderboard:quiz:${quizId}:*`),
    cacheDelPattern("quizzes:list:*"),
    cacheDel("leaderboard:global"),
  ]);
}
