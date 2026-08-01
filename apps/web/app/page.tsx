"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CatalogProduct } from "@/services/supabase-catalog";
import { FlashSaleBanner } from "@/components/FlashSaleBanner";
import { CategoryQuickFilter } from "@/components/CategoryQuickFilter";
import { RealtimeFeedService } from "@/services/realtime-feed";
import { remberdawarColors } from "@/utils/theme-config";

// ---------------------------------------------------------------------------
// Catalog Homepage — Live Deals, Category Filters, Dual Buy Buttons, Realtime
// ---------------------------------------------------------------------------

interface PageState {
  products: CatalogProduct[];
  filteredProducts: CatalogProduct[];
  flashSales: any[];
  loading: boolean;
  error: string | null;
  toast: string | null;
}

const BUDGET_RANGES = [
  { label: "Bawah RM20", value: "<20" },
  { label: "RM20–50", value: "20-50" },
  { label: "RM50–100", value: "50-100" },
  { label: "Atas RM100", value: ">100" },
];

const CATEGORIES = [
  { label: "Semua", value: "all" },
  { label: "Airfryer", value: "airfryer" },
  { label: "Barang Baby", value: "baby" },
  { label: "Dapur", value: "kitchen" },
  { label: "Kecantikan", value: "skincare" },
  { label: "Paling Viral", value: "viral" },
];

export default function CatalogPage() {
  const [state, setState] = useState<PageState>({
    products: [],
    filteredProducts: [],
    flashSales: [],
    loading: true,
    error: null,
    toast: null,
  });

  const [activeCategory, setActiveCategory] = useState("all");
  const [activeBudget, setActiveBudget] = useState("<20");

  // Load catalog products
  const loadProducts = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));
      const res = await fetch("/api/catalog", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CatalogProduct[] = await res.json();
      setState((s) => ({
        ...s,
        products: data,
        filteredProducts: data,
        loading: false,
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, loading: false, error: err.message }));
    }
  }, []);

  // Load flash sales
  const loadFlashSales = useCallback(async () => {
    try {
      const res = await fetch("/api/flash-sales", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setState((s) => ({ ...s, flashSales: data }));
    } catch {
      // silent — flash sales are optional
    }
  }, []);

  // Subscribe to realtime Supabase events for toast notifications
  useEffect(() => {
    const feed = new RealtimeFeedService();
    const unsubscribe = feed.subscribeToDeals((event) => {
      setState((s) => ({
        ...s,
        toast: `🔔 ${event.type}: ${event.payload?.new?.product_name || "Update"}`,
      }));
      setTimeout(() => setState((s) => ({ ...s, toast: null })), 5000);
    });
    loadProducts();
    loadFlashSales();
    return () => {
      unsubscribe();
    };
  }, [loadProducts, loadFlashSales]);

  // Filter products by category + budget
  useEffect(() => {
    let result = [...state.products];
    if (activeCategory !== "all") {
      result = result.filter((p) => p.category === activeCategory);
    }
    if (activeBudget === "<20") {
      result = result.filter(
        (p) => (p.lazada_price || p.shopee_price || 0) < 20,
      );
    } else if (activeBudget === "20-50") {
      result = result.filter((p) => {
        const price = p.lazada_price || p.shopee_price || 0;
        return price >= 20 && price <= 50;
      });
    } else if (activeBudget === "50-100") {
      result = result.filter((p) => {
        const price = p.lazada_price || p.shopee_price || 0;
        return price >= 50 && price <= 100;
      });
    } else if (activeBudget === ">100") {
      result = result.filter(
        (p) => (p.lazada_price || p.shopee_price || 0) > 100,
      );
    }
    setState((s) => ({ ...s, filteredProducts: result }));
  }, [state.products, activeCategory, activeBudget]);

  // Dual buy handler
  const handleBuy = useCallback(
    (platform: "lazada" | "shopee", product: CatalogProduct) => {
      const url =
        platform === "lazada" ? product.lazada_url : product.shopee_url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    },
    [],
  );

  if (state.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-cream)]">
        <p className="text-[var(--color-charcoal)] text-lg">
          Memuatkan katalog...
        </p>
      </main>
    );
  }

  if (state.error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-cream)]">
        <p className="text-red-600 text-lg">Ralat: {state.error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--color-cream)]">
      {/* Toast Notification */}
      {state.toast && (
        <div className="fixed top-4 right-4 z-[999] rounded-lg bg-[var(--color-terracotta)] px-4 py-2 text-white shadow-lg transition-all">
          {state.toast}
        </div>
      )}

      {/* Flash Sale Banner */}
      <FlashSaleBanner flashSales={state.flashSales} />

      {/* Hero Section */}
      <section className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold text-[var(--color-charcoal)]">
          Katalog Produk 🔥
        </h1>
        <p className="mt-2 text-[var(--color-charcoal)] opacity-80">
          Produk dapur & ibu mertua dengan harga terbaik
        </p>
      </section>

      {/* Category Quick Filters */}
      <section className="mx-auto max-w-6xl px-4">
        <CategoryQuickFilter
          products={state.products}
          onFilterChange={(filtered) =>
            setState((s) => ({ ...s, filteredProducts: filtered }))
          }
        />
      </section>

      {/* Budget Filter Chips */}
      <section className="mx-auto max-w-6xl px-4 py-4">
        <div className="flex flex-wrap gap-2">
          {BUDGET_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setActiveBudget(range.value)}
              className={`rounded-full px-4 py-1 text-sm font-medium transition-colors ${
                activeBudget === range.value
                  ? "bg-[var(--color-terracotta)] text-white"
                  : "bg-white text-[var(--color-charcoal)] shadow-sm"
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </section>

      {/* Product Grid */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        {state.filteredProducts.length === 0 ? (
          <p className="text-center text-[var(--color-charcoal)] opacity-60">
            Tiada produk ditemui
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {state.filteredProducts.map((product) => (
              <div
                key={product.id}
                className="rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <img
                  src={
                    product.lazada_image ||
                    product.shopee_image ||
                    "/placeholder.png"
                  }
                  alt={product.product_name}
                  className="h-48 w-full rounded-lg object-cover"
                />
                <h2 className="mt-3 font-semibold text-[var(--color-charcoal)]">
                  {product.product_name}
                </h2>
                <p className="mt-1 text-sm text-[var(--color-charcoal)] opacity-70">
                  {product.category}
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[var(--color-terracotta)]">
                    RM
                    {(
                      product.lazada_price ||
                      product.shopee_price ||
                      0
                    ).toFixed(2)}
                  </span>
                </div>
                {/* Dual Buy Buttons */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => handleBuy("lazada", product)}
                    className="flex-1 rounded-lg bg-[#FF6B00] px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Beli Lazada 🧡
                  </button>
                  <button
                    onClick={() => handleBuy("shopee", product)}
                    className="flex-1 rounded-lg bg-[#FC7200] px-3 py-2 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Beli Shopee 🧡
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
