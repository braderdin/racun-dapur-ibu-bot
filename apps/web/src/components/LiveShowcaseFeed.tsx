"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CatalogProduct } from "../services/supabase-catalog";
import {
  flashSaleService,
  FlashSaleInfo,
  CountdownTimer,
} from "../services/flash-sale";
import { realtimeFeedService, RealtimeEvent } from "../services/realtime-feed";
import { remberdawarColors } from "../utils/theme-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LiveShowcaseFeedProps {
  initialProducts?: CatalogProduct[];
  onProductClick?: (product: CatalogProduct) => void;
  className?: string;
  maxProducts?: number;
  enableRealtime?: boolean;
}

interface BudgetFilter {
  label: string;
  min: number;
  max: number | null;
}

interface ProductWithFlashSale extends CatalogProduct {
  flashSaleInfo?: FlashSaleInfo;
  countdown?: CountdownTimer;
  isFlashSale: boolean;
}

// ---------------------------------------------------------------------------
// Budget Filters Configuration
// ---------------------------------------------------------------------------

const BUDGET_FILTERS: BudgetFilter[] = [
  { label: "Semua", min: 0, max: null },
  { label: "< RM20", min: 0, max: 20 },
  { label: "RM20 - RM50", min: 20, max: 50 },
  { label: "RM50 - RM100", min: 50, max: 100 },
  { label: "> RM100", min: 100, max: null },
];

// ---------------------------------------------------------------------------
// Live Showcase Feed Component
// ---------------------------------------------------------------------------

export const LiveShowcaseFeed: React.FC<LiveShowcaseFeedProps> = ({
  initialProducts = [],
  onProductClick,
  className = "",
  maxProducts = 20,
  enableRealtime = true,
}) => {
  const [products, setProducts] = useState<CatalogProduct[]>(initialProducts);
  const [filteredProducts, setFilteredProducts] = useState<
    ProductWithFlashSale[]
  >([]);
  const [selectedBudgetFilter, setSelectedBudgetFilter] =
    useState<BudgetFilter>(BUDGET_FILTERS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Process products with flash sale info
  const processProducts = useCallback(
    (productList: CatalogProduct[]): ProductWithFlashSale[] => {
      const flashSales = flashSaleService.identifyFlashSales(productList);
      const flashSaleMap = new Map(flashSales.map((fs) => [fs.productId, fs]));

      return productList
        .map((product) => {
          const flashSaleInfo = flashSaleMap.get(product.id);
          const countdown = flashSaleInfo
            ? flashSaleService.getFlashSaleCountdown(product)
            : undefined;

          return {
            ...product,
            flashSaleInfo,
            countdown,
            isFlashSale: !!flashSaleInfo,
          };
        })
        .sort((a, b) => {
          // Flash sales first, then by priority
          if (a.isFlashSale && !b.isFlashSale) return -1;
          if (!a.isFlashSale && b.isFlashSale) return 1;
          if (a.isFlashSale && b.isFlashSale) {
            return (
              flashSaleService.calculateFlashSalePriority(b.flashSaleInfo!) -
              flashSaleService.calculateFlashSalePriority(a.flashSaleInfo!)
            );
          }
          return 0;
        })
        .slice(0, maxProducts);
    },
    [maxProducts],
  );

  // Apply budget filter
  const applyBudgetFilter = useCallback(
    (productList: ProductWithFlashSale[], filter: BudgetFilter) => {
      if (!filter.max) {
        return productList.filter((p) => {
          const price =
            p.lazada_peak_hour_current_price ||
            p.shopee_peak_hour_current_price ||
            0;
          return price >= filter.min;
        });
      }
      return productList.filter((p) => {
        const price =
          p.lazada_peak_hour_current_price ||
          p.shopee_peak_hour_current_price ||
          0;
        return price >= filter.min && price <= filter.max;
      });
    },
    [],
  );

  // Update filtered products when products or filter changes
  useEffect(() => {
    const processed = processProducts(products);
    const filtered = applyBudgetFilter(processed, selectedBudgetFilter);
    setFilteredProducts(filtered);
  }, [products, selectedBudgetFilter, processProducts, applyBudgetFilter]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!enableRealtime) return;

    const unsubscribe = realtimeFeedService.subscribeToDeals(
      (event: RealtimeEvent) => {
        console.log("📡 Realtime event received:", event.type, event.payload);

        if (event.type === "NEW_DEAL" || event.type === "FLASH_SALE_START") {
          const newProduct = event.payload.new as CatalogProduct;
          if (newProduct) {
            setProducts((prev) => {
              // Check if product already exists
              const exists = prev.some((p) => p.id === newProduct.id);
              if (exists) {
                return prev.map((p) =>
                  p.id === newProduct.id ? newProduct : p,
                );
              }
              return [newProduct, ...prev].slice(0, maxProducts);
            });
            setLastUpdated(new Date());
          }
        } else if (event.type === "DEAL_UPDATED") {
          const updatedProduct = event.payload.new as CatalogProduct;
          if (updatedProduct) {
            setProducts((prev) =>
              prev.map((p) =>
                p.id === updatedProduct.id ? updatedProduct : p,
              ),
            );
            setLastUpdated(new Date());
          }
        }
      },
    );

    // Check connection health
    const healthCheck = async () => {
      const healthy = await realtimeFeedService.healthCheck();
      setRealtimeConnected(healthy);
    };
    healthCheck();
    const healthInterval = setInterval(healthCheck, 30000);

    return () => {
      unsubscribe();
      clearInterval(healthInterval);
    };
  }, [enableRealtime, maxProducts]);

  // Load initial products if empty
  useEffect(() => {
    if (products.length === 0 && initialProducts.length === 0) {
      loadProducts();
    }
  }, []);

  const loadProducts = async () => {
    setIsLoading(true);
    try {
      // In production, fetch from Supabase
      // For now, use initialProducts or mock data
      if (initialProducts.length > 0) {
        setProducts(initialProducts);
      }
    } catch (error) {
      console.error("Error loading products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Format price for display
  const formatPrice = (price?: number): string => {
    if (!price) return "RM 0.00";
    return `RM ${price.toFixed(2)}`;
  };

  // Format countdown for display
  const formatCountdown = (timer?: CountdownTimer): string => {
    if (!timer || timer.isExpired) return "Selesai";

    const parts: string[] = [];
    if (timer.days > 0) parts.push(`${timer.days}h`);
    if (timer.hours > 0 || parts.length > 0) parts.push(`${timer.hours}j`);
    parts.push(`${timer.minutes}m`);
    parts.push(`${timer.seconds}s`);
    return parts.join(" ");
  };

  // Get current price (flash sale or regular)
  const getCurrentPrice = (product: ProductWithFlashSale): number => {
    return (
      product.flashSaleInfo?.currentPrice ||
      product.lazada_peak_hour_current_price ||
      product.shopee_peak_hour_current_price ||
      0
    );
  };

  // Get original price
  const getOriginalPrice = (product: ProductWithFlashSale): number => {
    return (
      product.flashSaleInfo?.originalPrice ||
      product.lazada_peak_hour_original_price ||
      product.shopee_peak_hour_original_price ||
      getCurrentPrice(product)
    );
  };

  // Get discount percentage
  const getDiscountPercentage = (product: ProductWithFlashSale): number => {
    return (
      product.flashSaleInfo?.discountPercentage ||
      product.lazada_peak_hour_percent ||
      product.shopee_peak_hour_percent ||
      0
    );
  };

  // Get affiliate URL for platform
  const getAffiliateUrl = (
    product: ProductWithFlashSale,
    platform: "lazada" | "shopee",
  ): string => {
    if (platform === "lazada") {
      return (
        product.lazada_affiliate_url ||
        `https://c.lazada.com.my/t/c.${product.id}`
      );
    }
    return (
      product.shopee_affiliate_url ||
      `https://shopee.com.my/product/${product.id}`
    );
  };

  // Handle buy button click
  const handleBuyClick = (
    product: ProductWithFlashSale,
    platform: "lazada" | "shopee",
  ) => {
    const url = getAffiliateUrl(product, platform);
    window.open(url, "_blank", "noopener,noreferrer");

    // Track click analytics
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", "affiliate_click", {
        product_id: product.id,
        platform,
        price: getCurrentPrice(product),
      });
    }
  };

  if (isLoading && filteredProducts.length === 0) {
    return (
      <div
        className={`live-showcase-feed ${className}`}
        style={{
          padding: "24px",
          textAlign: "center",
          color: remberdawarColors.charcoal,
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⏳</div>
        <p>Memuatkan deal terbaik...</p>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div
        className={`live-showcase-feed ${className}`}
        style={{
          padding: "24px",
          textAlign: "center",
          color: remberdawarColors.charcoal,
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🔍</div>
        <p>Tiada deal dijumpai untuk filter ini</p>
        <button
          onClick={() => setSelectedBudgetFilter(BUDGET_FILTERS[0])}
          style={{
            marginTop: "12px",
            padding: "8px 16px",
            background: remberdawarColors.terracotta,
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Tunjukkan Semua
        </button>
      </div>
    );
  }

  return (
    <div className={`live-showcase-feed ${className}`}>
      {/* Header with Budget Filters */}
      <div
        style={{
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: `2px solid ${remberdawarColors.terracotta}30`,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "20px",
              fontWeight: "bold",
              color: remberdawarColors.charcoal,
              fontFamily: "var(--font-playfair)",
            }}
          >
            🛍️ Live Showcase
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "#666",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: realtimeConnected ? "#4CAF50" : "#F44336",
              }}
            />
            <span>{realtimeConnected ? "Live" : "Offline"}</span>
            {lastUpdated && (
              <span>
                • Terkemas kini: {lastUpdated.toLocaleTimeString("ms-MY")}
              </span>
            )}
          </div>
        </div>

        {/* Budget Quick Filters */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          {BUDGET_FILTERS.map((filter) => (
            <button
              key={filter.label}
              onClick={() => setSelectedBudgetFilter(filter)}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                border: `2px solid ${
                  selectedBudgetFilter.label === filter.label
                    ? remberdawarColors.terracotta
                    : remberdawarColors.terracotta + "60"
                }`,
                background:
                  selectedBudgetFilter.label === filter.label
                    ? remberdawarColors.terracotta
                    : "transparent",
                color:
                  selectedBudgetFilter.label === filter.label
                    ? "white"
                    : remberdawarColors.charcoal,
                fontSize: "13px",
                fontWeight: "600",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Product Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "16px",
        }}
      >
        {filteredProducts.map((product) => {
          const currentPrice = getCurrentPrice(product);
          const originalPrice = getOriginalPrice(product);
          const discountPercent = getDiscountPercentage(product);
          const isFlashSale = product.isFlashSale;
          const countdown = product.countdown;

          return (
            <div
              key={product.id}
              onClick={() => onProductClick?.(product)}
              style={{
                background: remberdawarColors.snowWhite,
                borderRadius: "12px",
                padding: "16px",
                cursor: "pointer",
                boxShadow: `0 2px 12px ${remberdawarColors.terracotta}15`,
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                border: isFlashSale
                  ? `2px solid ${remberdawarColors.terracotta}`
                  : "none",
                position: "relative",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = `0 8px 24px ${remberdawarColors.terracotta}25`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = `0 2px 12px ${remberdawarColors.terracotta}15`;
              }}
            >
              {/* Flash Sale Badge */}
              {isFlashSale && (
                <div
                  style={{
                    position: "absolute",
                    top: "-8px",
                    right: "-8px",
                    background: remberdawarColors.terracotta,
                    color: "white",
                    padding: "4px 10px",
                    borderRadius: "12px",
                    fontSize: "11px",
                    fontWeight: "bold",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                    zIndex: 10,
                  }}
                >
                  🔥 FLASH SALE
                </div>
              )}

              {/* Product Image */}
              <div
                style={{
                  width: "100%",
                  aspectRatio: "1/1",
                  borderRadius: "8px",
                  overflow: "hidden",
                  marginBottom: "12px",
                  background: remberdawarColors.cream + "30",
                  position: "relative",
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#999",
                    }}
                  >
                    📦
                  </div>
                )}

                {/* Countdown Timer Overlay for Flash Sales */}
                {isFlashSale && countdown && !countdown.isExpired && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "8px",
                      left: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.7)",
                      color: "white",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: "bold",
                      textAlign: "center",
                      fontFamily: "monospace",
                    }}
                  >
                    ⏰ {formatCountdown(countdown)}
                  </div>
                )}
              </div>

              {/* Product Title */}
              <h3
                style={{
                  margin: "0 0 8px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: remberdawarColors.charcoal,
                  lineHeight: "1.4",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {product.title}
              </h3>

              {/* Price & Discount */}
              <div style={{ marginBottom: "12px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "20px",
                      fontWeight: "bold",
                      color: remberdawarColors.terracotta,
                    }}
                  >
                    {formatPrice(currentPrice)}
                  </span>
                  {originalPrice > currentPrice && (
                    <span
                      style={{
                        fontSize: "13px",
                        textDecoration: "line-through",
                        color: "#999",
                      }}
                    >
                      {formatPrice(originalPrice)}
                    </span>
                  )}
                  {discountPercent > 0 && (
                    <span
                      style={{
                        background: remberdawarColors.terracotta,
                        color: "white",
                        padding: "2px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                      }}
                    >
                      -{discountPercent}%
                    </span>
                  )}
                </div>
              </div>

              {/* Platform Tags */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginBottom: "12px",
                  flexWrap: "wrap",
                }}
              >
                {product.lazada_affiliate_url && (
                  <span
                    style={{
                      background: "#FF6B00",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    Lazada
                  </span>
                )}
                {product.shopee_affiliate_url && (
                  <span
                    style={{
                      background: "#EE4D2D",
                      color: "white",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "10px",
                      fontWeight: "600",
                    }}
                  >
                    Shopee
                  </span>
                )}
              </div>

              {/* Dual Buy Buttons */}
              <div style={{ display: "flex", gap: "8px" }}>
                {product.lazada_affiliate_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyClick(product, "lazada");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      background: "#FF6B00",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#E65A00";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#FF6B00";
                    }}
                  >
                    🧡 Beli Lazada
                  </button>
                )}
                {product.shopee_affiliate_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyClick(product, "shopee");
                    }}
                    style={{
                      flex: 1,
                      padding: "10px 16px",
                      background: "#EE4D2D",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#D63D1D";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#EE4D2D";
                    }}
                  >
                    🧡 Beli Shopee
                  </button>
                )}
                {!product.lazada_affiliate_url &&
                  !product.shopee_affiliate_url && (
                    <button
                      disabled
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        background: "#E0E0E0",
                        color: "#999",
                        border: "none",
                        borderRadius: "8px",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "not-allowed",
                      }}
                    >
                      Tidak Tersedia
                    </button>
                  )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: "16px",
          paddingTop: "12px",
          borderTop: `1px solid ${remberdawarColors.terracotta}20`,
          textAlign: "center",
          fontSize: "12px",
          color: "#888",
        }}
      >
        <p>Dikemas kini secara automatik • Data dari Lazada & Shopee API</p>
      </div>
    </div>
  );
};

export default LiveShowcaseFeed;
