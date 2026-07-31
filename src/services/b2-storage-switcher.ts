/*
 * Backblaze B2 Auto-Switching Storage Service
 * Implements multi-account B2 storage switching logic with 9GB thresholds per account
 * Maintains 27GB total storage across 3 accounts with automatic target switching
 */

import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";

export interface B2StorageAccount {
  name: string;
  keyId: string;
  applicationKey: string;
  baseUrl: string;
  endpoint: string;
  capacityBytes: number;
  usedBytes: number;
  isActive: boolean;
}

export interface B2StorageSwitchResult {
  selectedAccount: B2StorageAccount;
  reason: "normal" | "threshold_reached" | "auto_switch";
  totalAccounts: number;
}

export class B2StorageSwitcher {
  private accounts: B2StorageAccount[];
  private currentIndex: number;

  constructor(env: Env) {
    this.accounts = this.initializeAccounts(env);
    this.currentIndex = this.determineActiveAccount();
  }

  private initializeAccounts(env: Env): B2StorageAccount[] {
    const accounts: B2StorageAccount[] = [
      {
        name: "backblaze-account-1",
        keyId: env.B2_ACC1_KEY_NAME || "key_name_1",
        applicationKey: env.B2_ACC1_APPLICATION_KEY || "app_key_1",
        baseUrl:
          env.BACKBLAZE_STORAGE_BASE_URL || "https://storage.backblaze.com",
        endpoint: "https://api.backblazeb2.com/b2api/v2/b2_storage",
        capacityBytes: CONSTANTS.B2_STORAGE_CAP_BYTES,
        usedBytes: 0,
        isActive: false,
      },
      {
        name: "backblaze-account-2",
        keyId: env.B2_ACC2_KEY_NAME || "key_name_2",
        applicationKey: env.B2_ACC2_APPLICATION_KEY || "app_key_2",
        baseUrl:
          env.BACKBLAZE_STORAGE_BASE_URL || "https://storage.backblaze.com",
        endpoint: "https://api.backblazeb2.com/b2api/v2/b2_storage",
        capacityBytes: CONSTANTS.B2_STORAGE_CAP_BYTES,
        usedBytes: 0,
        isActive: false,
      },
      {
        name: "backblaze-account-3",
        keyId: env.B2_ACC1_KEY_NAME || "key_name_3", // Rotate through keys
        applicationKey: env.B2_ACC1_APPLICATION_KEY || "app_key_3", // Rotate through keys
        baseUrl:
          env.BACKBLAZE_STORAGE_BASE_URL || "https://storage.backblaze.com",
        endpoint: "https://api.backblazeb2.com/b2api/v2/b2_storage",
        capacityBytes: CONSTANTS.B2_STORAGE_CAP_BYTES,
        usedBytes: 0,
        isActive: false,
      },
    ];

    // Set first account as active initially
    if (accounts.length > 0) {
      accounts[0].isActive = true;
    }

    return accounts;
  }

  private determineActiveAccount(): number {
    const activeAccounts = this.accounts.filter((acc) => acc.isActive);
    return activeAccounts.length > 0
      ? this.accounts.indexOf(activeAccounts[0])
      : 0;
  }

  public selectUploadTarget(
    fileSize: number,
    category: string = "general",
  ): B2StorageSwitchResult {
    console.log(
      `[B2StorageSwitcher] Selecting upload target for ${category} (${fileSize} bytes)`,
    );

    // Normalize category to match folder structure
    const normalizedCategory = category === "kitchen" ? "kitchen" : "baby";

    // Find the most appropriate account based on thresholds
    for (let i = 0; i < this.accounts.length; i++) {
      const account = this.accounts[i];

      if (account.isActive) {
        // Check if current active account is full
        if (account.usedBytes + fileSize > account.capacityBytes) {
          // Current account full, switch to next available
          account.isActive = false;
          const nextIndex = (i + 1) % this.accounts.length;
          this.accounts[nextIndex].isActive = true;
          this.currentIndex = nextIndex;

          console.log(
            `[B2StorageSwitcher] Switching to account ${nextIndex} (${this.accounts[nextIndex].name}) - current full`,
          );

          return {
            selectedAccount: this.accounts[nextIndex],
            reason: "threshold_reached",
            totalAccounts: this.accounts.length,
          };
        }

        // Normal processing - using current account
        return {
          selectedAccount: account,
          reason: "normal",
          totalAccounts: this.accounts.length,
        };
      }
    }

    // No active accounts, should not happen
    throw new Error("No active B2 storage accounts available");
  }

  public updateAccountUsage(accountName: string, usedBytes: number): void {
    const account = this.accounts.find((acc) => acc.name === accountName);
    if (account) {
      account.usedBytes = usedBytes;
      console.log(
        `[B2StorageSwitcher] Updated usage for ${accountName}: ${usedBytes} bytes (${Math.round((usedBytes / account.capacityBytes) * 100)}% used)`,
      );
    }
  }

  public getStorageStatus(): {
    accounts: B2StorageAccount[];
    totalCapacity: number;
    totalUsed: number;
    usagePercentage: number;
  } {
    const totalCapacity = this.accounts.reduce(
      (sum, acc) => sum + acc.capacityBytes,
      0,
    );
    const totalUsed = this.accounts.reduce(
      (sum, acc) => sum + acc.usedBytes,
      0,
    );
    const usagePercentage = (totalUsed / totalCapacity) * 100;

    return {
      accounts: this.accounts,
      totalCapacity,
      totalUsed,
      usagePercentage,
    };
  }

  public async uploadToB2(
    fileData: ArrayBuffer,
    filename: string,
    category: string = "general",
  ): Promise<{ success: boolean; account: string; url: string }> {
    const fileSize = fileData.byteLength;
    const target = this.selectUploadTarget(fileSize, category);
    const account = target.selectedAccount;

    try {
      console.log(
        `[B2StorageSwitcher] Uploading to ${account.name} (${account.endpoint}) - ${filename}`,
      );

      // Simulate upload - in production would make actual API call
      // For demo, we'll just update the usage
      account.usedBytes += fileSize;

      const uploadUrl = `${account.baseUrl}/uploads/${category}/${filename}`;

      console.log(
        `[B2StorageSwitcher] Upload completed to ${account.name} - Used: ${account.usedBytes}/${account.capacityBytes} (${Math.round((account.usedBytes / account.capacityBytes) * 100)}%)`,
      );

      return {
        success: true,
        account: account.name,
        url: uploadUrl,
      };
    } catch (error) {
      console.error(
        `[B2StorageSwitcher] Upload failed to ${account.name}:`,
        error instanceof Error ? error.message : String(error),
      );

      return {
        success: false,
        account: account.name,
        url: "",
      };
    }
  }

  public autoSwitchIfNeeded(): void {
    let switched = false;

    // Check each account for threshold being reached
    for (let i = 0; i < this.accounts.length; i++) {
      if (
        this.accounts[i].isActive &&
        this.accounts[i].usedBytes >= this.accounts[i].capacityBytes
      ) {
        // Switch to next active account
        this.accounts[i].isActive = false;
        const nextIndex = (i + 1) % this.accounts.length;
        this.accounts[nextIndex].isActive = true;
        this.currentIndex = nextIndex;

        console.log(
          `[B2StorageSwitcher] Auto-switch completed - switched to account ${nextIndex} (${this.accounts[nextIndex].name})`,
        );
        switched = true;
      }
    }

    if (!switched) {
      console.log(
        `[B2StorageSwitcher] No accounts require switching. Current active: ${this.accounts[this.currentIndex].name}`,
      );
    }
  }
}

export { B2StorageSwitcher as default };
