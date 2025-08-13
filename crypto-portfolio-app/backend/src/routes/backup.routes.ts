/**
 * Backup management API routes
 * Provides comprehensive endpoints for backup operations, recovery, and monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { body, param, query, validationResult } from 'express-validator';
import {
  BackupConfiguration,
  BackupJob,
  BackupJobStatus,
  BackupType,
  RecoveryRequest,
  RecoveryType,
  RecoveryStatus,
  UserDataExportRequest,
  ExportType,
  ExportFormat,
  BackupApiResponse,
  PaginatedResponse
} from '../types/backup.types';
import BackupService from '../services/backupService';
import RecoveryService from '../services/recoveryService';
import UserDataExportService from '../services/userDataExportService';
import BackupScheduler from '../schedulers/backupScheduler';
import BackupMonitor from '../monitoring/backupMonitor';
import { EncryptionUtils } from '../utils/encryptionUtils';
import { authenticate, requireRole } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { logger } from '../utils/logger';

export interface BackupRouterDependencies {
  dbPool: Pool;
  backupService: BackupService;
  recoveryService: RecoveryService;
  exportService: UserDataExportService;
  scheduler: BackupScheduler;
  monitor: BackupMonitor;
  encryptionUtils: EncryptionUtils;
}

export function createBackupRouter(deps: BackupRouterDependencies): Router {
  const router = Router();

  // Middleware
  router.use(authenticate);
  router.use('/admin', requireRole(['admin', 'backup_admin']));

  // Validation middleware
  const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array(),
        timestamp: new Date(),
        requestId: req.id
      } as BackupApiResponse);
    }
    next();
  };

  // ==================== BACKUP CONFIGURATION ROUTES ====================

  /**
   * GET /api/v1/backup/admin/configurations
   * List backup configurations
   */
  router.get('/admin/configurations',
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('enabled').optional().isBoolean(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;
        const enabled = req.query.enabled ? req.query.enabled === 'true' : undefined;

        const { configurations, total } = await getBackupConfigurations(
          deps.dbPool, limit, offset, enabled
        );

        const response: BackupApiResponse<PaginatedResponse<BackupConfiguration>> = {
          success: true,
          data: {
            items: configurations,
            total,
            page,
            pageSize: limit,
            hasMore: offset + limit < total
          },
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to list backup configurations', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to list backup configurations',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * POST /api/v1/backup/admin/configurations
   * Create backup configuration
   */
  router.post('/admin/configurations',
    [
      body('name').isString().isLength({ min: 1, max: 255 }),
      body('description').optional().isString().isLength({ max: 1000 }),
      body('type').isIn(Object.values(BackupType)),
      body('schedule.expression').isString(),
      body('schedule.enabled').isBoolean(),
      body('target.type').isIn(['database', 'filesystem', 'application_data']),
      body('storage.primary.type').isString(),
      body('encryption.enabled').isBoolean(),
      body('compression.enabled').isBoolean(),
      body('verification.enabled').isBoolean(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const configuration: Omit<BackupConfiguration, 'id' | 'createdAt' | 'updatedAt'> = {
          ...req.body,
          enabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const createdConfig = await createBackupConfiguration(deps.dbPool, configuration);
        
        // Add to scheduler if enabled
        if (createdConfig.schedule.enabled) {
          await deps.scheduler.addBackupConfiguration(createdConfig);
        }

        const response: BackupApiResponse<BackupConfiguration> = {
          success: true,
          data: createdConfig,
          timestamp: new Date(),
          requestId: req.id
        };

        res.status(201).json(response);
      } catch (error) {
        logger.error('Failed to create backup configuration', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to create backup configuration',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/configurations/:id
   * Get backup configuration by ID
   */
  router.get('/admin/configurations/:id',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const configuration = await getBackupConfiguration(deps.dbPool, req.params.id);
        
        if (!configuration) {
          return res.status(404).json({
            success: false,
            error: 'Backup configuration not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        const response: BackupApiResponse<BackupConfiguration> = {
          success: true,
          data: configuration,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to get backup configuration', { 
          configurationId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to get backup configuration',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * PUT /api/v1/backup/admin/configurations/:id
   * Update backup configuration
   */
  router.put('/admin/configurations/:id',
    [
      param('id').isString(),
      body('name').optional().isString().isLength({ min: 1, max: 255 }),
      body('description').optional().isString().isLength({ max: 1000 }),
      body('enabled').optional().isBoolean(),
      body('schedule.enabled').optional().isBoolean(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const updatedConfig = await updateBackupConfiguration(
          deps.dbPool, req.params.id, req.body
        );
        
        if (!updatedConfig) {
          return res.status(404).json({
            success: false,
            error: 'Backup configuration not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        // Update scheduler
        await deps.scheduler.updateBackupConfiguration(updatedConfig);

        const response: BackupApiResponse<BackupConfiguration> = {
          success: true,
          data: updatedConfig,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to update backup configuration', { 
          configurationId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to update backup configuration',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * DELETE /api/v1/backup/admin/configurations/:id
   * Delete backup configuration
   */
  router.delete('/admin/configurations/:id',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const deleted = await deleteBackupConfiguration(deps.dbPool, req.params.id);
        
        if (!deleted) {
          return res.status(404).json({
            success: false,
            error: 'Backup configuration not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        // Remove from scheduler
        await deps.scheduler.removeBackupConfiguration(req.params.id);

        const response: BackupApiResponse = {
          success: true,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to delete backup configuration', { 
          configurationId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to delete backup configuration',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  // ==================== BACKUP JOB ROUTES ====================

  /**
   * POST /api/v1/backup/admin/jobs
   * Trigger manual backup
   */
  router.post('/admin/jobs',
    [
      body('configurationId').isString(),
      handleValidationErrors
    ],
    rateLimiter({ max: 10, windowMs: 60000 }), // 10 requests per minute
    async (req: Request, res: Response) => {
      try {
        const jobId = await deps.scheduler.triggerBackup(req.body.configurationId);

        const response: BackupApiResponse<{ jobId: string }> = {
          success: true,
          data: { jobId },
          timestamp: new Date(),
          requestId: req.id
        };

        res.status(202).json(response);
      } catch (error) {
        logger.error('Failed to trigger backup', { 
          configurationId: req.body.configurationId, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to trigger backup',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/jobs
   * List backup jobs
   */
  router.get('/admin/jobs',
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('configurationId').optional().isString(),
      query('status').optional().isIn(Object.values(BackupJobStatus)),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const { jobs, total } = await deps.backupService.listBackupJobs(
          req.query.configurationId as string,
          req.query.status as BackupJobStatus,
          limit,
          offset
        );

        const response: BackupApiResponse<PaginatedResponse<BackupJob>> = {
          success: true,
          data: {
            items: jobs,
            total,
            page,
            pageSize: limit,
            hasMore: offset + limit < total
          },
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to list backup jobs', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to list backup jobs',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/jobs/:id
   * Get backup job by ID
   */
  router.get('/admin/jobs/:id',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const job = await deps.backupService.getBackupJob(req.params.id);
        
        if (!job) {
          return res.status(404).json({
            success: false,
            error: 'Backup job not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        const response: BackupApiResponse<BackupJob> = {
          success: true,
          data: job,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to get backup job', { 
          jobId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to get backup job',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * DELETE /api/v1/backup/admin/jobs/:id
   * Delete backup job
   */
  router.delete('/admin/jobs/:id',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        await deps.backupService.deleteBackupJob(req.params.id);

        const response: BackupApiResponse = {
          success: true,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to delete backup job', { 
          jobId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to delete backup job',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  // ==================== RECOVERY ROUTES ====================

  /**
   * POST /api/v1/backup/admin/recovery
   * Create recovery request
   */
  router.post('/admin/recovery',
    [
      body('backupJobId').isString(),
      body('type').isIn(Object.values(RecoveryType)),
      body('target.database.host').isString(),
      body('target.database.port').isInt(),
      body('target.database.database').isString(),
      body('target.database.username').isString(),
      body('target.database.password').isString(),
      body('options.validateBeforeRestore').optional().isBoolean(),
      body('options.createTargetIfNotExists').optional().isBoolean(),
      body('options.stopOnError').optional().isBoolean(),
      body('options.parallel').optional().isBoolean(),
      handleValidationErrors
    ],
    rateLimiter({ max: 5, windowMs: 300000 }), // 5 requests per 5 minutes
    async (req: Request, res: Response) => {
      try {
        const recoveryRequest = await deps.recoveryService.createRecoveryRequest(
          req.body.backupJobId,
          req.body.type,
          req.body.target,
          req.body.options,
          req.user.id
        );

        const response: BackupApiResponse<RecoveryRequest> = {
          success: true,
          data: recoveryRequest,
          timestamp: new Date(),
          requestId: req.id
        };

        res.status(202).json(response);
      } catch (error) {
        logger.error('Failed to create recovery request', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to create recovery request',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/recovery
   * List recovery requests
   */
  router.get('/admin/recovery',
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 100 }),
      query('status').optional().isIn(Object.values(RecoveryStatus)),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        const { requests, total } = await deps.recoveryService.listRecoveryRequests(
          limit,
          offset,
          req.query.status as RecoveryStatus
        );

        const response: BackupApiResponse<PaginatedResponse<RecoveryRequest>> = {
          success: true,
          data: {
            items: requests,
            total,
            page,
            pageSize: limit,
            hasMore: offset + limit < total
          },
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to list recovery requests', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to list recovery requests',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/recovery/:id
   * Get recovery request by ID
   */
  router.get('/admin/recovery/:id',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const recoveryRequest = await deps.recoveryService.getRecoveryRequest(req.params.id);
        
        if (!recoveryRequest) {
          return res.status(404).json({
            success: false,
            error: 'Recovery request not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        const response: BackupApiResponse<RecoveryRequest> = {
          success: true,
          data: recoveryRequest,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to get recovery request', { 
          requestId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to get recovery request',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/recovery/:id/progress
   * Get recovery progress
   */
  router.get('/admin/recovery/:id/progress',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const progress = deps.recoveryService.getRecoveryProgress(req.params.id);
        
        if (!progress) {
          return res.status(404).json({
            success: false,
            error: 'Recovery progress not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        const response: BackupApiResponse = {
          success: true,
          data: progress,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to get recovery progress', { 
          requestId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to get recovery progress',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * POST /api/v1/backup/admin/recovery/:id/cancel
   * Cancel recovery request
   */
  router.post('/admin/recovery/:id/cancel',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        await deps.recoveryService.cancelRecovery(req.params.id);

        const response: BackupApiResponse = {
          success: true,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to cancel recovery', { 
          requestId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to cancel recovery',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  // ==================== USER DATA EXPORT ROUTES ====================

  /**
   * POST /api/v1/backup/export/request
   * Request user data export
   */
  router.post('/export/request',
    [
      body('type').isIn(Object.values(ExportType)),
      body('format').isIn(Object.values(ExportFormat)),
      body('options.includeMetadata').optional().isBoolean(),
      body('options.includeSensitiveData').optional().isBoolean(),
      body('options.dateRange.from').optional().isISO8601(),
      body('options.dateRange.to').optional().isISO8601(),
      handleValidationErrors
    ],
    rateLimiter({ max: 3, windowMs: 3600000 }), // 3 requests per hour
    async (req: Request, res: Response) => {
      try {
        const exportRequest = await deps.exportService.createExportRequest(
          req.user.id,
          req.body.type,
          req.body.format,
          req.body.options
        );

        const response: BackupApiResponse<UserDataExportRequest> = {
          success: true,
          data: exportRequest,
          timestamp: new Date(),
          requestId: req.id
        };

        res.status(202).json(response);
      } catch (error) {
        logger.error('Failed to create export request', { 
          userId: req.user.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to create export request',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/export/requests
   * List user's export requests
   */
  router.get('/export/requests',
    [
      query('page').optional().isInt({ min: 1 }),
      query('limit').optional().isInt({ min: 1, max: 50 }),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = (page - 1) * limit;

        const { requests, total } = await deps.exportService.listUserExportRequests(
          req.user.id,
          limit,
          offset
        );

        const response: BackupApiResponse<PaginatedResponse<UserDataExportRequest>> = {
          success: true,
          data: {
            items: requests,
            total,
            page,
            pageSize: limit,
            hasMore: offset + limit < total
          },
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to list export requests', { 
          userId: req.user.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to list export requests',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/export/:id/download
   * Download export file
   */
  router.get('/export/:id/download',
    [
      param('id').isString(),
      query('token').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const exportRequest = await deps.exportService.getExportRequest(req.params.id);
        
        if (!exportRequest) {
          return res.status(404).json({
            success: false,
            error: 'Export request not found',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        // Verify user owns this export or is admin
        if (exportRequest.userId !== req.user.id && !req.user.roles.includes('admin')) {
          return res.status(403).json({
            success: false,
            error: 'Access denied',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        // Verify export is ready and not expired
        if (exportRequest.status !== 'completed') {
          return res.status(400).json({
            success: false,
            error: 'Export not ready for download',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        if (exportRequest.expiresAt < new Date()) {
          return res.status(410).json({
            success: false,
            error: 'Export has expired',
            timestamp: new Date(),
            requestId: req.id
          } as BackupApiResponse);
        }

        // TODO: Implement secure file download
        // This would involve validating the token and serving the file
        res.json({
          success: true,
          message: 'File download would be implemented here',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);

      } catch (error) {
        logger.error('Failed to download export', { 
          exportId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to download export',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  // ==================== MONITORING AND HEALTH ROUTES ====================

  /**
   * GET /api/v1/backup/admin/health
   * Get system health status
   */
  router.get('/admin/health', async (req: Request, res: Response) => {
    try {
      const health = deps.monitor.getSystemHealth();

      const response: BackupApiResponse = {
        success: true,
        data: health,
        timestamp: new Date(),
        requestId: req.id
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get system health', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get system health',
        timestamp: new Date(),
        requestId: req.id
      } as BackupApiResponse);
    }
  });

  /**
   * GET /api/v1/backup/admin/metrics
   * Get backup metrics
   */
  router.get('/admin/metrics',
    [
      query('from').optional().isISO8601(),
      query('to').optional().isISO8601(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const timeRange = req.query.from && req.query.to ? {
          from: new Date(req.query.from as string),
          to: new Date(req.query.to as string)
        } : undefined;

        const metrics = await deps.monitor.getMonitoringMetrics(timeRange);

        const response: BackupApiResponse = {
          success: true,
          data: metrics,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to get metrics', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to get metrics',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/alerts
   * Get active alerts
   */
  router.get('/admin/alerts', async (req: Request, res: Response) => {
    try {
      const alerts = await deps.monitor.getActiveAlerts();

      const response: BackupApiResponse = {
        success: true,
        data: alerts,
        timestamp: new Date(),
        requestId: req.id
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get alerts', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get alerts',
        timestamp: new Date(),
        requestId: req.id
      } as BackupApiResponse);
    }
  });

  /**
   * POST /api/v1/backup/admin/alerts/:id/acknowledge
   * Acknowledge alert
   */
  router.post('/admin/alerts/:id/acknowledge',
    [
      param('id').isString(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        await deps.monitor.acknowledgeAlert(req.params.id, req.user.id);

        const response: BackupApiResponse = {
          success: true,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to acknowledge alert', { 
          alertId: req.params.id, 
          error: error.message 
        });
        res.status(500).json({
          success: false,
          error: 'Failed to acknowledge alert',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/report
   * Generate backup report
   */
  router.get('/admin/report',
    [
      query('from').isISO8601(),
      query('to').isISO8601(),
      query('includeDetails').optional().isBoolean(),
      handleValidationErrors
    ],
    async (req: Request, res: Response) => {
      try {
        const timeRange = {
          from: new Date(req.query.from as string),
          to: new Date(req.query.to as string)
        };
        const includeDetails = req.query.includeDetails === 'true';

        const report = await deps.monitor.generateReport(timeRange, includeDetails);

        const response: BackupApiResponse = {
          success: true,
          data: report,
          timestamp: new Date(),
          requestId: req.id
        };

        res.json(response);
      } catch (error) {
        logger.error('Failed to generate report', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to generate report',
          timestamp: new Date(),
          requestId: req.id
        } as BackupApiResponse);
      }
    }
  );

  /**
   * GET /api/v1/backup/admin/scheduler/status
   * Get scheduler status
   */
  router.get('/admin/scheduler/status', async (req: Request, res: Response) => {
    try {
      const status = deps.scheduler.getStatus();

      const response: BackupApiResponse = {
        success: true,
        data: status,
        timestamp: new Date(),
        requestId: req.id
      };

      res.json(response);
    } catch (error) {
      logger.error('Failed to get scheduler status', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduler status',
        timestamp: new Date(),
        requestId: req.id
      } as BackupApiResponse);
    }
  });

  return router;
}

// Database helper functions (these would be implemented based on your specific schema)

async function getBackupConfigurations(
  pool: Pool,
  limit: number,
  offset: number,
  enabled?: boolean
): Promise<{ configurations: BackupConfiguration[]; total: number }> {
  const client = await pool.connect();
  
  try {
    let whereClause = '';
    const params: any[] = [];
    
    if (enabled !== undefined) {
      whereClause = ' WHERE enabled = $1';
      params.push(enabled);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM backup_configurations${whereClause}`;
    const countResult = await client.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get configurations with pagination
    const configsQuery = `
      SELECT * FROM backup_configurations${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;
    params.push(limit, offset);
    
    const configsResult = await client.query(configsQuery, params);
    const configurations = configsResult.rows.map(row => mapRowToBackupConfiguration(row));

    return { configurations, total };
    
  } finally {
    client.release();
  }
}

async function getBackupConfiguration(pool: Pool, id: string): Promise<BackupConfiguration | null> {
  const client = await pool.connect();
  
  try {
    const result = await client.query('SELECT * FROM backup_configurations WHERE id = $1', [id]);
    return result.rows[0] ? mapRowToBackupConfiguration(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

async function createBackupConfiguration(
  pool: Pool,
  config: Omit<BackupConfiguration, 'id' | 'createdAt' | 'updatedAt'>
): Promise<BackupConfiguration> {
  const client = await pool.connect();
  
  try {
    const id = `config_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const query = `
      INSERT INTO backup_configurations (
        id, name, description, enabled, schedule, type, target, storage,
        retention, encryption, compression, verification, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const result = await client.query(query, [
      id,
      config.name,
      config.description,
      config.enabled,
      JSON.stringify(config.schedule),
      config.type,
      JSON.stringify(config.target),
      JSON.stringify(config.storage),
      JSON.stringify(config.retention),
      JSON.stringify(config.encryption),
      JSON.stringify(config.compression),
      JSON.stringify(config.verification),
      now,
      now
    ]);
    
    return mapRowToBackupConfiguration(result.rows[0]);
  } finally {
    client.release();
  }
}

async function updateBackupConfiguration(
  pool: Pool,
  id: string,
  updates: Partial<BackupConfiguration>
): Promise<BackupConfiguration | null> {
  const client = await pool.connect();
  
  try {
    const setClause = [];
    const params = [];
    let paramIndex = 1;
    
    if (updates.name) {
      setClause.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    
    if (updates.description !== undefined) {
      setClause.push(`description = $${paramIndex++}`);
      params.push(updates.description);
    }
    
    if (updates.enabled !== undefined) {
      setClause.push(`enabled = $${paramIndex++}`);
      params.push(updates.enabled);
    }
    
    if (updates.schedule) {
      setClause.push(`schedule = $${paramIndex++}`);
      params.push(JSON.stringify(updates.schedule));
    }
    
    setClause.push(`updated_at = $${paramIndex++}`);
    params.push(new Date());
    
    params.push(id);
    
    const query = `
      UPDATE backup_configurations 
      SET ${setClause.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await client.query(query, params);
    return result.rows[0] ? mapRowToBackupConfiguration(result.rows[0]) : null;
  } finally {
    client.release();
  }
}

async function deleteBackupConfiguration(pool: Pool, id: string): Promise<boolean> {
  const client = await pool.connect();
  
  try {
    const result = await client.query('DELETE FROM backup_configurations WHERE id = $1', [id]);
    return result.rowCount > 0;
  } finally {
    client.release();
  }
}

function mapRowToBackupConfiguration(row: any): BackupConfiguration {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    enabled: row.enabled,
    schedule: JSON.parse(row.schedule),
    type: row.type,
    target: JSON.parse(row.target),
    storage: JSON.parse(row.storage),
    retention: JSON.parse(row.retention),
    encryption: JSON.parse(row.encryption),
    compression: JSON.parse(row.compression),
    verification: JSON.parse(row.verification),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export default createBackupRouter;