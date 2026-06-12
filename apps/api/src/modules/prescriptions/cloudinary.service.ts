import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Archives prescription PDFs to Cloudinary. Gracefully no-ops when credentials
 * are absent — callers fall back to on-demand PDF generation.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger('Cloudinary');
  private readonly configured: boolean;

  constructor() {
    const name = process.env.CLOUDINARY_CLOUD_NAME;
    const key = process.env.CLOUDINARY_API_KEY;
    const secret = process.env.CLOUDINARY_API_SECRET;
    this.configured = Boolean(name && key && secret);
    if (this.configured) {
      cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret, secure: true });
    }
  }

  isConfigured(): boolean {
    return this.configured;
  }

  /** Uploads (or overwrites) a PDF buffer as a raw asset; returns its secure URL, or null. */
  uploadPdf(buffer: Buffer, publicId: string): Promise<string | null> {
    if (!this.configured) return Promise.resolve(null);
    return new Promise((resolve) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: 'raw', public_id: publicId, format: 'pdf', overwrite: true, invalidate: true },
        (err, res) => {
          if (err || !res) {
            this.logger.warn(`PDF archival failed for ${publicId}: ${err?.message ?? 'no response'}`);
            resolve(null);
          } else {
            resolve(res.secure_url);
          }
        },
      );
      stream.end(buffer);
    });
  }

  /**
   * Uploads a base64 data-URL (image or PDF) and returns its secure URL, or null when unconfigured.
   * `resource_type: 'auto'` lets Cloudinary detect images vs raw documents (PDFs). Used by KYC.
   */
  async uploadDataUrl(dataUrl: string, publicId: string): Promise<string | null> {
    if (!this.configured) return null;
    try {
      const res = await cloudinary.uploader.upload(dataUrl, {
        resource_type: 'auto',
        public_id: publicId,
        overwrite: true,
        invalidate: true,
      });
      return res.secure_url;
    } catch (e) {
      this.logger.warn(`Upload failed for ${publicId}: ${(e as Error).message}`);
      return null;
    }
  }
}
