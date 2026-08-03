/*
 * Cloudflare KV State Management Service
 * Manages global feature flags and emergency kill-switches with <5ms read latency
 * Supports real-time configuration changes without worker restarts
 */

import { Env } from "../types/env";
import { logger } from "../utils/logger";

// Cloudflare Workers KV namespace type
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: {
    prefix?: string;
    limit?: number;
  }): Promise<{ keys: Array<{ name: string }> }>;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureFlag {
  key: string;
  value: boolean | string | number;
  ttl?: number;
  description?: string;
  updated_at: string;
}

export interface KillSwitch {
  feature: string;
  enabled: boolean;
  reason?: string;
  updated_by?: string;
  updated_at: string;
}

export interface KVStateConfig {
  fbPostingEnabled: boolean;
  xPostingEnabled: boolean;
  aiGenerationEnabled: boolean;
  b2UploadEnabled: boolean;
  emergencyMode: boolean;
  maintenanceMode: boolean;
}

// Default configuration
export const DEFAULT_KV_STATE: KVStateConfig = {
  fbPostingEnabled: true,
  xPostingEnabled: true,
  aiGenerationEnabled: true,
  b2UploadEnabled: true,
  emergencyMode: false,
  maintenanceMode: false,
};

// ---------------------------------------------------------------------------
// Cloudflare KV State Service
// ---------------------------------------------------------------------------

export class CloudflareKVStateService {
  private kvNamespace: KVNamespace | null = null;
  private env: Env;
  private cache: KVStateConfig;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 1000; // 1 second cache

  constructor(env: Env) {
    this.env = env;
    this.kvNamespace = env.KV_STATE || null;
    this.cache = { ...DEFAULT_KV_STATE };
    this.cacheExpiry = 0;
  }

  // ---------------------------------------------------------------------------
  // Get current state (with caching for <5ms latency)
  // ---------------------------------------------------------------------------

  async getState(): Promise<KVStateConfig> {
    const now = Date.now();

    // Return cached state if still valid
    if (now < this.cacheExpiry) {
      return this.cache;
    }

    if (!this.kvNamespace) {
      logger.warn(
        "KV namespace not available, using defaults",
        {},
        "CloudflareKVState",
      );
      return DEFAULT_KV_STATE;
    }

    try {
      const cached = await this.kvNamespace.get("state:config");
      if (cached) {
        const state = JSON.parse(cached) as KVStateConfig;
        this.cache = state;
        this.cacheExpiry = now + this.CACHE_TTL_MS;
        return state;
      }
    } catch (error) {
      logger.error("Failed to read KV state", { error }, "CloudflareKVState");
    }

    // Cache miss - write defaults
    await this.setState(DEFAULT_KV_STATE);
    return DEFAULT_KV_STATE;
  }

  // ---------------------------------------------------------------------------
  // Set state
  // ---------------------------------------------------------------------------

  async setState(state: KVStateConfig): Promise<void> {
    this.cache = state;
    this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;

    if (!this.kvNamespace) {
      logger.warn(
        "KV namespace not available, state not persisted",
        {},
        "CloudflareKVState",
      );
      return;
    }

    try {
      await this.kvNamespace.put("state:config", JSON.stringify(state), {
        expirationTtl: 86400, // 24 hours
      });
      logger.info("KV state updated", { state }, "CloudflareKVState");
    } catch (error) {
      logger.error("Failed to write KV state", { error }, "CloudflareKVState");
    }
  }

  // ---------------------------------------------------------------------------
  // Feature flag operations
  // ---------------------------------------------------------------------------

  async getFeatureFlag(key: string): Promise<boolean | string | number | null> {
    const state = await this.getState();

    // Map feature flag keys to state properties
    const flagMap: Record<string, keyof KVStateConfig> = {
      "fb.posting.enabled": "fbPostingEnabled",
      "x.posting.enabled": "xPostingEnabled",
      "ai.generation.enabled": "aiGenerationEnabled",
      "b2.upload.enabled": "b2UploadEnabled",
      "emergency.mode": "emergencyMode",
      "maintenance.mode": "maintenanceMode",
    };

    const stateKey = flagMap[key];
    if (stateKey && stateKey in state) {
      return state[stateKey];
    }

    return null;
  }

  async setFeatureFlag(
    key: string,
    value: boolean | string | number,
  ): Promise<void> {
    const state = await this.getState();

    const flagMap: Record<string, keyof KVStateConfig> = {
      "fb.posting.enabled": "fbPostingEnabled",
      "x.posting.enabled": "xPostingEnabled",
      "ai.generation.enabled": "aiGenerationEnabled",
      "b2.upload.enabled": "b2UploadEnabled",
      "emergency.mode": "emergencyMode",
      "maintenance.mode": "maintenanceMode",
    };

    const stateKey = flagMap[key];
    if (stateKey) {
      (state as any)[stateKey] = value;
      await this.setState(state);
      logger.info("Feature flag updated", { key, value }, "CloudflareKVState");
    } else {
      logger.warn("Unknown feature flag key", { key }, "CloudflareKVState");
    }
  }

  // ---------------------------------------------------------------------------
  // Kill-switch operations
  // ---------------------------------------------------------------------------

  async isKillSwitchEnabled(feature: string): Promise<boolean> {
    const state = await this.getState();

    const killSwitchMap: Record<string, keyof KVStateConfig> = {
      fb_posting: "fbPostingEnabled",
      x_posting: "xPostingEnabled",
      ai_generation: "aiGenerationEnabled",
      b2_upload: "b2UploadEnabled",
      emergency: "emergencyMode",
      maintenance: "maintenanceMode",
    };

    const stateKey = killSwitchMap[feature];
    if (stateKey) {
      return !(state as any)[stateKey];
    }

    return false;
  }

  async enableKillSwitch(feature: string, reason?: string): Promise<void> {
    const state = await this.getState();

    const killSwitchMap: Record<string, keyof KVStateConfig> = {
      fb_posting: "fbPostingEnabled",
      x_posting: "xPostingEnabled",
      ai_generation: "aiGenerationEnabled",
      b2_upload: "b2UploadEnabled",
      emergency: "emergencyMode",
      maintenance: "maintenanceMode",
    };

    const stateKey = killSwitchMap[feature];
    if (stateKey) {
      (state as any)[stateKey] = false;
      await this.setState(state);
      logger.warn(
        "Kill switch enabled",
        { feature, reason },
        "CloudflareKVState",
      );
    }
  }

  async disableKillSwitch(feature: string): Promise<void> {
    const state = await this.getState();

    const killSwitchMap: Record<string, keyof KVStateConfig> = {
      fb_posting: "fbPostingEnabled",
      x_posting: "xPostingEnabled",
      ai_generation: "aiGenerationEnabled",
      b2_upload: "b2UploadEnabled",
      emergency: "emergencyMode",
      maintenance: "maintenanceMode",
    };

    const stateKey = killSwitchMap[feature];
    if (stateKey) {
      (state as any)[stateKey] = true;
      await this.setState(state);
      logger.info("Kill switch disabled", { feature }, "CloudflareKVState");
    }
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    latencyMs: number;
    timestamp: string;
  }> {
    const startTime = Date.now();

    try {
      await this.getState();
      const latency = Date.now() - startTime;

      return {
        status: latency < 100 ? "healthy" : "degraded",
        latencyMs: latency,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "unhealthy",
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let kvStateInstance: CloudflareKVStateService | null = null;

export function getKVStateService(env: Env): CloudflareKVStateService {
  if (!kvStateInstance) {
    kvStateInstance = new CloudflareKVStateService(env);
  }
  return kvStateInstance;
}
