import { Env } from "../types/env";
import { OpenRouterService } from "../services/openrouter";

export class AIPersonaCommentEngine {
  private openRouter: OpenRouterService;
  private env: Env;
  private persona: string;

  constructor(env: Env) {
    this.env = env;
    this.openRouter = new OpenRouterService();
    this.persona = this.buildPersona();
  }

  /**
   * Generate natural, engaging Malaysian affiliate CTA copy for reply comments
   * @param productTitle - Product title from Lazada
   * @param affiliateLink - Cloaked affiliate link
   * @param context - Context information (optional)
   * @returns Engaging comment text in Bahasa Malaysia
   */
  async generateComment(
    productTitle: string,
    affiliateLink: string,
    context?: string,
  ): Promise<string> {
    try {
      if (!productTitle || !affiliateLink) {
        throw new Error("Missing required parameters for comment generation");
      }

      // Build prompt with persona instructions
      const prompt = this.buildPrompt(productTitle, affiliateLink, context);

      // Generate comment using OpenRouter AI
      const product = {
        id: "comment_generation",
        name: productTitle,
        description: prompt,
        price: 0,
        category: "comment",
        rating: 5,
        platform: "lazada",
      };

      const result = await this.openRouter.generateCopy(product);
      const comment = result.hook + " " + result.body.join(" ") + " " + result.cta;

      if (!comment) {
        throw new Error("Failed to generate comment");
      }

      // Clean and validate the generated comment
      const cleanedComment = this.cleanComment(comment);

      console.log(
        `Generated comment for product: ${productTitle.substring(0, 30)}...`,
      );
      return cleanedComment;
    } catch (error) {
      console.error("Error generating comment:", error);
      // Return fallback comment
      return this.getFallbackComment(productTitle, affiliateLink);
    }
  }

  /**
   * Generate multiple comments for different scenarios
   * @param productTitle - Product title
   * @param affiliateLink - Affiliate link
   * @param count - Number of comments to generate
   * @returns Array of comments
   */
  async generateMultipleComments(
    productTitle: string,
    affiliateLink: string,
    count: number = 3,
  ): Promise<string[]> {
    try {
      const comments: string[] = [];

      // Generate comments with different tones
      const tones = ["enthusiastic", "professional", "casual", "urgent"];

      for (let i = 0; i < Math.min(count, tones.length); i++) {
        const context = tones[i];
        const comment = await this.generateComment(
          productTitle,
          affiliateLink,
          context,
        );
        comments.push(comment);

        // Add small delay between generations
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      return comments;
    } catch (error) {
      console.error("Error generating multiple comments:", error);
      return [this.getFallbackComment(productTitle, affiliateLink)];
    }
  }

  /**
   * Build persona-based prompt for AI generation
   * @param productTitle - Product title
   * @param affiliateLink - Affiliate link
   * @param context - Context information
   * @returns Complete prompt for AI
   */
  private buildPrompt(
    productTitle: string,
    affiliateLink: string,
    context?: string,
  ): string {
    const basePrompt = `
Kamu adalah AI asisten yang menulis komen balas Twitter yang hangat dan sesuai budaya untuk "Racun Dapur Ibu" - seorang ibu Malaysia yang ramah dan suka berkongsi penemuan hebat untuk rumah tangga dan barangan ibu & bayi.

PROFIL PENGGUNA:
- Nama: Cikgu Fatimah (rakyat Malaysia)
- Umur: 35
- Pekerjaan: Bekas guru, kini suri rumah
- Kepribadian: Hangat, boleh dipercayai, suka membantu, sedikit konservatif tetapi terbuka kepada produk baru yang berguna
- Nilai: Keluarga, penjimatan, kualiti, produk yang boleh dipercayai
- Bahasa: Bahasa Malaysia standard (tidak menggunakan bahasa slang atau singkatan)

TUGAS: Tulis komen balas Twitter yang SEMESTIYA untuk produk ini:

PRODUK: ${productTitle}
PAUTAN AFFILIATE: ${affiliateLink}

KEPERLUAN KANDUNGAN:
1. Mulakan dengan sapaan yang hangat (contoh: "Hai semua!", "Salam sejahtera!", "Hai rakan-rakan!")
2. Nyatakan perasaan kagum atau kelulusan yang tulus tentang produk (contoh: "Saya sangat suka produk ini", "Penemuan yang sangat baik!")
3. Sertakan CTA yang ringkas dan jelas (contoh: "Bolehpilih nak grab promo Lazada kat link ni tau! 👇", "Rekomen sangat-sangat!")
4. Sertakan pautan affiliate (pastikan ia pendek dan mudah dibaca)
5. Tambah emoji yang sesuai (contoh: 👇, ✨, ❤️, 👍)
6. Panjang: 20-40 perkataan
7. Nada: Ramah, tulus, tidak terlalu komersial
8. Pastikan tatabahasa dan ejaan Bahasa Malaysia yang betul

Konteks tambahan (jika ada): ${context || ""}

KUCI KUNCI PENULISAN:
- Gunakan "kat link ni" bukan "di link ni"
- Gunakan "nak" bukan "ingin"
- Gunakan "sangat-sangat" bukan "sangat"
- Sertakan emoji yang sesuai di akhir
- Jangan gunakan singkatan atau emoji yang tidak standard
- Pastikan ia terdengar seperti manusia, bukan AI

JAWAPAN (hanya komen balas Twitter):`;

    return basePrompt;
  }

  /**
   * Build persona description
   * @returns Persona description
   */
  private buildPersona(): string {
    return `Racun Dapur Ibu - AI Assistant for Malaysian Affiliate Marketing

Tentang: AI yang menulis komen balas Twitter yang hangat dan sesuai budaya untuk komuniti Malaysia.

Ciri-ciri Utama:
- Bahasa: Bahasa Malaysia standard, nada hangat dan boleh dipercayai
- Sasaran: Cikgu Fatimah (bekas guru, suri rumah, 35 tahun)
- Nada: Ramah, tulus, sedikit konservatif tetapi terbuka kepada produk berguna
- Fokus: Keluarga, penjimatan, kualiti, produk yang boleh dipercayai
- Emoji: Emoji yang sesuai dan standard sahaja
- CTA: Ringkas, jelas, menggunakan bahasa sehari-hari Malaysia

Prinsip Penulisan:
1. Mulakan dengan sapaan yang hangat
2. Nyatakan kelulusan yang tulus tentang produk
3. CTA yang ringkas dan jelas
4. Sertakan pautan affiliate
5. Tambah emoji yang sesuai
6. Panjang 20-40 perkataan
7. Nada: Ramah, tulus, tidak terlalu komersial
8. Tatabahasa dan ejaan Bahasa Malaysia yang betul`;
  }

  /**
   * Clean and validate generated comment
   * @param comment - Raw generated comment
   * @returns Cleaned comment
   */
  private cleanComment(comment: string): string {
    if (!comment) return "";

    // Remove any leading/trailing whitespace
    let cleaned = comment.trim();

    // Ensure it starts with a greeting
    if (!cleaned.match(/^(Hai|Salam|Hello|Hai semua|Salam sejahtera)/)) {
      cleaned = `Hai semua! ${cleaned}`;
    }

    // Ensure it ends with an emoji
    if (!cleaned.match(/[^\w\s]$/)) {
      cleaned += " 👇";
    }

    // Ensure it contains the affiliate link
    if (!cleaned.includes("http")) {
      cleaned += " \n\n${affiliateLink}";
    }

    // Limit length to 280 characters (Twitter limit)
    if (cleaned.length > 280) {
      cleaned = cleaned.substring(0, 277) + "...";
    }

    return cleaned;
  }

  /**
   * Get fallback comment when AI generation fails
   * @param productTitle - Product title
   * @param affiliateLink - Affiliate link
   * @returns Fallback comment
   */
  private getFallbackComment(
    productTitle: string,
    affiliateLink: string,
  ): string {
    const templates = [
      `Hai semua! Saya sangat suka ${productTitle.substring(0, 30)}... Rekomen sangat-sangat! Bolehpilih nak grab promo Lazada kat link ni tau! 👇\n\n${affiliateLink}`,
      `Salam sejahtera! Penemuan yang sangat baik! Sangat berguna untuk dapur. Bolehpilih nak grab promo Lazada kat link ni tau! 👇\n\n${affiliateLink}`,
      `Hai rakan-rakan! Saya sangat kagum dengan ${productTitle.substring(0, 30)}... Sangat recommend! Bolehpilih nak grab promo Lazada kat link ni tau! 👇\n\n${affiliateLink}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Validate comment quality
   * @param comment - Comment to validate
   * @returns Validation result
   */
  private validateComment(comment: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!comment) {
      issues.push("Comment is empty");
      return { isValid: false, issues };
    }

    if (comment.length > 280) {
      issues.push("Comment exceeds Twitter character limit");
    }

    if (!comment.includes("http")) {
      issues.push("Comment missing affiliate link");
    }

    if (!comment.match(/[^\w\s]$/)) {
      issues.push("Comment should end with emoji");
    }

    // Check for inappropriate content
    const inappropriateWords = ["badj", "haram", "porno"];
    for (const word of inappropriateWords) {
      if (comment.toLowerCase().includes(word)) {
        issues.push(`Comment contains inappropriate word: ${word}`);
      }
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Get persona statistics
   * @returns Persona statistics
   */
  getPersonaStats(): any {
    return {
      persona: this.persona,
      targetAudience: "Cikgu Fatimah (bekas guru, suri rumah, 35 tahun)",
      language: "Bahasa Malaysia",
      tone: "Hangat, boleh dipercayai, sedikit konservatif",
      focus: "Keluarga, penjimatan, kualiti, produk yang boleh dipercayai",
      maxLength: 280,
      emojiPolicy: "Emoji yang sesuai dan standard sahaja",
    };
  }
}
