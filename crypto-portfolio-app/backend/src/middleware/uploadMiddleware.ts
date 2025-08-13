import multer from 'multer';
import sharp from 'sharp';
import { S3 } from 'aws-sdk';
import { Request, Response, NextFunction } from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs/promises';
import { validateImageFile, sanitizeFilename } from '../utils/validation';

// AWS S3 Configuration
const s3 = new S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'crypto-portfolio-uploads';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Memory storage for processing
const storage = multer.memoryStorage();

// File filter for images only
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
  }
};

// Base multer configuration
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

export class UploadMiddleware {
  // Single avatar upload
  static avatarUpload = upload.single('avatar');

  // Process and upload avatar
  static processAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Validate file
      validateImageFile(req.file);

      // Generate unique filename
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const fileName = `avatar_${crypto.randomUUID()}${fileExtension}`;
      const userId = (req as any).user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // Process image with Sharp
      let processedBuffer: Buffer;
      
      try {
        processedBuffer = await sharp(req.file.buffer)
          .resize(400, 400, {
            fit: 'cover',
            position: 'center'
          })
          .jpeg({ quality: 85, progressive: true })
          .toBuffer();
      } catch (error) {
        console.error('Image processing error:', error);
        return res.status(400).json({ error: 'Invalid image file' });
      }

      // Upload to S3 or local storage
      let avatarUrl: string;
      
      if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
        // Upload to S3
        try {
          const uploadParams = {
            Bucket: BUCKET_NAME,
            Key: `avatars/${userId}/${fileName}`,
            Body: processedBuffer,
            ContentType: 'image/jpeg',
            ACL: 'public-read' as const,
            Metadata: {
              userId: userId,
              originalName: sanitizeFilename(req.file.originalname),
              uploadDate: new Date().toISOString()
            }
          };

          const uploadResult = await s3.upload(uploadParams).promise();
          avatarUrl = uploadResult.Location;
        } catch (error) {
          console.error('S3 upload error:', error);
          return res.status(500).json({ error: 'Failed to upload avatar' });
        }
      } else {
        // Local storage for development
        const uploadsDir = path.join(process.cwd(), 'uploads', 'avatars', userId);
        
        try {
          await fs.mkdir(uploadsDir, { recursive: true });
          const filePath = path.join(uploadsDir, fileName);
          await fs.writeFile(filePath, processedBuffer);
          avatarUrl = `/uploads/avatars/${userId}/${fileName}`;
        } catch (error) {
          console.error('Local storage error:', error);
          return res.status(500).json({ error: 'Failed to save avatar' });
        }
      }

      // Add avatar URL to request for controller to use
      (req as any).avatarUrl = avatarUrl;
      next();

    } catch (error) {
      console.error('Avatar processing error:', error);
      if (error instanceof Error) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Avatar upload failed' });
      }
    }
  };

  // Delete avatar from storage
  static deleteAvatar = async (avatarUrl: string): Promise<void> => {
    if (!avatarUrl) return;

    try {
      if (avatarUrl.includes('amazonaws.com') && process.env.AWS_ACCESS_KEY_ID) {
        // Delete from S3
        const key = avatarUrl.split('.com/')[1];
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: key
        }).promise();
      } else if (avatarUrl.startsWith('/uploads/')) {
        // Delete from local storage
        const filePath = path.join(process.cwd(), avatarUrl);
        await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist
      }
    } catch (error) {
      console.error('Avatar deletion error:', error);
      // Don't throw error - continue with profile update even if file deletion fails
    }
  };

  // Serve local avatars (development only)
  static serveAvatars = (req: Request, res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV !== 'production') {
      const avatarPath = path.join(process.cwd(), 'uploads', req.path);
      res.sendFile(avatarPath, (error) => {
        if (error) {
          res.status(404).json({ error: 'Avatar not found' });
        }
      });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  };

  // Cleanup old avatars
  static cleanupOldAvatars = async (userId: string, keepCurrent?: string): Promise<void> => {
    try {
      if (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID) {
        // List and delete old avatars from S3
        const listParams = {
          Bucket: BUCKET_NAME,
          Prefix: `avatars/${userId}/`
        };

        const objects = await s3.listObjectsV2(listParams).promise();
        if (objects.Contents) {
          const deleteObjects = objects.Contents
            .filter(obj => keepCurrent ? !obj.Key?.includes(path.basename(keepCurrent)) : true)
            .map(obj => ({ Key: obj.Key! }));

          if (deleteObjects.length > 0) {
            await s3.deleteObjects({
              Bucket: BUCKET_NAME,
              Delete: { Objects: deleteObjects }
            }).promise();
          }
        }
      } else {
        // Cleanup local storage
        const avatarDir = path.join(process.cwd(), 'uploads', 'avatars', userId);
        try {
          const files = await fs.readdir(avatarDir);
          for (const file of files) {
            if (!keepCurrent || !keepCurrent.includes(file)) {
              await fs.unlink(path.join(avatarDir, file)).catch(() => {});
            }
          }
        } catch (error) {
          // Directory doesn't exist - that's fine
        }
      }
    } catch (error) {
      console.error('Avatar cleanup error:', error);
    }
  };

  // Validate image dimensions and content
  static validateImageContent = async (buffer: Buffer): Promise<boolean> => {
    try {
      const metadata = await sharp(buffer).metadata();
      
      // Check dimensions
      if (!metadata.width || !metadata.height) return false;
      if (metadata.width > 4096 || metadata.height > 4096) return false;
      if (metadata.width < 50 || metadata.height < 50) return false;
      
      // Check format
      if (!['jpeg', 'png', 'webp'].includes(metadata.format || '')) return false;
      
      return true;
    } catch (error) {
      return false;
    }
  };

  // Compress and optimize images
  static optimizeImage = async (buffer: Buffer, options: {
    width?: number;
    height?: number;
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
  } = {}): Promise<Buffer> => {
    const {
      width = 400,
      height = 400,
      quality = 85,
      format = 'jpeg'
    } = options;

    let processor = sharp(buffer)
      .resize(width, height, {
        fit: 'cover',
        position: 'center'
      });

    switch (format) {
      case 'jpeg':
        processor = processor.jpeg({ quality, progressive: true });
        break;
      case 'png':
        processor = processor.png({ quality, progressive: true });
        break;
      case 'webp':
        processor = processor.webp({ quality });
        break;
    }

    return processor.toBuffer();
  };

  // Error handling middleware
  static handleUploadError = (error: any, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({ error: 'Unexpected file field.' });
        default:
          return res.status(400).json({ error: 'File upload error.' });
      }
    }

    if (error.message.includes('Only JPEG, PNG, and WebP')) {
      return res.status(400).json({ error: error.message });
    }

    console.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error during upload.' });
  };

  // Health check for storage systems
  static checkStorageHealth = async (): Promise<{ s3: boolean; local: boolean }> => {
    const health = { s3: false, local: false };

    // Check S3
    if (process.env.AWS_ACCESS_KEY_ID) {
      try {
        await s3.headBucket({ Bucket: BUCKET_NAME }).promise();
        health.s3 = true;
      } catch (error) {
        console.error('S3 health check failed:', error);
      }
    }

    // Check local storage
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.access(uploadsDir);
      health.local = true;
    } catch (error) {
      try {
        await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
        health.local = true;
      } catch (createError) {
        console.error('Local storage health check failed:', createError);
      }
    }

    return health;
  };
}

export const uploadMiddleware = {
  avatar: UploadMiddleware.avatarUpload,
  process: UploadMiddleware.processAvatar,
  delete: UploadMiddleware.deleteAvatar,
  serve: UploadMiddleware.serveAvatars,
  cleanup: UploadMiddleware.cleanupOldAvatars,
  error: UploadMiddleware.handleUploadError,
  health: UploadMiddleware.checkStorageHealth
};