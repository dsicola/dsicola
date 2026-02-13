/**
 * EXEMPLO DE INTEGRAÇÃO DO SISTEMA DE PERMISSÕES
 * 
 * Este arquivo demonstra como integrar o sistema RBAC + Contexto + Workflow
 * nos controllers existentes.
 */

import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { 
  checkPermission, 
  checkPermissionWithContext, 
  checkPermissionWithWorkflow 
} from '../middlewares/permission.middleware.js';
import * as planoEnsinoController from '../controllers/planoEnsino.controller.js';
import prisma from '../lib/prisma.js';

const router = Router();

// ============= EXEMPLO 1: PERMISSÃO SIMPLES =============
// Criar plano de ensino - apenas PROFESSOR pode criar
router.post(
  '/plano-ensino',
  authenticate,
  checkPermission('PLANO_ENSINO', 'CREATE', 'plano_ensino'),
  planoEnsinoController.createOrGetPlanoEnsino
);

// ============= EXEMPLO 2: PERMISSÃO COM CONTEXTO =============
// Criar aula no plano - verifica se professor tem acesso à disciplina
router.post(
  '/plano-ensino/:planoEnsinoId/aulas',
  authenticate,
  checkPermissionWithContext(
    'PLANO_ENSINO',
    'CREATE',
    'plano_aula',
    (req) => {
      // Extrair contexto do plano
      // O middleware buscará o plano e verificará se o usuário tem acesso
      return {
        disciplinaId: req.body.disciplinaId, // Será buscado do plano
      };
    }
  ),
  planoEnsinoController.createAula
);

// ============= EXEMPLO 3: PERMISSÃO COM WORKFLOW =============
// Submeter plano de ensino - verifica se está em estado RASCUNHO
router.post(
  '/plano-ensino/:id/submit',
  authenticate,
  checkPermissionWithWorkflow(
    'PLANO_ENSINO',
    'SUBMIT',
    'plano_ensino',
    async (req) => {
      // Buscar contexto do plano
      const plano = await prisma.planoEnsino.findUnique({
        where: { id: req.params.id },
        select: { disciplinaId: true, cursoId: true, turmaId: true },
      });
      return plano ? {
        disciplinaId: plano.disciplinaId,
        cursoId: plano.cursoId || undefined,
        turmaId: plano.turmaId || undefined,
      } : undefined;
    },
    async (req) => {
      // Buscar estado do workflow
      const plano = await prisma.planoEnsino.findUnique({
        where: { id: req.params.id },
        select: { status: true, bloqueado: true },
      });
      return plano ? {
        status: plano.status,
        bloqueado: plano.bloqueado,
      } : undefined;
    }
  ),
  planoEnsinoController.submitPlano // Implementar este método
);

// ============= EXEMPLO 4: PERMISSÃO COM WORKFLOW (APPROVE) =============
// Aprovar plano - apenas COORDENADOR/DIRECAO pode aprovar, estado deve ser SUBMETIDO
router.post(
  '/plano-ensino/:id/approve',
  authenticate,
  authorize('COORDENADOR', 'DIRECAO', 'ADMIN', 'SUPER_ADMIN'),
  checkPermissionWithWorkflow(
    'PLANO_ENSINO',
    'APPROVE',
    'plano_ensino',
    async (req) => {
      const plano = await prisma.planoEnsino.findUnique({
        where: { id: req.params.id },
        select: { disciplinaId: true, cursoId: true },
      });
      return plano ? {
        disciplinaId: plano.disciplinaId,
        cursoId: plano.cursoId || undefined,
      } : undefined;
    },
    async (req) => {
      const plano = await prisma.planoEnsino.findUnique({
        where: { id: req.params.id },
        select: { status: true, bloqueado: true },
      });
      return plano ? {
        status: plano.status,
        bloqueado: plano.bloqueado,
      } : undefined;
    }
  ),
  planoEnsinoController.approvePlano // Implementar este método
);

// ============= EXEMPLO 5: USO DIRETO NO CONTROLLER =============
/**
 * No controller, você também pode verificar permissões diretamente:
 */

export const exemploController = async (req: any, res: any, next: any) => {
  try {
    // Verificar permissão diretamente
    const { PermissionService } = await import('../services/permission.service.js');
    
    await PermissionService.requirePermission(
      req,
      'PLANO_ENSINO',
      'UPDATE',
      'plano_ensino',
      {
        disciplinaId: req.body.disciplinaId,
        cursoId: req.body.cursoId,
      },
      {
        status: 'RASCUNHO',
        bloqueado: false,
      }
    );

    // Se chegou aqui, tem permissão - continuar com a lógica
    // ...

  } catch (error) {
    next(error);
  }
};

// ============= NOTAS IMPORTANTES =============
/**
 * 1. Sempre use authenticate antes dos middlewares de permissão
 * 2. O PermissionService automaticamente:
 *    - Verifica tenant (instituicaoId)
 *    - Verifica roles do usuário
 *    - Verifica contexto académico
 *    - Verifica estado do workflow
 *    - Registra tentativas bloqueadas na auditoria
 * 
 * 3. Fluxo de validação:
 *    - Role → Contexto → Workflow
 *    - Se qualquer etapa falhar, retorna 403 com log de auditoria
 * 
 * 4. Para auditoria automática:
 *    - Todas as ações são logadas via AuditService
 *    - Bloqueios são logados automaticamente com acao='BLOCK'
 */

