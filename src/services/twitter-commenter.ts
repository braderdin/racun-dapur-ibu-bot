import { Env } from "../types/env";
import { Twitter } from "../services/twitter";
import { LazadaLinkCloaker } from "./link-cloaker-lazada";

export class TwitterCommenter {
  private twitter: Twitter;
  private linkCloaker: LazadaLinkCloaker;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.twitter = new Twitter(env);
    this.linkCloaker = new LazadaLinkCloaker(env);
  }

  /**
   * Post a reply tweet under the main tweet ID containing the cloaked affiliate link and CTA
   * @param mainTweetId - The main tweet ID to reply to
   * @param productData - Product data from Lazada API
   * @param commentText - Comment text to post
   * @returns Tweet response data
   */
  async postReplyTweet(
    mainTweetId: string,
    productData: any,
    commentText: string,
  ): Promise<any> {
    try {
      if (!mainTweetId || !productData || !commentText) {
        throw new Error("Missing required parameters for posting reply tweet");
      }

      // Generate cloaked affiliate link
      const cloakedLink =
        await this.linkCloaker.generateAffiliateLink(productData);
      if (!cloakedLink) {
        throw new Error("Failed to generate cloaked affiliate link");
      }

      // Prepare tweet content with affiliate link
      const tweetContent = this.formatTweetContent(commentText, cloakedLink);

      // Post reply tweet
      const tweetResponse = await this.twitter.postTweet(
        tweetContent,
        mainTweetId,
        {
          inReplyToTweetId: mainTweetId,
          quoteTweetId: null,
        },
      );

      if (!tweetResponse) {
        throw new Error("Failed to post reply tweet");
      }

      console.log(
        `Reply tweet posted successfully: ${tweetResponse.id} under tweet ${mainTweetId}`,
      );
      return {
        success: true,
        tweetId: tweetResponse.id,
        tweetUrl: `https://twitter.com/i/status/${tweetResponse.id}`,
        cloakedLink,
        mainTweetId,
      };
    } catch (error) {
      console.error("Error posting reply tweet:", error);
      throw error;
    }
  }

  /**
   * Post a thread of tweets (Tweet 1: Hook + HD Photo, Tweet 2: Auto-reply Affiliate Short Link)
   * @param productData - Product data from Lazada API
   * @param imageUrl - HD image URL for Tweet 1
   * @returns Thread response data
   */
  async postThread(productData: any, imageUrl?: string): Promise<any> {
    try {
      if (!productData) {
        throw new Error("Missing product data for posting thread");
      }

      const results: any = {
        threadId: `thread_${Date.now()}`,
        tweets: [],
      };

      // Tweet 1: Hook + HD Photo
      const tweet1Content = this.formatHookTweet(productData);
      const tweet1Response = await this.twitter.postTweet(tweet1Content, null, {
        mediaUrls: imageUrl ? [imageUrl] : [],
      });

      if (!tweet1Response) {
        throw new Error("Failed to post Tweet 1");
      }

      results.tweets.push({
        id: tweet1Response.id,
        content: tweet1Content,
        type: "hook",
        imageUrl,
      });

      // Wait a moment before posting Tweet 2
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Tweet 2: Auto-reply with affiliate link
      const cloakedLink =
        await this.linkCloaker.generateAffiliateLink(productData);
      const tweet2Content = this.formatAffiliateTweet(productData, cloakedLink);

      const tweet2Response = await this.twitter.postTweet(
        tweet2Content,
        tweet1Response.id,
        {
          inReplyToTweetId: tweet1Response.id,
        },
      );

      if (!tweet2Response) {
        throw new Error("Failed to post Tweet 2");
      }

      results.tweets.push({
        id: tweet2Response.id,
        content: tweet2Content,
        type: "affiliate",
        cloakedLink,
      });

      console.log(
        `Thread posted successfully with ${results.tweets.length} tweets`,
      );
      return results;
    } catch (error) {
      console.error("Error posting thread:", error);
      throw error;
    }
  }

  /**
   * Format hook tweet content
   * @param productData - Product data
   * @returns Formatted tweet content
   */
  private formatHookTweet(productData: any): string {
    const title = productData.title || "Product";
    const discountRate = productData.discountRate || "0%";
    const price = productData.price || "RM 0.00";

    const hooks = [
      `Penemuan dapur yang sangat baik! ${title.substring(0, 40)}... ${discountRate} diskaun! ✨`,
      `Ibu-ibu, ini sangat berguna untuk dapur! ${title.substring(0, 40)}... Harga hebat RM ${price}! ❤️`,
      `Deal dapur yang tak boleh missed! ${title.substring(0, 40)}... ${discountRate} off! 👇`,
      `Saya sangat suka ${title.substring(0, 40)}... Harga terbaik RM ${price}! Sangat recommend! ⭐`,
    ];

    return hooks[Math.floor(Math.random() * hooks.length)];
  }

  /**
   * Format affiliate tweet content
   * @param productData - Product data
   * @param affiliateLink - Cloaked affiliate link
   * @returns Formatted tweet content
   */
  private formatAffiliateTweet(
    productData: any,
    affiliateLink: string,
  ): string {
    const title = productData.title || "Product";
    const discountRate = productData.discountRate || "0%";

    const templates = [
      `Bolehpilih nak grab promo Lazada kat link ni tau! 👇\n\n${affiliateLink}`,
      `Rekomen sangat-sangat! ${title.substring(0, 30)}... ${discountRate} diskaun! Grab sekarang! 👇\n\n${affiliateLink}`,
      `Harga terbaik! ${title.substring(0, 30)}... Klik link ni untuk grab! 👇\n\n${affiliateLink}`,
      `Penemuan hebat! ${title.substring(0, 30)}... ${discountRate} off! Bolehpilih nak grab promo Lazada kat link ni tau! 👇\n\n${affiliateLink}`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }

  /**
   * Format tweet content with affiliate link
   * @param commentText - Comment text
   * @param affiliateLink - Affiliate link
   * @returns Formatted tweet content
   */
  private formatTweetContent(
    commentText: string,
    affiliateLink: string,
  ): string {
    return `${commentText}\n\n${affiliateLink}`;
  }

  /**
   * Validate tweet content
   * @param content - Tweet content
   * @returns Validation result
   */
  private validateTweetContent(content: string): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (!content) {
      issues.push("Tweet content is empty");
      return { isValid: false, issues };
    }

    if (content.length > 280) {
      issues.push("Tweet exceeds 280 character limit");
    }

    if (!content.includes("http")) {
      issues.push("Tweet missing affiliate link");
    }

    return { isValid: issues.length === 0, issues };
  }

  /**
   * Get Twitter posting statistics
   * @returns Twitter posting statistics
   */
  getPostingStats(): any {
    return {
      platform: "Twitter/X",
      characterLimit: 280,
      threadSupport: true,
      autoReplySupport: true,
      mediaSupport: true,
      rateLimit: "300 tweets per 3 hours",
      postingModes: ["reply", "thread", "quote"],
    };
  }
}
