import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface UploadFileOptions {
  key: string;
  body: Buffer | Uint8Array | string;
  contentType?: string;
  metadata?: Record<string, string>;
  cacheControl?: string;
}

export interface SignedUrlOptions {
  key: string;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.initializeS3();
  }

  private initializeS3(): void {
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME', '');

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      this.logger.warn(
        'AWS S3 not configured. File storage operations will fail.',
      );
      return;
    }

    this.s3Client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.logger.log(
      `AWS S3 initialized: bucket=${this.bucketName}, region=${this.region}`,
    );
  }

  /**
   * Check if S3 is configured
   */
  isConfigured(): boolean {
    return this.s3Client !== null && this.bucketName !== '';
  }

  /**
   * Upload a file to S3
   */
  async uploadFile(options: UploadFileOptions): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
        Body: options.body,
        ContentType: options.contentType || 'application/octet-stream',
        Metadata: options.metadata,
        CacheControl: options.cacheControl,
      });

      await this.s3Client.send(command);

      this.logger.debug(`File uploaded to S3: ${options.key}`);
      return options.key;
    } catch (error) {
      this.logger.error(`Failed to upload file to S3: ${options.key}`, error);
      throw error;
    }
  }

  /**
   * Get a signed URL for temporary access to a file
   */
  async getSignedUrl(options: SignedUrlOptions): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: options.key,
      });

      const expiresIn = options.expiresIn || 3600; // Default 1 hour
      const url = await getSignedUrl(this.s3Client, command, { expiresIn });

      return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate signed URL for: ${options.key}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Delete a file from S3
   */
  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      this.logger.debug(`File deleted from S3: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${key}`, error);
      throw error;
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    // S3 DeleteObjects can handle up to 1000 objects per request
    const batchSize = 1000;
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);

      try {
        // Note: DeleteObjectsCommand would be used here, but for simplicity
        // we'll delete one by one. For better performance, use DeleteObjectsCommand
        await Promise.all(batch.map((key) => this.deleteFile(key)));
      } catch (error) {
        this.logger.error(
          `Failed to delete batch of files (${batch.length} files)`,
          error,
        );
        // Continue with next batch
      }
    }

    this.logger.log(`Deleted ${keys.length} files from S3`);
  }

  /**
   * Check if a file exists in S3
   */
  async fileExists(key: string): Promise<boolean> {
    if (!this.s3Client) {
      return false;
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error: unknown) {
      const awsError = error as {
        name?: string;
        $metadata?: { httpStatusCode?: number };
      };
      if (
        awsError.name === 'NotFound' ||
        awsError.$metadata?.httpStatusCode === 404
      ) {
        return false;
      }
      this.logger.error(`Error checking file existence: ${key}`, error);
      return false;
    }
  }

  /**
   * List files in a prefix (directory)
   */
  async listFiles(prefix: string, maxKeys: number = 1000): Promise<string[]> {
    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }

    try {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      });

      const response = await this.s3Client.send(command);
      const keys = (response.Contents || []).map((object) => object.Key || '');

      return keys.filter((key) => key !== '');
    } catch (error) {
      this.logger.error(`Failed to list files with prefix: ${prefix}`, error);
      throw error;
    }
  }

  /**
   * Get file URL (public URL if bucket is public, otherwise signed URL)
   */
  async getFileUrl(key: string, signed: boolean = true): Promise<string> {
    if (signed) {
      return await this.getSignedUrl({ key });
    }

    // Public URL (if bucket is public)
    return `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Upload announcement image
   */
  async uploadAnnouncementImage(
    announcementId: string,
    imageBuffer: Buffer,
    contentType: string = 'image/jpeg',
  ): Promise<string> {
    const key = `announcements/${announcementId}/image.${this.getExtensionFromContentType(contentType)}`;
    return await this.uploadFile({
      key,
      body: imageBuffer,
      contentType,
      cacheControl: 'public, max-age=31536000', // 1 year
    });
  }

  /**
   * Upload publisher icon
   */
  async uploadPublisherIcon(
    announcementId: string,
    iconBuffer: Buffer,
    contentType: string = 'image/png',
  ): Promise<string> {
    const key = `announcements/${announcementId}/publisher-icon.${this.getExtensionFromContentType(contentType)}`;
    return await this.uploadFile({
      key,
      body: iconBuffer,
      contentType,
      cacheControl: 'public, max-age=31536000', // 1 year
    });
  }

  /**
   * Delete announcement files
   */
  async deleteAnnouncementFiles(announcementId: string): Promise<void> {
    const prefix = `announcements/${announcementId}/`;
    const files = await this.listFiles(prefix);
    if (files.length > 0) {
      await this.deleteFiles(files);
    }
  }

  /**
   * Upload timetable file
   */
  async uploadTimetableFile(
    departmentId: string,
    timetableId: string,
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ): Promise<string> {
    const extension = fileName.split('.').pop() || 'xlsx';
    const key = `timetables/${departmentId}/${timetableId}.${extension}`;
    return await this.uploadFile({
      key,
      body: fileBuffer,
      contentType,
    });
  }

  /**
   * Delete timetable files
   */
  async deleteTimetableFiles(
    departmentId: string,
    timetableId?: string,
  ): Promise<void> {
    if (timetableId) {
      // Delete specific timetable
      const prefix = `timetables/${departmentId}/${timetableId}`;
      const files = await this.listFiles(prefix);
      if (files.length > 0) {
        await this.deleteFiles(files);
      }
    } else {
      // Delete all timetables for department
      const prefix = `timetables/${departmentId}/`;
      const files = await this.listFiles(prefix);
      if (files.length > 0) {
        await this.deleteFiles(files);
      }
    }
  }

  /**
   * Get extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const mapping: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'xlsx',
      'application/vnd.ms-excel': 'xls',
    };

    return mapping[contentType.toLowerCase()] || 'bin';
  }
}
