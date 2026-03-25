import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { UserRole } from '@prisma/client';
import * as ctrl from './community.admin.controller.js';

const router = Router();

router.get(
  '/courses',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DIRECAO),
  ctrl.listCourses,
);
router.post(
  '/courses',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DIRECAO),
  ctrl.createCourse,
);
router.patch(
  '/courses/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DIRECAO),
  ctrl.updateCourse,
);
router.delete(
  '/courses/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DIRECAO),
  ctrl.deleteCourse,
);

export default router;
