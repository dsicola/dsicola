import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import * as academicTemplateController from '../controllers/academicTemplate.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'SUPER_ADMIN'), academicTemplateController.list);
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), academicTemplateController.create);
router.put('/active', authorize('ADMIN', 'SUPER_ADMIN'), academicTemplateController.setActive);

export default router;
