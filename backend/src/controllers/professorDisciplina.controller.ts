import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { resolveProfessorId, validateProfessorId } from '../utils/professorResolver.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId, disciplinaId, ano, semestre, instituicaoId } = req.query;
    const filter = addInstitutionFilter(req);
    
    // Build where clause with institution filter
    const where: any = {
      ...filter, // Apply institution filter first (most important for security)
      // Only return turmas that have both professorId and disciplinaId (actual assignments)
      professorId: { not: null },
      disciplinaId: { not: null },
    };
    
    // Add optional filters (these will override the defaults above)
    if (professorId) {
      where.professorId = professorId as string;
    }
    
    if (disciplinaId) {
      where.disciplinaId = disciplinaId as string;
    }
    
    if (ano) {
      where.ano = parseInt(ano as string);
    }
    
    if (semestre) {
      where.semestre = semestre as string;
    }
    
    // For SUPER_ADMIN, allow filtering by instituicaoId from query if provided
    if (instituicaoId && req.user?.roles?.includes('SUPER_ADMIN')) {
      where.instituicaoId = instituicaoId as string;
    }
    
    // REGRA: Atribuições são Planos de Ensino, não Turmas
    const wherePlano: any = {
      ...filter,
      professorId: { not: null },
      disciplinaId: { not: null },
    };
    
    if (professorId) {
      wherePlano.professorId = professorId as string;
    }
    
    if (disciplinaId) {
      wherePlano.disciplinaId = disciplinaId as string;
    }
    
    if (ano) {
      wherePlano.anoLetivo = parseInt(ano as string);
    }
    
    if (semestre) {
      wherePlano.semestre = parseInt(semestre as string);
    }
    
    const planosEnsino = await prisma.planoEnsino.findMany({
      where: wherePlano,
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          } as any,
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { semestre: 'asc' },
      ],
    });
    
    // Transform to match frontend expected format
    const atribuicoes = planosEnsino
      .map((plano: any) => ({
        id: plano.id,
        ano: plano.anoLetivo,
        semestre: plano.semestre,
        classeOuAno: plano.classeOuAno,
        professor: plano.professor ? {
          id: plano.professor.id,
          nome_completo: plano.professor.user?.nomeCompleto || 'N/A',
        } : null,
        disciplina: plano.disciplina ? {
          id: plano.disciplina.id,
          nome: plano.disciplina.nome,
          // REMOVIDO: curso (legacy) - usar plano.curso diretamente
          curso: plano.curso ? {
            nome: plano.curso.nome,
          } : null,
        } : null,
      }))
      .filter((a) => a.professor && a.disciplina);
    
    res.json(atribuicoes);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // REGRA: Atribuições são Planos de Ensino, não Turmas
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: { id, ...filter },
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          } as any,
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });
    
    if (!planoEnsino) {
      throw new AppError('Atribuição (Plano de Ensino) não encontrada', 404);
    }
    
    // Transform to match frontend expected format
    const planoEnsinoAny = planoEnsino as any;
    const atribuicao = {
      id: planoEnsinoAny.id,
      ano: planoEnsinoAny.anoLetivo,
      semestre: planoEnsinoAny.semestre,
      classeOuAno: planoEnsinoAny.classeOuAno,
        professor: planoEnsinoAny.professor ? {
          id: planoEnsinoAny.professor.id,
          nome_completo: planoEnsinoAny.professor.user?.nomeCompleto || 'N/A',
        } : null,
      disciplina: planoEnsinoAny.disciplina ? {
        id: planoEnsinoAny.disciplina.id,
        nome: planoEnsinoAny.disciplina.nome,
        // REMOVIDO: curso (legacy) - usar planoEnsino.curso diretamente
        curso: planoEnsinoAny.curso ? {
          nome: planoEnsinoAny.curso.nome,
        } : null,
      } : null,
    };
    
    res.json(atribuicao);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /professor-disciplinas/me
 * Professor logado obtém suas próprias atribuições (planos de ensino).
 * Usa req.professor.id do middleware resolveProfessor - NUNCA users.id.
 */
export const getMyDisciplinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.professor?.id) {
      throw new AppError('Professor não identificado. O middleware resolveProfessor deve ser aplicado nesta rota.', 500);
    }
    const professorId = req.professor.id; // professores.id (NÃO users.id)
    const filter = addInstitutionFilter(req);
    
    const planosEnsino = await prisma.planoEnsino.findMany({
      where: {
        ...filter,
        professorId,
      },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          } as any,
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { semestre: 'asc' },
      ],
    });
    
    const atribuicoes = planosEnsino
      .filter((plano: any) => plano.disciplina && plano.professor)
      .map((plano: any) => ({
        id: plano.id,
        ano: plano.anoLetivo,
        semestre: plano.semestre,
        classeOuAno: plano.classeOuAno,
        professor: plano.professor ? {
          id: plano.professor.id,
          nome_completo: plano.professor.user?.nomeCompleto || 'N/A',
        } : null,
        disciplina: plano.disciplina ? {
          id: plano.disciplina.id,
          nome: plano.disciplina.nome,
          curso: plano.curso ? { nome: plano.curso.nome } : null,
        } : null,
      }))
      .filter((a) => a.professor && a.disciplina);
    
    res.json(atribuicoes);
  } catch (error) {
    next(error);
  }
};

export const getByProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // REGRA SIGA/SIGAE (OPÇÃO B): professorId DEVE ser professores.id (NUNCA users.id)
    const { professorId } = req.params;
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    const professorIdNormalizado = String(professorId || '').trim();
    const isValidProfessorId = await validateProfessorId(professorIdNormalizado, instituicaoId);
    if (!isValidProfessorId) {
      throw new AppError(
        'Professor não encontrado ou não pertence à sua instituição. Use professores.id (GET /professores).',
        404
      );
    }
    const professorIdFinal = professorIdNormalizado;

    const planosEnsino = await prisma.planoEnsino.findMany({
      where: {
        ...filter,
        professorId: professorIdFinal,
        disciplinaId: { not: null } as any,
      },
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          } as any,
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { semestre: 'asc' },
      ],
    });
    
    // Transform to match frontend expected format
    const atribuicoes = planosEnsino
      .filter((plano: any) => plano.disciplina && plano.professor)
      .map((plano: any) => ({
        id: plano.id,
        ano: plano.anoLetivo,
        semestre: plano.semestre,
        classeOuAno: plano.classeOuAno,
        professor: plano.professor ? {
          id: plano.professor.id,
          nome_completo: plano.professor.user?.nomeCompleto || 'N/A',
        } : null,
        disciplina: plano.disciplina ? {
          id: plano.disciplina.id,
          nome: plano.disciplina.nome,
          // REMOVIDO: curso (legacy) - usar plano.curso diretamente
          curso: plano.curso ? {
            nome: plano.curso.nome,
          } : null,
        } : null,
      }))
      .filter((a) => a.professor && a.disciplina);
    
    res.json(atribuicoes);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId, disciplinaId, ano, semestre, cursoId, classeId, classeOuAno } = req.body;
    
    // Get instituicaoId from authenticated user (security: never trust frontend)
    if (!req.user) {
      throw new AppError('Usuário não autenticado', 401);
    }
    
    const isSuperAdmin = req.user.roles?.includes('SUPER_ADMIN') || false;
    let finalInstituicaoId = req.user.instituicaoId;
    
    // VALIDAÇÃO MULTI-TENANT: Para roles não-SUPER_ADMIN, rejeitar instituicaoId do body
    if (!isSuperAdmin && (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined)) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }
    
    // For SUPER_ADMIN, allow instituicaoId from body if provided (only exception)
    if (isSuperAdmin && req.body.instituicaoId) {
      finalInstituicaoId = req.body.instituicaoId;
    }
    
    if (!finalInstituicaoId) {
      throw new AppError('Instituição não identificada', 400);
    }
    
    // Validate required fields
    if (!professorId || !disciplinaId) {
      throw new AppError('Professor e disciplina são obrigatórios', 400);
    }
    
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): professorId DEVE ser professores.id
    // PROIBIDO: Aceitar users.id - frontend DEVE enviar professores.id
    // NÃO há lógica híbrida ou legacy - apenas professores.id é aceito
    const professorIdNormalizado = String(professorId).trim();
    
    // Validar que professorId é um professores.id válido
    const isValidProfessorId = await validateProfessorId(professorIdNormalizado, finalInstituicaoId);
    
    if (!isValidProfessorId) {
      throw new AppError(
        'Professor não encontrado ou não pertence à sua instituição. O professorId deve ser um ID válido da tabela professores (não users.id). Verifique se o professor está cadastrado corretamente.',
        404
      );
    }
    
    const professorIdFinal = professorIdNormalizado;
    
    // Verificar tipo acadêmico da instituição para validação condicional
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // REGRA POR TIPO DE INSTITUIÇÃO:
    // ENSINO SUPERIOR: Curso obrigatório, Semestre obrigatório
    // ENSINO SECUNDÁRIO: Classe obrigatória, Curso opcional, Sem semestre
    
    // REMOVIDO: Buscar cursoId via disciplina.cursoId (legacy)
    // NOVO MODELO: Buscar cursoId APENAS via CursoDisciplina
    let finalCursoId = cursoId;
    if (!finalCursoId && disciplinaId) {
      // Verificar se disciplina existe e pertence à instituição
      const disciplina = await prisma.disciplina.findUnique({
        where: { id: disciplinaId },
        select: { instituicaoId: true },
      });
      
      if (!disciplina) {
        throw new AppError('Disciplina não encontrada', 404);
      }
      
      // Verify disciplina belongs to the same institution (unless super admin)
      if (!isSuperAdmin && disciplina.instituicaoId !== finalInstituicaoId) {
        throw new AppError('Disciplina não pertence à sua instituição', 403);
      }
      
      // NOVO MODELO: Buscar cursoId via CursoDisciplina (única forma válida)
      // Se disciplinaId foi fornecido, buscar o primeiro curso vinculado via CursoDisciplina
      // IMPORTANTE: Apenas para Ensino Superior (curso é obrigatório)
      if (tipoAcademico === 'SUPERIOR' && disciplinaId && !finalCursoId) {
        const cursoDisciplina = await prisma.cursoDisciplina.findFirst({
          where: { disciplinaId },
          select: { cursoId: true },
        });
        if (cursoDisciplina) {
          finalCursoId = cursoDisciplina.cursoId;
        }
      }
    }
    
    // REGRA POR TIPO DE INSTITUIÇÃO: Validar curso conforme tipo acadêmico
    if (tipoAcademico === 'SUPERIOR') {
      // ENSINO SUPERIOR: Curso é OBRIGATÓRIO
      if (!finalCursoId || finalCursoId.trim() === '') {
        throw new AppError('Curso é obrigatório para Ensino Superior. Selecione um curso antes de continuar.', 400);
      }
    }
    // ENSINO SECUNDÁRIO: Curso é OPCIONAL (não validar aqui)
    
    // Validar semestre/trimestre conforme tipo de instituição
    let finalSemestre: string | null = null;
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: semestre é obrigatório
      if (!semestre) {
        throw new AppError('Semestre é obrigatório para Ensino Superior', 400);
      }
      finalSemestre = semestre;
    } else if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: semestre não é usado (usar trimestres/classe)
      finalSemestre = null;
    } else {
      // Backwards compatibility: aceitar semestre se fornecido
      finalSemestre = semestre || '1';
    }
    
    const finalAno = ano || new Date().getFullYear();
    
    // Ano Letivo é contexto, não dependência - não bloquear por falta de ano letivo ativo
    // Tentar buscar ano letivo ativo, mas não bloquear se não existir
    let anoLetivoId: string | null = null;
    try {
      const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
        where: {
          instituicaoId: finalInstituicaoId,
          status: 'ATIVO',
        },
      });
      if (anoLetivoAtivo) {
        anoLetivoId = anoLetivoAtivo.id;
      }
    } catch (error) {
      // Não bloquear - ano letivo é contexto
    }
    
    // REGRA: Atribuição de Disciplina deve criar um Plano de Ensino, não uma Turma diretamente
    // Verificar se já existe um Plano de Ensino para esta combinação
    if (!anoLetivoId) {
      throw new AppError('Ano Letivo é obrigatório para criar atribuição de disciplina. Selecione um Ano Letivo válido.', 400);
    }

    // Verificar se já existe um Plano de Ensino
    // CORREÇÃO CRÍTICA: Usar professorIdFinal (professores.id) ao invés de professorId do body
    const existingPlano = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId: finalInstituicaoId,
        disciplinaId,
        anoLetivoId,
        professorId: professorIdFinal, // CORREÇÃO: Usar professores.id validado
      },
    });

    if (existingPlano) {
      throw new AppError('Esta atribuição já existe para este período', 409);
    }

    // Criar Plano de Ensino (não Turma diretamente)
    // CORREÇÃO CRÍTICA: Usar professorIdFinal (professores.id) e garantir que instituicaoId sempre seja setado
    // REGRA POR TIPO DE INSTITUIÇÃO:
    // - ENSINO SUPERIOR: cursoId é obrigatório (já validado acima)
    // - ENSINO SECUNDÁRIO: cursoId é opcional (pode ser null)
    const planoEnsinoData: any = {
      cursoId: tipoAcademico === 'SUPERIOR' ? finalCursoId : (finalCursoId || null), // Ensino Superior exige curso, Secundário permite null
      disciplinaId,
      professorId: professorIdFinal, // CORREÇÃO CRÍTICA: Sempre usar professores.id (não users.id)
      anoLetivo: finalAno,
      anoLetivoId, // OBRIGATÓRIO
      instituicaoId: finalInstituicaoId, // CORREÇÃO CRÍTICA: Sempre setar do JWT (nunca null)
    };

    // Adicionar campos condicionais
    if (tipoAcademico === 'SUPERIOR') {
      if (!finalSemestre) {
        throw new AppError('Semestre é obrigatório para Ensino Superior. Selecione um semestre cadastrado antes de continuar.', 400);
      }
      
      // VALIDAÇÃO CRÍTICA: Verificar se semestre existe na tabela Semestres vinculado ao ano letivo
      if (anoLetivoId) {
        const semestreExiste = await prisma.semestre.findFirst({
          where: {
            anoLetivoId: anoLetivoId,
            numero: Number(finalSemestre),
            instituicaoId: finalInstituicaoId,
          },
        });
        
        if (!semestreExiste) {
          // Verificar se há semestres cadastrados para este ano letivo (para mensagem de erro mais útil)
          const semestresAnoLetivo = await prisma.semestre.findMany({
            where: {
              anoLetivoId: anoLetivoId,
              instituicaoId: finalInstituicaoId,
            },
            select: { numero: true },
          });
          
          if (semestresAnoLetivo.length === 0) {
            throw new AppError(`Semestre é obrigatório para Ensino Superior. Não há semestres configurados para o ano letivo selecionado. Acesse Configuração de Ensino → Semestres para criar um semestre antes de continuar.`, 400);
          } else {
            throw new AppError(`Semestre ${finalSemestre} não encontrado para o ano letivo selecionado. Semestres disponíveis: ${semestresAnoLetivo.map(s => s.numero).join(', ')}. Acesse Configuração de Ensino → Semestres para criar o semestre necessário.`, 400);
          }
        }
      }
      
      planoEnsinoData.semestre = Number(finalSemestre);
    } else if (tipoAcademico === 'SECUNDARIO') {
      // ENSINO SECUNDÁRIO - Regras SIGA/SIGAE:
      // - classeId obrigatório (vem do body)
      // - classeOuAno obrigatório (vem do body)
      // DISCIPLINA é ESTRUTURAL: não possui classeId
      
      if (!classeOuAno || classeOuAno.trim() === '') {
        throw new AppError('Classe/Ano é obrigatório para Ensino Secundário (ex: "10ª Classe", "1º Ano"). Informe o campo Classe/Ano antes de continuar.', 400);
      }
      planoEnsinoData.classeOuAno = classeOuAno;
      
      // classeId deve vir do body, não da disciplina
      if (classeId) {
        planoEnsinoData.classeId = classeId;
      } else {
        throw new AppError('Classe é obrigatória para Ensino Secundário. Selecione uma classe antes de criar o Plano de Ensino.', 400);
      }
    }

    const planoEnsino = await prisma.planoEnsino.create({
      data: planoEnsinoData,
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
        professor: {
          include: {
            user: {
              select: {
                id: true,
                nomeCompleto: true,
              },
            },
          } as any,
        },
        curso: {
          select: {
            id: true,
            nome: true,
          },
        },
        classe: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    });

    // Transformar para formato esperado pelo frontend
    const planoEnsinoAny = planoEnsino as any;
    const atribuicao = {
      id: planoEnsinoAny.id,
      ano: planoEnsinoAny.anoLetivo,
      semestre: planoEnsinoAny.semestre,
      classeOuAno: planoEnsinoAny.classeOuAno,
        professor: planoEnsinoAny.professor ? {
          id: planoEnsinoAny.professor.id,
          nome_completo: planoEnsinoAny.professor.user?.nomeCompleto || 'N/A',
        } : null,
      disciplina: planoEnsinoAny.disciplina ? {
        id: planoEnsinoAny.disciplina.id,
        nome: planoEnsinoAny.disciplina.nome,
        // REMOVIDO: curso (legacy) - usar planoEnsino.curso diretamente
        curso: planoEnsinoAny.curso ? {
          nome: planoEnsinoAny.curso.nome,
        } : null,
      } : null,
    };

    res.status(201).json(atribuicao);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // REGRA: Remover atribuição = remover Plano de Ensino (não Turma)
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    // Verificar se o Plano de Ensino existe e pertence à instituição
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: { id, ...filter },
      include: {
        aulas: {
          select: { id: true },
          take: 1, // Apenas verificar se existe
        },
        avaliacoes: {
          select: { id: true },
          take: 1,
        },
      },
    });
    
    if (!planoEnsino) {
      throw new AppError('Atribuição (Plano de Ensino) não encontrada', 404);
    }
    
    // Verificar se o Plano de Ensino pode ser removido (não tem aulas ou avaliações vinculadas)
    if (planoEnsino.aulas.length > 0) {
      throw new AppError('Não é possível remover esta atribuição pois existem aulas planejadas vinculadas. Remova as aulas primeiro.', 400);
    }
    
    if (planoEnsino.avaliacoes.length > 0) {
      throw new AppError('Não é possível remover esta atribuição pois existem avaliações vinculadas. Remova as avaliações primeiro.', 400);
    }
    
    // Deletar o Plano de Ensino
    await prisma.planoEnsino.delete({ where: { id } });
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ============== NOVOS ENDPOINTS: VÍNCULOS ESTRUTURAIS PROFESSOR-DISCIPLINA ==============
// Estes endpoints gerenciam vínculos estruturais (não dependem de ano letivo)
// Diferentes dos endpoints acima que usam Planos de Ensino (dependem de ano letivo)

/**
 * Vincular professor a uma disciplina (estrutural)
 * POST /professor-disciplinas/professor/:professorId/disciplinas
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const vincularProfessorDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Desvincular professor de uma disciplina
 * DELETE /professor-disciplinas/professor/:professorId/disciplinas/:disciplinaId
 * REGRA SIGAE: DESCONTINUADO - A ÚNICA fonte de verdade para atribuição é PlanoEnsino.
 */
export const desvincularProfessorDisciplina = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Endpoint descontinuado. Use Plano de Ensino para atribuir professor a turma/disciplina. A única fonte de verdade é PlanoEnsino.',
    410
  );
};

/**
 * Listar disciplinas de um professor (vínculos estruturais)
 * GET /professores/:professorId/disciplinas-vinculos
 */
export const listarDisciplinasProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { professorId } = req.params;
    const instituicaoId = requireTenantScope(req);

    // Verificar se professor existe e pertence à instituição
    const professor = await prisma.professor.findFirst({
      where: { 
        id: professorId,
        instituicaoId,
      },
    });

    if (!professor) {
      throw new AppError('Professor não encontrado ou não pertence à sua instituição', 404);
    }

    const vinculos = await prisma.professorDisciplina.findMany({
      where: { professorId },
      include: {
        disciplina: {
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
            ativa: true,
          },
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          },
        },
      },
      orderBy: {
        disciplina: {
          nome: 'asc',
        },
      },
    });

    res.json(vinculos);
  } catch (error) {
    next(error);
  }
};
