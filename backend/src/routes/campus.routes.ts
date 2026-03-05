import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as campusController from '../controllers/campus.controller.js';

const router = Router();

router.use(authenticate);
router.use(validateLicense);

router.get('/', campusController.getCampus);
router.get('/:id', campusController.getCampusById);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), campusController.createCampus);
router.put('/:id', authorize('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), campusController.updateCampus);
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), campusController.deleteCampus);

export default router;
