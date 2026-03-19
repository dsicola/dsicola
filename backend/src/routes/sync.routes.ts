import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { syncBatch } from '../controllers/sync.controller.js';

const router = Router();

/**
 * POST /sync - Batch sync para fila offline
 * Recebe array de pedidos e reexecuta cada um.
 * Requer autenticação. Multi-tenant via JWT.
 */
router.post('/', authenticate, syncBatch);

export default router;
