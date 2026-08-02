"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { remberdawarColors } from "../utils/theme-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LazadaDeal {
  id: string;
  title: string;
  originalPrice: number;
  discountPrice: number;
  discountPercent: number;
  imageUrls: string[];
  affiliateLink: string;
  seller: string;
  rating: number;
  stock: number;
  endTime: Date;
  category: string;
}

export interface FeaturedAdCarouselProps {
  deals: LazadaDeal[];
  onDealClick?: (deal: LazadaDeal) => void;
  autoPlay?: boolean;
  intervalMs?: number;
  className?: string;
}

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FeaturedAdCarousel: React.FC<FeaturedAdCarouselProps> = ({
  deals,
  onDealClick,
  autoPlay = true,
  intervalMs = 8000,
  className = "",
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [countdowns, setCountdowns] = useState<Record<string, CountdownState>>(
    {},
  );
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate countdowns for each deal
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns: Record<string, CountdownState> = {};

      deals.forEach((deal) => {
        const now = new Date();
        const end = new Date(deal.endTime);
        const diff = end.getTime() - now.getTime();

        if (diff <= 0) {
          newCountdowns[deal.id] = {
            days: 0,
            hours: 0,
            minutes: 0,
            seconds: 0,
          };
        } else {
          const seconds = Math.floor(diff / 1000);
          const minutes = Math.floor(seconds / 60);
          const hours = Math.floor(minutes / 60);
          const days = Math.floor(hours / 24);

          newCountdowns[deal.id] = {
            days,
            hours: hours % 24,
            minutes: minutes % 60,
            seconds: seconds % 60,
          };
        }
      });

      setCountdowns(newCountdowns);
    };

    updateCountdowns();
    const countdownInterval = setInterval(updateCountdowns, 1000);

    return () => clearInterval(countdownInterval);
  }, [deals]);

  // Auto-play logic
  useEffect(() => {
    if (!autoPlay || isHovered || deals.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % deals.length);
    }, intervalMs);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoPlay, isHovered, intervalMs, deals.length]);

  const handleDealClick = (deal: LazadaDeal) => {
    if (onDealClick) {
      onDealClick(deal);
    }
  };

  const nextDeal = () => {
    setCurrentIndex((prev) => (prev + 1) % deals.length);
  };

  const prevDeal = () => {
    setCurrentIndex((prev) => (prev - 1 + deals.length) % deals.length);
  };

  const formatCountdown = (cd: CountdownState) => {
    if (cd.days > 0) {
      return `${cd.days}d ${cd.hours}h ${cd.minutes}m`;
    }
    return `${cd.hours}h ${cd.minutes}m ${cd.seconds}s`;
  };

  const formatPrice = (price: number) => {
    return `RM ${price.toFixed(2)}`;
  };

  if (!deals || deals.length === 0) {
    return (
      <div
        className={`featured-ad-carousel ${className}`}
        style={{ padding: "20px", textAlign: "center" }}
      >
        <p style={{ color: remberdawarColors.terracotta, fontSize: "14px" }}>
          Tiada deal hot hari ini. Semoga hari ini beruntung!
        </p>
      </div>
    );
  }

  const currentDeal = deals[currentIndex];

  return (
    <div
      className={`featured-ad-carousel ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        borderRadius: "16px",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${remberdawarColors.cream} 0%, ${remberdawarColors.terracotta} 100%)`,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
      }}
    >
      {/* Main Carousel Content */}
      <AnimatePresence initial={false}>
        <motion.div
          key={currentDeal.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            padding: "24px",
          }}
        >
          {/* Product Image */}
          <div style={{ flexShrink: 0 }}>
            <img
              src={currentDeal.imageUrls[0]}
              alt={currentDeal.title}
              style={{
                width: "180px",
                height: "180px",
                objectFit: "cover",
                borderRadius: "12px",
                border: "3px solid white",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/placeholder-product.png";
              }}
            />
          </div>

          {/* Product Info */}
          <div style={{ flex: 1, color: "white" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "4px 12px",
                  borderRadius: "20px",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {currentDeal.discountPercent}% DISCOUNT
              </span>
              <span style={{ fontSize: "12px", opacity: 0.9 }}>
                {currentDeal.category}
              </span>
            </div>

            <h3
              style={{
                fontSize: "18px",
                fontWeight: 700,
                margin: "8px 0",
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {currentDeal.title}
            </h3>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "12px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "14px",
                    opacity: 0.7,
                    textDecoration: "line-through",
                  }}
                >
                  {formatPrice(currentDeal.originalPrice)}
                </span>
                <span
                  style={{
                    fontSize: "24px",
                    fontWeight: 800,
                    marginLeft: "8px",
                  }}
                >
                  {formatPrice(currentDeal.discountPrice)}
                </span>
              </div>
              <div style={{ fontSize: "14px", opacity: 0.9 }}>
                ⭐ {currentDeal.rating.toFixed(1)} ({currentDeal.stock}{" "}
                tersedia)
              </div>
            </div>

            {/* Countdown Timer */}
            {countdowns[currentDeal.id] && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(0, 0, 0, 0.2)",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  marginBottom: "12px",
                }}
              >
                <span style={{ fontSize: "14px", fontWeight: 600 }}>
                  ⏰ Bersiar:
                </span>
                <span
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    fontFamily: "monospace",
                  }}
                >
                  {formatCountdown(countdowns[currentDeal.id])}
                </span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => handleDealClick(currentDeal)}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  background: "white",
                  color: remberdawarColors.terracotta,
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                Beli Sekarang
              </button>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(currentDeal.affiliateLink)
                }
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  background: "rgba(255, 255, 255, 0.2)",
                  color: "white",
                  border: "2px solid white",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
                title="Salin pautan affiliate"
              >
                Salin Link
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Navigation Arrows */}
      {deals.length > 1 && (
        <>
          <button
            onClick={prevDeal}
            style={{
              position: "absolute",
              left: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
            }}
          >
            ‹
          </button>
          <button
            onClick={nextDeal}
            style={{
              position: "absolute",
              right: "16px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "rgba(255, 255, 255, 0.2)",
              border: "none",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
            }}
          >
            ›
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {deals.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: "16px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "8px",
          }}
        >
          {deals.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                border: "none",
                background:
                  index === currentIndex ? "white" : "rgba(255, 255, 255, 0.4)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FeaturedAdCarousel;
