import { Job } from 'bull';
import { PortfolioCalculationJobData, JobResult, JobMetrics } from '../types/queue.types';
import { portfolioService } from '../services/portfolioService';
import { webSocketService } from '../websocket/webSocketService';
import { logger } from '../utils/logger';

export const processPortfolioCalculationJob = async (
  job: Job<PortfolioCalculationJobData>
): Promise<JobResult> => {
  const startTime = new Date();
  const { userId, portfolioId, calculateAll, metrics } = job.data;

  try {
    logger.info(`Processing portfolio calculation job ${job.id}`, {
      userId,
      portfolioId,
      calculateAll,
      metrics
    });

    let calculationResults: any[] = [];

    if (calculateAll) {
      // Calculate all portfolios for user
      calculationResults = await portfolioService.calculateAllPortfolios(userId);
    } else if (portfolioId) {
      // Calculate specific portfolio
      const result = await portfolioService.calculatePortfolioMetrics(portfolioId, metrics);
      calculationResults = [result];
    } else {
      // Calculate all user's portfolios
      calculationResults = await portfolioService.calculateUserPortfolios(userId);
    }

    // Update portfolio performance metrics
    for (const result of calculationResults) {
      await portfolioService.updatePortfolioPerformance(result.portfolioId, result.metrics);
    }

    // Send real-time updates to user
    await webSocketService.sendToUser(userId, 'portfolio_update', {
      portfolios: calculationResults,
      timestamp: new Date()
    });

    const endTime = new Date();
    const jobMetrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      memory: process.memoryUsage().heapUsed,
      cpu: process.cpuUsage().user
    };

    logger.info(`Portfolio calculation job ${job.id} completed`, {
      calculatedPortfolios: calculationResults.length,
      duration: jobMetrics.duration
    });

    return {
      success: true,
      data: {
        calculatedPortfolios: calculationResults.length,
        portfolios: calculationResults.map(r => ({
          portfolioId: r.portfolioId,
          totalValue: r.metrics.totalValue,
          change24h: r.metrics.change24h,
          changePercent24h: r.metrics.changePercent24h
        })),
        lastCalculation: endTime
      },
      metrics: jobMetrics
    };

  } catch (error) {
    const endTime = new Date();
    const jobMetrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime()
    };

    logger.error(`Portfolio calculation job ${job.id} failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics: jobMetrics
    };
  }
};