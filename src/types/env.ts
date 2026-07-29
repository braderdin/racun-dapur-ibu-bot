export interface Env {
  // X (Twitter) API Keys
  X_API_KEY: string;
  X_BEARER_TOKEN: string;
  X_ACCESS_TOKEN?: string;
  X_ACCESS_TOKEN_SECRET?: string;

  // Lazada Open API
  LAZADA_APP_KEY: string;
  LAZADA_APP_SECRET: string;
  LAZADA_MEMBER_ID: string;
  LAZADA_USER_TOKEN: string;

  // OpenRouter AI
  OPENROUTER_API_KEY: string;
  OPENROUTER_BASE_URL: string;

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  // Upstash QStash
  QSTASH_TOKEN: string;
  QSTASH_URL: string;

  // Supabase
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_ANON_KEY: string;

  // Backblaze B2 Storage (3 Account Multi-Bucket)
  B2_ACC1_BUCKET_NAME: string;
  B2_ACC1_KEY_ID: string;
  B2_ACC1_APPLICATION_KEY: string;

  B2_ACC2_BUCKET_NAME: string;
  B2_ACC2_KEY_ID: string;
  B2_ACC2_APPLICATION_KEY: string;

  B2_ACC3_BUCKET_NAME: string;
  B2_ACC3_KEY_ID: string;
  B2_ACC3_APPLICATION_KEY: string;
}

export interface ProductItem {
  id: string;
  title: string;
  price: string;
  originalPrice?: string;
  discountRate?: string;
  imageUrl: string;
  affiliateUrl: string;
  rating?: string;
  soldCount?: string;
}

export interface GeneratedCopy {
  tweetHook: string; // Tweet 1: Masalah & Penyelesaian (TIADA LINK)
  tweetReply: string; // Tweet 2: Auto-reply + Link Affiliate
}
