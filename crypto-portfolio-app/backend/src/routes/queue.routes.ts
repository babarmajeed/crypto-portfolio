import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { 
  QueueName, 
  ReportType, 
  ReportFormat, 
  ReportPeriod,
  SyncType,
  JobPriority 
} from '../types/queue.types';
import { jobProcessingService } from '../services/jobProcessingService';
import { queueDashboard } from '../monitoring/queueDashboard';
import { getQueueStats, pauseQueue, resumeQueue, cleanQueue } from '../queues';
import { getScheduledJobs, toggleScheduledJob } from '../scheduler';
import { auth } from '../middleware/auth';
import { authorize } from '../middleware/authorize';
import { logger } from '../utils/logger';

const router = Router();

// Validation middleware
const validateJobCreation = [
  body('priority').optional().isIn(Object.values(JobPriority)),
  body('delay').optional().isInt({ min: 0 }),
];

const validatePriceUpdate = [
  body('symbols').optional().isArray(),
  body('exchange').optional().isString(),
  body('updateAll').optional().isBoolean(),
];

const validatePortfolioCalculation = [
  body('userId').isString().notEmpty(),
  body('portfolioId').optional().isString(),
  body('calculateAll').optional().isBoolean(),
  body('metrics').optional().isArray(),
];

const validateEmailNotification = [
  body('to').notEmpty(),
  body('template').isString().notEmpty(),
  body('subject').isString().notEmpty(),
  body('data').isObject(),
];

const validateDataSync = [
  body('userId').isString().notEmpty(),
  body('exchange').isString().notEmpty(),
  body('syncType').isIn(Object.values(SyncType)),
  body('startDate').optional().isISO8601(),
  body('endDate').optional().isISO8601(),
];

const validateReportGeneration = [
  body('userId').isString().notEmpty(),
  body('reportType').isIn(Object.values(ReportType)),
  body('format').isIn(Object.values(ReportFormat)),
  body('period').isIn(Object.values(ReportPeriod)),
];

// Dashboard and monitoring routes
router.get('/dashboard', auth, authorize(['admin']), queueDashboard.dashboardHandler);

router.get('/metrics/system/:hours?', 
  auth, 
  authorize(['admin']), 
  queueDashboard.systemMetricsHandler
);

router.get('/metrics/queue/:queueName/:hours?', 
  auth, 
  authorize(['admin']), 
  queueDashboard.queueMetricsHandler
);

router.get('/performance/summary', 
  auth, 
  authorize(['admin']), 
  queueDashboard.performanceSummaryHandler
);

// Queue management routes
router.get('/status', auth, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const allStats = [];
    for (const queueName of Object.values(QueueName)) {
      const stats = await getQueueStats(queueName);
      allStats.push(stats);
    }

    const systemStatus = await jobProcessingService.getSystemStatus();

    res.json({
      success: true,
      data: {
        system: systemStatus,
        queues: allStats
      }
    });
  } catch (error) {
    logger.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get queue status'
    });
  }
});

router.post('/pause/:queueName', 
  auth, 
  authorize(['admin']),
  param('queueName').isIn(Object.values(QueueName)),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { queueName } = req.params;
      await pauseQueue(queueName as QueueName);
      
      res.json({
        success: true,
        message: `Queue ${queueName} paused successfully`
      });
    } catch (error) {
      logger.error('Error pausing queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to pause queue'
      });
    }
  }
);

router.post('/resume/:queueName', 
  auth, 
  authorize(['admin']),
  param('queueName').isIn(Object.values(QueueName)),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { queueName } = req.params;
      await resumeQueue(queueName as QueueName);
      
      res.json({
        success: true,
        message: `Queue ${queueName} resumed successfully`
      });
    } catch (error) {
      logger.error('Error resuming queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resume queue'
      });
    }
  }
);

router.post('/clean/:queueName', 
  auth, 
  authorize(['admin']),
  param('queueName').isIn(Object.values(QueueName)),
  query('grace').optional().isInt({ min: 0 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { queueName } = req.params;
      const grace = parseInt(req.query.grace as string) || 86400000; // 24 hours default
      
      await cleanQueue(queueName as QueueName, grace);
      
      res.json({
        success: true,
        message: `Queue ${queueName} cleaned successfully`
      });
    } catch (error) {
      logger.error('Error cleaning queue:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clean queue'
      });
    }
  }
);

// Scheduler management routes
router.get('/scheduler/jobs', auth, authorize(['admin']), async (req: Request, res: Response) => {
  try {
    const jobs = getScheduledJobs();
    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    logger.error('Error getting scheduled jobs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get scheduled jobs'
    });
  }
});

router.post('/scheduler/toggle/:jobId', 
  auth, 
  authorize(['admin']),
  param('jobId').isString().notEmpty(),
  body('enabled').isBoolean(),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const { jobId } = req.params;
      const { enabled } = req.body;
      
      toggleScheduledJob(jobId, enabled);
      
      res.json({
        success: true,
        message: `Scheduled job ${jobId} ${enabled ? 'enabled' : 'disabled'} successfully`
      });
    } catch (error) {
      logger.error('Error toggling scheduled job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle scheduled job'
      });
    }
  }
);

// Job creation routes

// Price update jobs
router.post('/jobs/price-update', 
  auth,
  [...validateJobCreation, ...validatePriceUpdate],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const jobId = await jobProcessingService.schedulePriceUpdate(req.body);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Price update job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling price update job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule price update job'
      });
    }
  }
);

// Portfolio calculation jobs
router.post('/jobs/portfolio-calculation', 
  auth,
  [...validateJobCreation, ...validatePortfolioCalculation],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const jobId = await jobProcessingService.schedulePortfolioCalculation(req.body);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Portfolio calculation job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling portfolio calculation job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule portfolio calculation job'
      });
    }
  }
);

// Email notification jobs
router.post('/jobs/email-notification', 
  auth,
  authorize(['admin', 'user']),
  [...validateJobCreation, ...validateEmailNotification],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const jobId = await jobProcessingService.scheduleEmailNotification(req.body);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Email notification job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling email notification job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule email notification job'
      });
    }
  }
);

// Data sync jobs
router.post('/jobs/data-sync', 
  auth,
  [...validateJobCreation, ...validateDataSync],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      // Ensure user can only sync their own data
      if (req.user?.role !== 'admin' && req.body.userId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          error: 'Cannot sync data for other users'
        });
      }

      const jobId = await jobProcessingService.scheduleDataSync(req.body);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Data sync job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling data sync job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule data sync job'
      });
    }
  }
);

// Report generation jobs
router.post('/jobs/report-generation', 
  auth,
  [...validateJobCreation, ...validateReportGeneration],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      // Ensure user can only generate reports for themselves
      if (req.user?.role !== 'admin' && req.body.userId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          error: 'Cannot generate reports for other users'
        });
      }

      const jobId = await jobProcessingService.scheduleReportGeneration(req.body);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Report generation job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling report generation job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule report generation job'
      });
    }
  }
);

// Convenience routes for common operations

// Immediate price update for critical symbols
router.post('/jobs/price-update/immediate', 
  auth,
  authorize(['admin']),
  body('symbols').optional().isArray(),
  async (req: Request, res: Response) => {
    try {
      const { symbols } = req.body;
      const jobId = await jobProcessingService.scheduleImmediatePriceUpdate(symbols);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'Immediate price update job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling immediate price update job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule immediate price update job'
      });
    }
  }
);

// User portfolio calculation
router.post('/jobs/portfolio-calculation/user/:userId', 
  auth,
  param('userId').isString().notEmpty(),
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      
      // Ensure user can only calculate their own portfolio
      if (req.user?.role !== 'admin' && userId !== req.user?.id) {
        return res.status(403).json({
          success: false,
          error: 'Cannot calculate portfolio for other users'
        });
      }

      const jobId = await jobProcessingService.scheduleUserPortfolioCalculation(userId);
      
      res.status(201).json({
        success: true,
        data: { jobId },
        message: 'User portfolio calculation job scheduled successfully'
      });
    } catch (error) {
      logger.error('Error scheduling user portfolio calculation job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule user portfolio calculation job'
      });
    }
  }
);

export default router;