import { Job } from 'bull';
import { PriceUpdateJobData, JobResult, JobMetrics } from '../types/queue.types';
import { priceService } from '../services/priceService';
import { webSocketService } from '../websocket/webSocketService';
import { logger } from '../utils/logger';

export const processPriceUpdateJob = async (
  job: Job<PriceUpdateJobData>
): Promise<JobResult> => {
  const startTime = new Date();
  const { symbols, exchange, updateAll, userId } = job.data;

  try {
    logger.info(`Processing price update job ${job.id}`, { symbols, exchange, updateAll });

    let updatedPrices: any[] = [];

    if (updateAll) {
      // Update all tracked symbols
      updatedPrices = await priceService.updateAllPrices();
    } else if (symbols && symbols.length > 0) {
      // Update specific symbols
      updatedPrices = await priceService.updatePricesForSymbols(symbols, exchange);
    } else {
      // Update prices for active portfolios
      updatedPrices = await priceService.updateActivePrices();
    }

    // Emit real-time price updates via WebSocket
    if (updatedPrices.length > 0) {
      await webSocketService.broadcastPriceUpdates(updatedPrices);
      
      // If userId is specified, send targeted update
      if (userId) {
        await webSocketService.sendToUser(userId, 'price_update', {
          prices: updatedPrices,
          timestamp: new Date()
        });
      }
    }

    const endTime = new Date();
    const metrics: JobMetrics = {
      startTime,
      endTime,
      duration: endTime.getTime() - startTime.getTime(),
      memory: process.memoryUsage().heapUsed,
      cpu: process.cpuUsage().user
    };

    logger.info(`Price update job ${job.id} completed`, {
      updatedCount: updatedPrices.length,
      duration: metrics.duration
    });

    return {
      success: true,
      data: {
        updatedPrices: updatedPrices.length,
        symbols: updatedPrices.map(p => p.symbol),
        lastUpdate: endTime
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

    logger.error(`Price update job ${job.id} failed:`, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics
    };
  }
};