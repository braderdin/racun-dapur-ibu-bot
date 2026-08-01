//! TypeScript type definitions for environment variables in the OpenRouter AI Proxy Worker.

/**
 * Cloudflare Worker Environment Variables
 *
 * Defines all environment variables required by the OpenRouter AI Proxy Worker.
 * Includes specialized settings for proxy rotation, AI model configuration,
 * and security mechanisms essential for production deployment.
 *
 * @remarks
 * This file intentionally excludes actual API key values for production security.
 * Sensitive credentials are stored in environment-specific configuration files
 * outside of the source code (e.g., .dev.vars, .env, or Cloudflare Workers dashboard).
 */

import { z } from "zod";

// Environment Variable Schemas for Configuration Validation
/**
 * Schema for validating OpenRouter environment variables used for worker proxy configuration.
 * Includes settings for key rotation, rate limiting, and security controls.
 */
export const proxyConfigSchema = z.object({
  // OpenRouter Key Rotation and Proxy Settings
  OPENROUTER_PROXY_ROTATION_COUNT: z.string().default("3"),
  OPENROUTER_PROXY_ROTATION_DELAY_MS: z.string().default("3000"),
  OPENROUTER_PROXY_DELAY_MS: z.string().default("0"),
  OPENROUTER_MODEL: z.string().default("openrouter/free"),
  OPENROUTER_BASE_URL: z.string().optional(),

  // Edge Loop Breaker and Circuit Breaker Configuration
  EDGE_LOOP_BREAKER_THRESHOLD: z.string().default("3"),
  EDGE_LOOP_BREAKER_TIMEOUT_MS: z.string().default("60000"),
  MAX_PROXY_REQUESTS_PER_MINUTE: z.string().default("5"),
  MAX_PROXY_REQUESTS_PER_HOUR: z.string().default("200"),
  MAX_PROXY_REQUESTS_PER_DAY: z.string().default("1000"),

  // Proxy Security and Validation Settings
  PROXY_VALIDATE_SSL: z.string().default("true"),
  PROXY_MAX_RETRIES: z.string().default("3"),
  PROXY_RETRY_DELAY_MS: z.string().default("1000"),

  // Monitoring and Logging Configuration
  PROXY_ENABLE_DETAILED_LOGS: z.string().default("false"),
  PROXY_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // Proxy Rotation Seed and Randomization
  PROXY_ROTATION_SEED: z.string().optional(),
  PROXY_RANDOMIZED_RETRY: z.string().default("true"),
});

/**
 * Schema for core URL and API endpoint configuration.
 * Defines critical network infrastructure endpoints for external integrations.
 */
export const coreEndpointsSchema = z.object({
  // OpenRouter API and Proxy Endpoints
  OPENROUTER_API_BASE_URL: z.string().optional(),
  OPENROUTER_V1_ENDPOINT: z.string().optional(),
  PROXY_BASE_URL: z.string().optional(),
  PROXY_V1_ENDPOINT: z.string().optional(),

  // External Service Integration Endpoints
  X_API_V2_BASE_URL: z.string().optional(),
  META_GRAPH_API_BASE_URL: z.string().optional(),
  LAZADA_API_BASE_URL: z.string().optional(),
  SHOPEE_API_BASE_URL: z.string().optional(),

  // Internal Service Endpoints
  REDIS_REST_URL: z.string().optional(),
  REDIS_REST_TOKEN: z.string().optional(),
  UPSTASH_VECTOR_REST_URL: z.string().optional(),
  UPSTASH_VECTOR_REST_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  QSTASH_URL: z.string().optional(),
  QSTASH_TOKEN: z.string().optional(),

  // Storage and Database Endpoints
  BACKBLAZE_STORAGE_BASE_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),

  // Web Portal and Frontend Endpoints
  VERCEL_URL: z.string().optional(),
  WEB_PORTAL_BASE_URL: z.string().optional(),
});

/**
 * Schema for authentication and security-related environment variables.
 * Stores secure credential references and authentication parameters.
 */
export const securityConfigSchema = z.object({
  // OpenRouter Security and Authentication
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_PROXY_CREDENTIALS: z.string().optional(),

  // Supabase Authentication
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  // Cross-Service Authentication
  X_ACCESS_TOKEN: z.string().optional(),
  X_BEARER_TOKEN: z.string().optional(),
  X_CONSUMER_KEY: z.string().optional(),
  X_CLIENT_SECRET: z.string().optional(),
  X_CLIENT_ID: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  X_CONSUMER_KEY_SECRET: z.string().optional(),

  // Upstash Authentication
  UPSTASH_VECTOR_REST_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  UPSTASH_QSTASH_TOKEN: z.string().optional(),

  // Backblaze Storage Authentication
  BACKBLAZE_ACC1_APPLICATION_KEY: z.string().optional(),
  BACKBLAZE_ACC2_APPLICATION_KEY: z.string().optional(),
  BACKBLAZE_ACC3_APPLICATION_KEY: z.string().optional(),
  B2_ACC1_KEY_NAME: z.string().optional(),
  B2_ACC1_APPLICATION_KEY: z.string().optional(),
  B2_ACC2_KEY_NAME: z.string().optional(),
  B2_ACC2_APPLICATION_KEY: z.string().optional(),

  // QStash Authentication and Signing
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  QSTASH_SIGNING_KEY: z.string().optional(),

  // Additional Security Keys for Integration Services
  YDB_API_KEY: z.string().optional(),
  LAZADA_API_SECRET: z.string().optional(),
  SHOPEE_API_SECRET: z.string().optional(),

  // Lazada API Credentials
  LAZADA_APP_KEY: z.string().optional(),
  LAZADA_APP_SECRET: z.string().optional(),

  // Shopee API Credentials
  SHOPEE_API_KEY: z.string().optional(),
  SHOPEE_SHOP_ID: z.string().optional(),

  // Facebook API Credentials
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().optional(),
  FACEBOOK_APP_SECRET: z.string().optional(),
  FACEBOOK_APP_ID: z.string().optional(),
  FACEBOOK_PAGE_ID: z.string().optional(),
  FB_PAGE_ACCESS_TOKEN: z.string().optional(),
  FB_COMMENT_DELAY_MS: z.string().optional(),
  FB_COMMENT_MAX_RETRIES: z.string().optional(),

  // Twitter/X API Credentials
  TWITTER_API_KEY: z.string().optional(),
  TWITTER_API_SECRET: z.string().optional(),
  TWITTER_ACCESS_TOKEN: z.string().optional(),
  TWITTER_ACCESS_SECRET: z.string().optional(),

  // Cloaking & Link Masking
  CLOAK_DOMAIN: z.string().optional(),
  CLOAK_UTM_SOURCE: z.string().optional(),
  CLOAK_UTM_CAMPAIGN: z.string().optional(),
  CLOAK_EXPIRY_DAYS: z.string().optional(),

  // Trend Analysis
  TREND_HISTORY_DAYS: z.string().optional(),
  TREND_FLASH_SALE_THRESHOLD: z.string().optional(),
  TREND_ATL_CONFIDENCE: z.string().optional(),

  // Realtime Notifier
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  REALTIME_CHANNEL: z.string().optional(),
  REALTIME_FLUSH_MS: z.string().optional(),
  REALTIME_MAX_QUEUE: z.string().optional(),

  // Twitter/X Configuration
  TWITTER_TWEET1_MAX: z.string().optional(),
  TWITTER_TWEET2_MAX: z.string().optional(),
  TWITTER_DELAY_BETWEEN: z.string().optional(),
  TWITTER_AUTO_REPLY_DELAY: z.string().optional(),

  // Proxy Rotation Seed
  PROXY_ROTATION_SEED: z.string().optional(),

  // AI Persona Configuration
  PERSONA_LANGUAGE: z.string().optional(),
  PERSONA_MAX_BODY_LINES: z.string().optional(),
  PERSONA_MAX_HASHTAGS: z.string().optional(),
  PERSONA_FALLBACK: z.string().optional(),

  // Deal Curation Configuration
  DEAL_MIN_DISCOUNT_PERCENT: z.string().optional(),
  DEAL_MAX_PRICE: z.string().optional(),
  DEAL_MIN_RATING: z.string().optional(),
  DEAL_IN_STOCK_ONLY: z.string().optional(),
  DEAL_PLATFORMS: z.string().optional(),
  DEAL_MAX_PER_RUN: z.string().optional(),

  // Recommendations Configuration
  RECOMMENDATIONS_TOP_K: z.string().optional(),
  RECOMMENDATIONS_SIMILARITY: z.string().optional(),
  RECOMMENDATIONS_CACHE_TTL: z.string().optional(),
  RECOMMENDATIONS_CATEGORY_BOOST: z.string().optional(),

  // Upstash Vector Circuit Breaker
  UPSTASH_VECTOR_CIRCUIT_BREAKER_THRESHOLD: z.string().optional(),
  UPSTASH_VECTOR_CIRCUIT_BREAKER_TIMEOUT: z.string().optional(),
});

/**
 * Schema for routing and load balancing configuration.
 * Manages service routing, traffic distribution, and endpoint selection strategies.
 */
export const routingConfigSchema = z.object({
  // Service Discovery and Routing
  ENABLE_SERVICE_DISCOVERY: z.string().default("true"),
  SERVICE_REGISTRY_URL: z.string().optional(),
  ENABLE_CIRCUIT_BREAKER: z.string().default("true"),
  CIRCUIT_BREAKER_THRESHOLD: z.string().default("3"),
  CIRCUIT_BREAKER_TIMEOUT_MS: z.string().default("300000"),

  // Load Balancing and Failover
  LOAD_BALANCE_STRATEGY: z
    .enum(["round-robin", "weighted", "least-connections"])
    .default("round-robin"),
  ENABLE_AUTO_FAILOVER: z.string().default("true"),
  HEALTH_CHECK_INTERVAL_MS: z.string().default("30000"),
  UNHEALTHY_THRESHOLD: z.string().default("3"),

  // Routing and Distribution Configuration
  TRAFFIC_DISTRIBUTION_STRATEGY: z
    .enum(["geo", "latency", "capacity"])
    .default("latency"),
  ENABLE_REGION_HA: z.string().default("true"),
  PRIMARY_REGION: z.string().optional(),
  SECONDARY_REGION: z.string().optional(),
});

/**
 * Schema for content delivery and caching configuration.
 * Manages Edge CDN, caching strategies, and content delivery optimization.
 */
export const cacheConfigSchema = z.object({
  // Edge CDN Configuration
  ENABLE_EDGE_CDN: z.string().default("true"),
  EDGE_CDN_URL: z.string().optional(),
  CACHE_TTL_SECONDS: z.string().default("3600"),
  STALE_WHILE_REVALIDATE_SECONDS: z.string().default("300"),
  STALE_IF_ERROR_SECONDS: z.string().default("86400"),

  // Content Optimization and Delivery
  ENABLE_COMPRESSION: z.string().default("true"),
  ENABLE_HTTP2: z.string().default("true"),
  MAX_RESPONSE_SIZE_KB: z.string().default("1024"),

  // CDN Configuration
  CDN_FORWARDING_RULES: z.string().optional(),
  CDN_WRANGLE_CONFIG: z.string().optional(),
});

/**
 * Schema for global Rate Limiting, Anti-Spam and Security Protection.
 * Defines comprehensive protection mechanisms against abuse and misuse.
 */
export const protectionConfigSchema = z.object({
  // Universal Rate Limiting
  ENABLE_RATE_LIMITING: z.string().default("true"),
  RATE_LIMIT_DEFAULT_TIER: z
    .enum(["default", "premium", "enterprise"])
    .default("default"),
  RATE_LIMIT_COUNTRY_BLOCK: z.string().optional(),

  // Bot Protection and Anti-Spam
  ENABLE_BOT_PROTECTION: z.string().default("true"),
  BOT_DETECTION_THRESHOLD: z.string().default("100"),
  BOT_FINGERPRINTING_ENABLED: z.string().default("true"),
  ENABLE_CAPTCHA_FOR_FAILED_ATTEMPTS: z.string().default("false"),

  // Session and Traffic Security
  SESSION_TIMEOUT_MINUTES: z.string().default("120"),
  MAX_CONCURRENT_SESSIONS_PER_IP: z.string().default("5"),
  ENABLE_SESSION_IP_BINDING: z.string().default("true"),

  // API Abuse Protection
  API_CALL_RATE_LIMIT_PER_MINUTE: z.string().default("300"),
  API_CALL_RATE_LIMIT_PER_HOUR: z.string().default("10000"),
  ENABLE_API_KEY_REQUIREMENT: z.string().default("false"),
  API_KEY_REQUIRED_FOR_ENDPOINTS: z.string().optional(),
});

/**
 * Schema for monitoring, observability and system health tracking.
 * Manages comprehensive system monitoring, metrics collection, and alerting.
 */
export const observabilityConfigSchema = z.object({
  // Metrics and Monitoring
  ENABLE_METRICS_COLLECTION: z.string().default("true"),
  METRICS_EXPORT_ENDPOINT: z.string().optional(),
  METRICS_EXPORT_INTERVAL_MS: z.string().default("60000"),
  ENABLE_TRACE_COLLECTION: z.string().default("true"),
  TRACE_ENDPOINT: z.string().optional(),

  // Logging and Error Tracking
  ENABLE_STRUCTURED_LOGGING: z.string().default("true"),
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "error", "fatal"])
    .default("info"),
  LOG_FORMAT: z.enum(["json", "string"]).default("json"),
  LOG_OUTPUT: z.enum(["console", "file", "http"]).default("console"),

  // System Health and Status Monitoring
  ENABLE_HEALTH_CHECKS: z.string().default("true"),
  HEALTH_CHECK_ENDPOINT: z.string().optional(),
  HEALTH_CHECK_INTERVAL_MS: z.string().default("30000"),
  ENABLE_AUTO_RECOVERY: z.string().default("true"),
});

/**
 * Schema for the main Worker environment configuration.
 * Combines all individual configuration schemas into a unified type.
 */
export const envSchema = z.object({
  ...proxyConfigSchema.shape,
  ...coreEndpointsSchema.shape,
  ...securityConfigSchema.shape,
  ...routingConfigSchema.shape,
  ...cacheConfigSchema.shape,
  ...protectionConfigSchema.shape,
  ...observabilityConfigSchema.shape,
});

/**
 * Type representing the merged configuration from all schema objects.
 * Provides TypeScript type safety for all environment variables.
 */
export type EnvConfig = z.infer<typeof envSchema>;

export type Env = EnvConfig;

/**
 * Validates environment configuration against all schemas.
 * Ensures all required configuration is present and properly formatted.
 *
 * @param env - Environment variables to validate
 * @returns Validated configuration object
 * @throws Error if validation fails
 */
export function validateEnvConfig(
  env: Record<string, string | undefined>,
): EnvConfig {
  try {
    return envSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((err) => `\${err.path.join('.')}: \${err.message}`)
        .join("\n  ");
      throw new Error(
        `Environment configuration validation failed:\n  \${errorMessages}`,
      );
    }
    throw error;
  }
}

/**
 * Extracts configuration subset for specific services or modules.
 * Enables modular configuration selection based on runtime requirements.
 *
 * @param env - Full environment configuration
 * @param service - Target service name (e.g., 'OpenRouter', 'Supabase')
 * @returns Service-specific configuration subset
 */
export function extractServiceConfig(
  env: EnvConfig,
  service: string,
): Partial<EnvConfig> {
  switch (service.toLowerCase()) {
    case "openrouter":
      return {
        OPENROUTER_BASE_URL: env.OPENROUTER_BASE_URL,
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        OPENROUTER_MODEL: env.OPENROUTER_MODEL,
        OPENROUTER_PROXY_ROTATION_COUNT: env.OPENROUTER_PROXY_ROTATION_COUNT,
        OPENROUTER_PROXY_ROTATION_DELAY_MS:
          env.OPENROUTER_PROXY_ROTATION_DELAY_MS,
        OPENROUTER_PROXY_DELAY_MS: env.OPENROUTER_PROXY_DELAY_MS,
      };

    case "supabase":
      return {
        SUPABASE_URL: env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
        SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY,
      };

    case "upstash":
      return {
        UPSTASH_REDIS_REST_URL: env.UPSTASH_REDIS_REST_URL,
        UPSTASH_REDIS_REST_TOKEN: env.UPSTASH_REDIS_REST_TOKEN,
        UPSTASH_VECTOR_REST_URL: env.UPSTASH_VECTOR_REST_URL,
        UPSTASH_VECTOR_REST_TOKEN: env.UPSTASH_VECTOR_REST_TOKEN,
        QSTASH_URL: env.QSTASH_URL,
        QSTASH_TOKEN: env.QSTASH_TOKEN,
      };

    case "backblaze":
      return {
        BACKBLAZE_STORAGE_BASE_URL: env.BACKBLAZE_STORAGE_BASE_URL,
        BACKBLAZE_ACC1_APPLICATION_KEY: env.BACKBLAZE_ACC1_APPLICATION_KEY,
        BACKBLAZE_ACC2_APPLICATION_KEY: env.BACKBLAZE_ACC2_APPLICATION_KEY,
        BACKBLAZE_ACC3_APPLICATION_KEY: env.BACKBLAZE_ACC3_APPLICATION_KEY,
      };

    default:
      return {} as Partial<EnvConfig>;
  }
}

export default {
  envSchema,
  validateEnvConfig,
  extractServiceConfig,
};
