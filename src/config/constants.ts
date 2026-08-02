export const CONSTANTS = {
  // Upstash Redis TTL: 5 Hari (5 * 24 * 60 * 60 = 432,000 saat)
  REDIS_ANTI_REPEAT_TTL_SECONDS: 432000,

  // OpenRouter AI Delay Wrapper (3 Saat)
  OPENROUTER_DELAY_MS: 3000,
  OPENROUTER_MODEL: "openrouter/free",

  // Backblaze B2 Storage Limit Per Account (9GB Cap)
  B2_STORAGE_CAP_BYTES: 9 * 1024 * 1024 * 1024, // 9 GB

  // System-wide limits
  MAX_REQUESTS_PER_MINUTE: 5,
  MAX_REQUESTS_PER_HOUR: 200,
  MAX_REQUESTS_PER_DAY: 1000,

  // QStash scheduling hours (peak hours)
  QSTASH_PEAK_HOURS_START: "12:30",
  QSTASH_PEAK_HOURS_END: "14:00",
  QSTASH_EVENING_PEAK_HOURS_START: "20:30",
  QSTASH_EVENING_PEAK_HOURS_END: "22:30",

  // Default Hashtags
  BRAND_HASHTAGS: "#RacunDapurIbu #DiskaunDapur #AffiliateMY",

  // Platform API rate limits
  X_API_MAX_REQUESTS_PER_2_HOURS: 12,
  LAZADA_API_MAX_REQUESTS_PER_HOUR: 60,

  // Anti-spam protection
  MIN_POST_INTERVAL_MINUTES: 120, // 2 hours

  // Storage switching threshold
  B2_AUTO_SWITCH_THRESHOLD_GB: 9,

  // Worker configuration
  WORKER_MEMORY_LIMIT_MB: 1024,
  WORKER_MAX_DURATION_SECONDS: 300,
  WORKER_MAX_WIDTH: 1920,
  WORKER_MAX_HEIGHT: 1080,

  // Upstash Vector Circuit Breaker
  UPSTASH_VECTOR_CIRCUIT_BREAKER_THRESHOLD: 3,
  UPSTASH_VECTOR_CIRCUIT_BREAKER_TIMEOUT: 300000, // 5 minutes
};
