import { z } from "zod";

// ProductItem interface sudah didefinisikan di src/types/env.ts

// Zod validation schemas
export const ProductItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.string(),
  originalPrice: z.string().optional(),
  discountRate: z.string().optional(),
  imageUrl: z.string(),
  affiliateUrl: z.string(),
  rating: z.string().optional(),
  soldCount: z.string().optional(),
});

export const GeneratedCopySchema = z.object({
  tweetHook: z.string(),
  tweetReply: z.string(),
});

export type PostResult = {
  success: boolean;
  productId?: string;
  tweetId?: string;
  error?: string;
};

export type ProductValidation = {
  isValid: boolean;
  product?: any;
  errors?: string[];
};

// Utility functions
export function validateProduct(data: any): ProductValidation {
  try {
    const validated = ProductItemSchema.parse(data);
    return { isValid: true, product: validated };
  } catch (error) {
    return {
      isValid: false,
      errors:
        error instanceof z.ZodError
          ? error.errors.map((err) => err.message)
          : ["Invalid product data"],
    };
  }
}
