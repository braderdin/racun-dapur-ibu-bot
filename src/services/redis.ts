import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";

export class RedisService {
  private url: string;
  private token: string;

  constructor(env: Env) {
    this.url = env.UPSTASH_REDIS_REST_URL;
    this.token = env.UPSTASH_REDIS_REST_TOKEN;
  }

  /**
   * Semak samada Produk ID pernah dipost dalam masa 5 hari lepas.
   */
  async isProductPostedRecently(productId: string): Promise<boolean> {
    try {
      const key = `posted_product:${productId}`;
      const response = await fetch(`${this.url}/get/${key}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!response.ok) return false;
      const data: { result: string | null } = await response.json();
      return data.result !== null;
    } catch (error) {
      console.error("Error checking Redis key:", error);
      return false; // Jika error, teruskan supaya bot tak terhenti
    }
  }

  /**
   * Simpan Produk ID ke Redis dengan TTL 5 Hari (432,000s)
   */
  async markProductAsPosted(productId: string): Promise<void> {
    try {
      const key = `posted_product:${productId}`;
      const ttl = CONSTANTS.REDIS_ANTI_REPEAT_TTL_SECONDS;
      await fetch(`${this.url}/set/${key}/true/EX/${ttl}`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
    } catch (error) {
      console.error("Error setting Redis key:", error);
    }
  }
}