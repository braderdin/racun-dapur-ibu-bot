"use client";

import React, { useState, useMemo } from "react";
import { CatalogProduct } from "../types/catalog";
import { BudgetRange, BudgetFilterService } from "../utils/budget-filter";
import { remberdawarColors } from "../utils/theme-config";

// ---------------------------------------------------------------------------
// Category Quick Filter Component
// ---------------------------------------------------------------------------

interface CategoryQuickFilterProps {
  products: CatalogProduct[];
  onFilterChange?: (
    filteredProducts: CatalogProduct[],
    filters: FilterState,
  ) => void;
  className?: string;
}

interface FilterState {
  category: string;
  budget: BudgetRange | BudgetRange[];
  searchQuery: string;
  sortBy: "price-asc" | "price-desc" | "discount" | "rating";
}

const CATEGORIES = [
  { label: "Semua", value: "all" },
  { label: "Bawah RM20", value: "<20" },
  { label: "RM20-50", value: "20-50" },
  { label: "RM50-100", value: "50-100" },
  { label: "Atas RM100", value: ">100" },
  { label: "Airfryer", value: "airfryer" },
  { label: "Barang Baby", value: "baby" },
  { label: "Paling Viral", value: "viral" },
  { label: "Dapur", value: "kitchen" },
  { label: "Kecantikan", value: "skincare" },
];

export const CategoryQuickFilter: React.FC<CategoryQuickFilterProps> = ({
  products,
  onFilterChange,
  className = "",
}) => {
  const [filterState, setFilterState] = useState<FilterState>({
    category: "all",
    budget: "<20",
    searchQuery: "",
    sortBy: "discount",
  });

  const budgetFilterService = useMemo(() => new BudgetFilterService(), []);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Apply search query filter
    if (filterState.searchQuery.trim()) {
      const query = filterState.searchQuery.toLowerCase();
      result = result.filter(
        (product) =>
          product.product_name.toLowerCase().includes(query) ||
          product.category.toLowerCase().includes(query) ||
          (product.tags && product.tags.toLowerCase().includes(query)),
      );
    }

    // Apply category filter
    if (filterState.category !== "all") {
      if (
        CATEGORIES.find(
          (c) => c.value === filterState.category,
        )?.label.startsWith("Bawah") ||
        CATEGORIES.find(
          (c) => c.value === filterState.category,
        )?.label.startsWith("RM") ||
        CATEGORIES.find(
          (c) => c.value === filterState.category,
        )?.label.startsWith("Atas")
      ) {
        // Budget filter
        const budgetRange = filterState.category as BudgetRange;
        result = budgetFilterService.filterByBudget(result, budgetRange);
      } else if (filterState.category === "viral") {
        // Sort by sold count (viral)
        result.sort((a, b) => {
          const aSold = parseInt(a.lazada_sold || a.shopee_sold || "0", 10);
          const bSold = parseInt(b.lazada_sold || b.shopee_sold || "0", 10);
          return bSold - aSold;
        });
      } else if (filterState.category === "airfryer") {
        result = result.filter(
          (p) =>
            p.product_name.toLowerCase().includes("airfryer") ||
            p.category.toLowerCase().includes("kitchen"),
        );
      } else if (filterState.category === "baby") {
        result = result.filter(
          (p) =>
            p.product_name.toLowerCase().includes("baby") ||
            p.category.toLowerCase().includes("baby"),
        );
      } else if (filterState.category === "kitchen") {
        result = result.filter(
          (p) =>
            p.category.toLowerCase().includes("kitchen") ||
            p.product_name.toLowerCase().includes("kuali") ||
            p.product_name.toLowerCase().includes("periuk") ||
            p.product_name.toLowerCase().includes("pembakar"),
        );
      } else if (filterState.category === "skincare") {
        result = result.filter(
          (p) =>
            p.category.toLowerCase().includes("skincare") ||
            p.product_name.toLowerCase().includes("skincare") ||
            p.product_name.toLowerCase().includes("kecantikan"),
        );
      }
    }

    // Apply sorting
    switch (filterState.sortBy) {
      case "price-asc":
        result.sort((a, b) => {
          const aPrice = a.lazada_price || a.shopee_price || 0;
          const bPrice = b.lazada_price || b.shopee_price || 0;
          return aPrice - bPrice;
        });
        break;
      case "price-desc":
        result.sort((a, b) => {
          const aPrice = a.lazada_price || a.shopee_price || 0;
          const bPrice = b.lazada_price || b.shopee_price || 0;
          return bPrice - aPrice;
        });
        break;
      case "discount":
        result.sort((a, b) => {
          const aDisc = a.lazada_discount || a.shopee_discount || 0;
          const bDisc = b.lazada_discount || b.shopee_discount || 0;
          return bDisc - aDisc;
        });
        break;
      case "rating":
        result.sort((a, b) => {
          const aRating = a.lazada_rating || a.shopee_rating || 0;
          const bRating = b.lazada_rating || b.shopee_rating || 0;
          return bRating - aRating;
        });
        break;
    }

    return result;
  }, [products, filterState, budgetFilterService]);

  // Notify parent of filter changes
  React.useEffect(() => {
    onFilterChange?.(filteredProducts, filterState);
  }, [filteredProducts, filterState, onFilterChange]);

  const handleCategoryClick = (category: string) => {
    setFilterState((prev) => ({ ...prev, category }));
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterState((prev) => ({ ...prev, searchQuery: e.target.value }));
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterState((prev) => ({
      ...prev,
      sortBy: e.target.value as FilterState["sortBy"],
    }));
  };

  return (
    <div className={`category-quick-filter ${className}`}>
      {/* Search Bar */}
      <div style={{ marginBottom: "12px" }}>
        <input
          type="text"
          placeholder="Cari produk..."
          value={filterState.searchQuery}
          onChange={handleSearchChange}
          style={{
            width: "100%",
            padding: "10px 16px",
            border: `2px solid ${remberdawarColors.terracotta}30`,
            borderRadius: "8px",
            fontSize: "14px",
            outline: "none",
            fontFamily: "var(--font-inter)",
          }}
        />
      </div>

      {/* Category Filter Strip */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          overflowX: "auto",
          paddingBottom: "8px",
          marginBottom: "12px",
          scrollbarWidth: "none",
        }}
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.value}
            onClick={() => handleCategoryClick(category.value)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: `1px solid ${
                filterState.category === category.value
                  ? remberdawarColors.terracotta
                  : "#e0e0e0"
              }`,
              background:
                filterState.category === category.value
                  ? remberdawarColors.terracotta
                  : "white",
              color:
                filterState.category === category.value
                  ? "white"
                  : remberdawarColors.charcoal,
              fontSize: "13px",
              fontWeight:
                filterState.category === category.value ? "600" : "400",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.2s ease",
            }}
          >
            {category.label}
          </button>
        ))}
      </div>

      {/* Sort Control */}
      <div style={{ marginBottom: "8px" }}>
        <select
          value={filterState.sortBy}
          onChange={handleSortChange}
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            border: `1px solid #e0e0e0`,
            fontSize: "13px",
            outline: "none",
            fontFamily: "var(--font-inter)",
          }}
        >
          <option value="discount">Diskaun Tertinggi</option>
          <option value="rating">Rating Tertinggi</option>
          <option value="price-asc">Harga: Murah ke Mahal</option>
          <option value="price-desc">Harga: Mahal ke Murah</option>
        </select>
      </div>

      {/* Result Count */}
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          color: "#999",
        }}
      >
        {filteredProducts.length} produk ditemui
      </p>
    </div>
  );
};

export default CategoryQuickFilter;
