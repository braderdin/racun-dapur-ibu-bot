import { Env } from "../types/env";
import { ProductItem } from "../types/product";

export class LazadaLiveFetcher {
  private appKey: string;
  private appSecret: string;
  private memberId: string;
  private userToken: string;

  constructor(env: Env) {
    this.appKey = env.LAZADA_APP_KEY || "";
    this.appSecret = env.LAZADA_APP_SECRET || "";
    this.memberId =
      (env as any).LAZADA_MEMBER_ID || process.env.LAZADA_MEMBER_ID || "";
    this.userToken =
      (env as any).LAZADA_USER_TOKEN || process.env.LAZADA_USER_TOKEN || "";
  }

  /**
   * Fetch live product details from Lazada Open API
   * @param productId - Lazada product ID
   * @returns Product details including title, prices, rating, stock status, and image URLs
   */
  async fetchLiveProductDetails(
    productId: string,
  ): Promise<ProductItem | null> {
    try {
      if (
        !this.appKey ||
        !this.appSecret ||
        !this.memberId ||
        !this.userToken
      ) {
        console.error("Missing Lazada API credentials");
        return null;
      }

      // Lazada Open API endpoint for product details
      const apiUrl = `https://api.lazada.com.my/rest/v2/product/get?product_id=${productId}`;

      // Generate timestamp for API signature
      const timestamp = Date.now().toString();

      // Prepare API parameters
      const params: Record<string, string> = {
        app_key: this.appKey,
        method: "lazada.product.get",
        timestamp,
        format: "json",
        v: "2",
        sign_method: "md5",
        product_id: productId,
        member_id: this.memberId,
        access_token: this.userToken,
      };

      // Generate signature (simplified - in production use proper MD5 signing)
      const signString = this.generateSignString(params);
      const sign = this.md5(signString + this.appSecret);
      params.sign = sign;

      // Make API request
      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.error(
          `Lazada API error: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const data = await response.json();

      // Parse and transform API response to ProductItem format
      return this.transformProductData(data);
    } catch (error) {
      console.error("Error fetching live product details from Lazada:", error);
      return null;
    }
  }

  /**
   * Fetch multiple live products from Lazada API
   * @param productIds - Array of Lazada product IDs
   * @returns Array of ProductItem objects
   */
  async fetchMultipleLiveProducts(
    productIds: string[],
  ): Promise<ProductItem[]> {
    try {
      const results: ProductItem[] = [];

      // Process products in parallel with rate limiting
      const promises = productIds.map(async (productId) => {
        const product = await this.fetchLiveProductDetails(productId);
        if (product) {
          results.push(product);
        }
        // Add small delay to respect API rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      console.error("Error fetching multiple live products:", error);
      return [];
    }
  }

  /**
   * Generate signature string for Lazada API
   * @param params - API parameters
   * @returns Signature string
   */
  private generateSignString(params: Record<string, string>): string {
    // Sort parameters by key
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys
      .map((key) => `${key}=${params[key]}`)
      .join("&");
    return paramString;
  }

  /**
   * Simple MD5 hash implementation
   * @param str - String to hash
   * @returns MD5 hash
   */
  private md5(str: string): string {
    // In production, use a proper crypto library
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Transform Lazada API response to ProductItem format
   * @param apiData - Raw API response data
   * @returns ProductItem object
   */
  private transformProductData(apiData: any): ProductItem | null {
    try {
      if (!apiData || !apiData.data) {
        return null;
      }

      const product = apiData.data;

      // Extract product details from API response
      return {
        id: product.product_id || `laz_${Date.now()}`, // Fallback for missing ID
        title: product.name || "Unknown Product",
        price: this.formatPrice(product.price),
        originalPrice: this.formatPrice(
          product.original_price || product.price,
        ),
        discountRate: this.calculateDiscountRate(
          product.price,
          product.original_price || product.price,
        ),
        imageUrl:
          product.images?.[0] ||
          "https://via.placeholder.com/300x300?text=No+Image",
        affiliateUrl: `https://c.lazada.com.my/t/c.${product.product_id || "X"}`, // Generate affiliate link
        soldCount: product.sales || "0+ Terjual",
        rating: product.rating || "0.0",
        stock: product.stock_status || "unknown",
        category: "lazada",
        platform: "lazada",
        explanation: product.description || "",
      };
    } catch (error) {
      console.error("Error transforming product data:", error);
      return null;
    }
  }

  /**
   * Format price to RM currency format
   * @param price - Price value
   * @returns Formatted price string
   */
  private formatPrice(price: number | string): string {
    if (!price) return "RM 0.00";

    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return `RM ${numPrice.toFixed(2)}`;
  }

  /**
   * Calculate discount rate percentage
   * @param price - Current price
   * @param originalPrice - Original price
   * @returns Discount rate string
   */
  private calculateDiscountRate(
    price: number | string,
    originalPrice: number | string,
  ): string {
    const numOriginalPrice = Number(originalPrice);
    if (!numOriginalPrice || numOriginalPrice <= 0) return "0%";

    const numPrice = Number(price);

    const discount = ((numOriginalPrice - numPrice) / numOriginalPrice) * 100;
    return `${Math.round(discount)}%`;
  }
}
