import { PrismaClient, Transaction, TransactionType, TransactionStatus, Portfolio, Holding } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { logger } from '../utils/logger';

interface CreateTransactionInput {
  userId: string;
  portfolioId: string;
  type: TransactionType;
  cryptocurrencyId: string;
  quantity: Decimal | number | string;
  price?: Decimal | number | string;
  fee?: Decimal | number | string;
  feeCurrencyId?: string;
  totalValue?: Decimal | number | string;
  exchangeId?: string;
  exchangeTransactionId?: string;
  notes?: string;
  transactionHash?: string;
  blockNumber?: bigint;
  executedAt?: Date;
}

interface UpdateTransactionInput {
  type?: TransactionType;
  status?: TransactionStatus;
  quantity?: Decimal | number | string;
  price?: Decimal | number | string;
  fee?: Decimal | number | string;
  totalValue?: Decimal | number | string;
  notes?: string;
}

interface TransactionWithDetails extends Transaction {
  cryptocurrency: {
    id: string;
    symbol: string;
    name: string;
    logoUrl: string | null;
  };
  portfolio: {
    id: string;
    name: string;
  };
  exchange?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

interface TransactionSummary {
  totalTransactions: number;
  totalBuyVolume: Decimal;
  totalSellVolume: Decimal;
  totalFeesUSD: Decimal;
  netInvestment: Decimal;
  averageBuyPrice: Decimal;
  averageSellPrice: Decimal;
  profitLoss: Decimal;
}

interface PeriodSummary {
  period: string;
  transactions: number;
  volume: Decimal;
  fees: Decimal;
  netFlow: Decimal;
}

export class TransactionService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new transaction
   */
  async createTransaction(data: CreateTransactionInput): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
      // Validate portfolio ownership
      const portfolio = await tx.portfolio.findFirst({
        where: {
          id: data.portfolioId,
          userId: data.userId,
        },
      });

      if (!portfolio) {
        throw new Error('Portfolio not found or access denied');
      }

      // Create the transaction
      const transaction = await tx.transaction.create({
        data: {
          userId: data.userId,
          portfolioId: data.portfolioId,
          type: data.type,
          status: TransactionStatus.COMPLETED,
          cryptocurrencyId: data.cryptocurrencyId,
          quantity: new Decimal(data.quantity),
          price: data.price ? new Decimal(data.price) : null,
          fee: data.fee ? new Decimal(data.fee) : new Decimal(0),
          feeCurrencyId: data.feeCurrencyId,
          totalValue: data.totalValue ? new Decimal(data.totalValue) : null,
          exchangeId: data.exchangeId,
          exchangeTransactionId: data.exchangeTransactionId,
          notes: data.notes,
          transactionHash: data.transactionHash,
          blockNumber: data.blockNumber,
          executedAt: data.executedAt || new Date(),
        },
      });

      // Calculate total value if not provided
      if (!transaction.totalValue && transaction.price) {
        const totalValue = transaction.quantity.mul(transaction.price);
        await tx.transaction.update({
          where: { id: transaction.id },
          data: { totalValue },
        });
        transaction.totalValue = totalValue;
      }

      // Update portfolio holdings
      await this.updatePortfolioHoldings(tx, transaction);

      return transaction;
    });
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(transactionId: string, userId: string): Promise<TransactionWithDetails | null> {
    return this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        userId,
      },
      include: {
        cryptocurrency: {
          select: {
            id: true,
            symbol: true,
            name: true,
            logoUrl: true,
          },
        },
        portfolio: {
          select: {
            id: true,
            name: true,
          },
        },
        exchange: {
          select: {
            id: true,
            name: true,
            displayName: true,
          },
        },
      },
    }) as Promise<TransactionWithDetails | null>;
  }

  /**
   * Get user transactions with filters and pagination
   */
  async getUserTransactions(
    userId: string,
    options: {
      portfolioId?: string;
      cryptocurrencyId?: string;
      exchangeId?: string;
      type?: TransactionType;
      status?: TransactionStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
      sortBy?: 'executedAt' | 'totalValue' | 'quantity';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{
    transactions: TransactionWithDetails[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
  }> {
    const {
      portfolioId,
      cryptocurrencyId,
      exchangeId,
      type,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 50,
      sortBy = 'executedAt',
      sortOrder = 'desc',
    } = options;

    const where: any = { userId };

    if (portfolioId) where.portfolioId = portfolioId;
    if (cryptocurrencyId) where.cryptocurrencyId = cryptocurrencyId;
    if (exchangeId) where.exchangeId = exchangeId;
    if (type) where.type = type;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.executedAt = {};
      if (startDate) where.executedAt.gte = startDate;
      if (endDate) where.executedAt.lte = endDate;
    }

    const [transactions, totalCount] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        include: {
          cryptocurrency: {
            select: {
              id: true,
              symbol: true,
              name: true,
              logoUrl: true,
            },
          },
          portfolio: {
            select: {
              id: true,
              name: true,
            },
          },
          exchange: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
      }) as Promise<TransactionWithDetails[]>,
      this.prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
    };
  }

  /**
   * Update transaction
   */
  async updateTransaction(
    transactionId: string,
    userId: string,
    data: UpdateTransactionInput
  ): Promise<Transaction> {
    return this.prisma.$transaction(async (tx) => {
      // Get original transaction
      const originalTransaction = await tx.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!originalTransaction) {
        throw new Error('Transaction not found');
      }

      // Revert original holdings update
      await this.revertHoldingsUpdate(tx, originalTransaction);

      // Update transaction
      const updateData: any = {};
      if (data.type) updateData.type = data.type;
      if (data.status) updateData.status = data.status;
      if (data.quantity) updateData.quantity = new Decimal(data.quantity);
      if (data.price) updateData.price = new Decimal(data.price);
      if (data.fee !== undefined) updateData.fee = new Decimal(data.fee);
      if (data.totalValue) updateData.totalValue = new Decimal(data.totalValue);
      if (data.notes !== undefined) updateData.notes = data.notes;

      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: updateData,
      });

      // Recalculate total value if needed
      if ((data.quantity || data.price) && updatedTransaction.price) {
        const totalValue = updatedTransaction.quantity.mul(updatedTransaction.price);
        await tx.transaction.update({
          where: { id: transactionId },
          data: { totalValue },
        });
        updatedTransaction.totalValue = totalValue;
      }

      // Apply new holdings update
      await this.updatePortfolioHoldings(tx, updatedTransaction);

      return updatedTransaction;
    });
  }

  /**
   * Delete transaction
   */
  async deleteTransaction(transactionId: string, userId: string): Promise<void> {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findFirst({
        where: {
          id: transactionId,
          userId,
        },
      });

      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Revert holdings update
      await this.revertHoldingsUpdate(tx, transaction);

      // Delete transaction
      await tx.transaction.delete({
        where: { id: transactionId },
      });
    });
  }

  /**
   * Import transactions from exchange
   */
  async importExchangeTransactions(
    userId: string,
    portfolioId: string,
    exchangeId: string,
    transactions: any[]
  ): Promise<number> {
    let importedCount = 0;

    for (const txData of transactions) {
      try {
        // Check if transaction already exists
        const existingTx = await this.prisma.transaction.findFirst({
          where: {
            exchangeTransactionId: txData.id,
            exchangeId,
            userId,
          },
        });

        if (existingTx) {
          continue; // Skip duplicate
        }

        // Find or create cryptocurrency
        const cryptocurrency = await this.findOrCreateCryptocurrency(txData.symbol);

        // Create transaction
        await this.createTransaction({
          userId,
          portfolioId,
          type: this.mapTransactionType(txData.type),
          cryptocurrencyId: cryptocurrency.id,
          quantity: txData.quantity,
          price: txData.price,
          fee: txData.fee,
          totalValue: txData.total,
          exchangeId,
          exchangeTransactionId: txData.id,
          executedAt: new Date(txData.timestamp),
        });

        importedCount++;
      } catch (error) {
        logger.error('Error importing transaction:', error);
      }
    }

    logger.info(`Imported ${importedCount} transactions from exchange`);
    return importedCount;
  }

  /**
   * Get transaction summary for a portfolio
   */
  async getTransactionSummary(
    portfolioId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<TransactionSummary> {
    const where: any = {
      portfolioId,
      userId,
      status: TransactionStatus.COMPLETED,
    };

    if (startDate || endDate) {
      where.executedAt = {};
      if (startDate) where.executedAt.gte = startDate;
      if (endDate) where.executedAt.lte = endDate;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: {
        type: true,
        quantity: true,
        price: true,
        totalValue: true,
        fee: true,
      },
    });

    let totalBuyVolume = new Decimal(0);
    let totalSellVolume = new Decimal(0);
    let totalFeesUSD = new Decimal(0);
    let buyTransactions = 0;
    let sellTransactions = 0;
    let totalBuyAmount = new Decimal(0);
    let totalSellAmount = new Decimal(0);

    for (const tx of transactions) {
      const totalValue = tx.totalValue || new Decimal(0);
      const fee = tx.fee || new Decimal(0);

      totalFeesUSD = totalFeesUSD.add(fee);

      if (tx.type === TransactionType.BUY) {
        totalBuyVolume = totalBuyVolume.add(totalValue);
        totalBuyAmount = totalBuyAmount.add(tx.quantity);
        buyTransactions++;
      } else if (tx.type === TransactionType.SELL) {
        totalSellVolume = totalSellVolume.add(totalValue);
        totalSellAmount = totalSellAmount.add(tx.quantity);
        sellTransactions++;
      }
    }

    const netInvestment = totalBuyVolume.sub(totalSellVolume);
    const averageBuyPrice = buyTransactions > 0 ? totalBuyVolume.div(totalBuyAmount) : new Decimal(0);
    const averageSellPrice = sellTransactions > 0 ? totalSellVolume.div(totalSellAmount) : new Decimal(0);
    const profitLoss = totalSellVolume.sub(totalBuyVolume);

    return {
      totalTransactions: transactions.length,
      totalBuyVolume,
      totalSellVolume,
      totalFeesUSD,
      netInvestment,
      averageBuyPrice,
      averageSellPrice,
      profitLoss,
    };
  }

  /**
   * Get transaction summary by period
   */
  async getTransactionsByPeriod(
    portfolioId: string,
    userId: string,
    period: 'day' | 'week' | 'month' | 'year' = 'day',
    limit: number = 30
  ): Promise<PeriodSummary[]> {
    // This would use database-specific date functions
    // For now, we'll implement a basic version
    const endDate = new Date();
    const summaries: PeriodSummary[] = [];

    for (let i = 0; i < limit; i++) {
      const periodStart = new Date(endDate);
      const periodEnd = new Date(endDate);

      switch (period) {
        case 'day':
          periodStart.setDate(periodStart.getDate() - i);
          periodEnd.setDate(periodEnd.getDate() - i + 1);
          break;
        case 'week':
          periodStart.setDate(periodStart.getDate() - (i * 7));
          periodEnd.setDate(periodEnd.getDate() - ((i - 1) * 7));
          break;
        case 'month':
          periodStart.setMonth(periodStart.getMonth() - i);
          periodEnd.setMonth(periodEnd.getMonth() - i + 1);
          break;
        case 'year':
          periodStart.setFullYear(periodStart.getFullYear() - i);
          periodEnd.setFullYear(periodEnd.getFullYear() - i + 1);
          break;
      }

      const periodSummary = await this.getTransactionSummary(
        portfolioId,
        userId,
        periodStart,
        periodEnd
      );

      summaries.push({
        period: periodStart.toISOString().split('T')[0],
        transactions: periodSummary.totalTransactions,
        volume: periodSummary.totalBuyVolume.add(periodSummary.totalSellVolume),
        fees: periodSummary.totalFeesUSD,
        netFlow: periodSummary.netInvestment,
      });
    }

    return summaries.reverse();
  }

  /**
   * Calculate realized P&L for a cryptocurrency
   */
  async calculateRealizedPnL(
    portfolioId: string,
    cryptocurrencyId: string,
    userId: string
  ): Promise<{
    totalRealizedPnL: Decimal;
    totalCost: Decimal;
    totalProceeds: Decimal;
    transactions: number;
  }> {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        portfolioId,
        cryptocurrencyId,
        userId,
        status: TransactionStatus.COMPLETED,
        type: { in: [TransactionType.BUY, TransactionType.SELL] },
      },
      orderBy: { executedAt: 'asc' },
    });

    let totalCost = new Decimal(0);
    let totalProceeds = new Decimal(0);
    let totalQuantity = new Decimal(0);
    let averageCost = new Decimal(0);

    for (const tx of transactions) {
      const totalValue = tx.totalValue || new Decimal(0);

      if (tx.type === TransactionType.BUY) {
        totalCost = totalCost.add(totalValue);
        totalQuantity = totalQuantity.add(tx.quantity);
        averageCost = totalQuantity.gt(0) ? totalCost.div(totalQuantity) : new Decimal(0);
      } else if (tx.type === TransactionType.SELL) {
        totalProceeds = totalProceeds.add(totalValue);
        const sellCost = tx.quantity.mul(averageCost);
        totalCost = totalCost.sub(sellCost);
        totalQuantity = totalQuantity.sub(tx.quantity);
        averageCost = totalQuantity.gt(0) ? totalCost.div(totalQuantity) : new Decimal(0);
      }
    }

    const totalRealizedPnL = totalProceeds.sub(totalCost);

    return {
      totalRealizedPnL,
      totalCost,
      totalProceeds,
      transactions: transactions.length,
    };
  }

  // Private helper methods
  private async updatePortfolioHoldings(tx: any, transaction: Transaction): Promise<void> {
    if (transaction.type === TransactionType.BUY) {
      await this.addToHolding(tx, transaction);
    } else if (transaction.type === TransactionType.SELL) {
      await this.subtractFromHolding(tx, transaction);
    }
    // Handle other transaction types (DEPOSIT, WITHDRAWAL, etc.) as needed
  }

  private async addToHolding(tx: any, transaction: Transaction): Promise<void> {
    const existingHolding = await tx.holding.findFirst({
      where: {
        portfolioId: transaction.portfolioId,
        cryptocurrencyId: transaction.cryptocurrencyId,
        exchangeId: transaction.exchangeId,
      },
    });

    const totalValue = transaction.totalValue || new Decimal(0);

    if (existingHolding) {
      const newQuantity = existingHolding.quantity.add(transaction.quantity);
      const newTotalCost = (existingHolding.totalCost || new Decimal(0)).add(totalValue);
      const newAverageCost = newQuantity.gt(0) ? newTotalCost.div(newQuantity) : new Decimal(0);

      await tx.holding.update({
        where: { id: existingHolding.id },
        data: {
          quantity: newQuantity,
          totalCost: newTotalCost,
          averageCost: newAverageCost,
        },
      });
    } else {
      await tx.holding.create({
        data: {
          portfolioId: transaction.portfolioId,
          cryptocurrencyId: transaction.cryptocurrencyId,
          exchangeId: transaction.exchangeId,
          quantity: transaction.quantity,
          totalCost: totalValue,
          averageCost: transaction.price || new Decimal(0),
        },
      });
    }
  }

  private async subtractFromHolding(tx: any, transaction: Transaction): Promise<void> {
    const holding = await tx.holding.findFirst({
      where: {
        portfolioId: transaction.portfolioId,
        cryptocurrencyId: transaction.cryptocurrencyId,
        exchangeId: transaction.exchangeId,
      },
    });

    if (!holding) {
      throw new Error('Cannot sell - no holding found');
    }

    if (holding.quantity.lt(transaction.quantity)) {
      throw new Error('Cannot sell - insufficient quantity');
    }

    const newQuantity = holding.quantity.sub(transaction.quantity);
    const costPerUnit = holding.averageCost || new Decimal(0);
    const soldCost = transaction.quantity.mul(costPerUnit);
    const newTotalCost = (holding.totalCost || new Decimal(0)).sub(soldCost);

    if (newQuantity.eq(0)) {
      await tx.holding.delete({
        where: { id: holding.id },
      });
    } else {
      await tx.holding.update({
        where: { id: holding.id },
        data: {
          quantity: newQuantity,
          totalCost: newTotalCost,
        },
      });
    }
  }

  private async revertHoldingsUpdate(tx: any, transaction: Transaction): Promise<void> {
    if (transaction.type === TransactionType.BUY) {
      await this.subtractFromHolding(tx, transaction);
    } else if (transaction.type === TransactionType.SELL) {
      await this.addToHolding(tx, transaction);
    }
  }

  private async findOrCreateCryptocurrency(symbol: string): Promise<{ id: string }> {
    let crypto = await this.prisma.cryptocurrency.findFirst({
      where: { symbol: symbol.toUpperCase() },
    });

    if (!crypto) {
      crypto = await this.prisma.cryptocurrency.create({
        data: {
          symbol: symbol.toUpperCase(),
          name: symbol, // This would be improved with external API data
        },
      });
    }

    return crypto;
  }

  private mapTransactionType(exchangeType: string): TransactionType {
    const typeMap: { [key: string]: TransactionType } = {
      'buy': TransactionType.BUY,
      'sell': TransactionType.SELL,
      'deposit': TransactionType.DEPOSIT,
      'withdrawal': TransactionType.WITHDRAWAL,
      'transfer': TransactionType.TRANSFER,
    };

    return typeMap[exchangeType.toLowerCase()] || TransactionType.BUY;
  }
}