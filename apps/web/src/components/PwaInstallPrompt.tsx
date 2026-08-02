"use client";

import React, { useState, useEffect } from "react";
import { remberdawarColors } from "../utils/theme-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

interface PwaInstallPromptProps {
  className?: string;
  position?: "bottom" | "top";
  autoShowDelayMs?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  className = "",
  position = "bottom",
  autoShowDelayMs = 5000,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // Check if app is already installed
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Auto-show after delay
      setTimeout(() => {
        setShowPrompt(true);
      }, autoShowDelayMs);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Listen for app installation
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [autoShowDelayMs]);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === "accepted") {
          console.log("PWA installation accepted");
        } else {
          console.log("PWA installation dismissed");
        }

        setDeferredPrompt(null);
        setShowPrompt(false);
      } catch (error) {
        console.error("PWA installation error:", error);
      }
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem("pwa-prompt-dismissed", "true");
  };

  // Don't show if already installed or dismissed in this session
  if (
    isInstalled ||
    (sessionStorage.getItem("pwa-prompt-dismissed") === "true" && showPrompt)
  ) {
    return null;
  }

  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div
      className={`pwa-install-prompt ${className}`}
      style={{
        position: "fixed",
        [position]: "0",
        left: "0",
        right: "0",
        background: `linear-gradient(135deg, ${remberdawarColors.terracotta} 0%, ${remberdawarColors.cream} 100%)`,
        padding: "16px 24px",
        boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.15)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "12px",
      }}
    >
      <div style={{ flex: 1, minWidth: "200px" }}>
        <h3
          style={{
            margin: "0 0 8px 0",
            fontSize: "16px",
            fontWeight: 700,
            color: "white",
          }}
        >
          📱 Pasang Aplikasi Kami
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            opacity: 0.95,
            lineHeight: 1.4,
          }}
        >
          Akses katalog produk kami dengan pantas. Tiada internet kehilangan!
        </p>
      </div>

      <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
        <button
          onClick={handleDismiss}
          style={{
            padding: "8px 16px",
            background: "rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            borderRadius: "8px",
            color: "white",
            cursor: "pointer",
            fontSize: "14px",
            transition: "all 0.2s",
          }}
        >
          Tidak
        </button>
        <button
          onClick={handleInstallClick}
          style={{
            padding: "8px 20px",
            background: "white",
            border: "none",
            borderRadius: "8px",
            color: remberdawarColors.terracotta,
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: 600,
            transition: "all 0.2s",
          }}
        >
          Pasang
        </button>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
