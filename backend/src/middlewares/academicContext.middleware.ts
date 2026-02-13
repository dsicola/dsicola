import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { requireTenantScope } from './auth.js';

/**
 * Middleware para validar contexto acadêmico institucional
 * Garante que req.user.tipoAcademico está presente e válido
 * Bloqueia campos inválidos automaticamente conforme tipo de instituição
 * 
 * REGRAS SIGA/SIGAE:
 * - ENSINO_SUPERIOR: usa SEMESTRE, NUNCA Classe ou Trimestre
 * - ENSINO_SECUNDARIO: usa CLASSE + TRIMESTRE, NUNCA Semestre
 * 
 * @example
 * router.post('/plano-ensino',
 *   authenticate,
 *   requireAcademicContext,
 *   validateAcademicFields,
 *   controller.create
 * );
 */
export const requireAcademicContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return next(new AppError('Não autenticado', 401));
  }

  // Verificar se usuário tem instituição (exceto SUPER_ADMIN)
  const instituicaoId = req.user.instituicaoId;
  if (!instituicaoId && !req.user.roles.includes('SUPER_ADMIN')) {
    return next(new AppError('Operação acadêmica requer escopo de instituição', 403));
  }

  // Verificar se tipoAcademico está presente no token
  const tipoAcademico = req.user.tipoAcademico;
  if (!tipoAcademico) {
    return next(new AppError(
      'Tipo acadêmico da instituição não identificado. Configure o tipo acadêmico da instituição (ENSINO_SUPERIOR ou ENSINO_SECUNDARIO) antes de continuar.',
      400
    ));
  }

  // Validar que tipoAcademico é válido
  if (tipoAcademico !== 'SUPERIOR' && tipoAcademico !== 'SECUNDARIO') {
    return next(new AppError(
      `Tipo acadêmico inválido: ${tipoAcademico}. Deve ser SUPERIOR ou SECUNDARIO.`,
      400
    ));
  }

  next();
};

/**
 * Middleware para validar e bloquear campos acadêmicos inválidos
 * Bloqueia automaticamente campos que não pertencem ao tipo de instituição
 * 
 * REGRAS:
 * - SUPERIOR: rejeita trimestre, classe, classeId, trimestreId
 * - SECUNDARIO: rejeita semestre, semestreId, anoCurso
 */
export const validateAcademicFields = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user?.tipoAcademico) {
    // Se não tem tipoAcademico, requireAcademicContext deve ter bloqueado antes
    // Mas por segurança, validar aqui também
    return next(new AppError('Tipo acadêmico não identificado', 400));
  }

  const tipoAcademico = req.user.tipoAcademico;
  const body = req.body || {};
  const query = req.query || {};

  // Combinar body e query para validação completa
  const allFields = { ...body, ...query };

  if (tipoAcademico === 'SUPERIOR') {
    // ENSINO SUPERIOR: NUNCA aceitar Classe ou Trimestre
    const camposInvalidos = [
      'trimestre',
      'trimestreId',
      'trimestre_id',
      'classe',
      'classeId',
      'classe_id',
      'classeOuAno',
    ];

    for (const campo of camposInvalidos) {
      if (allFields[campo] !== undefined && allFields[campo] !== null && allFields[campo] !== '') {
        return next(new AppError(
          `Campo "${campo}" não é válido para Ensino Superior. Use "semestre" ou "semestreId" para definir o período acadêmico.`,
          400
        ));
      }
    }
  } else if (tipoAcademico === 'SECUNDARIO') {
    // ENSINO SECUNDÁRIO: NUNCA aceitar Semestre
    const camposInvalidos = [
      'semestre',
      'semestreId',
      'semestre_id',
      'anoCurso',
      'ano_curso',
    ];

    for (const campo of camposInvalidos) {
      if (allFields[campo] !== undefined && allFields[campo] !== null && allFields[campo] !== '') {
        return next(new AppError(
          `Campo "${campo}" não é válido para Ensino Secundário. Use "classe", "classeId" e "trimestre" ou "trimestreId" para definir o período acadêmico.`,
          400
        ));
      }
    }
  }

  next();
};

/**
 * Helper para obter tipoAcademico do request (garantido pelo middleware)
 * Use este helper em controllers para garantir que tipoAcademico está presente
 */
export const getTipoAcademicoFromRequest = (req: Request): 'SUPERIOR' | 'SECUNDARIO' => {
  const tipoAcademico = req.user?.tipoAcademico;
  
  if (!tipoAcademico || (tipoAcademico !== 'SUPERIOR' && tipoAcademico !== 'SECUNDARIO')) {
    throw new AppError('Tipo acadêmico não identificado ou inválido', 400);
  }
  
  return tipoAcademico;
};

/**
 * Helper para verificar se é Ensino Superior
 */
export const isEnsinoSuperior = (req: Request): boolean => {
  return req.user?.tipoAcademico === 'SUPERIOR';
};

/**
 * Helper para verificar se é Ensino Secundário
 */
export const isEnsinoSecundario = (req: Request): boolean => {
  return req.user?.tipoAcademico === 'SECUNDARIO';
};

