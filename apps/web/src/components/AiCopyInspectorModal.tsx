"use client";

import React, { useState, useEffect } from "react";
import { XIcon, FacebookIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AiCopyInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  xThread: {
    hook: string;
    caption?: string;
    latency: number;
    confidence: number;
    model: string;
    timestamp: number;
  };
  facebookPost: {
    storytelling: string;
    caption?: string;
    latency: number;
    confidence: number;
    model: string;
    timestamp: number;
  };
  product?: {
    id: string;
    title: string;
    price: number;
    discountPrice: number;
    discountPercent: number;
    category: "kitchen" | "baby" | "skincare";
  };
}

export interface LatencyMetrics {
  xThread: number;
  facebookPost: number;
  total: number;
  avg: number;
}

// ---------------------------------------------------------------------------
// Modal Component
// ---------------------------------------------------------------------------

export const AiCopyInspectorModal: React.FC<AiCopyInspectorModalProps> = ({
  isOpen,
  onClose,
  xThread,
  facebookPost,
  product,
}) => {
  const [activeTab, setActiveTab] = useState<"x" | "facebook">("x");
  const [showLatency, setShowLatency] = useState(false);

  // Calculate metrics
  const latencyMetrics: LatencyMetrics = {
    xThread: xThread.latency,
    facebookPost: facebookPost.latency,
    total: xThread.latency + facebookPost.latency,
    avg: (xThread.latency + facebookPost.latency) / 2,
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("ms-MY", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get confidence color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return "text-green-600";
    if (confidence >= 0.75) return "text-yellow-600";
    return "text-red-600";
  };

  // Get confidence label
  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return "Tinggi";
    if (confidence >= 0.75) return "Sederhana";
    return "Rendah";
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-terracotta to-warmGold text-white">
          <h2 className="text-lg font-semibold">🔍 Pemeriksa Salinan AI</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close modal"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Product Info */}
        {product && (
          <div className="p-4 bg-terracotta/10 border-b border-terracotta/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-terracotta rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {product.category === "kitchen"
                    ? "🍳"
                    : product.category === "baby"
                      ? "👶"
                      : "✨"}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-charcoal">{product.title}</h3>
                <div className="text-sm text-sage flex gap-4">
                  <span>
                    <span className="font-medium">Harga:</span>{" "}
                    {product.currency || "RM"} {product.discountPrice}
                  </span>
                  <span>
                    <span className="font-medium">Diska:</span>{" "}
                    {product.discountPercent}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("x")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "x"
                ? "border-b-2 border-terracotta text-terracotta"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <XIcon className="w-4 h-4" />X Thread
            </div>
          </button>
          <button
            onClick={() => setActiveTab("facebook")}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
              activeTab === "facebook"
                ? "border-b-2 border-terracotta text-terracotta"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <FacebookIcon className="w-4 h-4" />
              Facebook Post
            </div>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {activeTab === "x" ? (
            <div className="space-y-4">
              {/* X Thread Hook */}
              <div className="bg-terracotta/5 rounded-lg p-4 border border-terracotta/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-charcoal">
                    Hook (Tweet 1)
                  </h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      xThread.confidence >= 0.9
                        ? "bg-green-100 text-green-800"
                        : xThread.confidence >= 0.75
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    Keyakinan: {(xThread.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-base text-charcoal leading-relaxed whitespace-pre-wrap">
                  {xThread.hook}
                </p>
              </div>

              {/* X Thread Caption */}
              {xThread.caption && (
                <div className="bg-terracotta/5 rounded-lg p-4 border border-terracotta/10">
                  <h3 className="text-sm font-medium text-charcoal mb-2">
                    Caption (Tweet 2)
                  </h3>
                  <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                    {xThread.caption}
                  </p>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Latensi
                  </p>
                  <p className="text-lg font-semibold text-charcoal">
                    {xThread.latency}ms
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Model
                  </p>
                  <p className="text-sm font-medium text-charcoal">
                    {xThread.model}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Masa
                  </p>
                  <p className="text-sm font-medium text-charcoal">
                    {formatTimestamp(xThread.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Facebook Storytelling */}
              <div className="bg-terracotta/5 rounded-lg p-4 border border-terracotta/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-charcoal">
                    Cerita (Post Utama)
                  </h3>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full ${
                      facebookPost.confidence >= 0.9
                        ? "bg-green-100 text-green-800"
                        : facebookPost.confidence >= 0.75
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    Keyakinan: {(facebookPost.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                  {facebookPost.storytelling}
                </p>
              </div>

              {/* Facebook Caption */}
              {facebookPost.caption && (
                <div className="bg-terracotta/5 rounded-lg p-4 border border-terracotta/10">
                  <h3 className="text-sm font-medium text-charcoal mb-2">
                    Komen (Auto-Comment)
                  </h3>
                  <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                    {facebookPost.caption}
                  </p>
                </div>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 pt-2">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Latensi
                  </p>
                  <p className="text-lg font-semibold text-charcoal">
                    {facebookPost.latency}ms
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Model
                  </p>
                  <p className="text-sm font-medium text-charcoal">
                    {facebookPost.model}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Masa
                  </p>
                  <p className="text-sm font-medium text-charcoal">
                    {formatTimestamp(facebookPost.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer with Comparison */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Latensi X
              </p>
              <p className="text-lg font-semibold text-charcoal">
                {xThread.latency}ms
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Latensi FB
              </p>
              <p className="text-lg font-semibold text-charcoal">
                {facebookPost.latency}ms
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiCopyInspectorModal;
