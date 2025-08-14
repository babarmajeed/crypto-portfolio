import { Router } from 'express';
import binanceRoutes from './binance.routes';
import coinbaseRoutes from './coinbase.routes';
import krakenRoutes from './kraken.routes';
import kucoinRoutes from './kucoin.routes';
import multiExchangeSyncRoutes from './multiExchangeSync.routes';

const router = Router();

// Mount exchange-specific routes
router.use('/binance', binanceRoutes);
router.use('/coinbase', coinbaseRoutes);
router.use('/kraken', krakenRoutes);
router.use('/kucoin', kucoinRoutes);

// Mount multi-exchange synchronization routes
router.use('/sync', multiExchangeSyncRoutes);

export default router;