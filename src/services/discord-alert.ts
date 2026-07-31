/*
 * Discord Webhook Alert Service
 * Phase 7: Production Hardening — System Alerting for Chip Besar's #bot-logs channel
 * Dispatches real-time warnings, daily summaries, and degradation alerts with color-coded severity.
 * Uses environment variable bindings exclusively — no hardcoded secrets.
 */

import { Env } from "../types/env";
import { logger } from "../utils/logger";

// Severity color codes for Discord embeds (decimal integers)
const SEVERITY_COLORS = {
  info: 3066993, // Green
  warning: 16776960, // Yellow
  error: 15158332, // Red
  critical: 10181046, // Purple
} as const;

export interface DailySummary {
  date: string;
  totalPosts: number;
  successfulPosts: number;
  failedPosts: number;
  totalClicks: number;
  topProduct: string;
  platformBreakdown: {
    twitter: number;
    facebook: number;
  };
  errors: string[];
}

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline: boolean;
  }>;
  footer: {
    text: string;
    timestamp: string;
  };
}

export interface AlertDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class DiscordAlertService {
  private webhookUrl: string;
  private channel: string;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.webhookUrl = env.DISCORD_WEBHOOK_URL || "";
    this.channel = "#bot-logs";

    if (!this.webhookUrl) {
      logger.warn(
        "DISCORD_WEBHOOK_URL not configured — alerts will be logged but not dispatched",
        {},
        "DiscordAlertService",
      );
    }
  }

  /**
   * Send a system warning alert (yellow embed)
   */
  async sendSystemWarning(message: string): Promise<AlertDispatchResult> {
    return this.dispatchAlert("warning", "System Warning", message, {
      source: "discord-alert",
    });
  }

  /**
   * Send a daily posting summary (green embed)
   */
  async sendDailySummary(summary: DailySummary): Promise<AlertDispatchResult> {
    const fields = [
      {
        name: "Total Posts",
        value: `${summary.totalPosts}`,
        inline: true,
      },
      {
        name: "Successful",
        value: `${summary.successfulPosts}`,
        inline: true,
      },
      {
        name: "Failed",
        value: `${summary.failedPosts}`,
        inline: true,
      },
      {
        name: "Total Clicks",
        value: `${summary.totalClicks}`,
        inline: true,
      },
      {
        name: "Top Product",
        value: summary.topProduct,
        inline: true,
      },
      {
        name: "Platform Breakdown",
        value: `X/Twitter: ${summary.platformBreakdown.twitter}\nFacebook: ${summary.platformBreakdown.facebook}`,
        inline: true,
      },
    ];

    if (summary.errors.length > 0) {
      fields.push({
        name: "Errors",
        value: summary.errors.join("\n"),
        inline: false,
      });
    }

    return this.dispatchAlert(
      "info",
      "Daily Posting Summary",
      `📊 Summary for ${summary.date}`,
      fields,
    );
  }

  /**
   * Send a service degradation alert (red embed)
   */
  async sendServiceDegradation(
    service: string,
    error: string,
  ): Promise<AlertDispatchResult> {
    return this.dispatchAlert(
      "error",
      "Service Degradation",
      `⚠️ ${service} is degraded`,
      [
        {
          name: "Service",
          value: service,
          inline: true,
        },
        {
          name: "Error",
          value: error,
          inline: false,
        },
        {
          name: "Auto Recovery",
          value: "Attempting automatic recovery...",
          inline: true,
        },
      ],
    );
  }

  /**
   * Send a critical alert (purple embed)
   */
  async sendCriticalAlert(
    service: string,
    error: string,
  ): Promise<AlertDispatchResult> {
    return this.dispatchAlert(
      "critical",
      "Critical Alert",
      `🚨 ${service} — CRITICAL`,
      [
        {
          name: "Service",
          value: service,
          inline: true,
        },
        {
          name: "Error",
          value: error,
          inline: false,
        },
        {
          name: "Action Required",
          value: "Immediate attention needed from Chip Besar",
          inline: true,
        },
      ],
    );
  }

  /**
   * Core dispatch method — builds embed and sends via webhook
   */
  private async dispatchAlert(
    severity: "info" | "warning" | "error" | "critical",
    title: string,
    description: string,
    extraFields: Array<{ name: string; value: string; inline: boolean }> = [],
  ): Promise<AlertDispatchResult> {
    const startTime = Date.now();

    try {
      if (!this.webhookUrl) {
        logger.warn(
          "Discord webhook URL not configured — logging alert locally",
          { severity, title },
          "DiscordAlertService",
        );
        return { success: false, error: "Webhook URL not configured" };
      }

      const embed: DiscordEmbed = {
        title,
        description,
        color: SEVERITY_COLORS[severity],
        fields: [
          {
            name: "Severity",
            value: severity.toUpperCase(),
            inline: true,
          },
          {
            name: "Service",
            value: "racun-dapur-ibu-bot",
            inline: true,
          },
          ...extraFields,
        ],
        footer: {
          text: `@RacunDapurIbu Bot Monitoring`,
          timestamp: new Date().toISOString(),
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:
            severity === "critical"
              ? `🚨 <@ChipBesar> — Critical Alert: ${title}`
              : undefined,
          embeds: [embed],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Discord API returned ${response.status}: ${errorText}`,
        );
      }

      const elapsed = Date.now() - startTime;
      logger.info(
        `Discord alert dispatched successfully`,
        { severity, title, responseTimeMs: elapsed },
        "DiscordAlertService",
      );

      return { success: true };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(
        `Failed to dispatch Discord alert`,
        { severity, title, error: errorMessage, responseTimeMs: elapsed },
        "DiscordAlertService",
      );

      return { success: false, error: errorMessage };
    }
  }
}

export default DiscordAlertService;
