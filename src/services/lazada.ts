import { Env, ProductItem } from "../types/env";

export class LazadaService {
  private appKey: string;
  private appSecret: string;

  constructor(env: Env) {
    this.appKey = env.LAZADA_APP_KEY;
    this.appSecret = env.LAZADA_APP_SECRET;
  }

  /**
   * Menarik produk diskaun & trending dari Lazada Open API
   */
  async fetchTrendingProducts(): Promise<ProductItem[]> {
    try {
      // Mock Data / Real API call wrapper
      // Nanti bila endpoint affiliate Lazada rasmi dipasangkan, skrip ini memanggil REST API Lazada
      return [
        {
          id: "laz_001",
          title: "Air Fryer 5L Non-Stick Touch Screen Kitchen Appliance",
          price: "RM 119.00",
          originalPrice: "RM 299.00",
          discountRate: "60%",
          imageUrl: "https://sg-test-11.slatic.net/p/example-airfryer.jpg",
          affiliateUrl: "https://c.lazada.com.my/t/c.Yxxxx",
          soldCount: "1.2k+ Terjual",
        },
        {
          id: "laz_002",
          title: "Set Pisau Dapur Stainless Steel High Grade 6-in-1",
          price: "RM 29.90",
          originalPrice: "RM 79.00",
          discountRate: "62%",
          imageUrl: "https://sg-test-11.slatic.net/p/example-knife.jpg",
          affiliateUrl: "https://c.lazada.com.my/t/c.Yyyyy",
          soldCount: "850+ Terjual",
        },
      ];
    } catch (error) {
      console.error("Error fetching Lazada products:", error);
      return [];
    }
  }
}
