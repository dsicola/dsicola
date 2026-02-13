import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

export const getDisciplinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validar que usuário tem instituição (exceto SUPER_ADMIN)
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // SUPER_ADMIN pode não ter instituicaoId, mas outros devem ter
    if (!req.user.roles?.includes('SUPER_ADMIN') && !req.user.instituicaoId) {
      throw new AppError('Usuário sem instituição associada. Entre em contato com o administrador.', 403);
    }

    const filter = addInstitutionFilter(req);
    const { cursoId, classeId } = req.query;

    // Debug log
    console.log('[getDisciplinas] Request:', {
      userInstituicaoId: req.user?.instituicaoId,
      filter,
      cursoId,
      classeId,
    });

    // Se o filtro retornar { instituicaoId: null }, isso pode causar problemas no Prisma
    // Garantir que o filtro seja válido
    const where: any = {};
    
    // Aplicar filtro de instituição apenas se válido
    if (filter && filter.instituicaoId !== undefined && filter.instituicaoId !== null) {
      where.instituicaoId = filter.instituicaoId;
    } else if (req.user?.instituicaoId) {
      // Se usuário tem instituicaoId, usar diretamente
      where.instituicaoId = req.user.instituicaoId;
    } else if (!req.user.roles?.includes('SUPER_ADMIN')) {
      // Se não é SUPER_ADMIN e não tem instituicaoId válido, não retornar nada
      console.warn('[getDisciplinas] Usuário sem instituicaoId válido - retornando array vazio');
      return res.json([]);
    }
    
    // Se for SUPER_ADMIN sem instituicaoId, permitir ver todas (where vazio ou com filtro de query)
    // Mas ainda aplicar filtros de tipo acadêmico se houver

    // Get institution's tipoAcademico to filter disciplines
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // NOVO MODELO: Se cursoId fornecido, usar CursoDisciplina para buscar disciplinas
    // Isso permite que disciplinas institucionais sejam encontradas mesmo sem cursoId direto
    let disciplinaIdsFromCurso: string[] | null = null;
    if (cursoId) {
      const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
        where: { cursoId: cursoId as string },
        select: { disciplinaId: true },
      });
      disciplinaIdsFromCurso = cursoDisciplinas.map(cd => cd.disciplinaId);
      
      // NOVO MODELO: Não usar mais cursoId legacy - apenas CursoDisciplina
      // Se não encontrou disciplinas via CursoDisciplina, retornar array vazio
      
      // Se encontrou disciplinas, filtrar por elas
      if (disciplinaIdsFromCurso.length > 0) {
        where.id = { in: disciplinaIdsFromCurso };
      } else {
        // Se não encontrou nenhuma, retornar vazio
        return res.json([]);
      }
    }
    
    // DISCIPLINA é ESTRUTURAL: não possui classeId
    // Classe pertence ao PlanoEnsino, não à Disciplina
    // Se classeId fornecido na query, ignorar (não é mais suportado no modelo de Disciplina)

    console.log('[getDisciplinas] Where clause:', JSON.stringify(where, null, 2));
    console.log('[getDisciplinas] Tipo acadêmico:', tipoAcademico);
    console.log('[getDisciplinas] Instituição ID:', req.user?.instituicaoId);

    // Validar que o where clause tem pelo menos instituicaoId (exceto para SUPER_ADMIN)
    // Mas permitir continuar se já filtramos por disciplinaIds via CursoDisciplina
    if (!where.instituicaoId && !where.id && !req.user.roles?.includes('SUPER_ADMIN')) {
      // Tentar usar instituicaoId do usuário se disponível
      if (req.user?.instituicaoId) {
        where.instituicaoId = req.user.instituicaoId;
      } else {
        console.warn('[getDisciplinas] Where clause sem instituicaoId para usuário não-SUPER_ADMIN - retornando array vazio');
        return res.json([]);
      }
    }
    
    // Se where está completamente vazio (SUPER_ADMIN sem filtros), retornar vazio por segurança
    // Mas só se não há instituicaoId definido
    if (Object.keys(where).length === 0 && !req.user?.instituicaoId && !req.user.roles?.includes('SUPER_ADMIN')) {
      console.warn('[getDisciplinas] Where clause completamente vazio - retornando array vazio por segurança');
      return res.json([]);
    }

    try {
    // Validar e limpar where clause antes de executar query
    // Remover campos undefined/null que podem causar problemas no Prisma
    const cleanWhere: any = {};
    for (const [key, value] of Object.entries(where)) {
      // Pular valores undefined
      if (value === undefined) {
        continue;
      }
      
      // Tratar null explicitamente
      if (value === null) {
        cleanWhere[key] = null;
        continue;
      }
      
      // Se for objeto, verificar se não está vazio
      if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        // Se for objeto vazio, pular
        if (Object.keys(value).length === 0) {
          continue;
        }
        // Se for objeto com propriedades, incluir
        cleanWhere[key] = value;
        continue;
      }
      
      // Para outros tipos (string, number, boolean, array, Date), incluir
      cleanWhere[key] = value;
    }
    
    console.log('[getDisciplinas] Clean where clause:', JSON.stringify(cleanWhere, null, 2));
    
    // Garantir que há pelo menos instituicaoId no where (exceto SUPER_ADMIN)
    // Mas permitir continuar se já filtramos por disciplinaIds via CursoDisciplina
    if (!cleanWhere.instituicaoId && !cleanWhere.id && !req.user.roles?.includes('SUPER_ADMIN')) {
      // Tentar usar instituicaoId do usuário se disponível
      if (req.user?.instituicaoId) {
        cleanWhere.instituicaoId = req.user.instituicaoId;
      } else {
        console.warn('[getDisciplinas] Clean where sem instituicaoId - retornando array vazio');
        return res.json([]);
      }
    }
    
    const disciplinas = await prisma.disciplina.findMany({
      where: cleanWhere,
        include: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          cursoDisciplinas: {
            include: {
              curso: {
                select: { id: true, nome: true, codigo: true }
              }
            }
          }
        },
        orderBy: { nome: 'asc' }
      });

      console.log(`[getDisciplinas] Found ${disciplinas.length} disciplinas`);
      if (disciplinas.length > 0) {
        console.log('[getDisciplinas] Disciplinas IDs:', disciplinas.map(d => d.id).join(', '));
      } else {
        console.warn('[getDisciplinas] ⚠️  NENHUMA DISCIPLINA RETORNADA!');
      }

      // Debug: verificar se há disciplinas sem filtro de tipo acadêmico
      if (disciplinas.length === 0 && tipoAcademico) {
        console.warn('[getDisciplinas] ⚠️ Nenhuma disciplina encontrada com filtro de tipo acadêmico. Verificando todas as disciplinas da instituição...');
        const todasDisciplinas = await prisma.disciplina.findMany({
          where: { instituicaoId: req.user?.instituicaoId ?? undefined },
          select: {
            id: true,
            nome: true,
            // REMOVIDO: cursoId (legacy) - Disciplina não possui cursoId direto
          },
          take: 5, // Apenas as primeiras 5 para debug
        });
        console.log('[getDisciplinas] Disciplinas encontradas sem filtro de tipo:', todasDisciplinas);
      }

      res.json(disciplinas);
    } catch (prismaError: any) {
      console.error('[getDisciplinas] Erro no Prisma:', {
        error: prismaError.message,
        code: prismaError.code,
        where,
        userInstituicaoId: req.user?.instituicaoId,
      });
      // Re-throw para o errorHandler processar
      throw prismaError;
    }
  } catch (error) {
    next(error);
  }
};

export const getDisciplinaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const disciplina = await prisma.disciplina.findFirst({
      where: { id, ...filter },
      include: {
        // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
        cursoDisciplinas: {
          include: {
            curso: {
              select: { id: true, nome: true, codigo: true }
            }
          }
        }
      }
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    res.json(disciplina);
  } catch (error) {
    next(error);
  }
};

export const createDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado
    if (!req.user?.instituicaoId) {
      throw new AppError('Usuário não possui instituição vinculada', 400);
    }

    // NUNCA permitir instituicaoId do body (segurança multi-tenant)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido definir instituição. Use o token de autenticação.', 400);
    }

    // VALIDAÇÃO CRÍTICA SIGA/SIGAE: Disciplina é ESTRUTURAL - NÃO aceitar semestre nem classe
    // semestre pertence ao PlanoEnsino (ENSINO_SUPERIOR)
    // classe pertence ao PlanoEnsino (ENSINO_SECUNDARIO)
    if (req.body.semestre !== undefined || req.body.semestre_id !== undefined) {
      throw new AppError('Campo "semestre" não pertence à Disciplina. Disciplina é estrutural e pode ser reutilizada em vários contextos. O semestre deve ser definido no Plano de Ensino.', 400);
    }
    if (req.body.classe !== undefined || req.body.classe_id !== undefined || req.body.classeId !== undefined || req.body.classeOuAno !== undefined) {
      throw new AppError('Campo "classe" não pertence à Disciplina. Disciplina é estrutural e pode ser reutilizada em vários contextos. A classe deve ser definida no Plano de Ensino.', 400);
    }

    const { nome, codigo, descricao, cargaHoraria, cargaHorariaBase, obrigatoria, tipoDisciplina, trimestresOferecidos } = req.body;
    
    // NOVO MODELO: cursoId não é mais aceito diretamente na Disciplina
    // O vínculo com curso deve ser feito via CursoDisciplina após a criação
    if (req.body.cursoId !== undefined || req.body.curso_id !== undefined) {
      throw new AppError('Campo "cursoId" não pertence à Disciplina. Disciplina é estrutural e independente. O vínculo com curso deve ser feito via Matriz Curricular (CursoDisciplina) após a criação da disciplina.', 400);
    }

    // Validar campos obrigatórios
    if (!nome) {
      throw new AppError('Nome é obrigatório', 400);
    }

    // Validar carga horária obrigatória e > 0
    if (!cargaHoraria || Number(cargaHoraria) <= 0) {
      throw new AppError('Carga horária é obrigatória e deve ser maior que zero', 400);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // NOVO MODELO: Disciplina é institucional e independente
    // O vínculo com curso deve ser feito via CursoDisciplina após a criação

    // Gerar código se não fornecido
    let finalCodigo = codigo?.trim();
    if (!finalCodigo) {
      // Gerar código automático baseado no nome
      const nomeNormalizado = nome.trim().toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .substring(0, 10);
      const timestamp = Date.now().toString().slice(-4);
      finalCodigo = `${nomeNormalizado}-${timestamp}`;
    }

    // Verificar se código já existe na instituição
    const codigoExistente = await prisma.disciplina.findFirst({
      where: {
        codigo: finalCodigo,
        instituicaoId: req.user.instituicaoId,
      },
      select: {
        id: true,
        codigo: true,
        instituicaoId: true,
      },
    });

    if (codigoExistente) {
      throw new AppError('Código da disciplina já existe nesta instituição', 400);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const disciplinaData: any = {
      nome: nome.trim(),
      codigo: finalCodigo,
      instituicaoId: req.user.instituicaoId,
      cargaHoraria: Number(cargaHoraria), // Já validado acima como obrigatório e > 0
      obrigatoria: obrigatoria !== undefined ? Boolean(obrigatoria) : true,
      ativa: true, // NOVO: disciplina criada como ativa
    };

    // Adicionar descrição se fornecida
    if (descricao !== undefined) {
      disciplinaData.descricao = descricao && typeof descricao === 'string' && descricao.trim() !== '' ? descricao.trim() : null;
    }

    // Adicionar cargaHorariaBase se fornecida
    if (cargaHorariaBase !== undefined) {
      disciplinaData.cargaHorariaBase = cargaHorariaBase ? Number(cargaHorariaBase) : null;
    }

    // REMOVIDO: cursoId legacy - Disciplina é estrutural e independente
    // O vínculo com curso deve ser feito APENAS via CursoDisciplina (Matriz Curricular)
    // DISCIPLINA é ESTRUTURAL: semestre e classe pertencem ao PlanoEnsino, não à Disciplina

    // Adicionar campos opcionais apenas se definidos e válidos
    if (tipoDisciplina !== undefined) {
      disciplinaData.tipoDisciplina = (tipoDisciplina && typeof tipoDisciplina === 'string' && tipoDisciplina.trim() !== '') ? tipoDisciplina.trim() : null;
    }
    if (trimestresOferecidos !== undefined) {
      disciplinaData.trimestresOferecidos = Array.isArray(trimestresOferecidos) && trimestresOferecidos.length > 0 ? trimestresOferecidos : [];
    }

    const disciplina = await prisma.disciplina.create({
      data: disciplinaData,
      include: {
        // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
        // classe removido: Disciplina é estrutural, não possui classe
        cursoDisciplinas: {
          include: {
            curso: {
              select: { id: true, nome: true, codigo: true }
            }
          }
        }
      }
    });

    // REMOVIDO: Lógica legacy de criar CursoDisciplina automaticamente
    // O vínculo com curso deve ser feito APENAS via Matriz Curricular (endpoint específico)
    // Isso garante que o semestre seja definido corretamente no PlanoEnsino

    res.status(201).json(disciplina);
  } catch (error) {
    next(error);
  }
};

export const updateDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // VALIDAÇÃO CRÍTICA SIGA/SIGAE: Disciplina é ESTRUTURAL - NÃO aceitar semestre nem classe
    // semestre pertence ao PlanoEnsino (ENSINO_SUPERIOR)
    // classe pertence ao PlanoEnsino (ENSINO_SECUNDARIO)
    if (req.body.semestre !== undefined || req.body.semestre_id !== undefined) {
      throw new AppError('Campo "semestre" não pertence à Disciplina. Disciplina é estrutural e pode ser reutilizada em vários contextos. O semestre deve ser definido no Plano de Ensino.', 400);
    }
    if (req.body.classe !== undefined || req.body.classe_id !== undefined || req.body.classeId !== undefined || req.body.classeOuAno !== undefined) {
      throw new AppError('Campo "classe" não pertence à Disciplina. Disciplina é estrutural e pode ser reutilizada em vários contextos. A classe deve ser definida no Plano de Ensino.', 400);
    }
    
    const { nome, cursoId, cargaHoraria, obrigatoria, tipoDisciplina, trimestresOferecidos } = req.body;

    const existing = await prisma.disciplina.findFirst({
      where: { id, ...filter },
      include: {
        // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
        cursoDisciplinas: {
          include: {
            curso: {
              select: { id: true, nome: true, codigo: true }
            }
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    const updateData: any = {};

    if (nome !== undefined) updateData.nome = nome.trim();
    if (cargaHoraria !== undefined) {
      if (Number(cargaHoraria) <= 0) {
        throw new AppError('Carga horária deve ser maior que zero', 400);
      }
      updateData.cargaHoraria = Number(cargaHoraria);
    }
    
    // DISCIPLINA é ESTRUTURAL: semestre e classe pertencem ao PlanoEnsino, não à Disciplina
    // Não aceitar semestre ou classeId no update
    
    if (obrigatoria !== undefined) updateData.obrigatoria = Boolean(obrigatoria);
    if (tipoDisciplina !== undefined) {
      updateData.tipoDisciplina = (tipoDisciplina && typeof tipoDisciplina === 'string' && tipoDisciplina.trim() !== '') ? tipoDisciplina.trim() : null;
    }
    if (trimestresOferecidos !== undefined) {
      updateData.trimestresOferecidos = Array.isArray(trimestresOferecidos) && trimestresOferecidos.length > 0 ? trimestresOferecidos : [];
    }

    // NOVO MODELO: cursoId não pode ser atualizado diretamente na Disciplina
    // Disciplina é estrutural e independente - vínculos com cursos são feitos via CursoDisciplina
    // NOTA: classeId foi removido - classe pertence ao PlanoEnsino, não à Disciplina
    if (req.body.cursoId !== undefined || req.body.curso_id !== undefined) {
      throw new AppError('Campo "cursoId" não pertence à Disciplina. Disciplina é estrutural e independente. O vínculo com curso deve ser feito via Matriz Curricular (CursoDisciplina).', 400);
    }

    // NUNCA permitir alterar instituicaoId (multi-tenant)
    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido alterar a instituição da disciplina', 400);
    }

    const disciplina = await prisma.disciplina.update({
      where: { id },
      data: updateData,
      include: {
        // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
        cursoDisciplinas: {
          include: {
            curso: {
              select: { id: true, nome: true, codigo: true }
            }
          }
        }
      }
    });
    
    // REMOVIDO: Lógica legacy de atualizar CursoDisciplina automaticamente
    // O vínculo com curso deve ser feito APENAS via Matriz Curricular (endpoint específico)
    // Isso garante que o semestre seja definido corretamente no PlanoEnsino

    res.json(disciplina);
  } catch (error) {
    next(error);
  }
};

export const deleteDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.disciplina.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    // Check if has dependencies (turmas)
    const turmasCount = await prisma.turma.count({
      where: { disciplinaId: id }
    });

    if (turmasCount > 0) {
      throw new AppError('Não é possível excluir disciplina com turmas vinculadas', 400);
    }

    // Check if has alunoDisciplinas
    const alunoDisciplinasCount = await prisma.alunoDisciplina.count({
      where: { disciplinaId: id }
    });

    if (alunoDisciplinasCount > 0) {
      throw new AppError('Não é possível excluir disciplina com alunos vinculados', 400);
    }

    await prisma.disciplina.delete({ where: { id } });

    res.json({ message: 'Disciplina excluída com sucesso' });
  } catch (error) {
    next(error);
  }
};
