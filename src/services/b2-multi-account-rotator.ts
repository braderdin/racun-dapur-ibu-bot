/*
 * B2 Multi-Account Storage Rotator
 * Manages multi-account image storage switching across 3 Backblaze B2 accounts
 * (9GB each, 27GB total free tier), auto-failing over when account threshold is reached
 */

import { B2StorageService, B2StorageConfig, UploadResult } from "./b2-storage";
import { logger } from "../utils/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface B2AccountConfig {
  account: number;
  bucket: string;
  keyId: string;
  applicationKey: string;
  endpoint: string;
  maxCapacityGB: number;
  usedGB: number;
  enabled: boolean;
}

export interface StorageRotationResult {
  success: boolean;
  uploadedUrl: string;
  storageKey: string;
  account: number;
  bucket: string;
  switchedAccount: boolean;
  previousAccount?: number;
  metadata: {
    originalSize: number;
    compressedSize: number;
    isWebP: boolean;
    dimensions: { width: number; height: number };
    quality: number;
  };
}

export interface StorageStats {
  accounts: Array<{
    account: number;
    bucket: string;
    usedGB: number;
    capGB: number;
    remainingGB: number;
    percentage: number;
    needsAutoSwitch: boolean;
    enabled: boolean;
  }>;
  totalUsedGB: number;
  totalCapGB: number;
  currentAccount: number;
  nextAccount: number;
}

// ---------------------------------------------------------------------------
// B2 Multi-Account Storage Rotator
// ---------------------------------------------------------------------------

export class B2MultiAccountRotator {
  private readonly storageService: B2StorageService;
  private readonly accounts: B2AccountConfig[];
  private currentAccountIndex: number;
  private readonly CAPACITY_THRESHOLD = 0.85; // 85% threshold for auto-switch
  private readonly TOTAL_CAPACITY_GB = 27; // 3 accounts x 9GB each

  constructor(accounts: B2AccountConfig[]) {
    this.accounts = accounts
      .filter((a) => a.enabled)
      .sort((a, b) => a.account - b.account);
    this.currentAccountIndex = 0;
    this.storageService = new B2StorageService(this.accounts);

    logger.info(
      "B2MultiAccountRotator initialized",
      {
        accountCount: this.accounts.length,
        totalCapacityGB: this.TOTAL_CAPACITY_GB,
      },
      "B2MultiAccountRotator",
    );
  }

  // ---------------------------------------------------------------------------
  // Get current account configuration
  // ---------------------------------------------------------------------------

  getCurrentAccount(): B2AccountConfig | null {
    if (this.accounts.length === 0) {
      return null;
    }
    return this.accounts[this.currentAccountIndex];
  }

  // ---------------------------------------------------------------------------
  // Check if account needs auto-switch
  // ---------------------------------------------------------------------------

  needsAutoSwitch(account: B2AccountConfig): boolean {
    const usagePercentage = account.usedGB / account.maxCapacityGB;
    return usagePercentage >= this.CAPACITY_THRESHOLD;
  }

  // ---------------------------------------------------------------------------
  // Switch to next available account
  // ---------------------------------------------------------------------------

  switchToNextAccount(): B2AccountConfig | null {
    const startIndex = this.currentAccountIndex;
    let attempts = 0;

    while (attempts < this.accounts.length) {
      this.currentAccountIndex =
        (this.currentAccountIndex + 1) % this.accounts.length;
      attempts++;

      const account = this.accounts[this.currentAccountIndex];
      if (account && !this.needsAutoSwitch(account)) {
        logger.info(
          "Auto-switched to B2 account",
          {
            from: this.accounts[startIndex].account,
            to: account.account,
          },
          "B2MultiAccountRotator",
        );
        return account;
      }
    }

    logger.warn(
      "No available B2 accounts with capacity",
      {
        currentAccount: this.accounts[this.currentAccountIndex]?.account,
      },
      "B2MultiAccountRotator",
    );
    return null;
  }

  // ---------------------------------------------------------------------------
  // Upload product image with auto-switch
  // ---------------------------------------------------------------------------

  async uploadProductImage(
    imageBuffer: ArrayBuffer,
    productId: string,
    options: {
      platform: "lazada" | "shopee";
      category?: string;
      originalFileName?: string;
      metadata?: Record<string, any>;
    },
  ): Promise<StorageRotationResult> {
    const startTime = Date.now();
    let currentAccount = this.getCurrentAccount();
    let switchedAccount = false;
    let previousAccount: number | undefined;

    // Check if current account needs switch
    if (currentAccount && this.needsAutoSwitch(currentAccount)) {
      previousAccount = currentAccount.account;
      currentAccount = this.switchToNextAccount();
      switchedAccount = true;
    }

    if (!currentAccount) {
      throw new Error("No B2 accounts available for upload");
    }

    try {
      // Use the storage service to upload
      const uploadResult = await this.storageService.uploadProductImage(
        imageBuffer,
        productId,
        options,
      );

      const latency = Date.now() - startTime;
      logger.info(
        "Image uploaded to B2",
        {
          productId,
          account: currentAccount.account,
          bucket: currentAccount.bucket,
          latencyMs: latency,
          switchedAccount,
        },
        "B2MultiAccountRotator",
      );

      return {
        success: true,
        uploadedUrl: uploadResult.imageUrl,
        storageKey: uploadResult.storageKey,
        account: currentAccount.account,
        bucket: currentAccount.bucket,
        switchedAccount,
        previousAccount,
        metadata: uploadResult.metadata,
      };
    } catch (error) {
      logger.error(
        "B2 upload failed",
        {
          productId,
          account: currentAccount.account,
          error,
        },
        "B2MultiAccountRotator",
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Get storage statistics
  // ---------------------------------------------------------------------------

  async getStorageStats(): Promise<StorageStats> {
    const accountStats = this.accounts.map((account) => ({
      account: account.account,
      bucket: account.bucket,
      usedGB: account.usedGB,
      capGB: account.maxCapacityGB,
      remainingGB: Math.max(0, account.maxCapacityGB - account.usedGB),
      percentage: (account.usedGB / account.maxCapacityGB) * 100,
      needsAutoSwitch: this.needsAutoSwitch(account),
      enabled: account.enabled,
    }));

    const totalUsedGB = accountStats.reduce(
      (sum, stat) => sum + stat.usedGB,
      0,
    );
    const nextAccount = this.getNextAvailableAccount();

    return {
      accounts: accountStats,
      totalUsedGB,
      totalCapGB: this.TOTAL_CAPACITY_GB,
      currentAccount: this.accounts[this.currentAccountIndex]?.account || 0,
      nextAccount,
    };
  }

  // ---------------------------------------------------------------------------
  // Get next available account (for load balancing)
  // ---------------------------------------------------------------------------

  getNextAvailableAccount(): number {
    if (this.accounts.length === 0) {
      return 0;
    }

    let nextIndex = (this.currentAccountIndex + 1) % this.accounts.length;
    let attempts = 0;

    while (attempts < this.accounts.length) {
      const account = this.accounts[nextIndex];
      if (account && !this.needsAutoSwitch(account)) {
        return account.account;
      }
      nextIndex = (nextIndex + 1) % this.accounts.length;
      attempts++;
    }

    // Return current account if all are full
    return this.accounts[this.currentAccountIndex]?.account || 0;
  }

  // ---------------------------------------------------------------------------
  // Health check
  // ---------------------------------------------------------------------------

  async healthCheck(): Promise<{
    status: "healthy" | "degraded" | "unhealthy";
    accounts: number;
    currentAccount: number;
    totalCapacityGB: number;
    usedCapacityGB: number;
    timestamp: string;
  }> {
    const stats = await this.getStorageStats();
    const usagePercentage = (stats.totalUsedGB / stats.totalCapGB) * 100;

    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (usagePercentage >= 95) {
      status = "unhealthy";
    } else if (usagePercentage >= 80) {
      status = "degraded";
    }

    return {
      status,
      accounts: stats.accounts.length,
      currentAccount: stats.currentAccount,
      totalCapacityGB: stats.totalCapGB,
      usedCapacityGB: stats.totalUsedGB,
      timestamp: new Date().toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Reset to first available account
  // ---------------------------------------------------------------------------

  resetToFirstAccount(): void {
    this.currentAccountIndex = 0;
    logger.info(
      "Reset B2 account index to first account",
      {},
      "B2MultiAccountRotator",
    );
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let rotatorInstance: B2MultiAccountRotator | null = null;

export function getB2Rotator(
  accounts: B2AccountConfig[],
): B2MultiAccountRotator {
  if (!rotatorInstance) {
    rotatorInstance = new B2MultiAccountRotator(accounts);
  }
  return rotatorInstance;
}
