import { Env } from "./types/env";
import { RedisService } from "./services/redis";
import { LazadaService } from "./services/lazada";
import { OpenRouterAIService } from "./services/openrouter";
import { TwitterService } from "./services/twitter";
import { B2StorageService } from "./services/b2-storage";
import { SupabaseService } from "./services/supabase";

export default {
  /**
   * 1. Trigger HTTP / QStash Receiver
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/run-bot" || url.pathname === "/qstash-trigger") {
      ctx.waitUntil(this.executeBotPipeline(env));
      return new Response(JSON.stringify({ success: true, message: "Pipeline Bot @RacunDapurIbu Dijalankan!" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Bot @RacunDapurIbu Cloudflare Worker Active!", { status: 200 });
  },

  /**
   * 2. Trigger Penjadual Otomatik (Cloudflare Cron Trigger)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(this.executeBotPipeline(env));
  },

  /**
   * ENJIN PIPELINE AUTOMASI BOT (24/7 WORKFLOW)
   */
  async executeBotPipeline(env: Env): Promise<void> {
    console.log("=== [BOT START] Memulakan Carian Produk Trending Lazada ===");

    const redis = new RedisService(env);
    const lazada = new LazadaService(env);
    const ai = new OpenRouterAIService(env);
    const twitter = new TwitterService(env);
    const b2 = new B2StorageService(env);
    const supabase = new SupabaseService(env);

    // Langkah 1: Tarik Produk dari Lazada
    const products = await lazada.fetchTrendingProducts();
    if (products.length === 0) {
      console.log("Tiada produk ditemui.");
      return;
    }

    // Langkah 2: Tapis Produk Yang Dah Di-Post Dalam Masa 5 Hari (Redis Anti-Repeat)
    let selectedProduct = null;
    for (const prod of products) {
      const postedBefore = await redis.isProductPostedRecently(prod.id);
      if (!postedBefore) {
        selectedProduct = prod;
        break; // Ambil produk pertama yang belum di-post
      }
    }

    if (!selectedProduct) {
      console.log("Kesemua produk telah di-post dalam tempoh 5 hari lepas.");
      return;
    }

    console.log(`[Pilihan Produk]: ${selectedProduct.title} (${selectedProduct.price})`);

    // Langkah 3: Jana Copywriting Racun via OpenRouter AI (Delay 3s Diaktifkan)
    const copywriting = await ai.generateCopywriting(selectedProduct);

    // Langkah 4: Simpan Gambar ke Backblaze B2 (Auto-Switching Storage)
    let b2ImageUrl = selectedProduct.imageUrl;
    try {
      const imgRes = await fetch(selectedProduct.imageUrl);
      if (imgRes.ok) {
        const imgBuffer = await imgRes.arrayBuffer();
        b2ImageUrl = await b2.uploadProductImage(imgBuffer, `laz_${selectedProduct.id}.jpg`);
      }
    } catch (e) {
      console.warn("Gagal simpan ke B2, menggunakan URL CDN asal.");
    }

    // Langkah 5: Hantar 2-Tweet Thread Ke X API
    const success = await twitter.postAffiliateThread(copywriting, b2ImageUrl);

    if (success) {
      // Langkah 6: Tanda Produk Dalam Redis (TTL 5 Hari) & Log ke Supabase DB
      await redis.markProductAsPosted(selectedProduct.id);
      await supabase.logPostedProduct(selectedProduct, "tweet_sample_id_1001");
      console.log("=== [BOT SUCCESS] Hantaran Selesai & Memori Dikemaskini! ===");
    }
  },
};