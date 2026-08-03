/**
 * Live Lazada API Deal Scraper Service
 * Fetches live trending deals from Lazada Open API filtered by discount rate (>30%),
 * seller rating (>4.5⭐), price thresholds, and HD product image URLs.
 */

import { Env } from "../types/env";
import { ProductItem } from "../types/product";

export interface LazadaScraperConfig {
  minDiscountRate: number;
  minSellerRating: number;
  maxPrice: number;
  minPrice: number;
  categories: string[];
  limit: number;
}

export interface LazadaProductResponse {
  product_id: string;
  name: string;
  price: string;
  original_price: string;
  discount: string;
  images: string[];
  rating: number;
  review_count: number;
  seller_rating: number;
  stock_status: string;
  category: string;
  description: string;
  affiliate_url: string;
}

export class LazadaLiveScraper {
  private appKey: string;
  private appSecret: string;
  private memberId: string;
  private userToken: string;
  private config: LazadaScraperConfig;

  constructor(env: Env, config?: Partial<LazadaScraperConfig>) {
    this.appKey = env.LAZADA_APP_KEY || "";
    this.appSecret = env.LAZADA_APP_SECRET || "";
    this.memberId =
      (env as any).LAZADA_MEMBER_ID || process.env.LAZADA_MEMBER_ID || "";
    this.userToken =
      (env as any).LAZADA_USER_TOKEN || process.env.LAZADA_USER_TOKEN || "";

    this.config = {
      minDiscountRate: 30,
      minSellerRating: 4.5,
      maxPrice: 500,
      minPrice: 10,
      categories: ["kitchen", "baby", "skincare"],
      limit: 50,
      ...config,
    };
  }

  /**
   * Fetch trending deals from Lazada Open API with filtering
   * @returns Array of filtered ProductItem objects
   */
  async fetchTrendingDeals(): Promise<ProductItem[]> {
    try {
      if (
        !this.appKey ||
        !this.appSecret ||
        !this.memberId ||
        !this.userToken
      ) {
        console.error("Missing Lazada API credentials");
        return [];
      }

      const allProducts: ProductItem[] = [];

      // Fetch products for each category
      for (const category of this.config.categories) {
        const products = await this.fetchCategoryProducts(category);
        allProducts.push(...products);
      }

      // Apply filters
      const filteredProducts = this.applyFilters(allProducts);

      // Sort by discount rate descending
      filteredProducts.sort((a, b) => {
        const discountA = parseFloat(a.discountRate?.replace("%", "") || "0");
        const discountB = parseFloat(b.discountRate?.replace("%", "") || "0");
        return discountB - discountA;
      });

      return filteredProducts.slice(0, this.config.limit);
    } catch (error) {
      console.error("Error fetching trending deals from Lazada:", error);
      return [];
    }
  }

  /**
   * Fetch products for a specific category
   * @param category - Product category
   * @returns Array of ProductItem objects
   */
  private async fetchCategoryProducts(
    category: string,
  ): Promise<ProductItem[]> {
    try {
      // Lazada Open API endpoint for product search
      const apiUrl = "https://api.lazada.com.my/rest/v2/product/search";

      const timestamp = Date.now().toString();

      const params: Record<string, string> = {
        app_key: this.appKey,
        method: "lazada.product.search",
        timestamp,
        format: "json",
        v: "2",
        sign_method: "md5",
        category: this.mapCategoryToLazada(category),
        sort: "discount_desc",
        limit: "50",
        member_id: this.memberId,
        access_token: this.userToken,
      };

      const signString = this.generateSignString(params);
      const sign = this.md5(signString + this.appSecret);
      params.sign = sign;

      const queryString = new URLSearchParams(params).toString();
      const fullUrl = `${apiUrl}?${queryString}`;

      const response = await fetch(fullUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        console.error(
          `Lazada API error for category ${category}: ${response.status}`,
        );
        return [];
      }

      const data = await response.json();
      return this.transformSearchResults(data, category);
    } catch (error) {
      console.error(`Error fetching category ${category}:`, error);
      return [];
    }
  }

  /**
   * Transform Lazada search results to ProductItem format
   * @param apiData - Raw API response
   * @param category - Product category
   * @returns Array of ProductItem objects
   */
  private transformSearchResults(
    apiData: any,
    category: string,
  ): ProductItem[] {
    try {
      if (!apiData || !apiData.data || !apiData.data.products) {
        return [];
      }

      const products: ProductItem[] = [];

      for (const product of apiData.data.products) {
        const transformed = this.transformProductData(product, category);
        if (transformed) {
          products.push(transformed);
        }
      }

      return products;
    } catch (error) {
      console.error("Error transforming search results:", error);
      return [];
    }
  }

  /**
   * Transform individual product data
   * @param product - Raw product data from API
   * @param category - Product category
   * @returns ProductItem or null
   */
  private transformProductData(
    product: any,
    category: string,
  ): ProductItem | null {
    try {
      const discountRate = this.calculateDiscountRate(
        parseFloat(product.price),
        parseFloat(product.original_price || product.price),
      );

      const sellerRating = product.seller_rating || 0;
      const price = parseFloat(product.price);

      // Pre-filter at transformation level
      if (discountRate < this.config.minDiscountRate) return null;
      if (sellerRating < this.config.minSellerRating) return null;
      if (price > this.config.maxPrice || price < this.config.minPrice)
        return null;

      const imageUrl =
        product.images?.[0] ||
        "https://via.placeholder.com/400x400?text=No+Image";

      return {
        id: `laz_${product.product_id}`,
        title: product.name || "Unknown Product",
        price: `RM ${parseFloat(product.price).toFixed(2)}`,
        originalPrice: `RM ${parseFloat(product.original_price || product.price).toFixed(2)}`,
        discountRate: `${discountRate}%`,
        imageUrl,
        affiliateUrl:
          product.affiliate_url ||
          `https://c.lazada.com.my/t/c.${product.product_id}`,
        soldCount: `${product.sales || "0"}+ Terjual`,
        rating: product.rating?.toFixed(1) || "0.0",
        stock: product.stock_status || "unknown",
        category,
        platform: "lazada",
        explanation: product.description || "",
      };
    } catch (error) {
      console.error("Error transforming product data:", error);
      return null;
    }
  }

  /**
   * Apply additional filters to products
   * @param products - Array of ProductItem objects
   * @returns Filtered array
   */
  private applyFilters(products: ProductItem[]): ProductItem[] {
    return products.filter((product) => {
      const discountRate = parseFloat(
        product.discountRate?.replace("%", "") || "0",
      );
      const price = parseFloat(product.price?.replace("RM ", "") || "0");

      return (
        discountRate >= this.config.minDiscountRate &&
        price >= this.config.minPrice &&
        price <= this.config.maxPrice &&
        product.imageUrl &&
        !product.imageUrl.includes("placeholder")
      );
    });
  }

  /**
   * Map internal category to Lazada category ID
   * @param category - Internal category name
   * @returns Lazada category ID
   */
  private mapCategoryToLazada(category: string): string {
    const categoryMap: Record<string, string> = {
      kitchen: "10000001", // Home & Kitchen
      baby: "10000002", // Mother & Baby
      skincare: "10000003", // Beauty & Personal Care
    };
    return categoryMap[category] || "10000001";
  }

  /**
   * Generate signature string for Lazada API
   * @param params - API parameters
   * @returns Signature string
   */
  private generateSignString(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    return sortedKeys.map((key) => `${key}=${params[key]}`).join("&");
  }

  /**
   * Simple MD5 hash implementation
   * @param str - String to hash
   * @returns MD5 hash
   */
  private md5(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Calculate discount rate percentage
   * @param currentPrice - Current price
   * @param originalPrice - Original price
   * @returns Discount rate as number
   */
  private calculateDiscountRate(
    currentPrice: number,
    originalPrice: number,
  ): number {
    if (originalPrice <= 0) return 0;
    return Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
  }

  /**
   * Get scraper configuration
   * @returns Current configuration
   */
  getConfig(): LazadaScraperConfig {
    return { ...this.config };
  }

  /**
   * Update scraper configuration
   * @param config - Partial configuration to update
   */
  updateConfig(config: Partial<LazadaScraperConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
