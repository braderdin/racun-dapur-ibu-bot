"use client";

import { CatalogProduct } from "./supabase-catalog";

export interface CountdownTimer {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  totalMilliseconds: number;
}

export interface FlashSaleInfo {
  productId: string;
  lazadaPeakHourEnd?: string;
  shopeePeakHourEnd?: string;
  lazadaRemaining?: number;
  shopeeRemaining?: number;
  currentPrice?: number;
  originalPrice?: number;
  discountPercentage?: number;
}

export class FlashSaleService {
  // ⏱️ Calculate remaining time for flash sale
  calculateCountdown(endTime?: string): CountdownTimer {
    if (!endTime) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        totalMilliseconds: 0,
      };
    }

    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: true,
        totalMilliseconds: 0,
      };
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const remainingSeconds = seconds % 60;
    const remainingMinutes = minutes % 60;
    const remainingHours = hours % 24;

    return {
      days,
      hours: remainingHours,
      minutes: remainingMinutes,
      seconds: remainingSeconds,
      isExpired: false,
      totalMilliseconds: diff,
    };
  }

  // 🔥 Identify flash sale products
  identifyFlashSales(products: CatalogProduct[]): FlashSaleInfo[] {
    const now = new Date();
    const flashSales: FlashSaleInfo[] = [];

    products.forEach((product) => {
      const lazadaEnds = product.lazada_peak_hour_end
        ? new Date(product.lazada_peak_hour_end)
        : null;
      const shopeeEnds = product.shopee_peak_hour_end
        ? new Date(product.shopee_peak_hour_end)
        : null;

      const lazadaRemaining = product.lazada_peak_hour_remaining ?? 0;
      const shopeeRemaining = product.shopee_peak_hour_remaining ?? 0;

      const isFlashSale =
        (lazadaEnds && lazadaEnds > now && lazadaRemaining > 0) ||
        (shopeeEnds && shopeeEnds > now && shopeeRemaining > 0);

      if (isFlashSale) {
        const flashSale: FlashSaleInfo = {
          productId: product.id,
        };

        if (lazadaEnds && lazadaEnds > now && lazadaRemaining > 0) {
          flashSale.lazadaPeakHourEnd = product.lazada_peak_hour_end;
          flashSale.lazadaRemaining = lazadaRemaining;
          flashSale.currentPrice = product.lazada_peak_hour_current_price;
          flashSale.originalPrice = product.lazada_peak_hour_original_price;
          flashSale.discountPercentage = product.lazada_peak_hour_percent;
        }

        if (shopeeEnds && shopeeEnds > now && shopeeRemaining > 0) {
          flashSale.shopeePeakHourEnd = product.shopee_peak_hour_end;
          flashSale.shopeeRemaining = shopeeRemaining;
          flashSale.currentPrice = product.shopee_peak_hour_current_price;
          flashSale.originalPrice = product.shopee_peak_hour_original_price;
          flashSale.discountPercentage = product.shopee_peak_hour_percent;
        }

        flashSales.push(flashSale);
      }
    });

    return flashSales;
  }

  // ⏰ Get flash sale countdown for a specific product
  getFlashSaleCountdown(product: CatalogProduct): CountdownTimer {
    const now = new Date();
    let nearestEnd: string | null = null;

    if (
      product.lazada_peak_hour_end &&
      new Date(product.lazada_peak_hour_end) > now
    ) {
      nearestEnd = product.lazada_peak_hour_end;
    }

    if (
      product.shopee_peak_hour_end &&
      new Date(product.shopee_peak_hour_end) > now
    ) {
      if (
        !nearestEnd ||
        new Date(product.shopee_peak_hour_end) < new Date(nearestEnd)
      ) {
        nearestEnd = product.shopee_peak_hour_end;
      }
    }

    return this.calculateCountdown(nearestEnd);
  }

  // 🔄 Format countdown for display
  formatCountdown(timer: CountdownTimer): string {
    if (timer.isExpired) {
      return "Selesai";
    }

    const parts: string[] = [];

    if (timer.days > 0) {
      parts.push(`${timer.days} hari`);
    }

    if (timer.hours > 0 || parts.length > 0) {
      parts.push(`${timer.hours} jam`);
    }

    parts.push(`${timer.minutes} min`);
    parts.push(`${timer.seconds} saat`);

    return parts.join(" ");
  }

  // 📊 Calculate flash sale priority (for sorting)
  calculateFlashSalePriority(flashSale: FlashSaleInfo): number {
    let priority = 0;

    if (flashSale.lazadaPeakHourEnd) {
      const lazadaEnd = new Date(flashSale.lazadaPeakHourEnd);
      const now = new Date();
      const diffMs = lazadaEnd.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      priority += 100 - diffHours; // Earlier ends = higher priority
    }

    if (flashSale.shopeePeakHourEnd) {
      const shopeeEnd = new Date(flashSale.shopeePeakHourEnd);
      const now = new Date();
      const diffMs = shopeeEnd.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      priority += 100 - diffHours;
    }

    // Higher discount = higher priority
    if (flashSale.discountPercentage) {
      priority += flashSale.discountPercentage * 10;
    }

    return priority;
  }

  // 🔥 Filter flash sales by category
  filterFlashSalesByCategory(
    flashSales: FlashSaleInfo[],
    category: string,
  ): FlashSaleInfo[] {
    // This would need to be combined with product data
    // For now, returning all flash sales
    return flashSales;
  }

  // 📈 Sort flash sales by priority (high to low)
  sortFlashSalesByPriority(flashSales: FlashSaleInfo[]): FlashSaleInfo[] {
    return flashSales.sort(
      (a, b) =>
        b.calculateFlashSalePriority(b) - a.calculateFlashSalePriority(a),
    );
  }

  // 🔧 Debug and testing utilities
  debugFlashSale(flashSale: FlashSaleInfo): void {
    console.log("🔥 Flash Sale Debug:", {
      productId: flashSale.productId,
      lazadaEnd: flashSale.lazadaPeakHourEnd,
      shopeeEnd: flashSale.shopeePeakHourEnd,
      currentPrice: flashSale.currentPrice,
      originalPrice: flashSale.originalPrice,
      discountPercentage: flashSale.discountPercentage,
      remainingTime: this.calculateCountdown(
        flashSale.lazadaPeakHourEnd || flashSale.shopeePeakHourEnd || undefined,
      ),
    });
  }
}

// 🌟 Singleton instance
export const flashSaleService = new FlashSaleService();
