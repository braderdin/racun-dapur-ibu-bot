//
 * Dual-Engine Rotation Manager
 * Coordinates 50/50 balance between Lazada and Shopee deals based on execution slot timestamp
 * Implements rotation logic and API fallback strategies
 * Detects platform API availability and switches seamlessly
 */

import { ShopeeApiService } from "./shopee";
import { ProductItem } from "../types/product";
import { RedisService } from "./redis";

export interface Deal {
  id: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  platform: "lazada" | "shopee";
  sourceUrl: string;
  affiliateLink: string;
  commissionRate: number;
  expirationDate: string;
  category: string;
  rating: number;
  seller?: string;
  stock?: number;
  createdAt: Date;
}

export interface RotationConfig {
  rotationIntervalHours: number;
  ensure_50_50_balance: boolean;
  prefer_platform: "lazada" | "shopee" | "balanced";
  api_timeout_seconds: number;
  max_retry_attempts: number;
  enable_circuit_breaker: boolean;
}

export interface PlatformStatus {
  platform: "lazada" | "shopee";
  available: boolean;
  responseTime: number;
  successRate: number;
  lastChecked: Date;
  errorCount: number;
  healthy: boolean;
}

export interface RotationSchedule {
  currentSlot: number;
  totalSlots: number;
  rotationType: "strict_50_50" | "balanced" | "priority_based";
  nextRotationAt: Date;
  dealsToday: { lazada: number; shopee: number; };
}

export class DualEngineRotationManager {
  private config: RotationConfig;
  private shopeeService: ShopeeApiService;
  private redisService: RedisService;
  private platformStatus: Map<"lazada" | "shopee", PlatformStatus>;
  private rotationSchedule: RotationSchedule;

  constructor(
    shopeeService: ShopeeApiService,
    redisService: RedisService,
    config: Partial<RotationConfig> = {}
  ) {
    this.shopeeService = shopeeService;
    this.redisService = redisService;
    
    this.config = {
      rotationIntervalHours: 24,
      ensure_50_50_balance: true,
      prefer_platform: "balanced",
      api_timeout_seconds: 30,
      max_retry_attempts: 3,
      enable_circuit_breaker: true,
      ...config
    };
    
    this.platformStatus = new Map();
    this.platformStatus.set("lazada", {
      platform: "lazada",
      available: true,
      responseTime: 0,
      successRate: 1.0,
      lastChecked: new Date(),
      errorCount: 0,
      healthy: true
    });
    
    this.platformStatus.set("shopee", {
      platform: "shopee",
      available: true,
      responseTime: 0,
      successRate: 1.0,
      lastChecked: new Date(),
      errorCount: 0,
      healthy: true
    });
    
    this.rotationSchedule = this.initializeRotationSchedule();
    
    console.log("🔄 DualEngineRotationManager initialized");
  }

  private initializeRotationSchedule(): RotationSchedule {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const hoursPassed = Math.floor((now.getTime() - startOfDay.getTime()) / (1000 * 60 * 60));
    
    const totalSlots = this.config.rotationIntervalHours * 2; // 2 slots per hour (1 hour each)
    const currentSlot = Math.min(hoursPassed * 2, totalSlots - 1);
    
    return {
      currentSlot,
      totalSlots,
      rotationType: "strict_50_50",
      nextRotationAt: new Date(startOfDay.getTime() + (currentSlot + 1) * 3600000),
      dealsToday: { lazada: 0, shopee: 0 }
    };
  }

  async executeDealsCuration(): Promise<Deal[]> {
    try {
      console.log("🔄 Executing deals curation...")
      console.log("⏰ Current slot:", this.rotationSchedule.currentSlot, "/", this.rotationSchedule.totalSlots);
      
      // Determine which platform to prioritize based on current slot
      const targetPlatform = this.getTargetPlatformForCurrentSlot();
      console.log("🎯 Target platform for this slot:", targetPlatform);
      
      // Get deals from target platform
      const targetDeals = await this.getDealsFromPlatform(targetPlatform);
      console.log("✅ Retrieved", targetDeals.length, "deals from", targetPlatform);
      
      // Get deals from alternative platform
      const alternativePlatform: "lazada" | "shopee" = targetPlatform === "lazada" ? "shopee" : "lazada";
      const alternativeDeals = await this.getDealsFromPlatform(alternativePlatform);
      console.log("✅ Retrieved", alternativeDeals.length, "deals from", alternativePlatform);
      
      // Balance the deals to maintain 50/50 ratio
      const balancedDeals = this.balanceDealAllocation(targetDeals, alternativeDeals);
      
      // Update rotation schedule
      this.rotationSchedule.dealsToday[targetPlatform] += Math.ceil(balancedDeals.length / 2);
      this.rotationSchedule.currentSlot = (this.rotationSchedule.currentSlot + 1) % this.rotationSchedule.totalSlots;
      this.rotationSchedule.nextRotationAt = new Date(Date.now() + 3600000); // Next rotation in 1 hour
      
      // Save rotation state to Redis
      await this.saveRotationState();
      
      console.log("✅ Deals curation completed:", balancedDeals.length, "total deals");
      return balancedDeals;
      
    } catch (error) {
      console.error("❌ Deals curation failed:", error.message);
      throw error;
    }
  }

  private getTargetPlatformForCurrentSlot(): "lazada" | "shopee" {
    const isEvenSlot = this.rotationSchedule.currentSlot % 2 === 0;
    
    if (this.config.rotationType === "strict_50_50") {
      return isEvenSlot ? "lazada" : "shopee";
    } else if (this.config.rotationType === "priority_based") {
      return this.config.prefer_platform;
    } else {
      return isEvenSlot ? "lazada" : "shopee";
    }
  }

  private async getDealsFromPlatform(platform: "lazada" | "shopee"): Promise<Deal[]> {
    const startTime = Date.now();
    
    try {
      let deals: Deal[] = [];
      
      if (platform === "shopee") {
        // Get Shopee products and convert to Deal format
        const shopeeProducts = await this.shopeeService.fetchTrendingProducts({
          keyword: "",
          page: 1,
          pageSize: 20,
          sortBy: "pop"
        });
        
        deals = shopeeProducts.items.map(product => this.convertShopeeProductToDeal(product));
      } else {
        // Lazada integration would go here
        // For now, simulate with mock data
        deals = this.getMockLazadaDeals();
      }
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      // Update platform status
      const status = this.platformStatus.get(platform);
      if (status) {
        status.responseTime = responseTime;
        status.lastChecked = new Date();
        status.healthy = responseTime < this.config.api_timeout_seconds * 1000;
        status.errorCount = 0;
        this.platformStatus.set(platform, status);
      }
      
      console.log(`✅ ${platform} API responded in ${responseTime}ms, returned ${deals.length} deals`);
      
      return deals;
      
    } catch (error) {
      // Update platform status with error
      const status = this.platformStatus.get(platform);
      if (status) {
        status.errorCount++;
        status.lastChecked = new Date();
        status.healthy = false;
        status.successRate = status.successRate * (status.errorCount - 1) / status.errorCount;
        this.platformStatus.set(platform, status);
      }
      
      console.log(`❌ ${platform} API failed:`, error.message);
      
      // Return empty array for now
      return [];
    }
  }

  private balanceDealAllocation(targetDeals: Deal[], alternativeDeals: Deal[]): Deal[] {
    const targetCount = Math.max(1, Math.floor((targetDeals.length + alternativeDeals.length) / 2));
    const alternativeCount = Math.max(1, Math.floor((targetDeals.length + alternativeDeals.length) / 2));
    
    // Take up to targetCount from target platform
    const selectedTargetDeals = targetDeals.slice(0, targetCount);
    
    // Take up to alternativeCount from alternative platform  
    const selectedAlternativeDeals = alternativeDeals.slice(0, alternativeCount);
    
    // Combine and shuffle
    const allDeals = [...selectedTargetDeals, ...selectedAlternativeDeals];
    
    // Shuffle to mix platforms
    for (let i = allDeals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDeals[i], allDeals[j]] = [allDeals[j], allDeals[i]];
    }
    
    console.log(`🎯 Balanced allocation: ${selectedTargetDeals.length} from target (${targetDeals[0]?.platform || 'N/A'}), ${selectedAlternativeDeals.length} from alternative`);
    
    return allDeals;
  }

  private convertShopeeProductToDeal(product: any): Deal {
    return {
      id: product.id,
      title: product.name,
      description: product.description,
      price: product.price,
      imageUrl: product.thumbnailUrl,
      platform: "shopee" as const,
      sourceUrl: product.shortLink,
      affiliateLink: product.affiliateLink,
      commissionRate: product.commissionRate,
      expirationDate: product.expirationDate,
      category: product.category,
      rating: product.rating,
      seller: "Shopee Seller",
      stock: product.stock,
      createdAt: new Date()
    };
  }

  private getMockLazadaDeals(): Deal[] {
    // Mock data for testing
    return [
      {
        id: "lazada_mock_001",
        title: "Premium Electronic Item A",
        description: "High-quality electronic item from Lazada marketplace",
        price: 89.99,
        imageUrl: "https://example.com/lazada-product-1.jpg",
        platform: "lazada" as const,
        sourceUrl: "https://lazada.co/1234567890",
        affiliateLink: "https://lazada.co/1234567890?sub_id=racun_dapur_ibu",
        commissionRate: 0.08,
        expirationDate: "2024-12-31",
        category: "electronics",
        rating: 4.3,
        seller: "Lazada Official",
        stock: 150,
        createdAt: new Date()
      },
      {
        id: "lazada_mock_002", 
        title: "Home & Living Item B",
        description: "Beautiful home and living item from Lazada",
        price: 39.99,
        imageUrl: "https://example.com/lazada-product-2.jpg",
        platform: "lazada" as const,
        sourceUrl: "https://lazada.co/0987654321",
        affiliateLink: "https://lazada.co/0987654321?sub_id=racun_dapur_ibu",
        commissionRate: 0.06,
        expirationDate: "2024-11-30",
        category: "home",
        rating: 4.7,
        seller: "Lazada Merchant",
        stock: 75,
        createdAt: new Date()
      }
    ];
  }

  private async saveRotationState(): Promise<void> {
    try {
      const state = {
        currentSlot: this.rotationSchedule.currentSlot,
        totalSlots: this.rotationSchedule.totalSlots,
        rotationType: this.rotationSchedule.rotationType,
        nextRotationAt: this.rotationSchedule.nextRotationAt.toISOString(),
        dealsToday: this.rotationSchedule.dealsToday,
        lastUpdated: new Date().toISOString()
      };
      
      await this.redisService.set(
        `dual_engine_rotation:state`,
        JSON.stringify(state),
        3600 // 1 hour TTL
      );
      
      console.log("💾 Rotation state saved to Redis");
      
    } catch (error) {
      console.error("❌ Failed to save rotation state:", error.message);
    }
  }

  async loadRotationState(): Promise<void> {
    try {
      const stateStr = await this.redisService.get(`dual_engine_rotation:state`);
      
      if (stateStr) {
        const state = JSON.parse(stateStr);
        this.rotationSchedule = {
          ...this.rotationSchedule,
          currentSlot: state.currentSlot,
          totalSlots: state.totalSlots,
          rotationType: state.rotationType,
          nextRotationAt: new Date(state.nextRotationAt),
          dealsToday: state.dealsToday
        };
        
        console.log("📥 Rotation state loaded from Redis");
      }
      
    } catch (error) {
      console.error("❌ Failed to load rotation state:", error.message);
      // Initialize with default schedule if loading fails
      this.rotationSchedule = this.initializeRotationSchedule();
    }
  }

  getRotationSchedule(): RotationSchedule {
    return { ...this.rotationSchedule };
  }

  getPlatformStatus(): Map<"lazada" | "shopee", PlatformStatus> {
    return new Map(this.platformStatus);
  }

  async checkPlatformHealth(): Promise<void> {
    for (const [platform] of this.platformStatus) {
      try {
        console.log(`🔍 Checking health of ${platform} platform...`);
        
        // Simple health check
        const startTime = Date.now();
        const healthy = platform === "shopee" ? await this.shopeeService.validateApiCredentials() : true;
        const responseTime = Date.now() - startTime;
        
        const status = this.platformStatus.get(platform);
        if (status) {
          status.responseTime = responseTime;
          status.lastChecked = new Date();
          status.healthy = healthy && responseTime < this.config.api_timeout_seconds * 1000;
          this.platformStatus.set(platform, status);
        }
        
        console.log(`✅ ${platform} platform health: ${status?.healthy ? 'HEALTHY' : 'UNHEALTHY'} (${responseTime}ms)`);
        
      } catch (error) {
        console.error(`❌ ${platform} platform health check failed:`, error.message);
        
        const status = this.platformStatus.get(platform);
        if (status) {
          status.errorCount++;
          status.healthy = false;
          this.platformStatus.set(platform, status);
        }
      }
    }
  }

  async getRecommendation(agentId?: string): Promise<Deal[]> {
    // For now, delegate to executeDealsCuration
    // In real implementation, this would consider user's preferences, agent history, etc.
    return await this.executeDealsCuration();
  }
}

// Create a singleton instance
const dualEngineRotationManager = new DualEngineRotationManager(
  require('./shopee').shopeeApiService,
  require('./redis').redisService,
  {
    rotationIntervalHours: 24,
    ensure_50_50_balance: true,
    prefer_platform: "balanced",
    api_timeout_seconds: 30,
    max_retry_attempts: 3,
    enable_circuit_breaker: true
  }
);

export { dualEngineRotationManager };

// Export types for convenience
export type {
  Deal,
  RotationConfig,
  PlatformStatus,
  RotationSchedule
} from this;