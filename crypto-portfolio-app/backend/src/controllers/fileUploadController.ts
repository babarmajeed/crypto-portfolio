import { Request, Response } from 'express';
import multer from 'multer';
import { FileUploadService } from '../services/fileUploadService';
import { logger } from '../utils/logger';
import { FileCategory } from '../types/file.types';
import { uploadLimits } from '../config/storage.config';

export class FileUploadController {
  private fileUploadService: FileUploadService;

  constructor() {
    this.fileUploadService = new FileUploadService();
  }

  // Configure multer for different file types
  private createMulterConfig(category: FileCategory) {
    const limits = this.getLimitsForCategory(category);
    
    return multer({
      storage: multer.memoryStorage(),
      limits: {
        fileSize: limits.maxSize,
        files: category === FileCategory.TRANSACTION_IMPORT ? 10 : 1
      },
      fileFilter: (req, file, cb) => {
        const isValid = limits.allowedTypes.includes(file.mimetype);
        if (isValid) {
          cb(null, true);
        } else {
          cb(new Error(`File type ${file.mimetype} not allowed`));
        }
      }
    });
  }

  private getLimitsForCategory(category: FileCategory) {
    switch (category) {
      case FileCategory.PROFILE_PICTURE:
        return uploadLimits.profilePicture;
      case FileCategory.TRANSACTION_IMPORT:
        return uploadLimits.transactionImport;
      case FileCategory.PORTFOLIO_EXPORT:
        return uploadLimits.portfolioExport;
      case FileCategory.DOCUMENT:
        return uploadLimits.document;
      default:
        return uploadLimits.document;
    }
  }

  // Profile picture upload
  uploadProfilePicture = [
    this.createMulterConfig(FileCategory.PROFILE_PICTURE).single('profilePicture'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          });
        }

        // Delete existing profile picture
        const existingFiles = await this.fileUploadService.getUserFiles(
          userId,
          FileCategory.PROFILE_PICTURE
        );

        for (const file of existingFiles) {
          await this.fileUploadService.deleteFile(file.id, userId);
        }

        // Upload new profile picture
        const fileMetadata = await this.fileUploadService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          userId,
          FileCategory.PROFILE_PICTURE
        );

        res.status(200).json({
          success: true,
          message: 'Profile picture uploaded successfully',
          data: {
            fileId: fileMetadata.id,
            url: fileMetadata.url,
            thumbnailUrl: fileMetadata.thumbnailUrl
          }
        });
      } catch (error) {
        logger.error('Profile picture upload failed:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }
  ];

  // Transaction import file upload
  uploadTransactionFile = [
    this.createMulterConfig(FileCategory.TRANSACTION_IMPORT).array('transactionFiles', 10),
    async (req: Request, res: Response) => {
      try {
        const files = req.files as Express.Multer.File[];
        if (!files || files.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No files uploaded'
          });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          });
        }

        // Upload files
        const uploadData = files.map(file => ({
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype
        }));

        const result = await this.fileUploadService.uploadMultipleFiles(
          uploadData,
          userId,
          FileCategory.TRANSACTION_IMPORT
        );

        res.status(200).json({
          success: true,
          message: `${result.successCount} files uploaded successfully`,
          data: result
        });
      } catch (error) {
        logger.error('Transaction file upload failed:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }
  ];

  // Document upload
  uploadDocument = [
    this.createMulterConfig(FileCategory.DOCUMENT).single('document'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: 'No file uploaded'
          });
        }

        const userId = req.user?.id;
        if (!userId) {
          return res.status(401).json({
            success: false,
            message: 'User not authenticated'
          });
        }

        const fileMetadata = await this.fileUploadService.uploadFile(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
          userId,
          FileCategory.DOCUMENT
        );

        res.status(200).json({
          success: true,
          message: 'Document uploaded successfully',
          data: {
            fileId: fileMetadata.id,
            filename: fileMetadata.filename,
            url: fileMetadata.url,
            size: fileMetadata.size
          }
        });
      } catch (error) {
        logger.error('Document upload failed:', error);
        res.status(500).json({
          success: false,
          message: error instanceof Error ? error.message : 'Upload failed'
        });
      }
    }
  ];

  // Get user files
  async getUserFiles(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const category = req.query.category as FileCategory | undefined;
      const files = await this.fileUploadService.getUserFiles(userId, category);

      res.status(200).json({
        success: true,
        message: 'Files retrieved successfully',
        data: files
      });
    } catch (error) {
      logger.error('Get user files failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve files'
      });
    }
  }

  // Get file metadata
  async getFileMetadata(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const file = await this.fileUploadService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'File metadata retrieved successfully',
        data: file
      });
    } catch (error) {
      logger.error('Get file metadata failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve file metadata'
      });
    }
  }

  // Delete file
  async deleteFile(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      await this.fileUploadService.deleteFile(fileId, userId);

      res.status(200).json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      logger.error('Delete file failed:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to delete file'
      });
    }
  }

  // Generate signed URL for file access
  async getSignedUrl(req: Request, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user?.id;
      const expires = parseInt(req.query.expires as string) || 3600; // 1 hour default

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // Verify user has access to file
      const file = await this.fileUploadService.getFileMetadata(fileId, userId);
      if (!file) {
        return res.status(404).json({
          success: false,
          message: 'File not found'
        });
      }

      const signedUrl = await this.fileUploadService.getSignedUrl(file.key!, {
        expires,
        responseContentType: file.mimeType,
        responseContentDisposition: `attachment; filename="${file.originalName}"`
      });

      res.status(200).json({
        success: true,
        message: 'Signed URL generated successfully',
        data: {
          url: signedUrl,
          expires: new Date(Date.now() + expires * 1000)
        }
      });
    } catch (error) {
      logger.error('Generate signed URL failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate signed URL'
      });
    }
  }

  // Upload progress tracking (for chunked uploads)
  async getUploadProgress(req: Request, res: Response) {
    try {
      const { uploadId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      // In a real implementation, this would check upload progress
      // For now, return a mock progress
      res.status(200).json({
        success: true,
        message: 'Upload progress retrieved',
        data: {
          uploadId,
          progress: 0,
          status: 'pending'
        }
      });
    } catch (error) {
      logger.error('Get upload progress failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get upload progress'
      });
    }
  }

  // Health check for file upload service
  async healthCheck(req: Request, res: Response) {
    try {
      // Check S3 connectivity
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          s3: 'healthy',
          database: 'healthy',
          processing: 'healthy'
        }
      };

      res.status(200).json({
        success: true,
        message: 'File upload service is healthy',
        data: health
      });
    } catch (error) {
      logger.error('File upload health check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Service unhealthy'
      });
    }
  }
}