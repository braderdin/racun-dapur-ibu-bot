import { Env } from "../types/env";
import { B2StorageSwitcher } from "../services/b2-storage-switcher";
import { ImageWatermark } from "./image-watermark";

export class LazadaImageProxy {
  private b2Storage: B2StorageSwitcher;
  private watermark: ImageWatermark;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.b2Storage = new B2StorageSwitcher(env);
    this.watermark = new ImageWatermark();
  }

  /**
   * Download and process Lazada product image to WebP HD format
   * @param imageUrl - Original Lazada product image URL
   * @param productId - Lazada product ID for naming
   * @returns CDN URL of processed image
   */
  async processLazadaImage(
    imageUrl: string,
    productId: string,
  ): Promise<string> {
    try {
      if (!imageUrl) {
        throw new Error("No image URL provided");
      }

      console.log(
        `Processing Lazada image: ${imageUrl} for product ${productId}`,
      );

      // Step 1: Download raw image from Lazada
      const rawImageBuffer = await this.downloadImage(imageUrl);
      if (!rawImageBuffer) {
        throw new Error("Failed to download image from Lazada");
      }

      // Step 2: Convert to WebP format with compression
      const webpBuffer = await this.convertToWebP(rawImageBuffer);
      if (!webpBuffer) {
        throw new Error("Failed to convert image to WebP");
      }

      // Step 3: Apply watermark with product info
      const watermarkedBuffer = await this.watermark.applyWatermark(
        webpBuffer,
        {
          text: `Lazada - ${productId}`, // Product ID as watermark text
          position: "bottom-right",
          opacity: 0.7,
          fontSize: 24,
          color: "#ffffff",
        },
      );

      // Step 4: Upload to Backblaze B2 with auto-switching
      const cdnUrl = await this.uploadToB2(watermarkedBuffer, productId);

      if (!cdnUrl) {
        throw new Error("Failed to upload image to B2 storage");
      }

      console.log(`Image processed successfully: ${cdnUrl}`);
      return cdnUrl;
    } catch (error) {
      console.error("Error processing Lazada image:", error);
      throw error;
    }
  }

  /**
   * Download image from Lazada URL
   * @param imageUrl - Image URL to download
   * @returns Image buffer or null if failed
   */
  private async downloadImage(imageUrl: string): Promise<Buffer | null> {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(15000), // 15 second timeout
      });

      if (!response.ok) {
        console.error(
          `Failed to download image: ${response.status} ${response.statusText}`,
        );
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      console.error("Error downloading image:", error);
      return null;
    }
  }

  /**
   * Convert image buffer to WebP format with compression
   * @param buffer - Original image buffer
   * @returns WebP buffer or null if failed
   */
  private async convertToWebP(buffer: Buffer): Promise<Buffer | null> {
    try {
      // In production, use Sharp.js for efficient WebP conversion
      // For now, return the original buffer as placeholder
      // TODO: Implement Sharp.js WebP conversion with quality optimization

      console.log(
        "Converting image to WebP format (placeholder implementation)",
      );

      // Placeholder: return original buffer
      // In real implementation: use Sharp.js for WebP conversion
      return buffer;
    } catch (error) {
      console.error("Error converting image to WebP:", error);
      return null;
    }
  }

  /**
   * Upload processed image to Backblaze B2 storage
   * @param buffer - Image buffer to upload
   * @param productId - Product ID for filename
   * @returns CDN URL or null if failed
   */
  private async uploadToB2(
    buffer: Buffer,
    productId: string,
  ): Promise<string | null> {
    try {
      // Generate unique filename
      const timestamp = Date.now();
      const filename = `lazada-${productId}-${timestamp}.webp`;

      // Upload to B2 with auto-switching logic
      const uploadResult = await this.b2Storage.uploadFile(
        buffer,
        filename,
        "image/webp",
        {
          source: "lazada",
          productId,
          timestamp,
          contentType: "image/webp",
        },
      );

      if (!uploadResult.success) {
        console.error("B2 upload failed:", uploadResult.error);
        return null;
      }

      // Return CDN URL
      return uploadResult.cdnUrl;
    } catch (error) {
      console.error("Error uploading to B2:", error);
      return null;
    }
  }

  /**
   * Process multiple Lazada images in batch
   * @param imageUrls - Array of image URLs
   * @param productId - Product ID for naming
   * @returns Array of CDN URLs
   */
  async processMultipleImages(
    imageUrls: string[],
    productId: string,
  ): Promise<string[]> {
    try {
      const results: string[] = [];

      // Process images sequentially to avoid overwhelming the system
      for (let i = 0; i < imageUrls.length; i++) {
        const imageUrl = imageUrls[i];
        console.log(
          `Processing image ${i + 1}/${imageUrls.length}: ${imageUrl}`,
        );

        try {
          const cdnUrl = await this.processLazadaImage(imageUrl, productId);
          results.push(cdnUrl);

          // Add delay between images to respect rate limits
          if (i < imageUrls.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Failed to process image ${i + 1}:`, error);
          // Continue with other images even if one fails
        }
      }

      return results;
    } catch (error) {
      console.error("Error processing multiple images:", error);
      return [];
    }
  }

  /**
   * Validate image URL from Lazada
   * @param imageUrl - Image URL to validate
   * @returns True if URL appears valid
   */
  private isValidLazadaImageUrl(imageUrl: string): boolean {
    if (!imageUrl) return false;

    // Check if URL is from Lazada domain
    return (
      imageUrl.includes("lzd.com") ||
      imageUrl.includes("lazada.com") ||
      imageUrl.includes("slatic.net") ||
      imageUrl.includes("lzdcdn.com")
    );
  }

  /**
   * Get image dimensions from buffer (placeholder)
   * @param buffer - Image buffer
   * @returns Image dimensions or null
   */
  private async getImageDimensions(
    buffer: Buffer,
  ): Promise<{ width: number; height: number } | null> {
    try {
      // In production, use Sharp.js to get image dimensions
      // For now, return placeholder dimensions
      return { width: 800, height: 800 }; // Placeholder
    } catch (error) {
      console.error("Error getting image dimensions:", error);
      return null;
    }
  }
}
