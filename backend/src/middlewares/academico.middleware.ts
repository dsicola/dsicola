import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import { AuthenticatedRequest } from './auth.js';

/**
 * Middleware para validar contexto acadêmico institucional
 * Garante que req.user.instituicaoId e req.user.tipoAcademico estão presentes
 * para operações acadêmicas
 */
export const requireAcademicoContext = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    throw new AppError('Usuário não autenticado', 401);
  }

  const authReq = req as AuthenticatedRequest;

  // Validar instituicaoId
  if (!authReq.user.instituicaoId) {
    throw new AppError(
      'Operação acadêmica requer escopo de instituição. Faça login novamente.',
      403
    );
  }

  // Validar tipoAcademico - ALUNO pode fazer consultas sem tipoAcademico (leitura dos próprios dados)
  if (!authReq.user.tipoAcademico) {
    const isAluno = authReq.user.roles?.includes('ALUNO');
    const isGet = req.method === 'GET';
    if (isAluno && isGet) {
      // ALUNO a consultar: permitir sem tipoAcademico (dados de matrícula, notas, etc.)
      next();
      return;
    }
    throw new AppError(
      'Tipo acadêmico da instituição não identificado. Configure o tipo acadêmico da instituição (ENSINO_SUPERIOR ou ENSINO_SECUNDARIO) antes de continuar.',
      400
    );
  }

  next();
};

/**
 * Valida campos acadêmicos conforme tipo de instituição
 * REGRA SIGA/SIGAE:
 * - SUPERIOR: usa SEMESTRE, NUNCA Classe ou Trimestre
 * - SECUNDARIO: usa CLASSE + TRIMESTRE, NUNCA Semestre
 * 
 * IMPORTANTE: Valida apenas em métodos que modificam dados (POST, PUT, PATCH, DELETE)
 * GET requests não são validados aqui (apenas leitura)
 */
export const validateAcademicoFields = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user?.tipoAcademico) {
    return next(); // Se não tem tipoAcademico, deixar outros middlewares tratar
  }

  // Validar apenas em métodos que modificam dados
  const methodsModificadores = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!methodsModificadores.includes(req.method)) {
    return next(); // GET, OPTIONS, etc. não precisam validar campos do body
  }

  const tipoAcademico = authReq.user.tipoAcademico;
  const body = req.body || {};

  // IMPORTANTE: Validar apenas campos de configuração acadêmica, não campos de dados de notas
  // Campos de notas (alunoId, exameId, avaliacaoId, valor, observacoes) não devem ser validados aqui
  // Validar apenas se o body contém campos de configuração acadêmica (classeId, semestreId, etc.)
  
  // Lista de campos que são de configuração acadêmica (devem ser validados)
  const camposAcademicos = ['classeId', 'classe', 'classeOuAno', 'trimestreId', 'trimestre', 'semestreId', 'semestre'];
  const temCamposAcademicos = camposAcademicos.some(campo => body[campo] !== undefined);
  
  // Se não tem campos acadêmicos no body, não validar (pode ser uma requisição de notas, por exemplo)
  if (!temCamposAcademicos) {
    return next();
  }

  // Validações para ENSINO SUPERIOR
  if (tipoAcademico === 'SUPERIOR') {
    // Bloquear campos inválidos
    if (body.classeId || body.classe || body.classeOuAno) {
      throw new AppError(
        'Campo "Classe" não é válido para Ensino Superior. Use "Curso" e "Semestre".',
        400
      );
    }

    if (body.trimestreId || body.trimestre !== undefined) {
      throw new AppError(
        'Campo "Trimestre" não é válido para Ensino Superior. Use "Semestre".',
        400
      );
    }

    // Validar que semestre está presente quando necessário
    // (validação específica será feita nos controllers conforme contexto)
  }

  // Validações para ENSINO SECUNDÁRIO
  if (tipoAcademico === 'SECUNDARIO') {
    // Bloquear campos inválidos
    if (body.semestreId || body.semestre !== undefined) {
      throw new AppError(
        'Campo "Semestre" não é válido para Ensino Secundário. Use "Classe" e "Trimestre".',
        400
      );
    }

    // Validar que classe está presente quando necessário
    // (validação específica será feita nos controllers conforme contexto)
  }

  next();
};

/**
 * Helper para obter tipoAcademico do request (garantido pelo middleware)
 * Retorna erro se não estiver disponível
 */
export const getTipoAcademicoFromRequest = (req: Request): 'SUPERIOR' | 'SECUNDARIO' => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user?.tipoAcademico) {
    throw new AppError(
      'Tipo acadêmico da instituição não identificado. Configure o tipo acadêmico da instituição antes de continuar.',
      400
    );
  }

  return authReq.user.tipoAcademico;
};

/**
 * Helper para verificar se é Ensino Superior
 */
export const isEnsinoSuperior = (req: Request): boolean => {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.tipoAcademico === 'SUPERIOR';
};

/**
 * Helper para verificar se é Ensino Secundário
 */
export const isEnsinoSecundario = (req: Request): boolean => {
  const authReq = req as AuthenticatedRequest;
  return authReq.user?.tipoAcademico === 'SECUNDARIO';
};

