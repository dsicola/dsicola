import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import * as debugController from '../controllers/debug.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Debug endpoint
router.get('/multi-tenant', debugController.debugMultiTenant);

export default router;

