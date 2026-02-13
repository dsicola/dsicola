import { Router } from 'express';
import { authenticate, authorize, addInstitutionFilter } from '../middlewares/auth.js';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { UserRole } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all user roles (with institution filter)
router.get('/', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR'), async (req, res, next) => {
  try {
    const { userId, role, instituicaoId } = req.query;

    let whereClause: any = {};

    // Apply institution filter
    if (!req.user?.roles.includes('SUPER_ADMIN')) {
      if (req.user?.instituicaoId) {
        whereClause.instituicaoId = req.user.instituicaoId;
      }
    } else if (instituicaoId) {
      whereClause.instituicaoId = instituicaoId as string;
    }

    if (userId) {
      whereClause.userId = userId as string;
    }

    if (role) {
      whereClause.role = role as UserRole;
    }

    const userRoles = await prisma.userRole_.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nomeCompleto: true,
            avatarUrl: true,
            instituicaoId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to include both camelCase and snake_case for frontend compatibility
    const formatted = userRoles.map(role => ({
      id: role.id,
      userId: role.userId,
      user_id: role.userId, // Add snake_case for frontend compatibility
      role: role.role,
      instituicaoId: role.instituicaoId,
      instituicao_id: role.instituicaoId,
      createdAt: role.createdAt,
      created_at: role.createdAt,
      user: role.user,
    }));

    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

// Get user roles by user ID (ADMIN/SECRETARIA para gestão; usuário pode ver próprios roles)
router.get('/user/:userId', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { userId } = req.params;

    const userRoles = await prisma.userRole_.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    res.json(userRoles);
  } catch (error) {
    next(error);
  }
});

// Get by role
router.get('/role/:role', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { role } = req.params;
    const filter = addInstitutionFilter(req);

    const userRoles = await prisma.userRole_.findMany({
      where: { 
        role: role as UserRole,
        ...filter
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            nomeCompleto: true,
            avatarUrl: true,
            instituicaoId: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(userRoles);
  } catch (error) {
    next(error);
  }
});

// Create user role
router.post('/', authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { userId, role, instituicaoId } = req.body;

    if (!userId || !role) {
      throw new AppError('userId e role são obrigatórios', 400);
    }

    // Check if user exists
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Usuário não encontrado', 404);
    }

    // Check if role already exists for user
    const existing = await prisma.userRole_.findFirst({
      where: { userId, role: role as UserRole }
    });

    if (existing) {
      throw new AppError('Usuário já possui esta role', 409);
    }

    // REGRA RBAC: Nunca aceitar instituicaoId do frontend para não-SUPER_ADMIN
    const isSuperAdmin = req.user?.roles.includes('SUPER_ADMIN');
    const finalInstituicaoId = isSuperAdmin && instituicaoId
      ? instituicaoId
      : (user.instituicaoId || req.user?.instituicaoId) ?? null;
    const userRole = await prisma.userRole_.create({
      data: {
        userId,
        role: role as UserRole,
        instituicaoId: finalInstituicaoId
      }
    });

    // REGRA SIGA/SIGAE: Se role for PROFESSOR, criar registro na tabela professores
    // Garante que professor sempre está na tabela professores (ver atribuições no painel)
    if (role === 'PROFESSOR' && finalInstituicaoId) {
      const professorExistente = await prisma.professor.findFirst({
        where: { userId, instituicaoId: finalInstituicaoId }
      });
      if (!professorExistente) {
        await prisma.professor.create({
          data: { userId, instituicaoId: finalInstituicaoId }
        });
      }
    }

    res.status(201).json(userRole);
  } catch (error) {
    next(error);
  }
});

// Delete user role
router.delete('/:id', authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const existing = await prisma.userRole_.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError('Role não encontrada', 404);
    }

    await prisma.userRole_.delete({ where: { id } });

    res.json({ message: 'Role removida com sucesso' });
  } catch (error) {
    next(error);
  }
});

export default router;
