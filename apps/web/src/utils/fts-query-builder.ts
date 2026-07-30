"use client";

export interface FTSQueryOptions {
  query?: string;
  category?: string;
  limit?: number;
  offset?: number;
  includeVector?: boolean;
  language?: 'malay' | 'english' | 'combined';
  filters?: {
    discountMin?: number;
    budget?: { min?: number; max?: number };
    availability?: 'available' | 'all';
  };
}

export interface FTSQueryResult {
  query: string;
  results: any[];
  total: number;
  executionTime: number;
  coverage?: number;
}

export class FTSQueryBuilder {
  private supabaseUrl: string;
  private supabaseKey: string;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl;
    this.supabaseKey = supabaseKey;
  }

  // 🔍 Build optimized FTS query for Malay/English
  buildQuery(options: FTSQueryOptions): string {
    const {
      query = '',
      category,
      includeVector = true,
      language = 'combined',
      filters,
    } = options;

    let sql = '';

    if (includeVector && query.trim()) {
      // Build comprehensive text search using to_tsvector
      const normalizedQuery = this.normalizeQuery(query, language);
      sql += this.buildVectorSearch(normalizedQuery, language);

      if (category) {
        sql += ` AND category = '${category}'`;
      }

      if (filters?.discountMin) {
        sql += ` AND (lazada_discount >= ${filters.discountMin} OR shopee_discount >= ${filters.discountMin})`;
      }

      if (filters?.budget?.min && filters?.budget?.max) {
        sql += ` AND (lazada_price >= ${filters.budget.min} AND lazada_price <= ${filters.budget.max})`;
        sql += ` OR (shopee_price >= ${filters.budget.min} AND shopee_price <= ${filters.budget.max})`;
      }

      if (filters?.availability === 'available') {
        sql += ` AND (lazada_availability = 'available' OR shopee_availability = 'available')`;
      }
    } else {
      // Fallback to ILIKE for empty queries
      sql += this.buildFullTextFallback(query);

      if (category) {
        sql += ` AND category = '${category}'`;
      }
    }

    return sql.trim();
  }

  // 💾 Normalize query for Malay/English optimization
  private normalizeQuery(query: string, language: string): string {
    // Remove punctuation and extra spaces
    let normalized = query.toLowerCase().trim();

    if (language === 'combined') {
      // Handle Malay and English words
      normalized = this.enhanceForMalayEnglish(normalized);
    } else if (language === 'malay') {
      normalized = this.malayStemming(normalized);
    } else {
      normalized = this.englishStemming(normalized);
    }

    return normalized;
  }

  // 🎯 Enhance query for bilingual support
  private enhanceForMalayEnglish(query: string): string {
    // Add common Malay prefixes/suffixes for better matching
    const commonTerms = [
      'makanan', 'minuman', 'barang', 'dapur', 'ibu', 'bayi',
      'skincare', 'kosmetik', 'sepatu', 'baju', 'telekung',
    ];

    const queryWords = query.split(' ');
    const enhancedWords = queryWords.map(word => {
      // Apply Malay stemming if applicable
      if (word.length > 3) {
        word = this.malayStemming(word);
      }
      return word;
    });

    return enhancedWords.join(' ');
  }

  // 📝 Malay word stemming
  private malayStemming(word: string): string {
    const malaySuffixes = [
      'kan', 'an', 'i', 'lah', 'pun', 'lah', 'kah', 'tau',
      'nya', 'mu', 'ku', 'dia', 'mereka', 'kami', 'kita',
    ];

    for (const suffix of malaySuffixes) {
      if (word.endsWith(suffix)) {
        return word.slice(0, -suffix.length) || word;
      }
    }

    return word;
  }

  // 📝 English word stemming
  private englishStemming(word: string): string {
    const englishSuffixes = [
      'ing', 'ed', 'ly', 'es', 's', 'tion', 'ed', 'er',
      'ism', 'ity', 'al', 'y', 'ify', 'ise', 'ize',
    ];

    for (const suffix of englishSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    return word;
  }

  // 🔍 Build vector search query (PostgreSQL specific)
  private buildVectorSearch(query: string, language: string): string {
    const tsvectorColumn = language === 'malay' ? 'to_tsvector("public", lazada_product_name)' :
                          language === 'english' ? 'to_tsvector("en", lazada_product_name)' :
                          `to_tsvector("public", lazada_product_name) || to_tsvector("en", lazada_product_name)`;

    const plainTo_tsquery = language === 'malay' ? 'to_tsquery("public", ?)' :
                           language === 'english' ? 'to_tsquery("en", ?)' :
                           `to_tsquery("public", ?) || to_tsquery("en", ?)`;

    let conditions = [];

    // Primary vector search
    if (language === 'combined') {
      conditions.push(`${tsvectorColumn} @@ ${plainTo_tsquery}`);
    } else {
      conditions.push(`${tsvectorColumn} @@ ${plainTo_tsquery}`);
    }

    // Fallback ILIKE
    conditions.push(`product_name ILIKE ?`);

    // Category filter as separate condition
    // Will be handled by caller

    return `(${conditions.join(' OR ')})`;
  }

  // 🔄 Fallback ILIKE query for simplicity
  private buildFullTextFallback(query: string): string {
    const queryPattern = `%${query}%`;
    return `(
      product_name ILIKE ? OR
      product_description ILIKE ? OR
      lazada_sku ILIKE ? OR
      shopee_sku ILIKE ?
    )`;
  }

  // ⚡ Execute FTS query with performance monitoring
  async executeQuery(
    queryOptions: FTSQueryOptions,
    pageSize: number = 20,
    page: number = 0
  ): Promise<FTSQueryResult> {
    const startTime = Date.now();

    try {
      const builtQuery = this.buildQuery(queryOptions);
      const offset = page * pageSize;

      // Construct SQL query with parameters
      const sql = `
        SELECT 
          id,
          sku,
          product_name,
          product_description,
          category,
          lazada_price,
          shopee_price,
          lazada_discount,
          shopee_discount,
          lazada_image,
          shopee_image,
          lazada_availability,
          shopee_availability,
          total_clicks,
          lazada_peak_hour_percent,
          shopee_peak_hour_percent,
          lazada_peak_hour_end,
          shopee_peak_hour_end,
          lazada_peak_hour_remaining,
          shopee_peak_hour_remaining,
          -- Calculate relevance score
          CASE
            WHEN lazada_peak_hour_percent > 0 THEN lazada_peak_hour_percent
            WHEN shopee_peak_hour_percent > 0 THEN shopee_peak_hour_percent
            ELSE 0
          END as relevance_score,
          -- Calculate time-based priority
          GREATEST(
            CASE
              WHEN lazada_peak_hour_end THEN EXTRACT(EPOCH FROM (lazada_peak_hour_end - NOW())) / 3600
              ELSE 86400
            END,
            CASE
              WHEN shopee_peak_hour_end THEN EXTRACT(EPOCH FROM (shopee_peak_hour_end - NOW())) / 3600
              ELSE 86400
            END
          ) as time_remaining_hours
        FROM posted_products
        WHERE ${builtQuery}
        AND (lazada_availability = 'available' OR shopee_availability = 'available')
        ORDER BY 
          relevance_score DESC,
          time_remaining_hours ASC,
          total_clicks DESC,
          skus SORTER?
        LIMIT ${pageSize}
        OFFSET ${offset};
      `;

      const response = await fetch(`${this.supabaseUrl}/rest/v1/posted_products`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
          'Content-Type': 'application/json',
          'Prefer': 'count=exact',
          'query': queryOptions.query || '',
          'category': queryOptions.category || '',
        },
        next: { revalidate: 300 }, // Cache for 5 minutes
      });

      if (!response.ok) {
        throw new Error(`FTS query failed: ${response.statusText}`);
      }

      const data = await response.json();
      const totalCount = response.headers.get('content-range')
        ? parseInt(response.headers.get('content-range')?.split('/')[1] || '0')
        : data.length;

      const executionTime = Date.now() - startTime;

      return {
        query: JSON.stringify(queryOptions),
        results: data,
        total: totalCount,
        executionTime,
        coverage: totalCount > 0 ? Math.min((data.length / totalCount) * 100, 100) : 0,
      };
    } catch (error) {
      console.error('FTS query execution error:', error);
      throw error;
    }
  }

  // 🛡️ Validate query safety
  validateQuerySafety(query: string): boolean {
    // Basic injection prevention
    const dangerousPatterns = [
      /;.*/,
      /'--/,
      /\/\*.*?\*\//s,
      /exec /i,
      /drop /i,
      /alter /i,
      /create /i,
      /union /i,
      /select /i,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(query));
  }

  // 📊 Get query performance metrics
  async getQueryMetrics(): Promise<any> {
    const response = await fetch(`${this.supabaseUrl}/rest/v1/posted_products`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.supabaseKey}`,
        'apikey': this.supabaseKey,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get query metrics');
    }

    const data = await response.json();

    return {
      totalProducts: data.length,
      indexedProducts: data.filter((p: any) => p.product_name).length,
      searchCoverage: data.length > 0 ? (data.filter((p: any) => p.product_name).length / data.length) * 100 : 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  // 🧪 Test FTS configuration
  async testFTSConfiguration(): Promise<boolean> {
    try {
      // Test basic search functionality
      const testResponse = await fetch(`${this.supabaseUrl}/rest/v1/posted_products`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.supabaseKey}`,
          'apikey': this.supabaseKey,
          'limit': '1',
        },
      });

      return testResponse.ok;
    } catch {
      return false;
    }
  }
}

// 🌟 Singleton factory function
export function createFTSQueryBuilder(): FTSQueryBuilder {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return new FTSQueryBuilder(supabaseUrl, supabaseKey);
}