/*
 * Shopee API Integration Service Interface (Dual-Engine Ready)
 * Implements Shopee Open API client module with product fetcher, link generator, and fallback mocks
 * Ready for pending Shopee API approval
 */

import { ProductItem } from "../types/product";

export interface ShopeeProductResponse {
  items: ShopeeProduct[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  filters: {
    sortBy: string;
    sortOrder: string;
    category: string;
    minPrice: number;
    maxPrice: number;
  };
}

export interface ShopeeProduct {
  id: string;
  itemId: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  stock: number;
  thumbnailUrl: string;
  imageUrls: string[];
  category: string;
  brand: string;
  rating: number;
  reviewCount: number;
  location: string;
  freeShipping: boolean;
  warranty: string;
  actualPrice: number;
  commissionRate: number;
  shortLink: string;
  affiliateLink: string;
  cpaLink: string;
  campaignId: string;
  expirationDate: string;
}

export interface ShopeeApiConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface ShopeeProductRequest {
  keyword: string;
  category?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "pop" | "price_asc" | "price_desc" | "rating" | "newest";
  filter?: {
    minPrice?: number;
    maxPrice?: number;
    brand?: string[];
    rating?: number;
  };
}

export class ShopeeApiService {
  private config: ShopeeApiConfig;
  private baseUrl: string = "https://partner.api.shopee.com";
  private readonly USER_AGENT =
    "RacunDapurIbuBot/1.0 (Affiliate Marketing Bot)";
  private readonly REQUEST_TIMEOUT = 15000;

  constructor(config: Partial<ShopeeApiConfig> = {}) {
    this.config = {
      baseUrl: "https://partner.api.shopee.com",
      clientId: config.clientId || "",
      clientSecret: config.clientSecret || "",
      accessToken: config.accessToken || "",
      refreshToken: config.refreshToken || "",
      expiresAt: config.expiresAt || 0,
      ...config,
    };

    console.log("🔧 ShopeeApiService initialized");
  }

  async fetchTrendingProducts(
    request: ShopeeProductRequest,
  ): Promise<ShopeeProductResponse> {
    try {
      console.log("🔍 Fetching trending products from Shopee...");

      // Check if API keys are configured
      if (!this.config.clientId || !this.config.clientSecret) {
        console.log("⚠️  Shopee API keys not configured, returning mock data");
        return this.getMockProducts(request);
      }

      // Try to fetch from real API
      const response = await this.makeApiRequest<ShopeeProductResponse>(
        "/api/v1/product/search",
        {
          ...request,
          sortBy: request.sortBy || "pop",
          sortOrder: "desc",
        },
      );

      console.log(
        "✅ Successfully fetched",
        response.items.length,
        "products from Shopee",
      );
      return response;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.log("⚠️  Shopee API failed, returning mock data:", errMessage);
      return this.getMockProducts(request);
    }
  }

  async getProductById(productId: string): Promise<ShopeeProduct | null> {
    try {
      console.log("🔍 Fetching product details for ID:", productId);

      const product = await this.makeApiRequest<ShopeeProduct>(
        `/api/v1/product/${productId}`,
      );

      console.log("✅ Successfully fetched product details");
      return product;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.log(
        "⚠️  Failed to fetch product details, using fallback:",
        errMessage,
      );
      return this.getMockProductById(productId);
    }
  }

  async generateAffiliateLink(
    productId: string,
    campaignId?: string,
    subId?: string,
  ): Promise<string> {
    try {
      console.log("🔗 Generating affiliate link for product:", productId);

      const response = await this.makeApiRequest<{ affiliateLink: string }>(
        `/api/v1/affiliate/link`,
        {
          productId,
          campaignId,
          subId,
          channel: "website",
          version: "v1",
        },
      );

      console.log("✅ Affiliate link generated successfully");
      return response.affiliateLink;
    } catch (error) {
      console.log(
        "⚠️  Failed to generate affiliate link, using fallback:",
        error instanceof Error ? error.message : String(error),
      );
      return this.generateFallbackAffiliateLink(productId, campaignId, subId);
    }
  }

  async validateApiCredentials(): Promise<boolean> {
    try {
      const response = await this.makeApiRequest<{ valid: boolean }>(
        "/api/v1/auth/validate",
      );
      return response.valid;
    } catch (error) {
      console.log(
        "❌ API credentials validation failed:",
        error instanceof Error ? error.message : String(error),
      );
      return false;
    }
  }

  private async makeApiRequest<T>(
    endpoint: string,
    params: any = {},
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": this.USER_AGENT,
      Authorization: `Bearer ${this.config.accessToken}`,
      "X-API-Key": this.config.clientId,
      "X-Channel": "wemedia",
    };

    const body = JSON.stringify(params);

    // Simulate API call (replace with actual fetch in real implementation)
    console.log("🌐 Making API request to:", url);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // For now, return mock response
    // In real implementation, this would be:
    // const response = await fetch(url, { method: 'POST', headers, body });
    // return await response.json();

    throw new Error(
      "API integration pending - Shopee Open API approval needed",
    );
  }

  private getMockProducts(
    request: ShopeeProductRequest,
  ): ShopeeProductResponse {
    console.log("📋 Using mock Shopee data (API integration pending)");

    const mockProducts: ShopeeProduct[] = [
      {
        id: "shopeemock001",
        itemId: "ITEM123456789",
        name: `Trending Product ${request.keyword || "Electronics"} A`,
        description: "High-quality product from Shopee marketplace",
        price: 99.99,
        originalPrice: 149.99,
        stock: 100,
        thumbnailUrl: "https://example.com/shopee-product-1.jpg",
        imageUrls: [
          "https://example.com/shopee-product-1.jpg",
          "https://example.com/shopee-product-1-2.jpg",
          "https://example.com/shopee-product-1-3.jpg",
        ],
        category: "electronics",
        brand: "PopularBrand",
        rating: 4.5,
        reviewCount: 1250,
        location: "Malaysia",
        freeShipping: true,
        warranty: "12 months",
        actualPrice: 99.99,
        commissionRate: 0.1,
        shortLink: "https://shopee.co/1234567890",
        affiliateLink: "https://shopee.co/1234567890?sub_id=racun_dapur_ibu",
        cpaLink: "https://shopee.co/1234567890?cpa=1",
        campaignId: "CAMPAIGN_DU123",
        expirationDate: "2024-12-31",
      },
      {
        id: "shopeemock002",
        itemId: "ITEM987654321",
        name: `Best Deal ${request.keyword || "Home"} B`,
        description: "Amazing value proposition for Shopee shoppers",
        price: 49.99,
        originalPrice: 79.99,
        stock: 50,
        thumbnailUrl: "https://example.com/shopee-product-2.jpg",
        imageUrls: [
          "https://example.com/shopee-product-2.jpg",
          "https://example.com/shopee-product-2-2.jpg",
        ],
        category: "home",
        brand: "ValueBrand",
        rating: 4.2,
        reviewCount: 890,
        location: "Singapore",
        freeShipping: true,
        warranty: "24 hours",
        actualPrice: 49.99,
        commissionRate: 0.08,
        shortLink: "https://shopee.co/0987654321",
        affiliateLink: "https://shopee.co/0987654321?sub_id=racun_dapur_ibu",
        cpaLink: "https://shopee.co/0987654321?cpa=1",
        campaignId: "CAMPAIGN_HO123",
        expirationDate: "2024-11-30",
      },
      {
        id: "shopeemock003",
        itemId: "ITEM555555555",
        name: `Premium ${request.keyword || "Beauty"} C`,
        description: "Luxury item for discerning shoppers",
        price: 199.99,
        originalPrice: 299.99,
        stock: 25,
        thumbnailUrl: "https://example.com/shopee-product-3.jpg",
        imageUrls: [
          "https://example.com/shopee-product-3.jpg",
          "https://example.com/shopee-product-3-2.jpg",
          "https://example.com/shopee-product-3-3.jpg",
          "https://example.com/shopee-product-3-4.jpg",
        ],
        category: "beauty",
        brand: "PremiumBrand",
        rating: 4.8,
        reviewCount: 450,
        location: "Thailand",
        freeShipping: false,
        warranty: "6 months",
        actualPrice: 199.99,
        commissionRate: 0.12,
        shortLink: "https://shopee.co/5555555555",
        affiliateLink: "https://shopee.co/5555555555?sub_id=racun_dapur_ibu",
        cpaLink: "https://shopee.co/5555555555?cpa=1",
        campaignId: "CAMPAIGN_BE456",
        expirationDate: "2024-10-31",
      },
    ];

    // Filter mock products based on request
    let filteredProducts = mockProducts;

    if (request.keyword) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(request.keyword.toLowerCase()) ||
          product.description
            .toLowerCase()
            .includes(request.keyword.toLowerCase()),
      );
    }

    if (request.category) {
      filteredProducts = filteredProducts.filter(
        (product) => product.category === request.category,
      );
    }

    return {
      items: filteredProducts,
      pagination: {
        currentPage: request.page || 1,
        totalPages: Math.ceil(
          filteredProducts.length / (request.pageSize || 10),
        ),
        totalItems: filteredProducts.length,
        itemsPerPage: request.pageSize || 10,
      },
      filters: {
        sortBy: request.sortBy || "pop",
        sortOrder: "desc",
        category: request.category || "",
        minPrice: request.filter?.minPrice || 0,
        maxPrice: request.filter?.maxPrice || 9999,
      },
    };
  }

  private getMockProductById(productId: string): ShopeeProduct | null {
    const mockProducts = this.getMockProducts({ keyword: "" }).items;
    return mockProducts.find((p) => p.id === productId) || null;
  }

  private generateFallbackAffiliateLink(
    productId: string,
    campaignId?: string,
    subId?: string,
  ): string {
    const baseUrl = "https://shopeepartners.com/track";
    const params = new URLSearchParams();
    params.set("product_id", productId);
    if (campaignId) params.set("campaign_id", campaignId);
    if (subId) params.set("sub_id", subId);
    params.set("source", "racun_dapur_ibu_bot");

    return `${baseUrl}?${params.toString()}`;
  }

  isApiReady(): boolean {
    return !!(
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.accessToken
    );
  }

  getApiStatus(): string {
    if (!this.config.clientId || !this.config.clientSecret) {
      return "CONFIGURATION_REQUIRED"; // Need API keys
    }
    if (!this.config.accessToken) {
      return "AUTHENTICATION_REQUIRED"; // Need to authenticate
    }
    if (this.config.accessToken && Date.now() < this.config.expiresAt) {
      return "READY"; // Ready to use
    }
    return "TOKEN_EXPIRED"; // Token expired
  }
}

// Create a singleton instance
const shopeeApiService = new ShopeeApiService({
  clientId: "", // To be filled after Shopee API approval
  clientSecret: "", // To be filled after Shopee API approval
  accessToken: "", // To be obtained after authentication
  refreshToken: "",
});

export { shopeeApiService };
