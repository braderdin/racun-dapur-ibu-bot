import { Env } from "../types/env";
import { FacebookService } from "../services/facebook";
import { LazadaLinkCloaker } from "./link-cloaker-lazada";

export class FacebookCommenter {
  private facebook: FacebookService;
  private linkCloaker: LazadaLinkCloaker;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.facebook = new FacebookService(env);
    this.linkCloaker = new LazadaLinkCloaker(env);
  }

  /**
   * Post the first comment under the published Facebook Page post containing the affiliate shortlink
   * @param postId - Facebook post ID
   * @param productData - Product data from Lazada API
   * @param commentText - Comment text to post
   * @returns Comment response data
   */
  async postComment(
    postId: string,
    productData: any,
    commentText: string,
  ): Promise<any> {
    try {
      if (!postId || !productData || !commentText) {
        throw new Error(
          "Missing required parameters for posting Facebook comment",
        );
      }

      // Generate cloaked affiliate link
      const cloakedLink =
        await this.linkCloaker.generateAffiliateLink(productData);
      if (!cloakedLink) {
        throw new Error("Failed to generate cloaked affiliate link");
      }

      // Prepare comment content with affiliate link
      const commentContent = this.formatCommentContent(
        commentText,
        cloakedLink,
      );

      // Post comment
      const commentResponse = await this.facebook.postCommentToFacebook(
        postId,
        {
          message: commentContent,
        },
      );

      if (!commentResponse || !commentResponse.success) {
        throw new Error("Failed to post Facebook comment");
      }

      console.log(
        `Facebook comment posted successfully: ${commentResponse.id} under post ${postId}`,
      );
      return {
        success: true,
        commentId: commentResponse.id,
        commentUrl: `${commentResponse.id}`, // Facebook doesn't provide direct URL for comments
        cloakedLink,
        postId,
      };
    } catch (error) {
      console.error("Error posting Facebook comment:", error);
      throw error;
    }
  }

  /**
   * Post main Facebook Page post with HD image and storytelling copywriting
   * @param productData - Product data from Lazada API
   * @param imageUrl - HD image URL
   * @returns Post response data
   */
  async postMainPost(productData: any, imageUrl?: string): Promise<any> {
    try {
      if (!productData) {
        throw new Error("Missing product data for posting Facebook Page post");
      }

      // Generate cloaked affiliate link
      const cloakedLink =
        await this.linkCloaker.generateAffiliateLink(productData);

      // Format storytelling caption
      const caption = this.formatStorytellingCaption(productData, cloakedLink);

      // Post main post
      const postResponse = await this.facebook.postToFacebookPage({
        message: caption,
        link: cloakedLink,
        picture:
          imageUrl || "https://via.placeholder.com/1200x630?text=Product+Image",
      });

      if (!postResponse || !postResponse.success) {
        throw new Error("Failed to post Facebook Page content");
      }

      console.log(
        `Facebook Page post published successfully: ${postResponse.id}`,
      );
      return {
        success: true,
        postId: postResponse.id,
        postUrl: `https://www.facebook.com/${postResponse.id}`, // Facebook Page post URL format
        cloakedLink,
        caption,
      };
    } catch (error) {
      console.error("Error posting Facebook Page content:", error);
      throw error;
    }
  }

  /**
   * Format storytelling caption for Facebook Page post
   * @param productData - Product data
   * @param affiliateLink - Cloaked affiliate link
   * @returns Formatted caption
   */
  private formatStorytellingCaption(
    productData: any,
    affiliateLink: string,
  ): string {
    const title = productData.title || "Product";
    const discountRate = productData.discountRate || "0%";
    const price = productData.price || "RM 0.00";
    const rating = productData.rating || "0.0";

    const templates = [
      `Penemuan dapur yang sangat baik! Saya sangat suka ${title.substring(0, 40)}... ${discountRate} diskaun! Harga terbaik RM ${price}! Sangat recommend untuk keluarga! ✨\n\nBolehpilih nak grab promo Lazada kat link ni tau!\n\n${affiliateLink}`,
      `Hai semua! Saya ingin berkongsi penemuan hebat untuk dapur! ${title.substring(0, 40)}... ${discountRate} off! RM ${price} sahaja! Sangat berguna untuk ibu & bayi! ❤️\n\nBolehpilih nak grab promo Lazada kat link ni tau!\n\n${affiliateLink}`,
      `Ibu-ibu, ini sangat berguna untuk dapur! ${title.substring(0, 40)}... ${discountRate} diskaun! Rating ${rating}/5. Sangat recommend! Bolehpilih nak grab promo Lazada kat link ni tau!\n\n${affiliateLink}`,
      `Deal dapur yang tak boleh missed! ${title.substring(0, 40)}... ${discountRate} off! RM ${price} sahaja! Sangat berguna untuk keluarga Malaysia! 👇\n\nBolehpilih nak grab promo Lazada kat link ni tau!\n\n${affiliateLink}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Format comment content with affiliate link
   * @param commentText - Comment text
   * @param affiliateLink - Affiliate link
   * @returns Formatted comment content
   */
  private formatCommentContent(
    commentText: string,
    affiliateLink: string,
  ): string {
    return `${commentText}\n\nBolehpilih nak grab promo Lazada kat link ni tau!\n\n${affiliateLink}`;
  }

  /**
   * Validate Facebook post/comment content
   * @param content - Content to validate
   * @returns Validation result
   */
  private validateContent(content: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!content) {
      issues.push("Content is empty");
      return { isValid: false, issues };
    }

    if (content.length > 65536) {
      // Facebook comment limit
      issues.push("Content exceeds Facebook character limit");
    }

    if (!content.includes("http")) {
      issues.push("Content missing affiliate link");
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Get Facebook posting statistics
   * @returns Facebook posting statistics
   */
  getPostingStats(): any {
    return {
      platform: "Facebook Page",
      commentLimit: 65536,
      postLimit: 63206208,
      imageSupport: true,
      linkSupport: true,
      autoCommentSupport: true,
      rateLimit: "5 comments per minute",
      postingModes: ["comment", "main_post"],
    };
  }
}
