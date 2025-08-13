import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { app } from '../app';
import { jobProcessingService } from '../services/jobProcessingService';
import { 
  QueueName, 
  JobPriority, 
  SyncType, 
  ReportType, 
  ReportFormat, 
  ReportPeriod 
} from '../types/queue.types';
import { getQueue, getQueueStats } from '../queues';
import { redisService } from '../services/redisService';

describe('Job Processing System', () => {
  let authToken: string;
  let adminToken: string;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize job processing system for testing
    await jobProcessingService.initialize();
    
    // Create test user and get tokens
    const userResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        password: 'password123',
        name: 'Test User'
      });
    
    testUserId = userResponse.body.data.user.id;
    authToken = userResponse.body.data.token;

    // Create admin user
    const adminResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'admin@example.com',
        password: 'password123',
        name: 'Admin User',
        role: 'admin'
      });
    
    adminToken = adminResponse.body.data.token;
  });

  afterAll(async () => {
    // Cleanup
    await jobProcessingService.shutdown();
    await redisService.flushall();
  });

  beforeEach(async () => {
    // Clean queues before each test
    for (const queueName of Object.values(QueueName)) {
      const queue = getQueue(queueName);
      await queue.clean(0, 'completed');
      await queue.clean(0, 'failed');
      await queue.clean(0, 'active');
      await queue.clean(0, 'waiting');
    }
  });

  describe('Queue Management API', () => {
    it('should get queue status', async () => {
      const response = await request(app)
        .get('/api/queues/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.system).toBeDefined();
      expect(response.body.data.queues).toBeInstanceOf(Array);
      expect(response.body.data.queues).toHaveLength(5);
    });

    it('should pause and resume a queue', async () => {
      // Pause queue
      await request(app)
        .post(`/api/queues/pause/${QueueName.PRICE_UPDATE}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check if paused
      const stats = await getQueueStats(QueueName.PRICE_UPDATE);
      expect(stats.paused).toBe(true);

      // Resume queue
      await request(app)
        .post(`/api/queues/resume/${QueueName.PRICE_UPDATE}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Check if resumed
      const resumedStats = await getQueueStats(QueueName.PRICE_UPDATE);
      expect(resumedStats.paused).toBe(false);
    });

    it('should clean a queue', async () => {
      await request(app)
        .post(`/api/queues/clean/${QueueName.PRICE_UPDATE}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny access to non-admin users', async () => {
      await request(app)
        .get('/api/queues/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  describe('Job Creation API', () => {
    it('should schedule a price update job', async () => {
      const jobData = {
        symbols: ['BTC', 'ETH'],
        priority: JobPriority.HIGH
      };

      const response = await request(app)
        .post('/api/queues/jobs/price-update')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();

      // Verify job was added to queue
      const stats = await getQueueStats(QueueName.PRICE_UPDATE);
      expect(stats.waiting + stats.active).toBeGreaterThan(0);
    });

    it('should schedule a portfolio calculation job', async () => {
      const jobData = {
        userId: testUserId,
        calculateAll: true,
        priority: JobPriority.HIGH
      };

      const response = await request(app)
        .post('/api/queues/jobs/portfolio-calculation')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should schedule an email notification job', async () => {
      const jobData = {
        to: 'test@example.com',
        template: 'welcome',
        subject: 'Welcome!',
        data: { name: 'Test User' }
      };

      const response = await request(app)
        .post('/api/queues/jobs/email-notification')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should schedule a data sync job', async () => {
      const jobData = {
        userId: testUserId,
        exchange: 'binance',
        syncType: SyncType.TRANSACTIONS
      };

      const response = await request(app)
        .post('/api/queues/jobs/data-sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should schedule a report generation job', async () => {
      const jobData = {
        userId: testUserId,
        reportType: ReportType.PORTFOLIO_SUMMARY,
        format: ReportFormat.PDF,
        period: ReportPeriod.MONTHLY
      };

      const response = await request(app)
        .post('/api/queues/jobs/report-generation')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should validate job data', async () => {
      const invalidJobData = {
        // Missing required fields
      };

      await request(app)
        .post('/api/queues/jobs/portfolio-calculation')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidJobData)
        .expect(400);
    });

    it('should prevent users from accessing other users data', async () => {
      const jobData = {
        userId: 'other-user-id',
        exchange: 'binance',
        syncType: SyncType.TRANSACTIONS
      };

      await request(app)
        .post('/api/queues/jobs/data-sync')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(403);
    });
  });

  describe('Convenience Routes', () => {
    it('should schedule immediate price update', async () => {
      const response = await request(app)
        .post('/api/queues/jobs/price-update/immediate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ symbols: ['BTC'] })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });

    it('should schedule user portfolio calculation', async () => {
      const response = await request(app)
        .post(`/api/queues/jobs/portfolio-calculation/user/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobId).toBeDefined();
    });
  });

  describe('Dashboard and Monitoring', () => {
    it('should get dashboard data', async () => {
      const response = await request(app)
        .get('/api/queues/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.overview).toBeDefined();
      expect(response.body.data.queues).toBeInstanceOf(Array);
      expect(response.body.data.workers).toBeInstanceOf(Array);
    });

    it('should get system metrics', async () => {
      const response = await request(app)
        .get('/api/queues/metrics/system/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should get queue metrics', async () => {
      const response = await request(app)
        .get(`/api/queues/metrics/queue/${QueueName.PRICE_UPDATE}/1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should get performance summary', async () => {
      const response = await request(app)
        .get('/api/queues/performance/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Scheduler Management', () => {
    it('should get scheduled jobs', async () => {
      const response = await request(app)
        .get('/api/queues/scheduler/jobs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should toggle scheduled job', async () => {
      const response = await request(app)
        .post('/api/queues/scheduler/toggle/price-update-high')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ enabled: false })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('Job Processing Service', () => {
  beforeAll(async () => {
    await jobProcessingService.initialize();
  });

  afterAll(async () => {
    await jobProcessingService.shutdown();
  });

  it('should initialize and start successfully', async () => {
    expect(jobProcessingService.isSystemInitialized()).toBe(true);
    
    await jobProcessingService.start();
    expect(jobProcessingService.isSystemRunning()).toBe(true);
    
    await jobProcessingService.stop();
    expect(jobProcessingService.isSystemRunning()).toBe(false);
  });

  it('should schedule price update jobs', async () => {
    const jobId = await jobProcessingService.schedulePriceUpdate({
      symbols: ['BTC', 'ETH'],
      priority: JobPriority.HIGH
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should schedule portfolio calculation jobs', async () => {
    const jobId = await jobProcessingService.schedulePortfolioCalculation({
      userId: 'test-user-id',
      calculateAll: true
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should schedule email notification jobs', async () => {
    const jobId = await jobProcessingService.scheduleEmailNotification({
      to: 'test@example.com',
      template: 'welcome',
      subject: 'Welcome!',
      data: { name: 'Test' }
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should schedule data sync jobs', async () => {
    const jobId = await jobProcessingService.scheduleDataSync({
      userId: 'test-user-id',
      exchange: 'binance',
      syncType: SyncType.TRANSACTIONS
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should schedule report generation jobs', async () => {
    const jobId = await jobProcessingService.scheduleReportGeneration({
      userId: 'test-user-id',
      reportType: ReportType.PORTFOLIO_SUMMARY,
      format: ReportFormat.PDF,
      period: ReportPeriod.MONTHLY
    });

    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should handle bulk operations', async () => {
    const symbolGroups = [['BTC', 'ETH'], ['ADA', 'SOL']];
    const jobIds = await jobProcessingService.scheduleBulkPriceUpdates(symbolGroups);

    expect(jobIds).toHaveLength(2);
    expect(jobIds.every(id => typeof id === 'string')).toBe(true);
  });

  it('should get system status', async () => {
    const status = await jobProcessingService.getSystemStatus();

    expect(status.initialized).toBe(true);
    expect(status.running).toBeDefined();
    expect(status.uptime).toBeGreaterThanOrEqual(0);
  });
});