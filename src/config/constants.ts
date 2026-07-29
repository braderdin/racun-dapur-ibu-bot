export const CONSTANTS = {
  // Upstash Redis TTL: 5 Hari (5 * 24 * 60 * 60 = 432,000 saat)
  REDIS_ANTI_REPEAT_TTL_SECONDS: 432000,

  // OpenRouter AI Delay Wrapper (3 Saat)
  OPENROUTER_DELAY_MS: 3000,
  OPENROUTER_MODEL: "openrouter/free",

  // Backblaze B2 Storage Limit Per Account (9GB Cap)
  B2_STORAGE_CAP_BYTES: 9 * 1024 * 1024 * 1024, // 9 GB

  // Default Hashtags
  BRAND_HASHTAGS: "#RacunDapurIbu #DiskaunDapur #AffiliateMY",
};