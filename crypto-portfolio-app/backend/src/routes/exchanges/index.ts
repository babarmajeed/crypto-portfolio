import { Router } from 'express';
import binanceRoutes from './binance.routes';

const router = Router();

// Mount exchange-specific routes
router.use('/binance', binanceRoutes);

// Future exchange routes will be added here
// router.use('/coinbase', coinbaseRoutes);
// router.use('/kraken', krakenRoutes);
// router.use('/kucoin', kucoinRoutes);

export default router;