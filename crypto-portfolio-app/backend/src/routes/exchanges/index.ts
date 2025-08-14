import { Router } from 'express';
import binanceRoutes from './binance.routes';
import coinbaseRoutes from './coinbase.routes';
import krakenRoutes from './kraken.routes';

const router = Router();

// Mount exchange-specific routes
router.use('/binance', binanceRoutes);
router.use('/coinbase', coinbaseRoutes);
router.use('/kraken', krakenRoutes);

// Future exchange routes will be added here
// router.use('/kucoin', kucoinRoutes);

export default router;