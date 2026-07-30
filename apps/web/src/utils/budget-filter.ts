// 💰 Budget Filter Helper
// Comprehensive price filtering and categorization for the Remberdawar web portal
// Supports Malay/English localization and multiple filter strategies

import { CatalogProduct } from '../types/catalog';

export type BudgetRange = '<20' | '20-50' | '50-100' | '>100';

export interface BudgetFilter {
  range: BudgetRange;
  min?: number;
  max?: number;
  applyToBothPlatforms?: boolean; // true to filter by either lazada OR shopee
}

export interface BudgetStats {
  totalProducts: number;
  categoryStats: Record<string, number>;
  priceDistribution: {
    '<50': number;
    '50-100': number;
    '100-200': number;
    '200-500': number;
    '>500': number;
  };
  averagePrice: number;
  medianPrice: number;
  mostExpensive: {
    lazada: number;
    shopee: number;
    productId?: string;
  };
  bestDeal: {
    productId: string;
    lazadaDiscount?: number;
    shopeeDiscount?: number;
    lazadaPrice?: number;
    shopeePrice?: number;
    platform: 'lazada' | 'shopee' | 'both';
  };
}

export class BudgetFilterService {
  // 🎯 Main filtering function with multiple strategies
  filterByBudget(
    products: CatalogProduct[],
    budgets: BudgetRange | BudgetRange[]
  ): CatalogProduct[] {
    const budgetsArray = Array.isArray(budgets) ? budgets : [budgets];

    return products.filter(product => {
      return budgetsArray.some(budget => {
        const budgetConfig = this.getBudgetConfig(budget);
        return this.meetsBudgetCriteria(product, budgetConfig);
      });
    });
  }

  // 📊 Filter with statistics
  filterWithStats(
    products: CatalogProduct[],
    budgets: BudgetRange | BudgetRange[]
  ): {
    filtered: CatalogProduct[];
    stats: BudgetStats;
    rangeFilters: BudgetFilter[];
  } {
    const budgetsArray = Array.isArray(budgets) ? budgets : [budgets];

    // Apply each budget filter
    const rangeFilters = budgetsArray.map(budget => this.getBudgetConfig(budget));
    const filtered = this.filterByBudget(products, budgetsArray);

    // Calculate comprehensive statistics
    const stats = this.calculateBudgetStats(filtered);

    return {
      filtered,
      stats,
      rangeFilters,
    };
  }

  // 🔍 Filter products by specific price range
  filterByPriceRange(
    products: CatalogProduct[],
    minPrice: number,
    maxPrice: number,
    platform?: 'lazada' | 'shopee' | 'both'
  ): CatalogProduct[] {
    return products.filter(product => {
      const lazadaPrice = product.lazada_price;
      const shopeePrice = product.shopee_price;

      switch (platform) {
        case 'lazada':
          return lazadaPrice !== null && lazadaPrice !== undefined &&
                 lazadaPrice >= minPrice && lazadaPrice <= maxPrice;

        case 'shopee':
          return shopeePrice !== null && shopeePrice !== undefined &&
                 shopeePrice >= minPrice && shopeePrice <= maxPrice;

        case 'both':
          return (lazadaPrice !== null && lazadaPrice !== undefined &&
                  lazadaPrice >= minPrice && lazadaPrice <= maxPrice) ||
                 (shopeePrice !== null && shopeePrice !== undefined &&
                  shopeePrice >= minPrice && shopeePrice <= maxPrice);

        default:
          // If no platform specified, require both platforms to have price in range
          return (lazadaPrice !== null && lazadaPrice !== undefined &&
                  lazadaPrice >= minPrice && lazadaPrice <= maxPrice) &&
                 (shopeePrice !== null && shopeePrice !== undefined &&
                  shopeePrice >= minPrice && shopeePrice <= maxPrice);
      }
    });
  }

  // 🎯 Filter by discount percentage
  filterByDiscount(
    products: CatalogProduct[],
    minDiscount: number,
    platform?: 'lazada' | 'shopee' | 'both'
  ): CatalogProduct[] {
    switch (platform) {
      case 'lazada':
        return products.filter(p =>
          p.lazada_discount && p.lazada_discount >= minDiscount
        );

      case 'shopee':
        return products.filter(p =>
          p.shopee_discount && p.shopee_discount >= minDiscount
        );

      case 'both':
        return products.filter(p =>
          (p.lazada_discount && p.lazada_discount >= minDiscount) ||
          (p.shopee_discount && p.shopee_discount >= minDiscount)
        );

      default:
        return products.filter(p =>
          (p.lazada_discount && p.lazada_discount >= minDiscount) ||
          (p.shopee_discount && p.shopee_discount >= minDiscount)
        );
    }
  }

  // 🏷️ Categorize products by budget range
  categorizeByBudget(products: CatalogProduct[]): {
    '<20': CatalogProduct[];
    '20-50': CatalogProduct[];
    '50-100': CatalogProduct[];
    '>100': CatalogProduct[];
  } {
    const categories: { [key in BudgetRange]: CatalogProduct[] } = {
      '<20': [],
      '20-50': [],
      '50-100': [],
      '>100': [],
    };

    products.forEach(product => {
      const prices = this.getAvailablePrices(product);
      if (prices.length === 0) return;

      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      let assignedCategory: BudgetRange = '>100'; // Default

      if (minPrice < 20) assignedCategory = '<20';
      else if (minPrice < 50) assignedCategory = '20-50';
      else if (minPrice < 100) assignedCategory = '50-100';
      else assignedCategory = '>100';

      categories[assignedCategory].push(product);
    });

    return categories;
  }

  // 📊 Calculate budget distribution across price bands
  calculatePriceDistribution(products: CatalogProduct[]): {
    '<50': number;
    '50-100': number;
    '100-200': number;
    '200-500': number;
    '>500': number;
  } {
    const distribution = {
      '<50': 0,
      '50-100': 0,
      '100-200': 0,
      '200-500': 0,
      '>500': 0,
    };

    products.forEach(product => {
      const lazadaPrice = product.lazada_price;
      const shopeePrice = product.shopee_price;

      const prices = [lazadaPrice, shopeePrice].filter(p => p !== null && p !== undefined) as number[];

      prices.forEach(price => {
        if (price < 50) distribution['<50']++;
        else if (price < 100) distribution['50-100']++;
        else if (price < 200) distribution['100-200']++;
        else if (price < 500) distribution['200-500']++;
        else distribution['>500']++;
      });
    });

    return distribution;
  }

  // 📈 Calculate comprehensive budget statistics
  private calculateBudgetStats(filtered: CatalogProduct[]): BudgetStats {
    const prices: number[] = [];
    let categoryStats: Record<string, number> = {};

    filtered.forEach(product => {
      // Collect prices
      if (product.lazada_price !== null && product.lazada_price !== undefined) {
        prices.push(product.lazada_price);
      }
      if (product.shopee_price !== null && product.shopee_price !== undefined) {
        prices.push(product.shopee_price);
      }

      // Collect category stats
      if (product.category) {
        categoryStats[product.category] = (categoryStats[product.category] || 0) + 1;
      }
    });

    if (prices.length === 0) {
      return {
        totalProducts: 0,
        categoryStats: {},
        priceDistribution: { '<50': 0, '50-100': 0, '100-200': 0, '200-500': 0, '>500': 0 },
        averagePrice: 0,
        medianPrice: 0,
        mostExpensive: { lazada: 0, shopee: 0 },
        bestDeal: { productId: '', platform: 'both' },
      };
    }

    prices.sort((a, b) => a - b);

    const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const medianPrice = prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)];

    const mostExpensive = {
      lazada: Math.max(...prices.filter(p => p > 0)),
      shopee: Math.max(...prices.filter(p => p > 0)),
      productId: filtered.find(p => p.lazada_price === Math.max(...prices) || p.shopee_price === Math.max(...prices))?.id,
    };

    const bestDeal = this.findBestDeal(filtered);

    return {
      totalProducts: filtered.length,
      categoryStats,
      priceDistribution: this.calculatePriceDistribution(filtered),
      averagePrice: Number(averagePrice.toFixed(2)),
      medianPrice: Number(medianPrice.toFixed(2)),
      mostExpensive,
      bestDeal,
    };
  }

  // 🎯 Find best deal across all platforms
  private findBestDeal(products: CatalogProduct[]): BudgetStats['bestDeal'] {
    let bestDeal: BudgetStats['bestDeal'] = { productId: '', platform: 'both' };
    let maxDiscount = -1;
    let maxDiscountPlatform = 'both';

    products.forEach(product => {
      const lazadaDiscount = product.lazada_discount || 0;
      const shopeeDiscount = product.shoepe_discount || 0;

      if (lazadaDiscount > maxDiscount) {
        maxDiscount = lazadaDiscount;
        maxDiscountPlatform = 'lazada';
        bestDeal = {
          productId: product.id,
          lazadaDiscount,
          shopeeDiscount,
          lazadaPrice: product.lazada_price,
          shopeePrice: product.shopee_price,
          platform: maxDiscountPlatform as 'lazada' | 'shopee' | 'both',
        };
      }

      if (shopeeDiscount > maxDiscount) {
        maxDiscount = shopeeDiscount;
        maxDiscountPlatform = 'shopee';
        bestDeal = {
          productId: product.id,
          lazadaDiscount,
          shopeeDiscount,
          lazadaPrice: product.lazada_price,
          shopeePrice: product.shopee_price,
          platform: maxDiscountPlatform as 'lazada' | 'shopee' | 'both',
        };
      }
    });

    return bestDeal;
  }

  // 🔍 Get available prices for a product
  private getAvailablePrices(product: CatalogProduct): number[] {
    const prices: number[] = [];

    if (product.lazada_price !== null && product.lazada_price !== undefined) {
      prices.push(product.lazada_price);
    }

    if (product.shopee_price !== null && product.shopee_price !== undefined) {
      prices.push(product.shopee_price);
    }

    return prices;
  }

  // 📋 Get budget configuration
  private getBudgetConfig(budget: BudgetRange): BudgetFilter {
    switch (budget) {
      case '<20':
        return { range: '<20', min: 0, max: 19 };
      case '20-50':
        return { range: '20-50', min: 20, max: 50 };
      case '50-100':
        return { range: '50-100', min: 50, max: 100 };
      case '>100':
        return { range: '>100', min: 100 };
      default:
        return { range: '>100', min: 100 };
    }
  }

  // ✅ Check if product meets budget criteria
  private meetsBudgetCriteria(
    product: CatalogProduct,
    budgetConfig: BudgetFilter
  ): boolean {
    const prices = this.getAvailablePrices(product);

    // If product has no available prices, skip
    if (prices.length === 0) return false;

    // Check if product has price within budget range
    return prices.some(price => {
      if (budgetConfig.max !== undefined) {
        return price >= (budgetConfig.min || 0) && price <= budgetConfig.max;
      } else {
        return price >= (budgetConfig.min || 0);
      }
    });
  }

  // 🌍 Localize budget labels for different languages
  getLocalizedBudgetLabels(language: 'ms' | 'en' = 'ms'): Record<BudgetRange, string> {
    const labels: Record<'ms' | 'en', Record<BudgetRange, string>> = {
      ms: {
        '<20': '< RM20',
        '20-50': 'RM20 - RM50',
        '50-100': 'RM50 - RM100',
        '>100': '> RM100',
      },
      en: {
        '<20': '< RM20',
        '20-50': 'RM20 - RM50',
        '50-100': 'RM50 - RM100',
        '>100': '> RM100',
      },
    };

    return labels[language];
  }

  // 🎯 Get budget color coding for UI
  getBudgetColor(budget: BudgetRange): string {
    const colors: Record<BudgetRange, string> = {
      '<20': '#10b981',    // Green
      '20-50': '#3b82f6',  // Blue
      '50-100': '#f59e0b', // Yellow/Orange
      '>100': '#ef4444',   // Red
    };

    return colors[budget] || '#6b7280';
  }

  // 📊 Generate budget filter analytics
  generateFilterAnalytics(
    products: CatalogProduct[],
    selectedBudget: BudgetRange
  ): {
    count: number;
    percentage: number;
    averagePrice: number;
    bestDeals: any[];
  } {
    const filtered = this.filterByBudget(products, selectedBudget);
    const count = filtered.length;
    const total = products.length;
    const percentage = total > 0 ? (count / total) * 100 : 0;

    const averagePrice = filtered.reduce((sum, product) => {
      const prices = this.getAvailablePrices(product);
      return sum + (prices.reduce((pSum, price) => pSum + price, 0) / prices.length);
    }, 0) / (count || 1);

    // Get best deals for this budget range
    const bestDeals = this.getBestDealsForBudget(filtered, selectedBudget);

    return {
      count,
      percentage,
      averagePrice: Number(averagePrice.toFixed(2)),
      bestDeals,
    };
  }

  // 🏆 Get best deals for specific budget range
  private getBestDealsForBudget(
    products: CatalogProduct[],
    budget: BudgetRange
  ): any[] {
    const budgetConfig = this.getBudgetConfig(budget);
    const filtered = products.filter(product =>
      this.meetsBudgetCriteria(product, budgetConfig)
    );

    // Sort by discount and clicks
    return filtered
      .sort((a, b) => {
        const aDiscount = Math.max(a.lazada_discount || 0, a.shopee_discount || 0);
        const bDiscount = Math.max(b.lazada_discount || 0, b.shopee_discount || 0);
        return bDiscount - aDiscount;
      })
      .slice(0, 5) // Top 5 best deals
      .map(product => ({
        id: product.id,
        productName: product.product_name,
        lazadaPrice: product.lazada_price,
        shopeePrice: product.shopee_price,
        lazadaDiscount: product.lazada_discount,
        shopeeDiscount: product.shopee_discount,
        lazadaImage: product.lazada_image,
        shopeeImage: product.shopee_image,
        totalClicks: product.total_clicks,
        category: product.category,
        lazadaPeakHourPercent: product.lazada_peak_hour_percent,
        shopeePeakHourPercent: product.shopee_peak_hour_percent,
      })));
  }

  // 🔧 Utility: Validate budget configuration
  validateBudgetConfig(budget: any): budget is BudgetFilter {
    return typeof budget === 'object' &&
           budget !== null &&
           typeof budget.range === 'string' &&
           (budget.range === '<20' || budget.range === '20-50' || budget.range === '50-100' || budget.range === '>100') &&
           (budget.min === undefined || typeof budget.min === 'number') &&
           (budget.max === undefined || typeof budget.max === 'number') &&
           (budget.applyToBothPlatforms === undefined || typeof budget.applyToBothPlatforms === 'boolean');
  }

  // 📋 Get all available budget ranges
  getAllBudgetRanges(): BudgetRange[] {
    return ['<20', '20-50', '50-100', '>100'];
  }

  // 🎯 Generate budget recommendation based on user preferences
  generateBudgetRecommendation(
    products: CatalogProduct[],
    maxBudget?: number,
    preferredCategories?: string[]
  ): {
    recommendedBudget: BudgetRange;
    reason: string;
    bestProducts: CatalogProduct[];
  } {
    const categories = this.categorizeByBudget(products);

    // Find budget range with most products within maxBudget
    let recommendedBudget = '>100'; // Default
    let maxProductsInBudget = 0;

    this.getAllBudgetRanges().forEach(budget => {
      const budgetConfig = this.getBudgetConfig(budget);
      const filtered = products.filter(product =>
        budgetConfig.max !== undefined &&
        this.getAvailablePrices(product).some(price => price <= (budgetConfig.max || Infinity))
      );

      if (filtered.length > maxProductsInBudget) {
        maxProductsInBudget = filtered.length;
        recommendedBudget = budget;
      }
    });

    // If maxBudget is specified, find closest budget
    if (maxBudget !== undefined) {
      const matchingBudget = this.getAllBudgetRanges().find(budget => {
        const config = this.getBudgetConfig(budget);
        return config.max && config.max >= maxBudget;
      });

      if (matchingBudget) recommendedBudget = matchingBudget;
    }

    // Get best products for recommended budget
    const bestProducts = this.filterByBudget(products, recommendedBudget);

    // Generate recommendation reason
    const reason = `Found ${maxProductsInBudget} products in your preferred budget range (${recommendedBudget})`;

    return {
      recommendedBudget,
      reason,
      bestProducts,
    };
  }

  // 🧪 Debug and testing utilities
  debugBudgetFilter(products: CatalogProduct[]): {
    total: number;
    categorized: { [key in BudgetRange]: number };
    priceDistribution: ReturnType<BudgetFilterService['calculatePriceDistribution']>;
    averagePrice: number;
  } {
    const categorized = this.categorizeByBudget(products);
    const categoryCounts = Object.entries(categorized).reduce((acc, [key, value]) => {
      acc[key as BudgetRange] = value.length;
      return acc;
    }, {} as { [key in BudgetRange]: number });

    const priceDistribution = this.calculatePriceDistribution(products);

    let totalPrice = 0;
    let priceCount = 0;

    products.forEach(product => {
      const prices = this.getAvailablePrices(product);
      totalPrice += prices.reduce((sum, price) => sum + price, 0);
      priceCount += prices.length;
    });

    return {
      total: products.length,
      categorized: categoryCounts,
      priceDistribution,
      averagePrice: priceCount > 0 ? totalPrice / priceCount : 0,
    };
  }
}

// 🌟 Singleton instance
export const budgetFilterService = new BudgetFilterService();