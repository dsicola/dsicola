import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { UserRole } from '@prisma/client';
import * as ctrl from './communityAd.controller.js';

/**
 * Rotas REST da publicidade na Comunidade.
 *
 * Prefixo montado em `app.ts`: `/api/community/ad-bookings`
 * - `GET /me` — resumo + histórico do tenant (ADMIN/DIRECAO/SUPER_ADMIN com instituição).
 * - `POST /` — novo pedido (fica AGUARDANDO_ANALISE até o Super Admin aprovar/rejeitar).
 * - `PATCH /me/:id/cancel` — cancelar pedido ainda em fila.
 * - `PATCH /me/:id/comprovativo` — anexar ou alterar comprovativo (só AGUARDANDO_ANALISE).
 * - `GET /super` — fila global (só SUPER_ADMIN).
 * - `PATCH /super/:id` — aprovar/rejeitar (só SUPER_ADMIN).
 */
const router = Router();

const instituicaoRoles = [UserRole.ADMIN, UserRole.DIRECAO, UserRole.SUPER_ADMIN];

router.get('/me', authenticate, authorize(...instituicaoRoles), ctrl.listMine);
router.post('/', authenticate, authorize(...instituicaoRoles), ctrl.create);
router.patch('/me/:id/cancel', authenticate, authorize(...instituicaoRoles), ctrl.cancelMine);
router.patch('/me/:id/comprovativo', authenticate, authorize(...instituicaoRoles), ctrl.attachComprovativo);

router.get('/super', authenticate, authorize(UserRole.SUPER_ADMIN), ctrl.superList);
router.patch('/super/:id', authenticate, authorize(UserRole.SUPER_ADMIN), ctrl.superReview);

export default router;
