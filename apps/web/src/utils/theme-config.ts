// 🌸 REMBERDAWAR (Wallflower) Theme Configuration
// Warm, inviting kitchen theme inspired by delicate wildflowers and home cooking

import { KitchenThemeColors, CategoryColors } from "../types/catalog";

export const remberdawarColors: KitchenThemeColors = {
  // 💖 Main Theme Colors
  cream: "#FEF2E6", // Warm cream base (like kitchen walls)
  terracotta: "#E57A44", // Clay pot terracotta (kitchen pottery)
  sage: "#8B9A7B", // Dried herb sage (kitchen herbs)
  warmGold: "#D4AF37", // Gold baked good glaze
  charcoal: "#4A4A4A", // Oven mitt charcoal
  snowWhite: "#FDFDFD", // Freshly baked bread white
  copper: "#B87333", // Copper kettle ornaments
};

export const categoryColors: CategoryColors = {
  // 🍳 Kitchen Category - Warm sun Baked Goods
  kitchen: "#E67E22", // Pumpkin/orange (baked goods)
  // 👶 Baby Category - Soft pastels
  baby: "#F8C8DC", // Baby pink (gentle touches)
  // ✨ Skincare Category - Fresh flowers
  skincare: "#E8F5E9", // Herbal green (natural skincare)
};

export const themeConfig = {
  // 📋 Theme Name
  name: "remberdawar",
  displayName: "Remberdawar (Wallflower)",
  description:
    "Warm kitchen theme inspired by delicate wildflowers and home cooking",

  // 🎨 Color Palette
  colors: remberdawarColors,
  categoryColors: categoryColors,

  // 📝 Typography (Inspired by handwritten recipes)
  fonts: {
    heading: "var(--font-playfair)", // Elegant, script-like
    body: "var(--font-inter)", // Clean, readable
    display: "var(--font-lora)", // Warm, classic
  },

  // 🎯 Breakpoints
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
  },

  // 🌈 Gradients
  gradients: {
    sunrise: "linear-gradient(135deg, #FEF2E6 0%, #E57A44 100%)", // Warm kitchen sunrise
    sunset: "linear-gradient(135deg, #8B9A7B 0%, #D4AF37 100%)", // Sage to gold
    dusk: "linear-gradient(135deg, #E8F5E9 0%, #8B9A7B 100%)", // Fresh herbs to sage
    floral: "linear-gradient(135deg, #FDFDFD 0%, #F8C8DC 100%)", // Cream to baby pink
  },

  // 🔔 Shadows
  shadows: {
    soft: "0 2px 8px rgba(229, 122, 68, 0.08)", // Gentle terracotta
    medium: "0 4px 16px rgba(139, 154, 123, 0.12)", // Herbaceous
    strong: "0 8px 24px rgba(216, 175, 55, 0.16)", // Golden warm
    floral: "0 4px 12px rgba(253, 253, 253, 0.20)", // Snow white
    pop: "0 6px 20px rgba(235, 122, 122, 0.15)", // Vibrant pink
  },

  // 🎨 Border Radius
  borderRadius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },

  // ⏱️ Animations
  animations: {
    gentle: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", // Smooth easing
    bounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)", // Playful bounce
    sway: "transform 0.5s ease-in-out", // Rocker motion
  },

  // 📊 Z-index Layers
  zIndex: {
    hide: "-1",
    auto: "auto",
    base: "0",
    docked: "10",
    dropdown: "20",
    sticky: "30",
    banner: "40",
    overlay: "50",
    modal: "60",
    popover: "70",
    skip: "80",
    toast: "90",
    notification: "100",
  },

  // 🍽️ Kitchen-Themed Spacing
  spacing: {
    // 4px increments, inspired by measuring spoons
    "0.5": "2px",
    "1": "4px",
    "1.5": "6px",
    "2": "8px",
    "2.5": "10px",
    "3": "12px",
    "3.5": "14px",
    "4": "16px",
    "5": "20px",
    "6": "24px",
    "7": "28px",
    "8": "32px",
    "9": "36px",
    "10": "40px",
    "12": "48px",
    "14": "56px",
    "16": "64px",
    "20": "80px",
    "24": "96px",
    "28": "112px",
    "32": "128px",
    "36": "144px",
    "40": "160px",
    "44": "176px",
    "48": "192px",
    "52": "208px",
    "56": "224px",
    "60": "240px",
    "64": "256px",
    "72": "288px",
    "80": "320px",
    "96": "384px",
  },

  // 🌸 Themed Components
  components: {
    // 🟡 Button Variants
    button: {
      primary: `bg-gradient-to-r from-[${remberdawarColors.terracotta}] to-[${remberdawarColors.warmGold}] hover:from-[${remberdawarColors.sage}] hover:to-[${remberdawarColors.terracotta}] shadow-medium transition-all duration-300`,
      secondary: `border-2 border-[${remberdawarColors.sage}] bg-[${remberdawarColors.cream}] hover:bg-[${remberdawarColors.sage}] hover:text-[${remberdawarColors.snowWhite}] transition-all duration-300`,
      outline: `border border-[${remberdawarColors.copper}] text-[${remberdawarColors.copper}] hover:bg-[${remberdawarColors.copper}] hover:text-[${remberdawarColors.cream}] transition-all duration-300`,
      ghost: `text-[${remberdawarColors.sage}] hover:bg-[${remberdawarColors.cream}] hover:text-[${remberdawarColors.terracotta}] transition-all duration-300`,
      danger: `bg-[${remberdawarColors.terracotta}] hover:bg-[${remberdawarColors.sage}] text-[${remberdawarColors.snowWhite}] transition-all duration-300`,
    },

    // 🔥 Card Variants
    card: {
      default: `bg-[${remberdawarColors.snowWhite}] rounded-lg shadow-soft border border-[${remberdawarColors.cream}] hover:shadow-medium hover:border-[${remberdawarColors.terracotta}] transition-all duration-300`,
      elevated: `bg-[${remberdawarColors.snowWhite}] rounded-xl shadow-medium hover:shadow-strong transition-all duration-300`,
      flash: `bg-gradient-to-br from-[${remberdawarColors.floral}] to-[${remberdawarColors.snowWhite}] border-2 border-[${remberdawarColors.terracotta}] rounded-lg animate-pulse shadow-pop`,
    },

    // 🍯 Tag Badges
    tag: {
      default: `bg-[${remberdawarColors.cream}] text-[${remberdawarColors.charcoal}] border border-[${remberdawarColors.sage}]`,
      discount: `bg-[${remberdawarColors.terracotta}] text-[${remberdawarColors.snowWhite}]`,
      category: `bg-[${remberdawarColors.sage}] text-[${remberdawarColors.snowWhite}]`,
      new: `bg-gradient-to-r from-[${remberdawarColors.floral}] to-[${remberdawarColors.snowWhite}] text-[${remberdawarColors.terracotta}] border border-[${remberdawarColors.terracotta}]`,
    },
  },

  // 🎯 Special Effects
  effects: {
    // 💨 Hover glow effect
    glow: {
      soft: `0 0 20px rgba(${hexToRgb(remberdawarColors.terracotta)}, 0.15)`,
      medium: `0 0 30px rgba(${hexToRgb(remberdawarColors.warmGold)}, 0.25)`,
      strong: `0 0 40px rgba(${hexToRgb(remberdawarColors.terracotta)}, 0.35)`,
    },

    // ✨ Pattern overlays
    patterns: {
      floral: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 20C4.477 20 0 15.523 0 10S4.477 0 10 0s10 4.477 10 10-10 10 0 10-10 10 0 10 10-10 10 0 10 10 0z' fill='%23${hexToRgb(remberdawarColors.floral.replace("#", "") % 20)}' opacity='0.05'/%3E%3C/svg%3E")`,
      kitchen: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='20' height='20' fill='%23${hexToRgb(remberdawarColors.cream)}'/%3E%3Crect x='20' y='20' fill='%23${hexToRgb(remberdawarColors.cream)}'/%3E%3C/svg%3E")`,
    },
  },
};
