import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

export class RedisService {
  private baseUrl: string;
  private token: string;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.baseUrl = env.UPSTASH_REDIS_REST_URL || "";
    this.token = env.UPSTASH_REDIS_REST_TOKEN || "";

    // Validasi konfigurasi
    if (!this.baseUrl || !this.token) {
      logger.warn(
        "Upstash Redis belum dikonfigurasi! Gunakan [UPSTASH_REDIS_REST_URL] dan [UPSTASH_REDIS_REST_TOKEN].",
        {},
        "RedisService",
      );
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: this.baseUrl && this.token ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }

  async getServiceStatus(): Promise<{
    name: string;
    status: string;
    timestamp: string;
  }> {
    const health = await this.healthCheck();
    return {
      name: "Upstash Redis",
      status: health.status,
      timestamp: health.timestamp,
    };
  }

  private async makeRequest<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(
          `Redis API error: ${response.status} ${response.statusText}`,
        );
      }

      return await response.json();
    } catch (error) {
      logger.error(
        "Redis API request failed",
        { error, url, path },
        "RedisService",
      );
      throw error;
    }
  }

  async addRepeatProduct(productId: string, ttl: number): Promise<void> {
    const key = `product:${productId}`;
    await this.makeRequest("PUT", `/keys/${key}`, { value: productId });
    await this.makeRequest("POST", `/ex/${key}/${ttl}`, {});
    logger.debug("Redis anti-repeat added", { productId, ttl }, "RedisService");
  }

  async isRepeatProduct(productId: string): Promise<boolean> {
    const key = `product:${productId}`;
    try {
      await this.makeRequest("GET", `/keys/${key}`);
      return true; // Produk sudah ada
    } catch (error) {
      // Key tidak ada, produk baru
      return false;
    }
  }

  async filterRepeatProducts(products: any[]): Promise<any[]> {
    const filtered: any[] = [];

    for (const product of products) {
      const key = `product:${product.id}`;
      try {
        await this.makeRequest("GET", `/keys/${key}`);
        logger.debug(
          "Redis anti-repeat matched",
          { productId: product.id },
          "RedisService",
        );
        continue; // Abai
      } catch (error) {
        // Tambahkan produk baru
        filtered.push(product);
      }
    }

    return filtered;
  }

  async removeRepeatProduct(productId: string): Promise<void> {
    const key = `product:${productId}`;
    await this.makeRequest("DELETE", `/keys/${key}`, {});
    logger.debug("Redis anti-repeat removed", { productId }, "RedisService");
  }
}
