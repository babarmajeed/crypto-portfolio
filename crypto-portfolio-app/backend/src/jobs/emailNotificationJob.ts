import { Job } from 'bull';
import { EmailNotificationJobData, JobResult, JobMetrics } from '../types/queue.types';
import { emailService } from '../services/emailService';
import { logger } from '../utils/logger';

export const processEmailNotificationJob = async (
  job: Job<EmailNotificationJobData>
): Promise<JobResult> => {
  const startTime = new Date();
  const { to, template, subject, data, attachments } = job.data;

  try {
    logger.info(`Processing email notification job ${job.id}`, {
      to: Array.isArray(to) ? to.length : 1,
      template,
      subject
    });

    // Send email using email service
    const emailResult = await emailService.sendTemplatedEmail({
      to,
      template,
      subject,
      data,
      attachments
    });

    const endTime = new Date();
    const metrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      memory: process.memoryUsage().heapUsed,
      cpu: process.cpuUsage().user
    };

    logger.info(`Email notification job ${job.id} completed`, {
      recipients: Array.isArray(to) ? to.length : 1,
      messageId: emailResult.messageId,
      duration: metrics.duration
    });

    return {
      success: true,
      data: {
        messageId: emailResult.messageId,
        recipients: Array.isArray(to) ? to.length : 1,
        template,
        sentAt: endTime
      },
      metrics
    };

  } catch (error) {
    const endTime = new Date();
    const metrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime()
    };

    logger.error(`Email notification job ${job.id} failed:`, error);

    // Check if it's a temporary error that should be retried
    const isRetryable = error instanceof Error && (
      error.message.includes('timeout') ||
      error.message.includes('connection') ||
      error.message.includes('rate limit')
    );

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      data: { isRetryable },
      metrics
    };
  }
};