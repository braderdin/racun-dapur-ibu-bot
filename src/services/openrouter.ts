import { Env, ProductItem, GeneratedCopy } from "../types/env";
import { CONSTANTS } from "../config/constants";

export class OpenRouterAIService {
  private apiKey: string;

  constructor(env: Env) {
    this.apiKey = env.OPENROUTER_API_KEY;
  }

  async generateCopywriting(product: ProductItem): Promise<GeneratedCopy> {
    await new Promise((resolve) =>
      setTimeout(resolve, CONSTANTS.OPENROUTER_DELAY_MS),
    );

    const prompt = `
Anda ialah AI Copywriter untuk akaun X (Twitter) @RacunDapurIbu.
Cipta 2 Tweet berasingan berdasarkan produk ini:
Produk: ${product.title}
Harga: ${product.price} (Harga Asal: ${product.originalPrice || "N/A"}, Diskaun: ${product.discountRate || "N/A"})
Statistik: ${product.soldCount || ""}

Format Output Wajib (JSON):
{
  "tweetHook": "Tweet 1: Ayat racun memikat, fokus masalah dapur & penyelesaian. DILARANG memasukkan pautan/link. Maksimum 230 karakter.",
  "tweetReply": "Tweet 2: Ayat penutup ringkas + Diskaun + Pautan affiliate: ${product.affiliateUrl}"
}
`;

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: CONSTANTS.OPENROUTER_MODEL,
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`OpenRouter API Error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      const parsed: GeneratedCopy = JSON.parse(data.choices[0].message.content);
      return parsed;
    } catch (error) {
      console.error(
        "OpenRouter AI Error, menggunakan fallback copywriting:",
        error,
      );
      return {
        tweetHook: `Aduhai ibu-ibu sekalian, tersangat memudahkan kerja dapur! ${product.title} tengah ada diskaun gila-gila! 🔥`,
        tweetReply: `Boleh dapatkan dengan harga diskaun ${product.price} kat sini tau: ${product.affiliateUrl} ${CONSTANTS.BRAND_HASHTAGS}`,
      };
    }
  }
}
