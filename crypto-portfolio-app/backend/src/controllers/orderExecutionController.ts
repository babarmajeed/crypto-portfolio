import { Request, Response } from 'express';
import { orderExecutionService } from '../services/exchanges/orderExecutionService';
import { auditService } from '../services/auditService';
import { loggingService } from '../services/loggingService';

export class OrderExecutionController {
  async executeOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce,
        clientOrderId
      } = req.body;

      const orderRequest = {
        userId,
        exchange,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce,
        clientOrderId
      };

      const orderResponse = await orderExecutionService.executeOrder(orderRequest);

      await auditService.log({
        userId,
        action: 'order_executed',
        resource: 'order',
        details: {
          orderId: orderResponse.orderId,
          exchange,
          symbol,
          side,
          type,
          quantity,
          status: orderResponse.status
        }
      });

      res.status(201).json({
        success: true,
        data: {
          order: orderResponse,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Order execution failed', { 
        userId: (req as any).user.id,
        orderRequest: req.body,
        error: error.message 
      });

      if (error.message.includes('validation failed')) {
        return res.status(400).json({
          success: false,
          error: 'Order validation failed',
          message: error.message
        });
      }

      if (error.message.includes('Insufficient balance')) {
        return res.status(400).json({
          success: false,
          error: 'Insufficient balance',
          message: error.message
        });
      }

      if (error.message.includes('Unsupported exchange')) {
        return res.status(400).json({
          success: false,
          error: 'Unsupported exchange',
          message: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Order execution failed',
        message: 'Internal server error'
      });
    }
  }

  async getOrderStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange, orderId } = req.params;

      const orderStatus = await orderExecutionService.getOrderStatus(userId, exchange, orderId);

      if (!orderStatus) {
        return res.status(404).json({
          success: false,
          error: 'Order not found'
        });
      }

      res.json({
        success: true,
        data: {
          order: orderStatus,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get order status', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        orderId: req.params.orderId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get order status'
      });
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange, orderId } = req.params;
      const { clientOrderId } = req.body;

      const canceled = await orderExecutionService.cancelOrder(
        userId, 
        exchange, 
        orderId, 
        clientOrderId
      );

      if (!canceled) {
        return res.status(400).json({
          success: false,
          error: 'Failed to cancel order'
        });
      }

      await auditService.log({
        userId,
        action: 'order_canceled',
        resource: 'order',
        details: { exchange, orderId, clientOrderId }
      });

      res.json({
        success: true,
        data: {
          canceled: true,
          orderId,
          exchange,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Order cancellation failed', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        orderId: req.params.orderId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Order cancellation failed'
      });
    }
  }

  async getUserOrders(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { exchange } = req.params;
      const { symbol, limit = 50, page = 1 } = req.query;

      const orders = await orderExecutionService.getUserOrders(
        userId,
        exchange,
        symbol as string,
        parseInt(limit as string)
      );

      const startIndex = (parseInt(page as string) - 1) * parseInt(limit as string);
      const paginatedOrders = orders.slice(startIndex, startIndex + parseInt(limit as string));

      res.json({
        success: true,
        data: {
          orders: paginatedOrders,
          pagination: {
            page: parseInt(page as string),
            limit: parseInt(limit as string),
            total: orders.length,
            pages: Math.ceil(orders.length / parseInt(limit as string))
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get user orders', {
        userId: (req as any).user.id,
        exchange: req.params.exchange,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get orders'
      });
    }
  }

  async validateOrder(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const {
        exchange,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce
      } = req.body;

      const orderRequest = {
        userId,
        exchange,
        symbol,
        side,
        type,
        quantity,
        price,
        stopPrice,
        timeInForce
      };

      const validation = await orderExecutionService.validateOrder(orderRequest);

      res.json({
        success: true,
        data: {
          validation,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Order validation failed', {
        userId: (req as any).user.id,
        orderRequest: req.body,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Order validation failed'
      });
    }
  }

  async getPendingOrders(req: Request, res: Response) {
    try {
      const pendingOrders = orderExecutionService.getPendingOrders();
      
      res.json({
        success: true,
        data: {
          orders: pendingOrders,
          count: pendingOrders.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get pending orders', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get pending orders'
      });
    }
  }

  async getSupportedExchanges(req: Request, res: Response) {
    try {
      const exchanges = orderExecutionService.getSupportedExchanges();
      
      res.json({
        success: true,
        data: {
          exchanges,
          count: exchanges.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      loggingService.error('Failed to get supported exchanges', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get supported exchanges'
      });
    }
  }
}

export const orderExecutionController = new OrderExecutionController();