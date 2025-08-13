import AWS from 'aws-sdk';
import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { PrismaService } from './prismaService';
import { QueueService } from '../queues';
import { storageConfig, s3Config, imageProcessingConfig } from '../config/storage.config';
import {
  FileMetadata,
  FileCategory,
  S3UploadOptions,
  SignedUrlOptions,
  ImageProcessingOptions,
  FileValidationResult,
  VirusScanStatus,
  FileUploadProgress,
  BatchUploadResult
} from '../types/file.types';

export class FileUploadService {
  private s3: AWS.S3;
  private prisma: PrismaService;
  private queueService: QueueService;
  private cloudFront?: AWS.CloudFront;

  constructor() {
    this.prisma = new PrismaService();
    this.queueService = QueueService.getInstance();
    this.initializeS3();
  }

  private initializeS3(): void {
    if (storageConfig.s3) {
      AWS.config.update({
        region: storageConfig.s3.region,
        accessKeyId: storageConfig.s3.accessKeyId,
        secretAccessKey: storageConfig.s3.secretAccessKey
      });

      this.s3 = new AWS.S3({
        endpoint: storageConfig.s3.endpoint,
        signatureVersion: storageConfig.s3.signatureVersion
      });

      if (storageConfig.cdnUrl) {
        this.cloudFront = new AWS.CloudFront();
      }

      logger.info('S3 service initialized');
    }
  }

  async uploadFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string,
    userId: string,
    category: FileCategory,
    options?: Partial<FileMetadata>
  ): Promise<FileMetadata> {
    try {
      // Generate unique filename
      const fileId = uuidv4();
      const extension = path.extname(originalName);
      const filename = `${fileId}${extension}`;
      
      // Validate file
      const validation = await this.validateFile(buffer, mimeType, category);
      if (!validation.isValid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Generate file path based on category
      const key = this.generateFileKey(userId, category, filename);
      
      // Calculate checksum
      const checksum = crypto.createHash('md5').update(buffer).digest('hex');

      // Upload to S3
      const uploadResult = await this.uploadToS3({
        bucket: s3Config.buckets.main,
        key,
        body: buffer,
        contentType: mimeType,
        serverSideEncryption: 'AES256',
        metadata: {
          userId,
          category,
          originalName,
          checksum
        },
        tagging: {
          UserId: userId,
          Category: category,
          UploadDate: new Date().toISOString().split('T')[0]
        }
      });

      // Create file metadata
      const fileMetadata: FileMetadata = {
        id: fileId,
        userId,
        originalName,
        filename,
        mimeType,
        size: buffer.length,
        path: key,
        bucket: s3Config.buckets.main,
        key,
        etag: uploadResult.ETag,
        checksum,
        category,
        metadata: options?.metadata || {},
        isTemporary: options?.isTemporary || false,
        expiresAt: options?.expiresAt,
        virusScanStatus: storageConfig.virusScanEnabled ? VirusScanStatus.PENDING : VirusScanStatus.SKIPPED,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Save to database
      const savedFile = await this.prisma.file.create({
        data: fileMetadata
      });

      // Process image if needed
      if (this.isImageFile(mimeType) && category === FileCategory.PROFILE_PICTURE) {
        await this.queueImageProcessing(fileId, buffer, key);
      }

      // Queue virus scan if enabled
      if (storageConfig.virusScanEnabled) {
        await this.queueVirusScan(fileId);
      }

      // Generate public URL
      const url = await this.getFileUrl(key);
      savedFile.url = url;

      return savedFile;
    } catch (error) {
      logger.error('File upload failed:', error);
      throw error;
    }
  }

  async uploadMultipleFiles(
    files: Array<{
      buffer: Buffer;
      originalName: string;
      mimeType: string;
    }>,
    userId: string,
    category: FileCategory
  ): Promise<BatchUploadResult> {
    const result: BatchUploadResult = {
      successful: [],
      failed: [],
      totalFiles: files.length,
      successCount: 0,
      failCount: 0
    };

    for (const file of files) {
      try {
        const uploaded = await this.uploadFile(
          file.buffer,
          file.originalName,
          file.mimeType,
          userId,
          category
        );
        result.successful.push(uploaded);
        result.successCount++;
      } catch (error) {
        result.failed.push({
          filename: file.originalName,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        result.failCount++;
      }
    }

    return result;
  }

  private async uploadToS3(options: S3UploadOptions): Promise<AWS.S3.ManagedUpload.SendData> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: options.bucket,
      Key: options.key,
      Body: options.body,
      ContentType: options.contentType,
      ContentDisposition: options.contentDisposition,
      ServerSideEncryption: options.serverSideEncryption,
      Metadata: options.metadata,
      ACL: options.acl || 'private',
      StorageClass: options.storageClass || 'STANDARD',
      Tagging: options.tagging ? this.formatTags(options.tagging) : undefined
    };

    return await this.s3.upload(params).promise();
  }

  async getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string> {
    const params: AWS.S3.GetObjectRequest = {
      Bucket: s3Config.buckets.main,
      Key: key,
      ResponseContentType: options?.responseContentType,
      ResponseContentDisposition: options?.responseContentDisposition,
      VersionId: options?.versionId
    };

    return await this.s3.getSignedUrlPromise('getObject', {
      ...params,
      Expires: options?.expires || storageConfig.signedUrlExpiry
    });
  }

  async getFileUrl(key: string): Promise<string> {
    if (storageConfig.cdnUrl) {
      return `${storageConfig.cdnUrl}/${key}`;
    }
    
    return `https://${s3Config.buckets.main}.s3.${storageConfig.s3!.region}.amazonaws.com/${key}`;
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      // Get file metadata
      const file = await this.prisma.file.findFirst({
        where: { id: fileId, userId }
      });

      if (!file) {
        throw new Error('File not found or access denied');
      }

      // Delete from S3
      await this.s3.deleteObject({
        Bucket: file.bucket || s3Config.buckets.main,
        Key: file.key!
      }).promise();

      // Delete thumbnails if they exist
      if (file.category === FileCategory.PROFILE_PICTURE) {
        await this.deleteThumbnails(file.key!);
      }

      // Soft delete from database
      await this.prisma.file.update({
        where: { id: fileId },
        data: { 
          deletedAt: new Date(),
          updatedAt: new Date()
        }
      });

      logger.info(`File deleted: ${fileId} by user ${userId}`);
    } catch (error) {
      logger.error('File deletion failed:', error);
      throw error;
    }
  }

  async processImage(
    buffer: Buffer,
    options: ImageProcessingOptions
  ): Promise<{ processed: Buffer; thumbnail?: Buffer }> {
    try {
      let pipeline = sharp(buffer);

      // Resize if specified
      if (options.resize) {
        pipeline = pipeline.resize(options.resize.width, options.resize.height, {
          fit: options.resize.fit || 'cover',
          withoutEnlargement: true
        });
      }

      // Convert format if specified
      if (options.format) {
        switch (options.format) {
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality: options.quality || 85 });
            break;
          case 'png':
            pipeline = pipeline.png();
            break;
          case 'webp':
            pipeline = pipeline.webp({ quality: options.quality || 85 });
            break;
          case 'avif':
            pipeline = pipeline.avif({ quality: options.quality || 85 });
            break;
        }
      }

      // Optimize if specified
      if (options.optimize) {
        pipeline = pipeline.normalize().sharpen();
      }

      const processed = await pipeline.toBuffer();

      // Generate thumbnail if specified
      let thumbnail: Buffer | undefined;
      if (options.thumbnail) {
        thumbnail = await sharp(buffer)
          .resize(options.thumbnail.width, options.thumbnail.height, { fit: 'cover' })
          .webp({ quality: 80 })
          .toBuffer();
      }

      return { processed, thumbnail };
    } catch (error) {
      logger.error('Image processing failed:', error);
      throw error;
    }
  }

  private async queueImageProcessing(fileId: string, buffer: Buffer, key: string): Promise<void> {
    await this.queueService.addJob('imageProcessing', {
      fileId,
      key,
      sizes: imageProcessingConfig.profilePicture.sizes
    });
  }

  private async queueVirusScan(fileId: string): Promise<void> {
    await this.queueService.addJob('virusScan', {
      fileId
    });
  }

  async validateFile(buffer: Buffer, mimeType: string, category: FileCategory): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fileInfo: {
        size: buffer.length,
        mimeType,
        extension: this.getExtensionFromMimeType(mimeType)
      }
    };

    // Check file size based on category
    const maxSize = this.getMaxSizeForCategory(category);
    if (buffer.length > maxSize) {
      result.isValid = false;
      result.errors.push(`File size ${buffer.length} exceeds maximum ${maxSize} bytes`);
    }

    // Check MIME type
    const allowedTypes = this.getAllowedTypesForCategory(category);
    if (!allowedTypes.includes(mimeType)) {
      result.isValid = false;
      result.errors.push(`MIME type ${mimeType} not allowed for category ${category}`);
    }

    // Additional validation for images
    if (this.isImageFile(mimeType)) {
      try {
        const metadata = await sharp(buffer).metadata();
        result.fileInfo.dimensions = {
          width: metadata.width || 0,
          height: metadata.height || 0
        };

        // Check image dimensions
        if (metadata.width && metadata.height) {
          const maxDimension = 4096;
          if (metadata.width > maxDimension || metadata.height > maxDimension) {
            result.warnings.push(`Image dimensions ${metadata.width}x${metadata.height} are very large`);
          }
        }
      } catch (error) {
        result.isValid = false;
        result.errors.push('Invalid image file');
      }
    }

    // Check for potential security issues
    if (this.hasSuspiciousContent(buffer)) {
      result.isValid = false;
      result.errors.push('File contains suspicious content');
    }

    return result;
  }

  private generateFileKey(userId: string, category: FileCategory, filename: string): string {
    const folder = s3Config.folders[this.getCategoryFolder(category)];
    return `${folder}/${userId}/${filename}`;
  }

  private getCategoryFolder(category: FileCategory): keyof typeof s3Config.folders {
    const mapping: Record<FileCategory, keyof typeof s3Config.folders> = {
      [FileCategory.PROFILE_PICTURE]: 'profilePictures',
      [FileCategory.TRANSACTION_IMPORT]: 'transactionImports',
      [FileCategory.PORTFOLIO_EXPORT]: 'portfolioExports',
      [FileCategory.DOCUMENT]: 'documents',
      [FileCategory.REPORT]: 'documents',
      [FileCategory.BACKUP]: 'backups',
      [FileCategory.TEMPORARY]: 'temporary'
    };

    return mapping[category] || 'documents';
  }

  private getMaxSizeForCategory(category: FileCategory): number {
    const limits: Record<FileCategory, number> = {
      [FileCategory.PROFILE_PICTURE]: 5 * 1024 * 1024, // 5MB
      [FileCategory.TRANSACTION_IMPORT]: 50 * 1024 * 1024, // 50MB
      [FileCategory.PORTFOLIO_EXPORT]: 100 * 1024 * 1024, // 100MB
      [FileCategory.DOCUMENT]: 10 * 1024 * 1024, // 10MB
      [FileCategory.REPORT]: 100 * 1024 * 1024, // 100MB
      [FileCategory.BACKUP]: 1024 * 1024 * 1024, // 1GB
      [FileCategory.TEMPORARY]: 50 * 1024 * 1024 // 50MB
    };

    return limits[category] || 10 * 1024 * 1024; // 10MB default
  }

  private getAllowedTypesForCategory(category: FileCategory): string[] {
    const types: Record<FileCategory, string[]> = {
      [FileCategory.PROFILE_PICTURE]: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      [FileCategory.TRANSACTION_IMPORT]: ['text/csv', 'application/json', 'text/plain'],
      [FileCategory.PORTFOLIO_EXPORT]: ['text/csv', 'application/json', 'application/pdf'],
      [FileCategory.DOCUMENT]: ['application/pdf'],
      [FileCategory.REPORT]: ['application/pdf', 'text/csv', 'application/json'],
      [FileCategory.BACKUP]: ['application/json', 'application/zip'],
      [FileCategory.TEMPORARY]: ['*']
    };

    return types[category] || ['application/pdf'];
  }

  private isImageFile(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/csv': '.csv',
      'application/json': '.json',
      'text/plain': '.txt'
    };

    return extensions[mimeType] || '';
  }

  private hasSuspiciousContent(buffer: Buffer): boolean {
    // Check for common malicious file signatures
    const suspiciousSignatures = [
      Buffer.from([0x4D, 0x5A]), // PE executable
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
      Buffer.from([0xCF, 0xFA, 0xED, 0xFE]), // Mach-O executable
    ];

    return suspiciousSignatures.some(signature => 
      buffer.subarray(0, signature.length).equals(signature)
    );
  }

  private formatTags(tags: Record<string, string>): string {
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private async deleteThumbnails(originalKey: string): Promise<void> {
    const sizes = imageProcessingConfig.profilePicture.sizes;
    const deletePromises = sizes.map(size => {
      const thumbnailKey = originalKey.replace(/(\.[^.]+)$/, `_${size.name}$1`);
      return this.s3.deleteObject({
        Bucket: s3Config.buckets.main,
        Key: thumbnailKey
      }).promise().catch(error => {
        logger.warn(`Failed to delete thumbnail ${thumbnailKey}:`, error);
      });
    });

    await Promise.all(deletePromises);
  }

  async cleanupTemporaryFiles(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - storageConfig.autoCleanup!.temporaryFilesTTL);

      const temporaryFiles = await this.prisma.file.findMany({
        where: {
          isTemporary: true,
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaning up ${temporaryFiles.length} temporary files`);

      for (const file of temporaryFiles) {
        try {
          await this.deleteFile(file.id, file.userId);
        } catch (error) {
          logger.error(`Failed to cleanup file ${file.id}:`, error);
        }
      }
    } catch (error) {
      logger.error('Temporary file cleanup failed:', error);
    }
  }

  async getFileMetadata(fileId: string, userId: string): Promise<FileMetadata | null> {
    return await this.prisma.file.findFirst({
      where: {
        id: fileId,
        userId,
        deletedAt: null
      }
    });
  }

  async getUserFiles(userId: string, category?: FileCategory): Promise<FileMetadata[]> {
    return await this.prisma.file.findMany({
      where: {
        userId,
        category,
        deletedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}