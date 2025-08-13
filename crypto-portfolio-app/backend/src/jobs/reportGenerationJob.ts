import { Job } from 'bull';
import { 
  ReportGenerationJobData, 
  JobResult, 
  JobMetrics, 
  ReportType, 
  ReportFormat,
  ReportPeriod 
} from '../types/queue.types';
import { reportService } from '../services/reportService';
import { emailService } from '../services/emailService';
import { webSocketService } from '../websocket/webSocketService';
import { logger } from '../utils/logger';
import path from 'path';

export const processReportGenerationJob = async (
  job: Job<ReportGenerationJobData>
): Promise<JobResult> => {
  const startTime = new Date();
  const { userId, reportType, format, period, data } = job.data;

  try {
    logger.info(`Processing report generation job ${job.id}`, {
      userId,
      reportType,
      format,
      period
    });

    // Generate report based on type
    let reportData: any;
    let filename: string;

    switch (reportType) {
      case ReportType.PORTFOLIO_SUMMARY:
        reportData = await generatePortfolioSummary(userId, period, data);
        filename = `portfolio-summary-${period}-${Date.now()}`;
        break;
      
      case ReportType.PERFORMANCE_ANALYSIS:
        reportData = await generatePerformanceAnalysis(userId, period, data);
        filename = `performance-analysis-${period}-${Date.now()}`;
        break;
      
      case ReportType.TAX_REPORT:
        reportData = await generateTaxReport(userId, period, data);
        filename = `tax-report-${period}-${Date.now()}`;
        break;
      
      case ReportType.TRANSACTION_HISTORY:
        reportData = await generateTransactionHistory(userId, period, data);
        filename = `transaction-history-${period}-${Date.now()}`;
        break;
      
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }

    // Generate report file in specified format
    const reportFile = await reportService.generateReportFile(
      reportData,
      format,
      filename
    );

    // Store report metadata
    const reportRecord = await reportService.storeReportMetadata({
      userId,
      reportType,
      format,
      period,
      filename: reportFile.filename,
      filePath: reportFile.path,
      size: reportFile.size,
      generatedAt: new Date()
    });

    // Send email notification with report attachment
    if (format !== ReportFormat.JSON) {
      await emailService.sendTemplatedEmail({
        to: reportData.userEmail,
        template: 'report-ready',
        subject: `Your ${reportType.replace('_', ' ')} report is ready`,
        data: {
          reportType: reportType.replace('_', ' '),
          period,
          filename: reportFile.filename
        },
        attachments: [{
          filename: reportFile.filename,
          content: reportFile.buffer,
          contentType: getContentType(format)
        }]
      });
    }

    // Send real-time notification to user
    await webSocketService.sendToUser(userId, 'report_generated', {
      reportId: reportRecord.id,
      reportType,
      format,
      period,
      filename: reportFile.filename,
      downloadUrl: `/api/reports/${reportRecord.id}/download`,
      timestamp: new Date()
    });

    const endTime = new Date();
    const metrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      memory: process.memoryUsage().heapUsed,
      cpu: process.cpuUsage().user
    };

    logger.info(`Report generation job ${job.id} completed`, {
      userId,
      reportType,
      format,
      filename: reportFile.filename,
      size: reportFile.size,
      duration: metrics.duration
    });

    return {
      success: true,
      data: {
        reportId: reportRecord.id,
        reportType,
        format,
        period,
        filename: reportFile.filename,
        size: reportFile.size,
        downloadUrl: `/api/reports/${reportRecord.id}/download`,
        generatedAt: endTime
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

    logger.error(`Report generation job ${job.id} failed:`, error);

    // Send error notification to user
    await webSocketService.sendToUser(userId, 'report_generation_error', {
      reportType,
      format,
      period,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date()
    }).catch(() => {}); // Don't fail the job if WebSocket fails

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics
    };
  }
};

// Helper functions for different report types
async function generatePortfolioSummary(
  userId: string,
  period: ReportPeriod,
  data?: any
): Promise<any> {
  const portfolios = await reportService.getPortfolioData(userId, period);
  const summary = await reportService.calculatePortfolioSummary(portfolios);
  const userInfo = await reportService.getUserInfo(userId);

  return {
    ...userInfo,
    period,
    portfolios,
    summary,
    generatedAt: new Date()
  };
}

async function generatePerformanceAnalysis(
  userId: string,
  period: ReportPeriod,
  data?: any
): Promise<any> {
  const performance = await reportService.getPerformanceData(userId, period);
  const analysis = await reportService.calculatePerformanceMetrics(performance);
  const userInfo = await reportService.getUserInfo(userId);

  return {
    ...userInfo,
    period,
    performance,
    analysis,
    generatedAt: new Date()
  };
}

async function generateTaxReport(
  userId: string,
  period: ReportPeriod,
  data?: any
): Promise<any> {
  const transactions = await reportService.getTaxableTransactions(userId, period);
  const taxCalculations = await reportService.calculateTaxLiability(transactions);
  const userInfo = await reportService.getUserInfo(userId);

  return {
    ...userInfo,
    period,
    transactions,
    taxCalculations,
    generatedAt: new Date()
  };
}

async function generateTransactionHistory(
  userId: string,
  period: ReportPeriod,
  data?: any
): Promise<any> {
  const transactions = await reportService.getTransactionHistory(userId, period);
  const summary = await reportService.calculateTransactionSummary(transactions);
  const userInfo = await reportService.getUserInfo(userId);

  return {
    ...userInfo,
    period,
    transactions,
    summary,
    generatedAt: new Date()
  };
}

function getContentType(format: ReportFormat): string {
  switch (format) {
    case ReportFormat.PDF:
      return 'application/pdf';
    case ReportFormat.CSV:
      return 'text/csv';
    case ReportFormat.EXCEL:
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case ReportFormat.JSON:
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}