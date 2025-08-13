import { Router } from 'express';
import { FileUploadController } from '../../controllers/fileUploadController';
import { authMiddleware } from '../../middleware/authMiddleware';
import { rateLimitMiddleware } from '../../middleware/rateLimiterMiddleware';

const router = Router();
const fileUploadController = new FileUploadController();

// Apply authentication to all upload routes
router.use(authMiddleware.authenticate);

// Profile picture upload
router.post(
  '/profile-picture',
  rateLimitMiddleware.uploadLimiter,
  fileUploadController.uploadProfilePicture
);

// Transaction file upload
router.post(
  '/transaction-files',
  rateLimitMiddleware.uploadLimiter,
  fileUploadController.uploadTransactionFile
);

// Document upload
router.post(
  '/document',
  rateLimitMiddleware.uploadLimiter,
  fileUploadController.uploadDocument
);

// Get user files
router.get(
  '/files',
  fileUploadController.getUserFiles
);

// Get specific file metadata
router.get(
  '/files/:fileId',
  fileUploadController.getFileMetadata
);

// Delete file
router.delete(
  '/files/:fileId',
  fileUploadController.deleteFile
);

// Generate signed URL for file access
router.get(
  '/files/:fileId/signed-url',
  fileUploadController.getSignedUrl
);

// Upload progress tracking
router.get(
  '/progress/:uploadId',
  fileUploadController.getUploadProgress
);

// Health check
router.get(
  '/health',
  fileUploadController.healthCheck
);

export { router as uploadRouter };