/**
 * WebP Auto-Compressor & B2 3-Account Storage Rotator
 * Downloads product images, auto-compresses to WebP HD (<2MB), overlays the
 * "Racun Dapur Ibu" trust badge, and auto-switches uploads across 3 Backblaze B2
 * Private Buckets (27GB Total RM0 Storage) served via Cloudflare S3 Auth Proxy.
 */

import { Env } from "../types/env";
import { B2StorageService } from "./b2-storage";
import {
  B2MultiAccountRotator,
  B2AccountConfig,
} from "./b2-multi-account-rotator";

export interface ImageProcessingConfig {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxFileSizeMB: number;
  badgeText: string;
  badgePosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  badgeOpacity: number;
}

export interface ProcessedImageResult {
  success: boolean;
  webpBuffer?: Buffer;
  webpUrl?: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  bucketAccount: number;
  error?: string;
}

export class B2WebPUploader {
  private env: Env;
  private b2Storage: B2StorageService;
  private accountRotator: B2MultiAccountRotator;
  private config: ImageProcessingConfig;

  constructor(env: Env, config?: Partial<ImageProcessingConfig>) {
    this.env = env;

    // Create B2 account configs from env - support both naming conventions
    const accounts: B2AccountConfig[] = [
      {
        account: 1,
        bucket: env.B2_ACC1_BUCKET_NAME || env.B2_ACC1_BUCKET || "",
        keyId: env.B2_ACC1_KEY_ID || "",
        applicationKey: env.B2_ACC1_APPLICATION_KEY || "",
        endpoint:
          env.B2_ACC1_ENDPOINT || "https://s3.us-west-004.backblazeb2.com",
        maxCapacityGB: 9,
        usedGB: 0,
        enabled: !!(
          (env.B2_ACC1_BUCKET_NAME || env.B2_ACC1_BUCKET) &&
          env.B2_ACC1_KEY_ID &&
          env.B2_ACC1_APPLICATION_KEY
        ),
      },
      {
        account: 2,
        bucket: env.B2_ACC2_BUCKET_NAME || env.B2_ACC2_BUCKET || "",
        keyId: env.B2_ACC2_KEY_ID || "",
        applicationKey: env.B2_ACC2_APPLICATION_KEY || "",
        endpoint:
          env.B2_ACC2_ENDPOINT || "https://s3.us-west-004.backblazeb2.com",
        maxCapacityGB: 9,
        usedGB: 0,
        enabled: !!(
          (env.B2_ACC2_BUCKET_NAME || env.B2_ACC2_BUCKET) &&
          env.B2_ACC2_KEY_ID &&
          env.B2_ACC2_APPLICATION_KEY
        ),
      },
      {
        account: 3,
        bucket: env.B2_ACC3_BUCKET_NAME || env.B2_ACC3_BUCKET || "",
        keyId: env.B2_ACC3_KEY_ID || "",
        applicationKey: env.B2_ACC3_APPLICATION_KEY || "",
        endpoint:
          env.B2_ACC3_ENDPOINT || "https://s3.us-west-004.backblazeb2.com",
        maxCapacityGB: 9,
        usedGB: 0,
        enabled: !!(
          (env.B2_ACC3_BUCKET_NAME || env.B2_ACC3_BUCKET) &&
          env.B2_ACC3_KEY_ID &&
          env.B2_ACC3_APPLICATION_KEY
        ),
      },
    ].filter((a) => a.enabled);

    this.b2Storage = new B2StorageService(accounts);
    this.accountRotator = new B2MultiAccountRotator(accounts);

    this.config = {
      maxWidth: 1200,
      maxHeight: 1200,
      quality: 85,
      maxFileSizeMB: 2,
      badgeText: "Racun Dapur Ibu",
      badgePosition: "bottom-right",
      badgeOpacity: 0.8,
      ...config,
    };
  }

  /**
   * Download, process, and upload product image to B2 with WebP compression
   * @param imageUrl - Source image URL
   * @param productId - Product identifier for naming
   * @returns Processed image result with CDN URL
   */
  async processAndUploadImage(
    imageUrl: string,
    productId: string,
  ): Promise<ProcessedImageResult> {
    try {
      // Step 1: Download image
      const imageBuffer = await this.downloadImage(imageUrl);
      if (!imageBuffer) {
        return this.createErrorResult("Failed to download image");
      }

      const originalSize = imageBuffer.length;

      // Step 2: Process image (resize, compress to WebP, add badge)
      const webpBuffer = await this.processImage(imageBuffer);
      if (!webpBuffer) {
        return this.createErrorResult("Failed to process image to WebP");
      }

      const compressedSize = webpBuffer.length;

      // Step 3: Check file size constraint
      if (compressedSize > this.config.maxFileSizeMB * 1024 * 1024) {
        // Try with lower quality
        const retryBuffer = await this.processImage(imageBuffer, {
          quality: 70,
        });
        if (
          retryBuffer &&
          retryBuffer.length <= this.config.maxFileSizeMB * 1024 * 1024
        ) {
          return await this.uploadToB2(retryBuffer, productId, originalSize);
        }
        return this.createErrorResult(
          `Compressed image exceeds ${this.config.maxFileSizeMB}MB limit`,
        );
      }

      // Step 4: Upload to B2 with account rotation
      return await this.uploadToB2(webpBuffer, productId, originalSize);
    } catch (error) {
      console.error("Error in processAndUploadImage:", error);
      return this.createErrorResult(
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Download image from URL with timeout and fallback
   * @param url - Image URL
   * @returns Image buffer or null
   */
  private async downloadImage(url: string): Promise<Buffer | null> {
    // Fallback image URL (public domain kitchen image from Unsplash)
    const FALLBACK_IMAGE_URL =
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop&auto=format";

    // Try to fetch the original image first
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "RacunDapurIbu-Bot/1.0",
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      console.warn(
        `Failed to download image (${response.status}), trying fallback...`,
      );
    } catch (error) {
      console.warn(
        `Error downloading image: ${error instanceof Error ? error.message : "Unknown error"}, trying fallback...`,
      );
    }

    // Try fallback image
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const fallbackResponse = await fetch(FALLBACK_IMAGE_URL, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (fallbackResponse.ok) {
        const arrayBuffer = await fallbackResponse.arrayBuffer();
        console.log("Using fallback image from Unsplash");
        return Buffer.from(arrayBuffer);
      }
      console.warn(`Fallback image also failed (${fallbackResponse.status})`);
    } catch (fallbackError) {
      console.warn(
        `Error fetching fallback image: ${fallbackError instanceof Error ? fallbackError.message : "Unknown error"}`,
      );
    }

    console.error("All image sources failed");
    return null;
  }

  /**
   * Process image: resize, convert to WebP, add trust badge
   * @param buffer - Original image buffer
   * @param options - Processing options override
   * @returns WebP buffer or null
   */
  private async processImage(
    buffer: Buffer,
    options?: Partial<ImageProcessingConfig>,
  ): Promise<Buffer | null> {
    try {
      // Dynamic import of sharp for image processing
      const sharp = (await import("sharp")).default;

      const cfg = { ...this.config, ...options };

      let pipeline = sharp(buffer)
        .rotate() // Auto-rotate based on EXIF
        .resize(cfg.maxWidth, cfg.maxHeight, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: cfg.quality, effort: 6 });

      // Add trust badge overlay
      pipeline = await this.addTrustBadge(pipeline, cfg);

      return await pipeline.toBuffer();
    } catch (error) {
      console.error("Error processing image:", error);
      return null;
    }
  }

  /**
   * Add "Racun Dapur Ibu" trust badge overlay
   * @param pipeline - Sharp pipeline
   * @param cfg - Configuration
   * @returns Modified pipeline
   */
  private async addTrustBadge(
    pipeline: any,
    cfg: ImageProcessingConfig,
  ): Promise<any> {
    try {
      const sharp = (await import("sharp")).default;

      // Create badge SVG
      const badgeSvg = this.generateBadgeSvg(cfg);
      const badgeBuffer = Buffer.from(badgeSvg);

      // Get image metadata for positioning
      const metadata = await pipeline.metadata();
      const imgWidth = metadata.width || cfg.maxWidth;
      const imgHeight = metadata.height || cfg.maxHeight;

      // Calculate badge position
      const badgeWidth = 200;
      const badgeHeight = 50;
      const padding = 20;

      let left = padding;
      let top = padding;

      switch (cfg.badgePosition) {
        case "top-right":
          left = imgWidth - badgeWidth - padding;
          top = padding;
          break;
        case "bottom-left":
          left = padding;
          top = imgHeight - badgeHeight - padding;
          break;
        case "bottom-right":
          left = imgWidth - badgeWidth - padding;
          top = imgHeight - badgeHeight - padding;
          break;
        case "top-left":
        default:
          left = padding;
          top = padding;
          break;
      }

      return pipeline.composite([
        {
          input: badgeBuffer,
          left,
          top,
          blend: "over",
        },
      ]);
    } catch (error) {
      console.error("Error adding trust badge:", error);
      return pipeline;
    }
  }

  /**
   * Generate trust badge SVG
   * @param cfg - Configuration
   * @returns SVG string
   */
  private generateBadgeSvg(cfg: ImageProcessingConfig): string {
    const opacity = Math.round(cfg.badgeOpacity * 255)
      .toString(16)
      .padStart(2, "0");
    return `
      <svg width="200" height="50" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="badgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#D4A574;stop-opacity:${cfg.badgeOpacity}" />
            <stop offset="100%" style="stop-color:#C9B896;stop-opacity:${cfg.badgeOpacity}" />
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="#000" flood-opacity="0.3"/>
          </filter>
        </defs>
        <rect x="5" y="5" width="190" height="40" rx="8" fill="url(#badgeGrad)" filter="url(#shadow)"/>
        <text x="100" y="30" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#1A1A1A" text-anchor="middle" dominant-baseline="middle">${cfg.badgeText}</text>
      </svg>
    `;
  }

  /**
   * Upload processed image to B2 with account rotation
   * @param webpBuffer - WebP image buffer
   * @param productId - Product identifier
   * @param originalSize - Original file size
   * @returns Processed image result
   */
  private async uploadToB2(
    webpBuffer: Buffer,
    productId: string,
    originalSize: number,
  ): Promise<ProcessedImageResult> {
    try {
      // Get next available B2 account
      const accountNumber = this.accountRotator.getNextAvailableAccount();
      if (!accountNumber) {
        return this.createErrorResult("No available B2 accounts");
      }

      const currentAccount = this.accountRotator.getCurrentAccount();
      if (!currentAccount) {
        return this.createErrorResult("No current B2 account");
      }

      const fileName = `products/${productId}_${Date.now()}.webp`;

      // Upload to B2 using storage service - convert Buffer to ArrayBuffer
      const arrayBuffer = new Uint8Array(webpBuffer).buffer;
      const uploadResult = await this.b2Storage.uploadProductImage(
        arrayBuffer,
        productId,
        {
          platform: "lazada", // default, could be parameterized
          category: "general",
          originalFileName: fileName,
        },
      );

      if (!uploadResult.success) {
        return this.createErrorResult(`B2 upload failed`);
      }

      // Generate CDN URL via Cloudflare S3 Auth Proxy
      const cdnUrl = `https://racun.ibu.my/images/${fileName}`;

      return {
        success: true,
        webpBuffer,
        webpUrl: cdnUrl,
        originalSize,
        compressedSize: webpBuffer.length,
        compressionRatio: Math.round(
          (1 - webpBuffer.length / originalSize) * 100,
        ),
        bucketAccount: currentAccount.account,
      };
    } catch (error) {
      console.error("Error uploading to B2:", error);
      return this.createErrorResult(
        error instanceof Error ? error.message : "Upload failed",
      );
    }
  }

  /**
   * Create error result
   * @param error - Error message
   * @returns Error result
   */
  private createErrorResult(error: string): ProcessedImageResult {
    return {
      success: false,
      originalSize: 0,
      compressedSize: 0,
      compressionRatio: 0,
      bucketAccount: 0,
      error,
    };
  }

  /**
   * Process multiple images in batch
   * @param images - Array of {url, productId}
   * @returns Array of results
   */
  async processBatch(
    images: Array<{ url: string; productId: string }>,
  ): Promise<ProcessedImageResult[]> {
    const results: ProcessedImageResult[] = [];

    for (const image of images) {
      const result = await this.processAndUploadImage(
        image.url,
        image.productId,
      );
      results.push(result);

      // Small delay between uploads to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return results;
  }

  /**
   * Get storage statistics across all accounts
   * @returns Storage stats
   */
  async getStorageStats(): Promise<any> {
    return await this.accountRotator.getStorageStats();
  }
}
