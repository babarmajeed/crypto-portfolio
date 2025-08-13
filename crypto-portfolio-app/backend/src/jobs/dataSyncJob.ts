import { Job } from 'bull';
import { DataSyncJobData, JobResult, JobMetrics, SyncType } from '../types/queue.types';
import { exchangeService } from '../services/exchangeService';
import { transactionService } from '../services/transactionService';
import { webSocketService } from '../websocket/webSocketService';
import { logger } from '../utils/logger';

export const processDataSyncJob = async (
  job: Job<DataSyncJobData>
): Promise<JobResult> => {
  const startTime = new Date();
  const { userId, exchange, syncType, startDate, endDate } = job.data;

  try {
    logger.info(`Processing data sync job ${job.id}`, {
      userId,
      exchange,
      syncType,
      startDate,
      endDate
    });

    let syncResults: any = {};

    switch (syncType) {
      case SyncType.TRANSACTIONS:
        syncResults = await syncTransactions(userId, exchange, startDate, endDate);
        break;
      
      case SyncType.BALANCES:
        syncResults = await syncBalances(userId, exchange);
        break;
      
      case SyncType.ORDERS:
        syncResults = await syncOrders(userId, exchange, startDate, endDate);
        break;
      
      case SyncType.ALL:
        const [transactions, balances, orders] = await Promise.all([
          syncTransactions(userId, exchange, startDate, endDate),
          syncBalances(userId, exchange),
          syncOrders(userId, exchange, startDate, endDate)
        ]);
        syncResults = { transactions, balances, orders };
        break;
      
      default:
        throw new Error(`Unsupported sync type: ${syncType}`);
    }

    // Send real-time update to user
    await webSocketService.sendToUser(userId, 'data_sync_complete', {
      exchange,
      syncType,
      results: syncResults,
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

    logger.info(`Data sync job ${job.id} completed`, {
      userId,
      exchange,
      syncType,
      duration: metrics.duration,
      results: syncResults
    });

    return {
      success: true,
      data: {
        userId,
        exchange,
        syncType,
        results: syncResults,
        syncedAt: endTime
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

    logger.error(`Data sync job ${job.id} failed:`, error);

    // Send error notification to user
    await webSocketService.sendToUser(userId, 'data_sync_error', {
      exchange,
      syncType,
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

// Helper functions for different sync types
async function syncTransactions(
  userId: string,
  exchange: string,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const exchangeClient = await exchangeService.getExchangeClient(userId, exchange);
  const transactions = await exchangeClient.fetchTransactions(startDate, endDate);
  
  const syncedTransactions = [];
  for (const transaction of transactions) {
    const synced = await transactionService.syncTransaction(userId, transaction);
    syncedTransactions.push(synced);
  }

  return {
    type: 'transactions',
    count: syncedTransactions.length,
    transactions: syncedTransactions
  };
}

async function syncBalances(userId: string, exchange: string): Promise<any> {
  const exchangeClient = await exchangeService.getExchangeClient(userId, exchange);
  const balances = await exchangeClient.fetchBalances();
  
  const syncedBalances = await exchangeService.syncBalances(userId, exchange, balances);

  return {
    type: 'balances',
    count: syncedBalances.length,
    balances: syncedBalances
  };
}

async function syncOrders(
  userId: string,
  exchange: string,
  startDate?: Date,
  endDate?: Date
): Promise<any> {
  const exchangeClient = await exchangeService.getExchangeClient(userId, exchange);
  const orders = await exchangeClient.fetchOrders(startDate, endDate);
  
  const syncedOrders = [];
  for (const order of orders) {
    const synced = await exchangeService.syncOrder(userId, order);
    syncedOrders.push(synced);
  }

  return {
    type: 'orders',
    count: syncedOrders.length,
    orders: syncedOrders
  };
}