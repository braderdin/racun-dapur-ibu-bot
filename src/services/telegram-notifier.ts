/**
 * TELEGRAM AUDIT & QA NOTIFIER SERVICE (@RacunDapurIbu)
 * File: src/services/telegram-notifier.ts
 * Description: Sends real-time visual audit alerts to Telegram for manual review.
 */

export interface TelegramAuditPayload {
  productTitle: string;
  price: string;
  discount: string;
  platform: "Shopee" | "Lazada";
  imageUrl: string;
  shortlinkUrl: string;
  twitterCopy: string;
  facebookCopy: string;
  twitterPostUrl?: string;
  facebookPostUrl?: string;
}

export class TelegramNotifierService {
  private botToken: string;
  private chatId: string;

  constructor(botToken: string, chatId: string) {
    this.botToken = botToken;
    this.chatId = chatId;
  }

  /**
   * Hantar laporan visual beserta gambar produk ke Telegram Chip Besar
   */
  async sendAuditReport(payload: TelegramAuditPayload): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.warn(
        "⚠️ Telegram credentials missing. Skipping Telegram audit alert.",
      );
      return false;
    }

    const caption = `
🚨 <b>[NEW POST AUDIT REPORT]</b> 🚨
--------------------------------------------------
📌 <b>Produk:</b> ${payload.productTitle}
💰 <b>Harga:</b> ${payload.price} (${payload.discount} OFF)
🛒 <b>Platform:</b> ${payload.platform}

--------------------------------------------------
📲 <b>1. SALURAN X (TWITTER):</b>
<b>Teks Tweet:</b>
<i>"${this.escapeHtml(payload.twitterCopy)}"</i>
🔗 <b>Live Tweet:</b> ${payload.twitterPostUrl || "N/A"}

--------------------------------------------------
📘 <b>2. SALURAN FACEBOOK PAGE:</b>
<b>Teks FB Post:</b>
<i>"${this.escapeHtml(payload.facebookCopy)}"</i>
🔗 <b>Live FB Post:</b> ${payload.facebookPostUrl || "N/A"}

--------------------------------------------------
🔗 <b>AFFILIATE SHORTLINK:</b>
<code>${payload.shortlinkUrl}</code>

💡 <i>Petua Chip Besar: Jika ada ralat pada gambar/link/ayat, sila klik link Live Post di atas untuk delete manual!</i>
    `.trim();

    try {
      // Menggunakan Telegram sendPhoto API
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            photo: payload.imageUrl,
            caption: caption,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
        },
      );

      const result = (await response.json()) as {
        ok: boolean;
        description?: string;
      };

      if (!result.ok) {
        // Fallback ke sendMessage jika sendPhoto gagal (contoh: URL gambar bermasalah)
        console.warn(
          `⚠️ Telegram sendPhoto failed (${result.description}). Fallback to sendMessage...`,
        );
        return await this.sendTextMessage(caption);
      }

      console.log("✅ Telegram audit notification sent successfully!");
      return true;
    } catch (error) {
      console.error("❌ Error sending Telegram audit notification:", error);
      return false;
    }
  }

  /**
   * Send a text message to Telegram
   */
  async sendTextMessage(text: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            text: text,
            parse_mode: "HTML",
          }),
        },
      );

      const result = (await response.json()) as { ok: boolean };
      return result.ok;
    } catch {
      return false;
    }
  }

  /**
   * Send a photo to Telegram
   */
  async sendPhoto(photoUrl: string, caption?: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendPhoto`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            photo: photoUrl,
            caption: caption,
            parse_mode: "HTML",
          }),
        },
      );

      const result = (await response.json()) as { ok: boolean };
      return result.ok;
    } catch {
      return false;
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
