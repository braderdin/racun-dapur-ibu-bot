"use client";

import React, { useState, useEffect } from "react";
import { FlashSaleInfo } from "../services/flash-sale";
import { remberdawarColors } from "../utils/theme-config";

// ---------------------------------------------------------------------------
// Flash Sale Banner Component
// ---------------------------------------------------------------------------

interface FlashSaleBannerProps {
  flashSales: FlashSaleInfo[];
  onProductClick?: (productId: string) => void;
  className?: string;
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
}

export const FlashSaleBanner: React.FC<FlashSaleBannerProps> = ({
  flashSales,
  onProductClick,
  className = "",
}) => {
  const [countdowns, setCountdowns] = useState<Record<string, CountdownState>>(
    {},
  );

  // Update countdowns every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newCountdowns: Record<string, CountdownState> = {};

      flashSales.forEach((sale) => {
        const endTime = sale.lazadaPeakHourEnd || sale.shopeePeakHourEnd;
        if (!endTime) return;

        const now = new Date();
        const end = new Date(endTime);
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) {
          newCountdowns[sale.productId] = {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
            isExpired: true,
          };
        } else {
          const seconds = Math.floor(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);

          newCountdowns[sale.productId] = {
            days,
            hours: hours % 24,
            minutes: minutes % 60,
            seconds: seconds % 60,
            isExpired: false,
          };
        }
      });

      setCountdowns(newCountdowns);
    }, 1000);

    return () => clearInterval(interval);
  }, [flashSales]);

  if (flashSales.length === 0) {
    return null;
  }

  return (
    <div
      className={`flash-sale-banner ${className}`}
      style={{
        background: `linear-gradient(135deg, ${remberdawarColors.cream} 0%, ${remberdawarColors.terracotta} 100%)`,
        borderRadius: "12px",
        padding: "16px",
        marginBottom: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "12px",
        }}
      >
        <span style={{ fontSize: "24px" }}>🔥</span>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: "bold",
            color: remberdawarColors.charcoal,
            fontFamily: "var(--font-playfair)",
          }}
        >
          Flash Sale Aktif!
        </h2>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "12px",
        }}
      >
        {flashSales.map((sale) => {
          const countdown = countdowns[sale.productId];
          const discount = sale.discountPercentage || 0;

          return (
            <div
              key={sale.productId}
              onClick={() => onProductClick?.(sale.productId)}
              style={{
                background: remberdawarColors.snowWhite,
                borderRadius: "8px",
                padding: "12px",
                cursor: "pointer",
                boxShadow: `0 2px 8px ${remberdawarColors.terracotta}20`,
                transition: "transform 0.2s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span
                  style={{
                    background: remberdawarColors.terracotta,
                    color: "white",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: "14px",
                    fontWeight: "bold",
                  }}
                >
                  -{discount}%
                </span>
                {countdown && !countdown.isExpired && (
                  <span
                    style={{
                      fontSize: "12px",
                      color: remberdawarColors.charcoal,
                      fontWeight: "600",
                    }}
                  >
                    {countdown.days > 0 && `${countdown.days}d `}
                    {countdown.hours}h {countdown.minutes}m {countdown.seconds}s
                  </span>
                )}
              </div>

              <p
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: remberdawarColors.charcoal,
                }}
              >
                {sale.productId}
              </p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {sale.originalPrice && (
                  <span
                    style={{
                      textDecoration: "line-through",
                      fontSize: "12px",
                      color: "#999",
                    }}
                  >
                    RM{sale.originalPrice.toFixed(2)}
                  </span>
                )}
                {sale.currentPrice && (
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "bold",
                      color: remberdawarColors.terracotta,
                    }}
                  >
                    RM{sale.currentPrice.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FlashSaleBanner;
