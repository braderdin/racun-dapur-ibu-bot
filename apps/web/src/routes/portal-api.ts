"use server";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SearchParams, FilterCriteria } from "../types/catalog";
import { catalogService } from "../services/supabase-catalog";

// Initialize Supabase service client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// 🔐 API Authentication Middleware
function verifyApiKey(request: Request): boolean {
  const apiKey = request.headers.get("x-api-key");
  const validApiKey = process.env.API_KEY;

  return !validApiKey || apiKey === validApiKey;
}

// ⚡ Handle API errors consistently
function handleApiError(error: any, operation: string): NextResponse {
  console.error(`API Error in ${operation}:`, error);

  // Handle specific Supabase errors
  if (error.code === "PGRST301") {
    return NextResponse.json(
      { error: "Not found", message: `Resource not found for ${operation}` },
      { status: 404 },
    );
  }

  if (error.code === "PGRST301") {
    return NextResponse.json(
      { error: "Database error", message: `Database error in ${operation}` },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      error: "Internal server error",
      message: `An error occurred during ${operation}`,
    },
    { status: 500 },
  );
}

// 📊 Get catalog with search and filters (SSR)
export async function GET(request: Request): Promise<NextResponse> {
  try {
    // Verify authentication
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const params: SearchParams = {
      query: searchParams.get("query") || undefined,
      limit: searchParams.get("limit")
        ? parseInt(searchParams.get("limit")!)
        : 20,
      offset: searchParams.get("offset")
        ? parseInt(searchParams.get("offset")!)
        : 0,
      filters: {
        category: searchParams.get("category") || undefined,
        discountMin: searchParams.get("discountMin")
          ? parseFloat(searchParams.get("discountMin")!)
          : undefined,
        budget: {
          min: searchParams.get("budgetMin")
            ? parseFloat(searchParams.get("budgetMin")!)
            : undefined,
          max: searchParams.get("budgetMax")
            ? parseFloat(searchParams.get("budgetMax")!)
            : undefined,
        },
      },
    };

    // Get catalog data using catalog service (SSR)
    const response = await catalogService.searchProducts(params);

    // Simulate network latency for realistic performance
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 100 + 50),
    );

    return NextResponse.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString(),
      cacheInfo: {
        revalidatedAt: new Date().toISOString(),
        staleWhileRevalidate: 3600, // 1 hour
      },
    });
  } catch (error) {
    return handleApiError(error, "GET catalog");
  }
}

// 🆕 Create new product (protected)
export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Verify authentication
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const body = await request.json();

    // Validate required fields
    const requiredFields = [
      "id",
      "sku",
      "product_name",
      "category",
      "lazada_url",
      "shopee_url",
    ];
    const missingFields = requiredFields.filter((field) => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: "Validation error",
          message: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Insert new product into database
    const { data, error } = await supabase
      .from("posted_products")
      .insert([body])
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        {
          error: "Database error",
          message: `Failed to create product: ${error.message}`,
        },
        { status: 500 },
      );
    }

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data,
        message: "Product created successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error, "POST product");
  }
}

// 📊 Get catalog statistics
export async function GET_STATS(request: Request): Promise<NextResponse> {
  try {
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const stats = await catalogService.getCatalogStats();

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "GET stats");
  }
}

// 📊 Get flash sale products
export async function GET_FLASH_SALES(request: Request): Promise<NextResponse> {
  try {
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 10;

    const flashSales = await catalogService.getActiveDeals(limit);

    return NextResponse.json({
      success: true,
      data: flashSales,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleApiError(error, "GET flash sales");
  }
}

// 🔍 Search products by keywords
export async function GET_SEARCH(request: Request): Promise<NextResponse> {
  try {
    if (!verifyApiKey(request)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing API key" },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 20;

    if (!query.trim()) {
      return NextResponse.json({
        success: true,
        data: [],
        message: "Please provide a search query",
        timestamp: new Date().toISOString(),
      });
    }

    const searchParamsObj: SearchParams = {
      query,
      limit,
    };

    const response = await catalogService.searchProducts(searchParamsObj);

    return NextResponse.json({
      success: true,
      data: response,
      query,
      timestamp: new Date().toISOString(),
      searchResults: {
        total: response.pagination.total,
        limit,
        queryType: "full-text",
      },
    });
  } catch (error) {
    return handleApiError(error, "GET search");
  }
}

// 🔄 Handle OPTIONS requests for CORS
export async function OPTIONS(request: Request): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // In production, restrict this to specific domains
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
      "Access-Control-Max-Age": "86400",
    },
  });
}

// 📊 Health check endpoint
export async function GET_HEALTH(request: Request): Promise<NextResponse> {
  try {
    const startTime = Date.now();

    // Test database connection
    const { data, error } = await supabase
      .from("posted_products")
      .select("count")
      .limit(1);

    const responseTime = Date.now() - startTime;

    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      services: {
        database: error ? "unhealthy" : "healthy",
        api: "healthy",
      },
      performance: {
        responseTime,
        status: responseTime < 1000 ? "good" : "slow",
      },
      version: process.env.APP_VERSION || "1.0.0",
    };

    return NextResponse.json(health);
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}

// 📊 API documentation endpoint
export async function GET_DOCS(request: Request): Promise<NextResponse> {
  const docs = {
    version: "1.0.0",
    name: "@RacunDapurIbu Web Portal API",
    description: "REST API for Vercel Next.js Web Catalog Portal",
    baseUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
    auth: {
      type: "API Key",
      header: "x-api-key",
      note: "Required for all endpoints except health check",
    },
    endpoints: [
      {
        path: "/api/catalog",
        method: "GET",
        description: "Get catalog with search and filters",
        parameters: [
          {
            name: "query",
            type: "string",
            optional: true,
            description: "Search keywords",
          },
          {
            name: "category",
            type: "string",
            optional: true,
            description: "Product category",
          },
          {
            name: "discountMin",
            type: "number",
            optional: true,
            description: "Minimum discount percentage",
          },
          {
            name: "budgetMin",
            type: "number",
            optional: true,
            description: "Minimum budget",
          },
          {
            name: "budgetMax",
            type: "number",
            optional: true,
            description: "Maximum budget",
          },
          {
            name: "limit",
            type: "number",
            optional: true,
            default: 20,
            description: "Results per page",
          },
          {
            name: "offset",
            type: "number",
            optional: true,
            default: 0,
            description: "Page offset",
          },
        ],
      },
      {
        path: "/api/catalog/search",
        method: "GET",
        description: "Search products by keywords",
        parameters: [
          {
            name: "q",
            type: "string",
            optional: false,
            description: "Search query",
          },
          {
            name: "limit",
            type: "number",
            optional: true,
            default: 20,
            description: "Results limit",
          },
        ],
      },
      {
        path: "/api/catalog/flash-sales",
        method: "GET",
        description: "Get active flash sale products",
        parameters: [
          {
            name: "limit",
            type: "number",
            optional: true,
            default: 10,
            description: "Number of flash sales to return",
          },
        ],
      },
      {
        path: "/api/catalog/stats",
        method: "GET",
        description: "Get catalog statistics and analytics",
      },
      {
        path: "/api/health",
        method: "GET",
        description: "API health check",
      },
      {
        path: "/api",
        method: "GET",
        description: "API documentation",
      },
    ],
  };

  return NextResponse.json(docs, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60", // 5 minutes cache
    },
  });
}
