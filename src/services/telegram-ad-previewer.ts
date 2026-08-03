/*
 * Telegram Visual Ad Previewer Service
 * Sends visual mockup previews showing exact social media (X & FB) and Vercel portal card layouts
 * to Telegram before publishing.
 */

import { Env } from "../types/env";
import { TelegramNotifierService } from "./telegram-notifier";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LazadaDeal {
  id: string;
  title: string;
  originalPrice: number;
  discountPrice: number;
  discountPercent: number;
  endTime: Date;
  imageUrls: string[];
  affiliateLink: string;
  rating: number;
  stock: number;
  category: string;
}

export interface AdPreview {
  deal: LazadaDeal;
  twitterPreview: {
    tweet1: string;
    tweet2: string;
    imageUrl: string;
  };
  facebookPreview: {
    postText: string;
    imageUrl: string;
    commentText: string;
  };
  webPreview: {
    title: string;
    price: string;
    discount: string;
    imageUrl: string;
  };
}

export interface PreviewOptions {
  includeImages: boolean;
  includeLinks: boolean;
  platform: "all" | "twitter" | "facebook" | "web";
  sendToTelegram: boolean;
}

export interface PreviewResult {
  success: boolean;
  previewId: string;
  platforms: string[];
  telegramSent: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// Telegram Visual Ad Previewer Service
// ---------------------------------------------------------------------------

export class TelegramAdPreviewer {
  private telegram: TelegramNotifierService;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.telegram = new TelegramNotifierService(
      env.TELEGRAM_BOT_TOKEN || "",
      env.TELEGRAM_CHAT_ID || "",
    );
  }

  // ---------------------------------------------------------------------------
  // Generate preview for a deal
  // ---------------------------------------------------------------------------

  async generatePreview(
    deal: LazadaDeal,
    options: Partial<PreviewOptions> = {},
  ): Promise<AdPreview> {
    const defaultOptions: PreviewOptions = {
      includeImages: true,
      includeLinks: true,
      platform: "all",
      sendToTelegram: false,
    };

    const opts: PreviewOptions = { ...defaultOptions, ...options };

    const preview: AdPreview = {
      deal,
      twitterPreview: this.generateTwitterPreview(deal, opts),
      facebookPreview: this.generateFacebookPreview(deal, opts),
      webPreview: this.generateWebPreview(deal, opts),
    };

    return preview;
  }

  // ---------------------------------------------------------------------------
  // Generate Twitter preview
  // ---------------------------------------------------------------------------

  private generateTwitterPreview(
    deal: LazadaDeal,
    options: PreviewOptions,
  ): AdPreview["twitterPreview"] {
    const discountText =
      deal.discountPercent > 0 ? `DISKON ${deal.discountPercent}%` : "SALE";
    const timeLeft = this.formatTimeLeft(deal.endTime);

    const tweet1 = `🔥 ${deal.title}

${discountText} hanya ${deal.discountPrice} ( dari RM ${deal.originalPrice} )

⏰ Sale berakhir dalam: ${timeLeft}

#RacunDapurIbu #DiskuanHarian`;

    const tweet2 = `🛒 Klik untuk beli: ${deal.affiliateLink}

💡 Tips: Produk ini sedang dalam keadaan stok terhad!

#Affiliate #BelanjaOnline #Diskuan`;

    return {
      tweet1,
      tweet2,
      imageUrl: deal.imageUrls[0] || "",
    };
  }

  // ---------------------------------------------------------------------------
  // Generate Facebook preview
  // ---------------------------------------------------------------------------

  private generateFacebookPreview(
    deal: LazadaDeal,
    options: PreviewOptions,
  ): AdPreview["facebookPreview"] {
    const discountText =
      deal.discountPercent > 0 ? `diskaun ${deal.discountPercent}%` : "sale";
    const timeLeft = this.formatTimeLeft(deal.endTime);

    const postText = `👩‍🍳 Bot Racun Dapur Ibu di sini untuk kami!

Sudah tentu anda mencari produk dapur yang berkualiti dengan harga mesra. Hari ni, kami jumpa ${deal.title} dengan ${discountText} yang sangat menarik!

💰 Harga diskaun: RM ${deal.discountPrice}
📅 Masa berakhir: ${timeLeft}
⭐ Rating: ${deal.rating}/5 (${deal.stock} tersedia)

💡 Klik link di komen untuk beli dengan pautan affiliate yang kami sediakan.

#RacunDapurIbu #DiskuanDapur #BelanjaOnline #${deal.category}`;

    const commentText = `🔗 Pautan beli: ${deal.affiliateLink}

💰 Harga: RM ${deal.discountPrice} (diskaun ${deal.discountPercent}%)
⏰ Tawaran ini berakhir dalam: ${timeLeft}

Klik pautan untuk dapatkan produk dengan harga termurah!`;

    return {
      postText,
      imageUrl: deal.imageUrls[0] || "",
      commentText,
    };
  }

  // ---------------------------------------------------------------------------
  // Generate Web preview
  // ---------------------------------------------------------------------------

  private generateWebPreview(
    deal: LazadaDeal,
    options: PreviewOptions,
  ): AdPreview["webPreview"] {
    const discountText =
      deal.discountPercent > 0 ? `-${deal.discountPercent}%` : "SALE";

    return {
      title: deal.title,
      price: `RM ${deal.discountPrice}`,
      discount: discountText,
      imageUrl: deal.imageUrls[0] || "",
    };
  }

  // ---------------------------------------------------------------------------
  // Send preview to Telegram
  // ---------------------------------------------------------------------------

  async sendPreviewToTelegram(
    preview: AdPreview,
    options: Partial<PreviewOptions> = {},
  ): Promise<boolean> {
    try {
      const botToken = this.env.TELEGRAM_BOT_TOKEN || "";
      const chatId = this.env.TELEGRAM_CHAT_ID || "";

      if (!botToken || !chatId) {
        console.warn("Telegram credentials missing. Cannot send preview.");
        return false;
      }

      const message = this.formatPreviewMessage(preview, options);

      await this.telegram.sendTextMessage(message);

      // Send image if available
      if (options.includeImages && preview.deal.imageUrls[0]) {
        await this.telegram.sendPhoto(preview.deal.imageUrls[0], message);
      }

      return true;
    } catch (error) {
      console.error("Error sending preview to Telegram:", error);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Format preview message for Telegram
  // ---------------------------------------------------------------------------

  private formatPreviewMessage(
    preview: AdPreview,
    options: Partial<PreviewOptions>,
  ): string {
    let message = `🖼️ <b>AD PREVIEW - @RacunDapurIbu</b>

`;

    if (options.platform === "all" || options.platform === "twitter") {
      message += `📱 <b>SALURAN X (TWITTER):</b>\n`;
      message += `<i>"${this.escapeHtml(preview.twitterPreview.tweet1.substring(0, 200))}..."</i>\n`;
      message += `📄 Tweet 2: ${this.escapeHtml(preview.twitterPreview.tweet2.substring(0, 150))}\n`;
      message += `🔗 Link: ${preview.twitterPreview.imageUrl ? "✅ HD Image Ready" : "❌ No Image"}\n\n`;
    }

    if (options.platform === "all" || options.platform === "facebook") {
      message += `📘 <b>SALURAN FACEBOOK:</b>\n`;
      message += `<i>"${this.escapeHtml(preview.facebookPreview.postText.substring(0, 200))}..."</i>\n`;
      message += `💬 Komen: ${this.escapeHtml(preview.facebookPreview.commentText.substring(0, 150))}\n`;
      message += `🔗 Link: ${preview.facebookPreview.imageUrl ? "✅ HD Image Ready" : "❌ No Image"}\n\n`;
    }

    if (options.platform === "all" || options.platform === "web") {
      message += `🌐 <b>VERCEL WEB PORTAL:</b>\n`;
      message += `🏷️ ${this.escapeHtml(preview.webPreview.title)}\n`;
      message += `💰 ${this.escapeHtml(preview.webPreview.price)}\n`;
      message += `🏷️ ${this.escapeHtml(preview.webPreview.discount)}\n`;
    }

    message += `\n<i>Preview ID: ${Date.now()}</i>`;

    return message;
  }

  // ---------------------------------------------------------------------------
  // Send complete preview with all platforms
  // ---------------------------------------------------------------------------

  async sendCompletePreview(deal: LazadaDeal): Promise<PreviewResult> {
    const previewId = `preview_${Date.now()}`;
    const platforms: string[] = [];

    try {
      // Generate preview
      const preview = await this.generatePreview(deal);

      // Send to Telegram
      const telegramSent = await this.sendPreviewToTelegram(preview);

      if (telegramSent) {
        platforms.push("telegram");
      }

      return {
        success: true,
        previewId,
        platforms,
        telegramSent,
      };
    } catch (error) {
      return {
        success: false,
        previewId,
        platforms,
        telegramSent: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: Format time left
  // ---------------------------------------------------------------------------

  private formatTimeLeft(endTime: Date): string {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return "Tamat";
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // ---------------------------------------------------------------------------
  // Helper: Escape HTML
  // ---------------------------------------------------------------------------

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let previewerInstance: TelegramAdPreviewer | null = null;

export function getTelegramAdPreviewer(env: Env): TelegramAdPreviewer {
  if (!previewerInstance) {
    previewerInstance = new TelegramAdPreviewer(env);
  }
  return previewerInstance;
}
