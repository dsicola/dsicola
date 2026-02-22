import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { validateLicense } from '../middlewares/license.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

// All routes require authentication
router.use(authenticate);
// Validate license for all routes (SUPER_ADMIN is exempt in middleware)
router.use(validateLicense);

// Get all users (ADMIN, SECRETARIA, SUPER_ADMIN)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), userController.getUsers);

// Get professor comprovativo/certificate (must be before /:id route)
router.get('/:id/comprovativo', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR'), userController.getProfessorComprovativo);

// Get user by ID
router.get('/:id', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), userController.getUserById);

// Create user (ADMIN, SECRETARIA, RH, SUPER_ADMIN) - RH cadastra funcionários
router.post('/', authorize('ADMIN', 'SECRETARIA', 'RH', 'SUPER_ADMIN'), userController.createUser);

// Update user (ADMIN, SECRETARIA, RH, SUPER_ADMIN) - RH edita perfis de funcionários
router.put('/:id', authorize('ADMIN', 'SECRETARIA', 'RH', 'SUPER_ADMIN'), userController.updateUser);

// Delete user (ADMIN, SUPER_ADMIN only)
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), userController.deleteUser);

// Update user role (ADMIN, SUPER_ADMIN only)
router.put('/:id/role', authorize('ADMIN', 'SUPER_ADMIN'), userController.updateUserRole);

// Create Professor entity explicitly (ADMIN, SUPER_ADMIN only)
// REGRA ARQUITETURAL SIGA/SIGAE: Professor é entidade acadêmica separada
// Role PROFESSOR NÃO cria Professor automaticamente - deve ser criado explicitamente
router.post('/:id/professor', authorize('ADMIN', 'SUPER_ADMIN'), userController.createProfessor);

// User access management routes (ADMIN, SECRETARIA only)
import * as userAccessController from '../controllers/user-access.controller.js';

// Get user access info
router.get('/:id/access', authorize('ADMIN', 'SECRETARIA'), userAccessController.getUserAccessInfo);

// Create user access account
router.post('/:id/access', authorize('ADMIN', 'SECRETARIA'), userAccessController.createUserAccess);

// Toggle user access (activate/deactivate)
router.put('/:id/access', authorize('ADMIN', 'SECRETARIA'), userAccessController.toggleUserAccess);

// Send password reset link
router.post('/:id/access/reset-password', authorize('ADMIN', 'SECRETARIA'), userAccessController.sendPasswordResetLink);

export default router;
