"use client";

import type { Metadata } from "next";
import { Inter, Playfair_Display, Lora } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { remberdawarColors } from "@/utils/theme-config";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});
const lora = Lora({ subsets: ["latin"], variable: "--font-lora" });

export const metadata: Metadata = {
  title: "@RacunDapurIbu - Katalog Produk Dapur & Ibu Mertua",
  description: "Katalog produk dapur & ibu mertua terkini dengan harga terbaik",
  openGraph: {
    title: "@RacunDapurIbu - Katalog Produk Dapur & Ibu Mertua",
    description:
      "Katalog produk dapur & ibu mertua terkini dengan harga terbaik",
    type: "website",
    locale: "ms_MY",
    siteName: "@RacunDapurIbu",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "@RacunDapurIbu - Katalog Produk",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "@RacunDapurIbu - Katalog Produk Dapur & Ibu Mertua",
    description:
      "Katalog produk dapur & ibu mertua terkini dengan harga terbaik",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ms" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content={remberdawarColors.terracotta} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>
      <body
        className={`${inter.variable} ${playfair.variable} ${lora.variable} ${inter.className}`}
        style={
          {
            "--color-cream": remberdawarColors.cream,
            "--color-terracotta": remberdawarColors.terracotta,
            "--color-sage": remberdawarColors.sage,
            "--color-warmGold": remberdawarColors.warmGold,
            "--color-charcoal": remberdawarColors.charcoal,
            "--color-snowWhite": remberdawarColors.snowWhite,
            "--color-copper": remberdawarColors.copper,
          } as React.CSSProperties
        }
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
