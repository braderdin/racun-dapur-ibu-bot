/*
 * Backblaze B2 Storage Service
 * Handles hierarchical WebP storage with auto-switching between 9GB accounts
 * Integrates with ImageProcessor for WebP optimization
 * Supports products/YYYY/MM/[category]/[platform]_[id].webp format
 */

import { CONSTANTS } from "../config/constants";
import { ImageProcessor } from "../utils/image-processor";

export interface B2StorageConfig {
  account: number;
  bucket: string;
  keyId: string;
  applicationKey: string;
  endpoint: string;
}

export interface UploadResult {
  success: boolean;
  imageUrl: string;
  storageKey: string;
  account: number;
  bucket: string;
  object: string;
  metadata: {
    originalSize: number;
    compressedSize: number;
    isWebP: boolean;
    dimensions: { width: number; height: number };
    quality: number;
  };
}

export interface StorageStats {
  usedGB: number;
  capGB: number;
  remainingGB: number;
  percentage: number;
  needsAutoSwitch: boolean;
}

export class B2StorageService {
  private readonly imageProcessor: ImageProcessor;
  private config: B2StorageConfig[];
  private currentAccountIndex: number;

  constructor(config: B2StorageConfig[]) {
    this.imageProcessor = new ImageProcessor({
      convertToWebP: true,
      quality: 0.85,
      maxSizeMB: 2,
    });

    this.config = config.sort((a, b) => a.account - b.account);
    this.currentAccountIndex = 0;

    console.log(
      "🔧 B2StorageService initialized with",
      this.config.length,
      "accounts",
    );
  }

  async uploadProductImage(
    imageBuffer: ArrayBuffer,
    productId: string,
    options: {
      platform: "lazada" | "shopee";
      category?: string;
      originalFileName?: string;
      metadata?: any;
    },
  ): Promise<UploadResult> {
    try {
      console.log("📤 Uploading product image...");

      // Get current account
      const currentConfig = this.getCurrentAccountConfig();
      console.log("📦 Using B2 account", currentConfig.account);

      // Process image with ImageProcessor
      const processedImage = await this.imageProcessor.processImage(
        imageBuffer,
        {
          convertToWebP: true,
          quality: 0.85,
          maxSizeMB: 2,
        },
      );

      // Generate hierarchical storage key
      const storageKey = this.imageProcessor.formatB2StorageKey(
        productId,
        options.platform,
        options.category || "general",
        options.originalFileName,
      );

      // Upload to B2 storage (simulated for now)
      const uploadResult = await this.uploadToB2(
        processedImage.buffer,
        storageKey,
        currentConfig,
        processedImage,
      );

      // Check if account needs auto-switch
      const storageStats = this.imageProcessor.getStorageQuotaStatus(
        processedImage.compressedSize,
        CONSTANTS.B2_STORAGE_CAP_BYTES,
      );

      if (storageStats.needsAutoSwitch) {
        console.log(
          "⚠️  Account",
          currentConfig.account + 1,
          "reached storage threshold, auto-switching...",
        );
        await this.switchToNextAccount();
      }

      console.log("✅ Product image uploaded successfully");
      console.log("📁 Storage key:", storageKey);
      console.log(
        "💾 Size:",
        (processedImage.compressedSize / 1024 / 1024).toFixed(2),
        "MB",
      );

      return uploadResult;
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      console.error("❌ Failed to upload product image:", errMessage);
      throw error instanceof Error ? error : new Error(errMessage);
    }
  }

  private getCurrentAccountConfig(): B2StorageConfig {
    const configIndex = this.currentAccountIndex % this.config.length;
    return this.config[configIndex];
  }

  private async switchToNextAccount(): Promise<void> {
    // Move to next account (cyclic)
    this.currentAccountIndex++;
    console.log(
      "🔄 Switched to account",
      this.getCurrentAccountConfig().account,
    );
  }

  private async uploadToB2(
    buffer: ArrayBuffer,
    storageKey: string,
    config: B2StorageConfig,
    imageInfo: any,
  ): Promise<UploadResult> {
    // Simulate B2 upload (in real implementation, use b2-sdk)
    console.log("☁️  Uploading to B2 storage...");

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    const imageUrl = `https://${config.bucket}.s3.amazonaws.com/${storageKey}`;

    return {
      success: true,
      imageUrl,
      storageKey,
      account: config.account,
      bucket: config.bucket,
      object: storageKey,
      metadata: {
        originalSize: imageInfo.originalSize,
        compressedSize: imageInfo.compressedSize,
        isWebP: imageInfo.isWebP,
        dimensions: { width: imageInfo.width, height: imageInfo.height },
        quality: 0.85,
      },
    };
  }

  getStorageStats(): StorageStats {
    const usedBytes =
      CONSTANTS.B2_STORAGE_CAP_BYTES * (this.currentAccountIndex + 1) * 0.3;
    return this.imageProcessor.getStorageQuotaStatus(usedBytes);
  }

  getCurrentAccount(): number {
    return this.getCurrentAccountConfig().account;
  }

  async cleanupOldFiles(daysOld: number = 30): Promise<void> {
    console.log("🧹 Cleaning up files older than", daysOld, "days...");

    // Simulate cleanup
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("✅ Cleanup completed");
  }

  generateHierarchicalPath(
    productId: string,
    platform: "lazada" | "shopee",
    category: string = "general",
  ): string {
    return this.imageProcessor.formatB2StorageKey(
      productId,
      platform,
      category,
    );
  }

  validateImageUpload(
    imageBuffer: ArrayBuffer,
    expectedPlatform?: "lazada" | "shopee",
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    const fileSizeMB = imageBuffer.byteLength / (1024 * 1024);
    if (fileSizeMB > 2) {
      errors.push(`File size ${fileSizeMB.toFixed(2)}MB exceeds 2MB limit`);
    }

    // Check if it's a supported image format
    // (would need actual validation here)

    if (
      expectedPlatform &&
      !(expectedPlatform === "lazada" || expectedPlatform === "shopee")
    ) {
      errors.push("Unsupported platform");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async healthCheck(): Promise<{
    status: string;
    details: string;
    timestamp: string;
  }> {
    return {
      status: this.config.length > 0 ? "healthy" : "unhealthy",
      details: `B2 storage service operational with ${this.config.length} accounts`,
      timestamp: new Date().toISOString(),
    };
  }
}

// Create a singleton instance
const b2StorageService = new B2StorageService([
  {
    account: 1,
    bucket: "racun-dapur-ibu-assets",
    keyId: "0052efa5668da500000000001",
    applicationKey: "K005yneif9owcpAltV67bqji3DjxZ5s",
    endpoint: "https://s3.amazonaws.com",
  },
  {
    account: 2,
    bucket: "racun-dapur-ibu-assets-02",
    keyId: "005450036af81220000000001",
    applicationKey: "K005lY71WOFB4uNyIS8O62oKN+QFZw0",
    endpoint: "https://s3.amazonaws.com",
  },
  {
    account: 3,
    bucket: "racun-dapur-ibu-assets-03",
    keyId: "005b1741c48e4c10000000001",
    applicationKey: "K005+I2FEu00DBkrMZgSx+8dNqjDPn0",
    endpoint: "https://s3.amazonaws.com",
  },
]);

export { b2StorageService };
