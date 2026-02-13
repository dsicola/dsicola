import { Router } from 'express';
import * as historicoRhController from '../controllers/historicoRh.controller.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

router.get('/', authenticate, authorize('ADMIN', 'RH', 'SUPER_ADMIN'), historicoRhController.getAll);
router.post('/', authenticate, authorize('ADMIN', 'RH', 'SUPER_ADMIN'), historicoRhController.create);

export default router;
