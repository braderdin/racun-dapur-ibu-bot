/*
 * Product Image Watermark & Badge Overlay Utility
 * Sharp.js image processing for auto-compressing product images
 * into WebP (<2MB) with "Racun Dapur Ibu" trust badges and
 * discount percentage tags overlaid.
 *
 * Phase 8: Autonomous AI Curation Engine
 * All credentials read from environment variables — no hardcoded secrets.
 */

import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

// Lazy-load sharp to avoid bundling native .node binaries in Cloudflare Workers
async function getSharp() {
  const sharpModule = await import("sharp");
  return sharpModule.default || sharpModule;
}

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface WatermarkOptions {
  maxSizeMB?: number;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  watermarkText?: string;
  badgeText?: string;
  discountPercent?: number;
  badgePosition?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  watermarkOpacity?: number;
  badgeOpacity?: number;
  outputFormat?: "webp" | "png" | "jpeg";
}

export interface WatermarkResult {
  buffer: Buffer;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  mimeType: string;
  isWebP: boolean;
  sizeValid: boolean; // Under 2MB
  dimensionsValid: boolean;
}

export interface BadgeOverlay {
  text: string;
  backgroundColor: string;
  textColor: string;
  fontSize: number;
  padding: number;
  borderRadius: number;
}

export interface WatermarkStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  position: { x: number; y: number };
}

// ---------------------------------------------------------------------------
// Default Configuration
// ---------------------------------------------------------------------------

const DEFAULT_OPTIONS: Required<WatermarkOptions> = {
  maxSizeMB: 2,
  maxWidth: 1920,
  maxHeight: 1080,
  quality: 0.82,
  watermarkText: "Racun Dapur Ibu",
  badgeText: "DISKAUN",
  discountPercent: 0,
  badgePosition: "top-right",
  watermarkOpacity: 0.15,
  badgeOpacity: 0.9,
  outputFormat: "webp",
};

// ---------------------------------------------------------------------------
// Badge color palette (warm kitchen theme)
// ---------------------------------------------------------------------------

const BADGE_STYLES: Record<string, BadgeOverlay> = {
  "top-right": {
    text: "DISKAUN",
    backgroundColor: "#E57A44", // Terracotta
    textColor: "#FFFFFF",
    fontSize: 24,
    padding: 12,
    borderRadius: 8,
  },
  "top-left": {
    text: "DISKAUN",
    backgroundColor: "#D4AF37", // Warm gold
    textColor: "#FFFFFF",
    fontSize: 24,
    padding: 12,
    borderRadius: 8,
  },
  "bottom-right": {
    text: "RACUN",
    backgroundColor: "#4A4A4A", // Charcoal
    textColor: "#FEF2E6", // Cream
    fontSize: 20,
    padding: 10,
    borderRadius: 6,
  },
  "bottom-left": {
    text: "RACUN",
    backgroundColor: "#8B9A7B", // Sage
    textColor: "#FFFFFF",
    fontSize: 20,
    padding: 10,
    borderRadius: 6,
  },
};

// ---------------------------------------------------------------------------
// Image Watermark Service
// ---------------------------------------------------------------------------

export class ImageWatermarkService {
  private options: Required<WatermarkOptions>;

  constructor(options?: Partial<WatermarkOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };

    logger.info(
      "ImageWatermarkService initialized",
      {
        maxSizeMB: this.options.maxSizeMB,
        outputFormat: this.options.outputFormat,
        badgePosition: this.options.badgePosition,
      },
      "ImageWatermarkService",
    );
  }

  // -----------------------------------------------------------------------
  // Main processing pipeline
  // -----------------------------------------------------------------------

  async processImage(
    inputBuffer: Buffer,
    options?: Partial<WatermarkOptions>,
  ): Promise<WatermarkResult> {
    const opts = { ...this.options, ...options };
    const originalSize = inputBuffer.length;

    logger.debug(
      "Processing image",
      {
        originalSize,
        format: opts.outputFormat,
      },
      "ImageWatermarkService",
    );

    // Step 1: Read image metadata
    const sharpLib = await getSharp();
    const metadata = await sharpLib(inputBuffer).metadata();

    // Step 2: Resize if needed (maintain aspect ratio)
    let pipeline = sharpLib(inputBuffer);

    if (metadata.width && metadata.width > opts.maxWidth) {
      pipeline = pipeline.resize({
        width: opts.maxWidth,
        withoutEnlargement: true,
      });
    }
    if (metadata.height && metadata.height > opts.maxHeight) {
      pipeline = pipeline.resize({
        height: opts.maxHeight,
        withoutEnlargement: true,
      });
    }

    // Step 3: Apply watermark overlay
    pipeline = await this.applyWatermark(pipeline, metadata, opts);

    // Step 4: Apply badge overlay with discount percentage
    if (opts.discountPercent > 0) {
      pipeline = await this.applyBadgeOverlay(pipeline, metadata, opts);
    }

    // Step 5: Convert to output format and compress
    const outputFormat = opts.outputFormat || "webp";
    pipeline = this.applyOutputFormat(pipeline, outputFormat, opts);

    // Step 6: Get final buffer
    const outputBuffer = await pipeline.toBuffer();
    const compressedSize = outputBuffer.length;

    // Step 7: Validate size constraint
    const sizeValid = compressedSize <= opts.maxSizeMB * 1024 * 1024;
    const dimensionsValid =
      (metadata.width || 0) <= opts.maxWidth &&
      (metadata.height || 0) <= opts.maxHeight;

    logger.info(
      "Image processing complete",
      {
        originalSize,
        compressedSize,
        sizeValid,
        dimensionsValid,
      },
      "ImageWatermarkService",
    );

    return {
      buffer: outputBuffer,
      originalSize,
      compressedSize,
      width: metadata.width || 0,
      height: metadata.height || 0,
      mimeType: `image/${outputFormat}`,
      isWebP: outputFormat === "webp",
      sizeValid,
      dimensionsValid,
    };
  }

  // -----------------------------------------------------------------------
  // Watermark overlay (subtle, semi-transparent)
  // -----------------------------------------------------------------------

  private async applyWatermark(
    pipeline: any,
    metadata: any,
    opts: Required<WatermarkOptions>,
  ): Promise<any> {
    const svg = this.generateWatermarkSvg(metadata, opts);
    const svgBuffer = Buffer.from(svg);

    return pipeline.composite([
      {
        input: svgBuffer,
        blend: "over",
      },
    ]);
  }

  // -----------------------------------------------------------------------
  // Badge overlay with discount percentage
  // -----------------------------------------------------------------------

  private async applyBadgeOverlay(
    pipeline: any,
    metadata: any,
    opts: Required<WatermarkOptions>,
  ): Promise<any> {
    const position = opts.badgePosition || "top-right";
    const style = BADGE_STYLES[position];
    const width = metadata.width || 800;
    const badgeWidth = Math.max(120, width * 0.2);
    const badgeHeight = 48;

    const svg = this.generateBadgeSvg(
      badgeWidth,
      badgeHeight,
      style,
      opts.discountPercent,
    );
    const svgBuffer = Buffer.from(svg);

    let x: number;
    let y: number;

    switch (position) {
      case "top-right":
        x = width - badgeWidth - 16;
        y = 16;
        break;
      case "top-left":
        x = 16;
        y = 16;
        break;
      case "bottom-right":
        x = width - badgeWidth - 16;
        y = (metadata.height || 600) - badgeHeight - 16;
        break;
      case "bottom-left":
        x = 16;
        y = (metadata.height || 600) - badgeHeight - 16;
        break;
      default:
        x = width - badgeWidth - 16;
        y = 16;
    }

    return pipeline.composite([
      {
        input: svgBuffer,
        left: x,
        top: y,
        blend: "over",
      },
    ]);
  }

  // -----------------------------------------------------------------------
  // SVG generators
  // -----------------------------------------------------------------------

  private generateWatermarkSvg(
    metadata: any,
    opts: Required<WatermarkOptions>,
  ): string {
    const width = metadata.width || 800;
    const height = metadata.height || 600;
    const opacity = opts.watermarkOpacity;

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="blur">
          <feGaussianBlur stdDeviation="4"/>
        </filter>
      </defs>
      <text x="${width / 2}" y="${height / 2}" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="48" font-weight="bold"
            fill="white" opacity="${opacity}" filter="url(#blur)"
            transform="rotate(-15, ${width / 2}, ${height / 2})">
        ${this.escapeXml(opts.watermarkText)}
      </text>
    </svg>`;
  }

  private generateBadgeSvg(
    width: number,
    height: number,
    style: BadgeOverlay,
    discountPercent: number,
  ): string {
    const displayText =
      discountPercent > 0 ? `${discountPercent}% OFF` : style.text;

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}"
            rx="8" ry="8" fill="${style.backgroundColor}" opacity="0.95"/>
      <text x="${width / 2}" y="${height / 2 + 8}" text-anchor="middle"
            font-family="Arial, sans-serif" font-size="${style.fontSize}"
            font-weight="bold" fill="${style.textColor}">
        ${this.escapeXml(displayText)}
      </text>
    </svg>`;
  }

  // -----------------------------------------------------------------------
  // Output format configuration
  // -----------------------------------------------------------------------

  private applyOutputFormat(
    pipeline: any,
    format: string,
    opts: Required<WatermarkOptions>,
  ): any {
    switch (format) {
      case "webp":
        return pipeline.webp({
          quality: Math.round(opts.quality * 100),
          force: true,
        });
      case "png":
        return pipeline.png({ compressionLevel: 9, force: true });
      case "jpeg":
        return pipeline.jpeg({
          quality: Math.round(opts.quality * 100),
          force: true,
        });
      default:
        return pipeline.webp({
          quality: Math.round(opts.quality * 100),
          force: true,
        });
    }
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

// ---------------------------------------------------------------------------
// Factory helper
// ---------------------------------------------------------------------------

export function createImageWatermarkService(
  options?: Partial<WatermarkOptions>,
): ImageWatermarkService {
  return new ImageWatermarkService(options);
}
