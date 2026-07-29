/**
 * Environment Type Definitions
 * TypeScript interfaces for environment variables used by the worker
 */

export interface Env {
  // Cloudflare Worker Runtime Bindings
  DATABASE_URL: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;

  // Backblaze B2 Storage Configuration
  B2_ACC1_KEY_NAME: string;
  B2_ACC1_KEY_ID: string;
  B2_ACC1_APPLICATION_KEY: string;
  B2_ACC2_KEY_NAME: string;
  B2_ACC2_KEY_ID: string;
  B2_ACC2_APPLICATION_KEY: string;

  // Upstash Redis Configuration
  REDIS_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  UPSTASH_REDIS_REST_URL: string;

  // Upstash QStash Configuration
  QSTASH_URL: string;
  QSTASH_TOKEN: string;
  QSTASH_CURRENT_SIGNING_KEY: string;
  QSTASH_NEXT_SIGNING_KEY: string;

  // X (Twitter) API Configuration
  X_API_KEY: string;
  X_API_KEY_SECRET: string;
  X_BEARER_TOKEN: string;
  X_ACCESS_TOKEN: string;
  X_ACCESS_TOKEN_SECRET: string;
  X_CONSUMER_KEY: string;
  X_CONSUMER_KEY_SECRET: string;
  X_CLIENT_ID: string;
  X_CLIENT_SECRET: string;

  // Lazada API Configuration
  LAZADA_APP_KEY: string;
  LAZADA_APP_SECRET: string;
  LAZADA_MEMBER_ID: string;
  LAZADA_USER_TOKEN: string;
  LAZADA_LITEAPP_KEY: string;
  LAZADA_LITEAPP_SECRET: string;

  // OpenRouter AI Configuration
  OPENROUTER_BASE_URL: string;
  OPENROUTER_API_KEY: string;

  // QStash Queue Configuration
  QSTASH_QUEUE_URL: string;
  QSTASH_QUEUE_TOKEN: string;

  // Rate Limiting and Anti-Srepeat Configuration
  REDIS_ANTI_REPEAT_TTL_SECONDS: number;
  MAX_REQUESTS_PER_MINUTE: number;
  OPENROUTER_REQUEST_DELAY_MS: number;

  // Storage and Image Processing Configuration
  MAX_IMAGE_SIZE_MB: number;
  ALLOWED_IMAGE_FORMATS: string;
  BACKBLAZE_STORAGE_BASE_URL: string;

  // Bot Behavior Configuration
  BOT_TWEET_COUNT: number;
  BOT_COOLDOWN_TIME_MINUTES: number;
  MAX_PRODUCTS_PER_RUN: number;

  // Monitoring and Health Check Configuration
  HEALTH_CHECK_TIMEOUT_MS: number;
  ENABLE_DETAILED_HEALTH_LOGS: boolean;

  // Security and Access Control
  ALLOWED_ORIGINS: string;
  API_KEY_HEADER_NAME: string;

  // Logging and Monitoring
  LOG_LEVEL: string;
  CONSOLE_LOG_ENABLED: boolean;
  STRUCTURED_LOGGING_ENABLED: boolean;

  // Backup and Recovery
  BACKUP_ENABLED: boolean;
  BACKUP_RETENTION_DAYS: number;

  // Performance and Caching
  REDIS_CACHE_TTL_SECONDS: number;
  ENABLE_CACHE_WARMING: boolean;

  // Development and Testing
  DEBUG_MODE: boolean;
  TEST_MODE: boolean;
}

// Environment variable validation
export function validateEnv(env: Env): Env {
  const requiredVars = [
    "DATABASE_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "REDIS_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "QSTASH_URL",
    "QSTASH_TOKEN",
    "QSTASH_CURRENT_SIGNING_KEY",
    "QSTASH_NEXT_SIGNING_KEY",
    "X_API_KEY",
    "X_API_KEY_SECRET",
    "LAZADA_APP_KEY",
    "LAZADA_APP_SECRET",
    "LAZADA_MEMBER_ID",
    "LAZADA_USER_TOKEN",
    "OPENROUTER_BASE_URL",
    "OPENROUTER_API_KEY",
    "REDIS_ANTI_REPEAT_TTL_SECONDS",
    "MAX_REQUESTS_PER_MINUTE",
    "REDIS_CACHE_TTL_SECONDS",
  ];

  const missingVars = requiredVars.filter((varName) => !env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}\n` +
        `Please check your .env.local or .dev.vars configuration.`,
    );
  }

  return env;
}

// Environment-specific configuration
export const appConfig = {
  development: {
    DATABASE_URL:
      process.env.DATABASE_URL || "postgresql://localhost:5432/racun_dapur_ibu",
    REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    SUPABASE_URL: process.env.SUPABASE_URL || "http://localhost:54321",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key",
    REDIS_ANTI_REPEAT_TTL_SECONDS: 300,
    MAX_REQUESTS_PER_MINUTE: 10,
    OPENROUTER_REQUEST_DELAY_MS: 100,
    DEBUG_MODE: true,
    LOG_LEVEL: "debug",
  },

  production: {
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://postgres:<password>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres",
    REDIS_URL: process.env.REDIS_URL || "https://redis.example.com",
    SUPABASE_URL:
      process.env.SUPABASE_URL || "https://yttyztkjbbpcqoozepmn.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    REDIS_ANTI_REPEAT_TTL_SECONDS: 432000,
    MAX_REQUESTS_PER_MINUTE: 5,
    OPENROUTER_REQUEST_DELAY_MS: 3000,
    DEBUG_MODE: false,
    LOG_LEVEL: "info",
  },
};

// Helper function to get configuration for current environment
export function getConfig() {
  const env = process.env.NODE_ENV || "production";
  return appConfig[env as keyof typeof appConfig] || appConfig.production;
}

// Environment variable type guard
export function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDev(): boolean {
  return process.env.NODE_ENV === "development";
}
