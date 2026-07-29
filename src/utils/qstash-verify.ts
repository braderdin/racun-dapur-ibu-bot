/*
 * Upstash QStash Webhook Verification Utility
 * Implements HMAC signature verification to secure edge endpoints against unauthorized requests
 */

import crypto from "crypto";

export interface QStashHeaders {
  "Upstash-Signature": string;
  "Upstash-Timestamp": string;
}

export class QStashVerifier {
  private signingKey: string;

  constructor(signingKey: string) {
    this.signingKey = signingKey;
  }

  verifySignature(payload: string, headers: QStashHeaders): boolean {
    if (!headers["Upstash-Signature"] || !headers["Upstash-Timestamp"]) {
      return false;
    }

    const timestamp = headers["Upstash-Timestamp"];
    const signature = headers["Upstash-Signature"];

    // Check timestamp freshness (prevent replay attacks, e.g., 5 minutes window)
    const now = Math.floor(Date.now() / 1000);
    const messageTimestamp = parseInt(timestamp);
    if (Math.abs(now - messageTimestamp) > 300) {
      // 5 minutes
      return false;
    }

    // Construct the signature string
    const signatureString = `${timestamp}.${payload}`;

    // Calculate HMAC-SHA256
    const hmac = crypto.createHmac("sha256", this.signingKey);
    hmac.update(signatureString);
    const calculatedSignature = `v1,${hmac.digest("hex")}`;

    // Constant-time comparison to prevent timing attacks
    return this.constantTimeCompare(signature, calculatedSignature);
  }

  private constantTimeCompare(str1: string, str2: string): boolean {
    if (str1.length !== str2.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < str1.length; i++) {
      result |= str1.charCodeAt(i) ^ str2.charCodeAt(i);
    }

    return result === 0;
  }

  // Helper method to generate signature (for testing/migration tools)
  generateSignature(payload: string, timestamp?: string): string {
    const ts = timestamp || Math.floor(Date.now() / 1000).toString();
    const signatureString = `${ts}.${payload}`;
    const hmac = crypto.createHmac("sha256", this.signingKey);
    hmac.update(signatureString);
    return `v1,${hmac.digest("hex")}`;
  }
}

// Factory function to create verifier from environment variables
export function createQStashVerifier(): QStashVerifier | null {
  // Try multiple possible environment variable names for the signing key
  const signingKey =
    process.env.QSTASH_NEXT_SIGNING_KEY ||
    process.env.QSTASH_CURRENT_SIGNING_KEY ||
    process.env.QSTASH_TOKEN;

  if (!signingKey) {
    // Log warning but don't throw - allow the application to start
    // The verifier will be null and endpoints can still handle requests
    console.warn("QStash signing key not configured in environment variables");
    return null;
  }

  return new QStashVerifier(signingKey);
}

// Express middleware for QStash signature verification
export function qstashVerifierMiddleware(verifier: QStashVerifier | null) {
  return (req: any, res: any, next: any) => {
    // Skip verification if verifier is not available
    if (!verifier) {
      console.warn(
        "QStash signature verification skipped - verifier not available",
      );
      return next();
    }

    try {
      const payload = JSON.stringify(req.body);
      const headers: QStashHeaders = {
        "Upstash-Signature":
          req.headers["upstash-signature"] ||
          req.headers["Upstash-Signature"] ||
          "",
        "Upstash-Timestamp":
          req.headers["upstash-timestamp"] ||
          req.headers["Upstash-Timestamp"] ||
          "",
      };

      if (!verifier.verifySignature(payload, headers)) {
        console.error("QStash signature verification failed", {
          signature: headers["Upstash-Signature"],
          timestamp: headers["Upstash-Timestamp"],
          payload:
            payload.length > 200 ? payload.substring(0, 200) + "..." : payload,
        });
        return res.status(401).json({ error: "Invalid QStash signature" });
      }

      // Add verified flag to request
      req.qstashVerified = true;
      return next();
    } catch (error) {
      console.error("Error during QStash verification:", error);
      return res.status(500).json({ error: "QStash verification error" });
    }
  };
}

// Middleware function that can be used with any web framework
declare global {
  interface IncomingMessage {
    qstashVerified?: boolean;
  }
}

export default {
  QStashVerifier,
  createQStashVerifier,
  qstashVerifierMiddleware,
};
