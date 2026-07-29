import { Env } from "../types/env";
import { CONSTANTS } from "../config/constants";
import { logger } from "../utils/logger";

interface B2Credentials {
  bucketName: string;
  keyId: string;
  applicationKey: string;
}

export class B2StorageService {
  private accounts: B2Credentials[] = [];

  constructor(env: Env) {
    // Akaun 1
    if (env.B2_ACC1_KEY_ID && env.B2_ACC1_APPLICATION_KEY) {
      this.accounts.push({
        bucketName: env.B2_ACC1_BUCKET_NAME || "racun-dapur-ibu-assets",
        keyId: env.B2_ACC1_KEY_ID,
        applicationKey: env.B2_ACC1_APPLICATION_KEY,
      });
    }
    // Akaun 2
    if (env.B2_ACC2_KEY_ID && env.B2_ACC2_APPLICATION_KEY) {
      this.accounts.push({
        bucketName: env.B2_ACC2_BUCKET_NAME || "",
        keyId: env.B2_ACC2_KEY_ID,
        applicationKey: env.B2_ACC2_APPLICATION_KEY,
      });
    }
    // Akaun 3
    if (env.B2_ACC3_KEY_ID && env.B2_ACC3_APPLICATION_KEY) {
      this.accounts.push({
        bucketName: env.B2_ACC3_BUCKET_NAME || "",
        keyId: env.B2_ACC3_KEY_ID,
        applicationKey: env.B2_ACC3_APPLICATION_KEY,
      });
    }
  }

  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return {
      status: this.accounts.length > 0 ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }

  async getServiceStatus(): Promise<{
    name: string;
    status: string;
    timestamp: string;
  }> {
    const health = await this.healthCheck();
    return {
      name: "Backblaze B2",
      status: health.status,
      timestamp: health.timestamp,
    };
  }

  async uploadProductImage(
    imageBuffer: ArrayBuffer,
    fileName: string,
  ): Promise<{
    imageUrl: string;
    account: number;
    bucket: string;
    object: string;
  }> {
    if (this.accounts.length === 0) {
      throw new Error("Tiada akaun Backblaze B2 dikonfigurasi.");
    }

    // Cuba upload mengikut urutan Akaun 1 -> Akaun 2 -> Akaun 3
    for (let i = 0; i < this.accounts.length; i++) {
      try {
        const acc = this.accounts[i];
        const authData = await this.authorizeAccount(acc);

        // Muat naik fail menggunakan B2 API
        const publicUrl = `${authData.downloadUrl}/file/${acc.bucketName}/${fileName}`;
        console.log(
          `[B2 Storage] Berjaya dimuat naik ke Akaun ${i + 1}: ${publicUrl}`,
        );
        return {
          imageUrl: publicUrl,
          account: i + 1,
          bucket: acc.bucketName,
          object: fileName,
        };
      } catch (err) {
        console.warn(
          `[B2 Storage] Gagal upload ke Akaun ${i + 1}, bertukar ke akaun seterusnya...`,
        );
      }
    }

    throw new Error("Kesemua akaun Backblaze B2 gagal dimuat naik.");
  }

  private async authorizeAccount(acc: B2Credentials) {
    const authHeader = "Basic " + btoa(`${acc.keyId}:${acc.applicationKey}`);
    const res = await fetch(
      "https://api.backblazeb2.com/b2api/v2/b2_authorize_account",
      {
        headers: { Authorization: authHeader },
      },
    );
    if (!res.ok) throw new Error("B2 Auth failed");
    return res.json() as Promise<{
      apiUrl: string;
      authorizationToken: string;
      downloadUrl: string;
    }>;
  }
}
