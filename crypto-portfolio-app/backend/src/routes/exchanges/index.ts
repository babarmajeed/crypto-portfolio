import { Router } from 'express';
import binanceRoutes from './binance.routes';
import coinbaseRoutes from './coinbase.routes';

const router = Router();

// Mount exchange-specific routes
router.use('/binance', binanceRoutes);
router.use('/coinbase', coinbaseRoutes);

// Future exchange routes will be added here
// router.use('/kraken', krakenRoutes);
// router.use('/kucoin', kucoinRoutes);

export default router;