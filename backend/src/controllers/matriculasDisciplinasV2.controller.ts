import { Request, Response, NextFunction } from 'express';
import { requireTenantScope } from '../middlewares/auth.js';
import { MatriculasDisciplinasV2Service } from '../services/matriculasDisciplinasV2.service.js';

/**
 * GET /v2/matriculas-disciplinas
 * Listagem de matrículas em disciplinas (versão 2 - robusta e simples)
 * 
 * Sempre retorna 200 com array (vazio ou com dados)
 * Não exige query params
 * Filtros opcionais: instituicao_id, ano_letivo, aluno_id, turma_id, curso_id, status
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Log de entrada
    console.log('[GET /v2/matriculas-disciplinas] Iniciando requisição');
    console.log('[GET /v2/matriculas-disciplinas] Query params:', req.query);
    console.log('[GET /v2/matriculas-disciplinas] User:', req.user ? {
      userId: req.user.userId,
      email: req.user.email,
      instituicaoId: req.user.instituicaoId,
      roles: req.user.roles
    } : 'not authenticated');

    // Validar e extrair filtros opcionais
    const filters: any = {};

    // MULTI-TENANT: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // NUNCA aceitar instituicaoId do query - violação de segurança multi-tenant
    // SUPER_ADMIN também deve usar instituicaoId do token para garantir isolamento
    const instituicaoId = requireTenantScope(req);
    
    // Aplicar filtro de instituição (sempre do JWT)
    if (instituicaoId) {
      filters.instituicao_id = instituicaoId;
    } else {
      // Se não tem instituicaoId no token, não retornar dados
      return res.json([]);
    }

    // ano_letivo (opcional)
    if (req.query.ano_letivo) {
      const ano = Number(req.query.ano_letivo);
      if (isNaN(ano) || ano < 1900 || ano > 2100) {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'ano_letivo',
            motivo: 'deve ser um número válido entre 1900 e 2100'
          }
        });
      }
      filters.ano_letivo = ano;
    }

    // aluno_id (opcional)
    if (req.query.aluno_id) {
      const alunoId = String(req.query.aluno_id).trim();
      if (alunoId === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'aluno_id',
            motivo: 'não pode ser uma string vazia'
          }
        });
      }
      filters.aluno_id = alunoId;
    }

    // turma_id (opcional)
    if (req.query.turma_id) {
      const turmaId = String(req.query.turma_id).trim();
      if (turmaId === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'turma_id',
            motivo: 'não pode ser uma string vazia'
          }
        });
      }
      filters.turma_id = turmaId;
    }

    // curso_id (opcional)
    if (req.query.curso_id) {
      const cursoId = String(req.query.curso_id).trim();
      if (cursoId === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'curso_id',
            motivo: 'não pode ser uma string vazia'
          }
        });
      }
      filters.curso_id = cursoId;
    }

    // status (opcional)
    if (req.query.status) {
      const status = String(req.query.status).trim();
      if (status === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'status',
            motivo: 'não pode ser uma string vazia'
          }
        });
      }
      filters.status = status;
    }

    // Buscar dados usando o service
    const resultados = await MatriculasDisciplinasV2Service.getAll(req.user, filters);

    // Sempre retornar 200 com array (vazio ou com dados)
    console.log('[GET /v2/matriculas-disciplinas] Retornando', resultados.length, 'resultados');
    return res.status(200).json(resultados);

  } catch (error) {
    // Log do erro antes de responder
    console.error('[GET /v2/matriculas-disciplinas] Erro:', error);
    if (error instanceof Error) {
      console.error('[GET /v2/matriculas-disciplinas] Erro message:', error.message);
      console.error('[GET /v2/matriculas-disciplinas] Erro stack:', error.stack);
    }

    // Passar para o error handler padrão
    next(error);
  }
};

