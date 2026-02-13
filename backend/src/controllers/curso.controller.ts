import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validatePlanLimits } from '../middlewares/license.middleware.js';

export const getCursos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // CRÍTICO: Multi-tenant - SEMPRE usar instituicaoId do token, nunca do query/body
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Processar parâmetros da query string (ativo, tipo, etc.)
    const ativoParam = req.query.ativo;
    const ativo = ativoParam !== undefined ? ativoParam === 'true' || ativoParam === true : undefined;

    // Debug log
    console.log('[getCursos] Request:', {
      userInstituicaoId: req.user?.instituicaoId,
      instituicaoIdFromToken: instituicaoId,
      filter,
      ativoParam,
      ativo,
      tipoAcademico: req.user?.tipoAcademico,
    });

    // Always use filter from req.user - ignore instituicaoId from query (multi-tenant security)
    // Construir where clause corretamente para evitar conflitos
    const where: any = {};

    // CRÍTICO: Multi-tenant - SEMPRE aplicar filtro de instituição
    // Usar instituicaoId do token (garantido por requireTenantScope)
    where.instituicaoId = instituicaoId;

    // Aplicar filtro de ativo se fornecido
    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    // Get institution's tipoAcademico to filter courses
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    console.log('[getCursos] Tipo Acadêmico:', tipoAcademico, 'InstituicaoId:', req.user?.instituicaoId);
    
    // REGRA SIGA/SIGAE: 
    // - ENSINO SUPERIOR: Cursos são obrigatórios, excluir cursos do tipo 'classe'
    // - ENSINO SECUNDÁRIO: Cursos podem existir (representam ÁREA/OPÇÃO), mas Classes são obrigatórias
    // - No Ensino Secundário, Curso NÃO possui mensalidade (mensalidade está na Classe)
    // - No Ensino Superior, Curso POSSUI mensalidade
    
    // Para Ensino Superior, excluir cursos do tipo 'classe' (esses devem ser classes)
    // IMPORTANTE: Aplicar filtro de tipo APENAS se tipoAcademico estiver definido como 'SUPERIOR'
    if (tipoAcademico === 'SUPERIOR') {
      // Construir condições do filtro de tipo
      const tipoFilter = {
        OR: [
          { tipo: { not: 'classe' } },
          { tipo: null }
        ]
      };

      // CRÍTICO: Sempre usar AND para combinar todos os filtros
      // Garantir que instituicaoId, ativo (se fornecido) e tipoFilter sejam aplicados
      const andConditions: any[] = [
        { instituicaoId: instituicaoId }, // CRÍTICO: Multi-tenant - sempre incluir
      ];
      
      if (ativo !== undefined) {
        andConditions.push({ ativo: ativo });
      }
      
      andConditions.push(tipoFilter);
      where.AND = andConditions;
    }
    // Para Ensino Secundário ou tipoAcademico null/undefined, retornar TODOS os cursos (sem filtro de tipo)
    // Mas manter filtro de ativo se fornecido
    // NOTA: No Ensino Secundário, cursos podem existir mas não são obrigatórios para conclusão
    // CRÍTICO: instituicaoId já está em where.instituicaoId (linha 33), então não precisa fazer nada

    console.log('[getCursos] Where clause:', JSON.stringify(where, null, 2));

    const cursos = await prisma.curso.findMany({
      where,
      include: {
        instituicao: { select: { id: true, nome: true } },
        _count: { select: { disciplinas: true, turmas: true } }
      },
      orderBy: { nome: 'asc' }
    });

    console.log(`[getCursos] Found ${cursos.length} cursos`);
    if (cursos.length > 0) {
      console.log('[getCursos] Cursos IDs:', cursos.map(c => c.id).join(', '));
    } else {
      console.warn('[getCursos] ⚠️  NENHUM CURSO RETORNADO!');
      console.warn('[getCursos] Verificando se há cursos na instituição...');
      
      // Debug: verificar se há cursos sem filtro de tipo
      const todosCursos = await prisma.curso.findMany({
        where: filter,
        select: { id: true, nome: true, tipo: true, instituicaoId: true }
      });
      console.log(`[getCursos] Total de cursos na instituição (sem filtro de tipo): ${todosCursos.length}`);
      if (todosCursos.length > 0) {
        console.log('[getCursos] Cursos encontrados:', todosCursos.map(c => ({ id: c.id, nome: c.nome, tipo: c.tipo })));
      }
    }

    res.json(cursos);
  } catch (error: any) {
    console.error('[getCursos] ❌ Erro ao buscar cursos:', error);
    console.error('[getCursos] Stack:', error.stack);
    next(error);
  }
};

export const getCursoById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const curso = await prisma.curso.findFirst({
      where: { id, ...filter },
      include: {
        instituicao: true,
        disciplinas: true, // LEGACY: manter para compatibilidade
        cursoDisciplinas: {
          include: {
            disciplina: {
              select: {
                id: true,
                nome: true,
                codigo: true,
                cargaHoraria: true,
                descricao: true,
                ativa: true,
              },
            },
          },
          orderBy: {
            disciplina: {
              nome: 'asc',
            },
          },
        },
        turmas: true
      }
    });

    if (!curso) {
      throw new AppError('Curso não encontrado', 404);
    }

    res.json(curso);
  } catch (error) {
    next(error);
  }
};

export const createCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado, nunca do body
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    const { nome, codigo, cargaHoraria, valorMensalidade, descricao, duracao, grau, tipo } = req.body;

    // Validar campos obrigatórios
    if (!nome || !codigo) {
      throw new AppError('Nome e código são obrigatórios', 400);
    }

    // Validar carga horária obrigatória e > 0
    if (!cargaHoraria || Number(cargaHoraria) <= 0) {
      throw new AppError('Carga horária é obrigatória e deve ser maior que zero', 400);
    }

    // VALIDAÇÃO DE LIMITES: Verificar se pode criar mais cursos
    try {
      await validatePlanLimits(req, 'cursos');
    } catch (limitError) {
      return next(limitError);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO)
    // No Ensino Secundário: Curso SEM mensalidade (mensalidade está na Classe)
    // No Ensino Superior: Curso COM mensalidade
    
    // VALIDAÇÃO: Ensino Superior não pode criar cursos do tipo "classe"
    if (tipoAcademico === 'SUPERIOR' && tipo === 'classe') {
      throw new AppError('Cursos não podem ser do tipo "classe". Use o endpoint de Classes para Ensino Secundário.', 400);
    }

    // Check unique codigo within institution
    const existing = await prisma.curso.findFirst({
      where: { 
        codigo: codigo.trim(), 
        instituicaoId: req.user.instituicaoId 
      }
    });

    if (existing) {
      throw new AppError('Código do curso já existe nesta instituição', 400);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const cursoData: any = {
      nome: nome.trim(),
      codigo: codigo.trim(),
      instituicaoId: req.user.instituicaoId,
      ativo: true,
      cargaHoraria: Number(cargaHoraria), // Já validado acima como obrigatório e > 0
    };

    // CRITICAL: Regras de mensalidade por tipo acadêmico
    // Ensino Secundário: Curso SEM mensalidade (mensalidade está na Classe)
    // Ensino Superior: Curso COM mensalidade (obrigatória)
    if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: Curso sempre com mensalidade = 0
      cursoData.valorMensalidade = 0;
    } else if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: Curso DEVE ter mensalidade > 0
      if (!valorMensalidade || Number(valorMensalidade) <= 0) {
        throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero para Ensino Superior', 400);
      }
      cursoData.valorMensalidade = Number(valorMensalidade);
    } else {
      // Tipo não identificado: usar valor fornecido ou 0
      cursoData.valorMensalidade = valorMensalidade ? Number(valorMensalidade) : 0;
    }

    // Adicionar campos opcionais apenas se definidos e não vazios
    // Descrição: opcional para ambos os tipos
    if (descricao !== undefined) {
      cursoData.descricao = (descricao && typeof descricao === 'string' && descricao.trim() !== '') ? descricao.trim() : null;
    }
    
    // Duração: apenas para Ensino Superior
    // Para Ensino Secundário, não usar duracao (não se aplica)
    if (tipoAcademico === 'SUPERIOR') {
      if (duracao !== undefined) {
        cursoData.duracao = (duracao && typeof duracao === 'string' && duracao.trim() !== '') ? duracao.trim() : null;
      }
    } else {
      // Ensino Secundário: sempre null (não se aplica)
      cursoData.duracao = null;
    }
    
    // Grau apenas para Ensino Superior
    if (tipoAcademico === 'SUPERIOR') {
      if (grau !== undefined) {
        cursoData.grau = (grau && typeof grau === 'string' && grau.trim() !== '') ? grau.trim() : null;
      }
    } else {
      // Ensino Secundário: sempre null (não se aplica)
      cursoData.grau = null;
    }
    
    // Tipo: opcional para ambos, mas Ensino Superior não pode ser "classe"
    if (tipo !== undefined) {
      if (tipo && typeof tipo === 'string' && tipo.trim() !== '') {
        cursoData.tipo = tipo.trim();
      } else {
        cursoData.tipo = null;
      }
    }

    const curso = await prisma.curso.create({
      data: cursoData
    });

    res.status(201).json(curso);
  } catch (error) {
    next(error);
  }
};

export const updateCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.curso.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Curso não encontrado', 404);
    }

    const { nome, codigo, cargaHoraria, valorMensalidade, descricao, duracao, grau, tipo, ativo } = req.body;

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO)
    // No Ensino Secundário: Curso SEM mensalidade (mensalidade está na Classe)
    // No Ensino Superior: Curso COM mensalidade
    
    // VALIDAÇÃO: Ensino Superior não pode ter cursos do tipo "classe"
    if (tipoAcademico === 'SUPERIOR' && tipo !== undefined && tipo === 'classe') {
      throw new AppError('Cursos não podem ser do tipo "classe". Use o endpoint de Classes para Ensino Secundário.', 400);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const updateData: any = {};

    if (nome !== undefined) updateData.nome = nome.trim();
    if (codigo !== undefined && codigo.trim() !== existing.codigo) {
      // Check unique codigo if changing
      const codigoExists = await prisma.curso.findFirst({
        where: { 
          codigo: codigo.trim(), 
          instituicaoId: existing.instituicaoId,
          id: { not: id }
        }
      });
      if (codigoExists) {
        throw new AppError('Código do curso já existe nesta instituição', 400);
      }
      updateData.codigo = codigo.trim();
    }
    if (cargaHoraria !== undefined) {
      if (Number(cargaHoraria) <= 0) {
        throw new AppError('Carga horária deve ser maior que zero', 400);
      }
      updateData.cargaHoraria = Number(cargaHoraria);
    }
    
    // CRITICAL: Regras de mensalidade por tipo acadêmico
    if (valorMensalidade !== undefined) {
      if (tipoAcademico === 'SECUNDARIO') {
        // Ensino Secundário: Curso SEM mensalidade (sempre 0)
        updateData.valorMensalidade = 0;
      } else if (tipoAcademico === 'SUPERIOR') {
        // Ensino Superior: Curso DEVE ter mensalidade > 0
        if (!valorMensalidade || Number(valorMensalidade) <= 0) {
          throw new AppError('Valor da mensalidade é obrigatório e deve ser maior que zero para Ensino Superior', 400);
        }
        updateData.valorMensalidade = Number(valorMensalidade);
      } else {
        // Tipo não identificado: usar valor fornecido ou 0
        updateData.valorMensalidade = Number(valorMensalidade) >= 0 ? Number(valorMensalidade) : 0;
      }
    }
    // Descrição: opcional para ambos os tipos
    if (descricao !== undefined) {
      updateData.descricao = (descricao && typeof descricao === 'string' && descricao.trim() !== '') ? descricao.trim() : null;
    }
    
    // Duração: apenas para Ensino Superior
    if (duracao !== undefined) {
      if (tipoAcademico === 'SUPERIOR') {
        updateData.duracao = (duracao && typeof duracao === 'string' && duracao.trim() !== '') ? duracao.trim() : null;
      } else if (tipoAcademico === 'SECUNDARIO') {
        // Ensino Secundário: sempre null (não se aplica)
        updateData.duracao = null;
      } else {
        // Tipo não identificado: usar valor fornecido ou null
        updateData.duracao = (duracao && typeof duracao === 'string' && duracao.trim() !== '') ? duracao.trim() : null;
      }
    }
    
    // Grau apenas para Ensino Superior
    if (grau !== undefined) {
      if (tipoAcademico === 'SUPERIOR') {
        updateData.grau = (grau && typeof grau === 'string' && grau.trim() !== '') ? grau.trim() : null;
      } else if (tipoAcademico === 'SECUNDARIO') {
        // Ensino Secundário: sempre null (não se aplica)
        updateData.grau = null;
      } else {
        // Tipo não identificado: usar valor fornecido ou null
        updateData.grau = (grau && typeof grau === 'string' && grau.trim() !== '') ? grau.trim() : null;
      }
    }
    
    // Tipo: opcional para ambos, mas Ensino Superior não pode ser "classe"
    if (tipo !== undefined) {
      if (tipo && typeof tipo === 'string' && tipo.trim() !== '') {
        updateData.tipo = tipo.trim();
      } else {
        updateData.tipo = null;
      }
    }
    
    if (ativo !== undefined) updateData.ativo = Boolean(ativo);

    // NUNCA permitir alterar instituicaoId (multi-tenant)
    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido alterar a instituição do curso', 400);
    }

    const curso = await prisma.curso.update({
      where: { id },
      data: updateData
    });

    res.json(curso);
  } catch (error) {
    next(error);
  }
};

export const deleteCurso = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.curso.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Curso não encontrado', 404);
    }

    // Check if has dependencies
    const disciplinasCount = await prisma.disciplina.count({
      where: { cursoId: id }
    });

    if (disciplinasCount > 0) {
      throw new AppError('Não é possível excluir curso com disciplinas vinculadas', 400);
    }

    await prisma.curso.delete({ where: { id } });

    res.json({ message: 'Curso excluído com sucesso' });
  } catch (error) {
    next(error);
  }
};
