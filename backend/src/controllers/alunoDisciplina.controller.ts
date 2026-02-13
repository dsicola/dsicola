import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter } from '../middlewares/auth.js';

/**
 * GET /matriculas-disciplinas
 * Listagem geral de todas as matrículas em disciplinas
 * Não exige parâmetros obrigatórios - usado para tabelas e dashboards
 * 
 * Filtros opcionais:
 * - alunoId: ID do aluno
 * - disciplinaId: ID da disciplina
 * - turmaId: ID da turma
 * - ano_letivo: Ano letivo (número)
 * - status: Status da matrícula
 * - curso_id: ID do curso
 */
export const getAllMatriculasDisciplinas = async (req: Request, res: Response, next: NextFunction) => {
  // Declarar where no escopo externo para estar acessível no catch
  let where: any = {};
  
  try {
    // Log de debug (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[GET /matriculas-disciplinas] Query params:', req.query);
      console.log('[GET /matriculas-disciplinas] User:', req.user ? {
        userId: req.user.userId,
        email: req.user.email,
        instituicaoId: req.user.instituicaoId,
        roles: req.user.roles
      } : 'not authenticated');
    }

    // Verificar autenticação (middleware já faz isso, mas garantindo)
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado',
        message: 'Token de autenticação necessário'
      });
    }

    // Obter filtro de instituição
    const filter = addInstitutionFilter(req);
    const instituicaoId = filter.instituicaoId || null;
    
    // Extrair e validar query params opcionais
    const { 
      alunoId, 
      disciplinaId, 
      turmaId, 
      ano_letivo,
      anoLetivo,
      status,
      curso_id,
      cursoId
    } = req.query;

    // Construir objeto where para Prisma
    where = {};
    
    // Validar alunoId (opcional)
    if (alunoId) {
      if (typeof alunoId !== 'string' || alunoId.trim() === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'alunoId',
            motivo: 'deve ser uma string não vazia'
          }
        });
      }
      where.alunoId = alunoId.trim();
    }

    // Validar disciplinaId (opcional)
    if (disciplinaId) {
      if (typeof disciplinaId !== 'string' || disciplinaId.trim() === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'disciplinaId',
            motivo: 'deve ser uma string não vazia'
          }
        });
      }
      where.disciplinaId = disciplinaId.trim();
    }

    // Validar turmaId (opcional)
    if (turmaId) {
      if (typeof turmaId !== 'string' || turmaId.trim() === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'turmaId',
            motivo: 'deve ser uma string não vazia'
          }
        });
      }
      where.turmaId = turmaId.trim();
    }

    // Validar ano_letivo (opcional) - aceita ano_letivo ou anoLetivo
    const anoLetivoParam = ano_letivo || anoLetivo;
    if (anoLetivoParam) {
      const ano = Number(anoLetivoParam);
      if (isNaN(ano) || ano < 1900 || ano > 2100) {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'ano_letivo',
            motivo: 'deve ser um número válido entre 1900 e 2100'
          }
        });
      }
      where.ano = ano;
    }

    // Validar status (opcional)
    if (status) {
      if (typeof status !== 'string' || status.trim() === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'status',
            motivo: 'deve ser uma string não vazia'
          }
        });
      }
      where.status = status.trim();
    }

    // Validar curso_id / cursoId (opcional) - filtrar através de CursoDisciplina (NOVO MODELO)
    const cursoIdParam = curso_id || cursoId;
    if (cursoIdParam) {
      if (typeof cursoIdParam !== 'string' || cursoIdParam.trim() === '') {
        return res.status(400).json({
          error: 'Parâmetro inválido',
          details: {
            campo: 'curso_id',
            motivo: 'deve ser uma string não vazia'
          }
        });
      }
      // NOVO MODELO: Filtrar disciplinas via CursoDisciplina (não mais disciplina.cursoId legacy)
      const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
        where: { cursoId: cursoIdParam.trim() },
        select: { disciplinaId: true },
      });
      const disciplinaIds = cursoDisciplinas.map(cd => cd.disciplinaId);
      
      if (disciplinaIds.length > 0) {
        where.disciplinaId = { in: disciplinaIds };
      } else {
        // Se não há disciplinas vinculadas ao curso, retornar array vazio
        return res.status(200).json([]);
      }
    }

    // Aplicar filtro de instituição (multi-tenant)
    if (instituicaoId) {
      // Filtrar por alunos da instituição
      const alunosDaInstituicao = await prisma.user.findMany({
        where: { 
          instituicaoId: instituicaoId,
          roles: {
            some: {
              role: 'ALUNO'
            }
          }
        },
        select: { id: true },
      });
      const alunoIds = alunosDaInstituicao.map(a => a.id);
      
      if (alunoIds.length === 0) {
        // Não há alunos na instituição - retornar array vazio
        if (process.env.NODE_ENV !== 'production') {
          console.log('[GET /matriculas-disciplinas] Nenhum aluno encontrado na instituição:', instituicaoId);
        }
        return res.status(200).json([]);
      }

      // Se alunoId foi fornecido, verificar se pertence à instituição
      if (where.alunoId) {
        if (!alunoIds.includes(where.alunoId)) {
          // Aluno não pertence à instituição - retornar array vazio
          if (process.env.NODE_ENV !== 'production') {
            console.log('[GET /matriculas-disciplinas] Aluno não pertence à instituição:', where.alunoId);
          }
          return res.status(200).json([]);
        }
        // Aluno pertence à instituição, continuar com filtro
      } else {
        // Filtrar por todos os alunos da instituição
        where.alunoId = { in: alunoIds };
      }
    } else if (instituicaoId === null && !req.user.roles.includes('SUPER_ADMIN')) {
      // Usuário autenticado mas sem instituição (e não é SUPER_ADMIN) - retornar array vazio
      if (process.env.NODE_ENV !== 'production') {
        console.log('[GET /matriculas-disciplinas] Usuário sem instituição (não SUPER_ADMIN)');
      }
      return res.status(200).json([]);
    }
    // Se for SUPER_ADMIN sem filtro de instituição, retornar todos (sem filtro adicional)

    // Executar query no banco
    if (process.env.NODE_ENV !== 'production') {
      console.log('[GET /matriculas-disciplinas] Prisma where clause:', JSON.stringify(where, null, 2));
    }

    const alunoDisciplinas = await prisma.alunoDisciplina.findMany({
      where,
      include: { 
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          }
        },
        disciplina: {
          include: {
            curso: {
              select: {
                id: true,
                nome: true,
                codigo: true,
              }
            },
          }
        },
        turma: {
          include: {
            curso: {
              select: {
                id: true,
                nome: true,
                codigo: true,
              }
            },
            classe: {
              select: {
                id: true,
                nome: true,
                codigo: true,
              }
            },
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('[GET /matriculas-disciplinas] Resultados encontrados:', alunoDisciplinas.length);
    }
    
    // Sempre retornar 200 com array (vazio ou com dados)
    return res.status(200).json(alunoDisciplinas);
  } catch (error) {
    // Log detalhado do erro
    console.error('[GET /matriculas-disciplinas] Erro:', error);
    if (error instanceof Error) {
      console.error('[GET /matriculas-disciplinas] Erro message:', error.message);
      console.error('[GET /matriculas-disciplinas] Erro stack:', error.stack);
    }
    
    // Se for erro do Prisma, pode ser 400 (validação) ou 500 (erro interno)
    if (error instanceof Error && error.message.includes('Invalid')) {
      // Log detalhado do erro do Prisma
      console.error('[GET /matriculas-disciplinas] Erro do Prisma - Invalid argument:', error.message);
      if (process.env.NODE_ENV !== 'production') {
        console.error('[GET /matriculas-disciplinas] Query params recebidos:', req.query);
        console.error('[GET /matriculas-disciplinas] Where clause que causou o erro:', JSON.stringify(where, null, 2));
      }
      return res.status(400).json({
        error: 'Parâmetro inválido',
        message: 'Os parâmetros fornecidos não são válidos',
        ...(process.env.NODE_ENV !== 'production' && {
          details: error.message,
          queryParams: req.query
        })
      });
    }
    
    // Passar para o error handler padrão
    next(error);
  }
};

/**
 * GET /aluno-disciplinas
 * Detalhe de matrículas por aluno e ano letivo
 * EXIGE parâmetros obrigatórios: aluno_id e ano_letivo
 */
export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { aluno_id, ano_letivo } = req.query;
    
    // Validar parâmetros obrigatórios
    if (!aluno_id || typeof aluno_id !== 'string' || aluno_id.trim() === '') {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes',
        required: ['aluno_id', 'ano_letivo']
      });
    }

    if (!ano_letivo || isNaN(Number(ano_letivo))) {
      return res.status(400).json({
        error: 'Parâmetros obrigatórios ausentes',
        required: ['aluno_id', 'ano_letivo']
      });
    }

    const alunoId = aluno_id.trim();
    const anoLetivo = parseInt(ano_letivo as string);

    // Validar e sanitizar query params opcionais
    const where: any = {
      alunoId,
      ano: anoLetivo,
    };

    // Parâmetros opcionais
    const { disciplinaId, turmaId } = req.query;
    if (disciplinaId && typeof disciplinaId === 'string' && disciplinaId.trim() !== '') {
      where.disciplinaId = disciplinaId.trim();
    }
    if (turmaId && typeof turmaId === 'string' && turmaId.trim() !== '') {
      where.turmaId = turmaId.trim();
    }

    // Verificar se o aluno pertence à instituição
    if (filter.instituicaoId) {
      const aluno = await prisma.user.findUnique({
        where: { id: alunoId },
        select: { instituicaoId: true },
      });

      if (!aluno) {
        return res.status(404).json({
          error: 'Aluno não encontrado'
        });
      }

      if (aluno.instituicaoId !== filter.instituicaoId) {
        return res.status(403).json({
          error: 'Acesso negado a este aluno'
        });
      }
    } else if (filter.instituicaoId === null) {
      // Usuário sem instituição - não retornar dados
      return res.json([]);
    }
    
    const alunoDisciplinas = await prisma.alunoDisciplina.findMany({
      where,
      include: { 
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          }
        },
        disciplina: {
          include: {
            curso: true,
          }
        },
        turma: {
          include: {
            curso: true,
            classe: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(alunoDisciplinas);
  } catch (error) {
    console.error('Error in getAll alunoDisciplinas:', error);
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, disciplinaId, turmaId, ano, semestre, status } = req.body;

    // Validar campos obrigatórios básicos
    if (!alunoId || !disciplinaId || !ano) {
      throw new AppError('alunoId, disciplinaId e ano são obrigatórios', 400);
    }

    // 1. Verificar se o aluno existe e pertence à instituição
    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      include: {
        roles: { select: { role: true } },
        instituicao: { select: { id: true } },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    // Verificar se tem role ALUNO
    const temRoleAluno = aluno.roles.some(r => r.role === 'ALUNO');
    if (!temRoleAluno) {
      throw new AppError('Usuário não é um aluno', 400);
    }

    // Verificar instituição
    if (filter.instituicaoId && aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este aluno', 403);
    }

    // 1.5. Obter instituiçãoId final e verificar tipo acadêmico
    const instituicaoIdFinal = filter.instituicaoId || aluno.instituicaoId;
    if (!instituicaoIdFinal) {
      throw new AppError('Instituição não identificada', 400);
    }

    // Validar que ano é um número válido
    const anoNumero = typeof ano === 'number' ? ano : parseInt(String(ano), 10);
    if (isNaN(anoNumero)) {
      throw new AppError('Ano letivo inválido', 400);
    }

    const matriculaAnualAtiva = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId: instituicaoIdFinal,
        status: 'ATIVA',
        anoLetivo: anoNumero, // Validar que a matrícula anual é do mesmo ano letivo
      },
    });

    if (!matriculaAnualAtiva) {
      throw new AppError('O aluno não possui matrícula anual ativa para este ano letivo. É necessário matricular o aluno anualmente antes de matricular em disciplinas.', 400);
    }

    // 2. Verificar se a disciplina existe
    // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
    // O vínculo com curso é feito via CursoDisciplina
    const disciplina = await prisma.disciplina.findUnique({
      where: { id: disciplinaId },
      select: {
        id: true,
        nome: true,
        instituicaoId: true,
      },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada', 404);
    }

    // 3. Determinar a turma do aluno
    let turmaFinal: string | null | undefined = null;

    if (turmaId) {
      // Se turmaId foi fornecido, validar que existe e o aluno está matriculado
      const turma = await prisma.turma.findUnique({
        where: { id: turmaId },
        include: {
          curso: true,
        },
      });

      if (!turma) {
        throw new AppError('Turma não encontrada', 404);
      }

      // NOVO MODELO: Verificar se a disciplina está vinculada ao curso da turma via CursoDisciplina
      if (turma.cursoId) {
        const disciplinaVinculada = await prisma.cursoDisciplina.findFirst({
          where: {
            cursoId: turma.cursoId,
            disciplinaId: disciplinaId,
          },
        });
        
        if (!disciplinaVinculada) {
          throw new AppError('A disciplina não está vinculada ao curso da turma selecionada', 400);
        }
      }

      // Verificar se o aluno está matriculado nesta turma
      const matricula = await prisma.matricula.findFirst({
        where: {
          alunoId,
          turmaId,
          status: 'Ativa',
        },
      });

      if (!matricula) {
        throw new AppError('Aluno não está matriculado na turma selecionada', 400);
      }

      turmaFinal = turmaId;
    } else {
      // Se turmaId não foi fornecido, buscar a matrícula ativa do aluno
      const matricula = await prisma.matricula.findFirst({
        where: {
          alunoId,
          status: 'Ativa',
        },
        include: {
          turma: {
            include: {
              curso: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!matricula) {
        throw new AppError('Aluno não possui matrícula ativa em nenhuma turma. Matricule o aluno em uma turma primeiro.', 400);
      }

      // NOVO MODELO: Verificar se a disciplina está vinculada ao curso da turma via CursoDisciplina
      if (matricula.turma.cursoId) {
        const disciplinaVinculada = await prisma.cursoDisciplina.findFirst({
          where: {
            cursoId: matricula.turma.cursoId,
            disciplinaId: disciplinaId,
          },
        });
        
        if (!disciplinaVinculada) {
          const cursoTurma = matricula.turma.curso?.nome || 'N/A';
          throw new AppError(`A disciplina não está vinculada ao curso "${cursoTurma}" da turma do aluno. As disciplinas devem estar vinculadas ao curso da turma do aluno via Matriz Curricular.`, 400);
        }
      }

      turmaFinal = matricula.turmaId;
    }

    // REGRA SIGA/SIGAE: Validar que existe Plano de Ensino APROVADO para esta disciplina
    // Nenhuma matrícula pode ser feita sem um Plano de Ensino válido e ativo
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // Construir filtro para buscar plano de ensino aprovado
    const planoEnsinoFilter: any = {
      instituicaoId: instituicaoIdFinal,
      disciplinaId: disciplinaId,
      anoLetivoId: matriculaAnualAtiva.anoLetivoId,
      estado: 'APROVADO', // Apenas planos aprovados permitem matrícula
      bloqueado: false,
    };

    // Adicionar filtros condicionais conforme tipo acadêmico
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: validar curso
      if (turmaFinal) {
        const turmaCompleta = await prisma.turma.findUnique({
          where: { id: turmaFinal },
          select: { cursoId: true },
        });
        if (turmaCompleta?.cursoId) {
          planoEnsinoFilter.cursoId = turmaCompleta.cursoId;
        }
      } else {
        // Se não há turma, buscar curso do aluno via matrícula anual
        const alunoComCurso = await prisma.user.findUnique({
          where: { id: alunoId },
          include: {
            matriculasAnuais: {
              where: {
                status: 'ATIVA',
                anoLetivo: ano,
                instituicaoId: instituicaoIdFinal,
              },
              include: {
                curso: { select: { id: true } },
              },
            },
          },
        });
        if (alunoComCurso?.matriculasAnuais?.[0]?.curso?.id) {
          planoEnsinoFilter.cursoId = alunoComCurso.matriculasAnuais[0].curso.id;
        }
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: validar classe
      if (turmaFinal) {
        const turmaCompleta = await prisma.turma.findUnique({
          where: { id: turmaFinal },
          select: { classeId: true },
        });
        if (turmaCompleta?.classeId) {
          planoEnsinoFilter.classeId = turmaCompleta.classeId;
        }
      } else {
        // Se não há turma, buscar classe do aluno via matrícula anual
        const alunoComClasse = await prisma.user.findUnique({
          where: { id: alunoId },
          include: {
            matriculasAnuais: {
              where: {
                status: 'ATIVA',
                anoLetivo: ano,
                instituicaoId: instituicaoIdFinal,
              },
              include: {
                classe: { select: { id: true } },
              },
            },
          },
        });
        if (alunoComClasse?.matriculasAnuais?.[0]?.classe?.id) {
          planoEnsinoFilter.classeId = alunoComClasse.matriculasAnuais[0].classe.id;
        }
      }
    }

    // Buscar plano de ensino aprovado
    const planoEnsinoAprovado = await prisma.planoEnsino.findFirst({
      where: planoEnsinoFilter,
    });

    if (!planoEnsinoAprovado) {
      throw new AppError(
        `Não é possível matricular o aluno nesta disciplina. Não existe um Plano de Ensino APROVADO para esta disciplina no contexto atual (Ano Letivo, Curso/Classe, Semestre). ` +
        `É necessário criar e aprovar um Plano de Ensino antes de permitir matrículas.`,
        400
      );
    }

    // 3.5. Normalizar semestre (pode ser string ou número)
    const semestreFinal = semestre ? String(semestre) : null;

    // 4. Verificar se já existe matrícula duplicada
    const whereClause: any = {
      alunoId,
      disciplinaId,
      ano,
    };
    if (semestreFinal) {
      whereClause.semestre = semestreFinal;
    } else {
      whereClause.semestre = null;
    }
    const existing = await prisma.alunoDisciplina.findFirst({
      where: whereClause,
    });

    if (existing) {
      throw new AppError('Aluno já está matriculado nesta disciplina para este ano/semestre', 409);
    }

    // 5. Criar a matrícula em disciplina
    const dataCreate: any = {
      alunoId,
      disciplinaId,
      matriculaAnualId: matriculaAnualAtiva.id,
      ano,
      semestre: semestreFinal ?? null,
      status: status || 'Cursando',
    };
    
    // Adicionar turmaId apenas se fornecido
    if (turmaFinal) {
      dataCreate.turmaId = turmaFinal;
    }
    
    const alunoDisciplina = await prisma.alunoDisciplina.create({
      data: dataCreate,
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          // O vínculo com curso é feito via CursoDisciplina
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
      },
    });

    res.status(201).json(alunoDisciplina);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    const { status } = req.body;

    // Verificar se existe e pertence à instituição
    const existing = await prisma.alunoDisciplina.findUnique({
      where: { id },
      include: {
        disciplina: {
          include: {
            curso: {
              include: {
                instituicao: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('Matrícula em disciplina não encontrada', 404);
    }

    // Verificar instituição através do aluno ou disciplina
    const aluno = await prisma.user.findUnique({
      where: { id: existing.alunoId },
      select: { instituicaoId: true },
    });

    if (filter.instituicaoId) {
      // REMOVIDO: disciplina.curso?.instituicao?.id (legacy)
      // Disciplina possui instituicaoId diretamente
      const instituicaoIdDisciplina = existing.disciplina.instituicaoId || aluno?.instituicaoId;
      if (instituicaoIdDisciplina !== filter.instituicaoId) {
        throw new AppError('Acesso negado a esta matrícula', 403);
      }
    }

    // Apenas permitir atualizar status
    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('Nenhum campo válido para atualizar', 400);
    }

    const alunoDisciplina = await prisma.alunoDisciplina.update({
      where: { id },
      data: updateData,
      include: {
        disciplina: {
          // REMOVIDO: curso (legacy) - Disciplina não possui cursoId direto
          // O vínculo com curso é feito via CursoDisciplina
          select: {
            id: true,
            nome: true,
            codigo: true,
            cargaHoraria: true,
          },
        },
      },
    });

    res.json(alunoDisciplina);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    // Verificar se existe e pertence à instituição
    const existing = await prisma.alunoDisciplina.findUnique({
      where: { id },
      include: {
        disciplina: {
          include: {
            curso: {
              include: {
                instituicao: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('Matrícula em disciplina não encontrada', 404);
    }

    // Verificar instituição através do aluno ou disciplina
    const aluno = await prisma.user.findUnique({
      where: { id: existing.alunoId },
      select: { instituicaoId: true },
    });

    if (filter.instituicaoId) {
      // REMOVIDO: disciplina.curso?.instituicao?.id (legacy)
      // Disciplina possui instituicaoId diretamente
      const instituicaoIdDisciplina = existing.disciplina.instituicaoId || aluno?.instituicaoId;
      if (instituicaoIdDisciplina !== filter.instituicaoId) {
        throw new AppError('Acesso negado a esta matrícula', 403);
      }
    }

    await prisma.alunoDisciplina.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/**
 * Matrícula em lote - matricula o aluno em todas as disciplinas do período
 */
export const createBulk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, ano, semestre, status, disciplinaIds } = req.body;

    // Log de debug para identificar problemas
    if (process.env.NODE_ENV !== 'production') {
      console.log('[createBulk] Request body:', {
        alunoId,
        ano,
        semestre,
        status,
        disciplinaIds: Array.isArray(disciplinaIds) ? disciplinaIds.length : disciplinaIds,
        disciplinaIdsType: typeof disciplinaIds,
      });
    }

    // Validar campos obrigatórios
    if (!alunoId || !ano) {
      throw new AppError('alunoId e ano são obrigatórios', 400);
    }

    // Validar tipos de dados
    if (typeof alunoId !== 'string') {
      throw new AppError('alunoId deve ser uma string', 400);
    }
    if (typeof ano !== 'number' && typeof ano !== 'string') {
      throw new AppError('ano deve ser um número ou string', 400);
    }
    // Converter ano para número se for string
    const anoNumero = typeof ano === 'string' ? parseInt(ano, 10) : ano;
    if (isNaN(anoNumero)) {
      throw new AppError('ano deve ser um número válido', 400);
    }

    // Validar disciplinaIds se fornecido
    if (disciplinaIds !== undefined && disciplinaIds !== null) {
      if (!Array.isArray(disciplinaIds)) {
        throw new AppError('disciplinaIds deve ser um array', 400);
      }
      if (disciplinaIds.length === 0) {
        throw new AppError('disciplinaIds não pode ser um array vazio', 400);
      }
      // Validar que todos os elementos são strings
      const disciplinaIdsInvalidos = disciplinaIds.filter(id => typeof id !== 'string');
      if (disciplinaIdsInvalidos.length > 0) {
        throw new AppError('Todos os elementos de disciplinaIds devem ser strings', 400);
      }
    }

    // Semestre é obrigatório apenas no modo automático (quando disciplinaIds não é fornecido)
    const isModoManual = disciplinaIds && Array.isArray(disciplinaIds) && disciplinaIds.length > 0;
    if (!isModoManual && !semestre) {
      throw new AppError('semestre é obrigatório no modo automático', 400);
    }

    // 1. Verificar se o aluno existe e pertence à instituição
    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      include: {
        roles: { select: { role: true } },
        instituicao: { 
          select: { 
            id: true,
            tipoAcademico: true,
          } 
        },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    // Verificar se tem role ALUNO
    const temRoleAluno = aluno.roles.some(r => r.role === 'ALUNO');
    if (!temRoleAluno) {
      throw new AppError('Usuário não é um aluno', 400);
    }

    // Verificar instituição
    if (filter.instituicaoId && aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este aluno', 403);
    }

    // 1.5. Verificar se o aluno possui matrícula anual ativa
    const instituicaoIdFinal = filter.instituicaoId || aluno.instituicaoId;
    if (!instituicaoIdFinal) {
      throw new AppError('Instituição não identificada', 400);
    }

    const matriculaAnualAtiva = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId: instituicaoIdFinal,
        status: 'ATIVA',
        anoLetivo: anoNumero, // Validar que a matrícula anual é do mesmo ano letivo
      },
      include: {
        instituicao: {
          select: { tipoAcademico: true },
        },
      },
    });

    if (!matriculaAnualAtiva) {
      throw new AppError('O aluno não possui matrícula anual ativa para este ano letivo. É necessário matricular o aluno anualmente antes de matricular em disciplinas.', 400);
    }

    // VALIDAÇÃO PADRÃO SIGA/SIGAE: Bloquear matrícula em disciplinas se não houver curso no Ensino Superior
    const tipoAcademicoMatricula = req.user?.tipoAcademico || matriculaAnualAtiva.instituicao?.tipoAcademico || null;
    if (tipoAcademicoMatricula === 'SUPERIOR' && !matriculaAnualAtiva.cursoId) {
      throw new AppError(
        'Não é possível matricular o estudante em disciplinas. A matrícula anual não possui curso definido. ' +
        'No Ensino Superior, é obrigatório definir um curso na matrícula anual antes de matricular em disciplinas. ' +
        'Acesse a matrícula anual do estudante e defina o curso.',
        400
      );
    }

    // 2. Buscar matrícula ativa do aluno para obter curso e turma
    const matricula = await prisma.matricula.findFirst({
      where: {
        alunoId,
        status: 'Ativa',
      },
      include: {
        turma: {
          include: {
            curso: {
              include: {
                instituicao: {
                  select: { id: true, tipoAcademico: true },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!matricula) {
      throw new AppError('Aluno não possui matrícula ativa em nenhuma turma. Matricule o aluno em uma turma primeiro.', 400);
    }

    const cursoId = matricula.turma.cursoId;
    const turmaId = matricula.turmaId;
    const tipoAcademico = matricula.turma.curso?.instituicao?.tipoAcademico || aluno.instituicao?.tipoAcademico;

    // 3. Determinar os períodos a processar
    // No modo manual, usar o semestre fornecido ou padrão baseado no tipo acadêmico
    const isTodosPeriodos = semestre === 'todos';
    let periodos: string[] = [];
    
    if (isModoManual) {
      // Modo manual: usar semestre fornecido ou padrão
      if (semestre && semestre !== 'todos') {
        periodos = [semestre];
      } else if (isTodosPeriodos) {
        // Se "todos" foi selecionado, determinar períodos baseado no tipo acadêmico
        if (tipoAcademico === 'SECUNDARIO') {
          periodos = ['1', '2', '3']; // Trimestres
        } else {
          periodos = ['1', '2']; // Semestres
        }
      } else {
        // Se não foi fornecido semestre no modo manual, usar padrão baseado no tipo acadêmico
        if (tipoAcademico === 'SECUNDARIO') {
          periodos = ['1']; // Padrão: primeiro trimestre
        } else {
          periodos = ['1']; // Padrão: primeiro semestre
        }
      }
    } else {
      // Modo automático: semestre é obrigatório
      if (isTodosPeriodos) {
        // Se "todos" foi selecionado, determinar períodos baseado no tipo acadêmico
        if (tipoAcademico === 'SECUNDARIO') {
          periodos = ['1', '2', '3']; // Trimestres
        } else {
          periodos = ['1', '2']; // Semestres
        }
      } else {
        periodos = [semestre];
      }
    }

    // 4. Buscar disciplinas do período
    let disciplinasDoPeriodo: any[] = [];

    if (isModoManual) {
      // Modo manual: usar disciplinas fornecidas
      // IMPORTANTE: Validar que as disciplinas pertencem à instituição do aluno
      // CRÍTICO: Disciplina tem instituicaoId diretamente, não filtrar apenas por curso.instituicaoId
      disciplinasDoPeriodo = await prisma.disciplina.findMany({
        where: {
          id: { in: disciplinaIds },
          instituicaoId: instituicaoIdFinal, // CRÍTICO: Filtro multi-tenant direto na Disciplina
        },
        include: {
          curso: {
            include: {
              instituicao: {
                select: { id: true, tipoAcademico: true },
              },
            },
          },
        },
      });

      // Validar que todas as disciplinas solicitadas foram encontradas
      const disciplinasEncontradasIds = new Set(disciplinasDoPeriodo.map(d => d.id));
      const disciplinasNaoEncontradas = disciplinaIds.filter((id: string) => !disciplinasEncontradasIds.has(id));
      
      if (disciplinasNaoEncontradas.length > 0) {
        throw new AppError(
          `Algumas disciplinas selecionadas não foram encontradas ou não pertencem à instituição: ${disciplinasNaoEncontradas.join(', ')}`,
          404
        );
      }

      // Validar que as disciplinas pertencem à instituição correta (validação adicional)
      const disciplinasForaInstituicao = disciplinasDoPeriodo.filter(
        d => d.instituicaoId !== instituicaoIdFinal
      );
      
      if (disciplinasForaInstituicao.length > 0) {
        throw new AppError(
          `Algumas disciplinas selecionadas não pertencem à instituição do aluno`,
          403
        );
      }
    } else {
      // Modo automático: buscar todas as disciplinas
      if (isTodosPeriodos) {
        // Se "todos", buscar todas as disciplinas do curso
        // CRÍTICO: Filtrar por instituicaoId diretamente na Disciplina
        const whereClause: any = {
          instituicaoId: instituicaoIdFinal, // CRÍTICO: Filtro multi-tenant direto
        };
        
        // Se cursoId fornecido, filtrar disciplinas via CursoDisciplina (NOVO MODELO)
        if (cursoId) {
          // NOVO MODELO: Sempre usar CursoDisciplina para buscar disciplinas vinculadas ao curso
          const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
            where: { cursoId },
            select: { disciplinaId: true },
          });
          const disciplinaIdsFromCurso = cursoDisciplinas.map(cd => cd.disciplinaId);
          if (disciplinaIdsFromCurso.length > 0) {
            whereClause.id = { in: disciplinaIdsFromCurso };
          } else {
            // Se não há disciplinas vinculadas ao curso, retornar array vazio
            return res.status(200).json([]);
          }
        }
        
        disciplinasDoPeriodo = await prisma.disciplina.findMany({
          where: whereClause,
          include: {
            curso: {
              include: {
                instituicao: {
                  select: { id: true, tipoAcademico: true },
                },
              },
            },
          },
          orderBy: { nome: 'asc' },
        });
      } else {
        // Buscar disciplinas do curso
        // DISCIPLINA é ESTRUTURAL: não possui semestre nem classe
        // O semestre pertence ao PlanoEnsino, não à Disciplina
        // CRÍTICO: Filtrar por instituicaoId diretamente na Disciplina
        const whereDisciplina: any = {
          instituicaoId: instituicaoIdFinal, // CRÍTICO: Filtro multi-tenant direto
        };

        // Filtrar por curso via CursoDisciplina (NOVO MODELO)
        if (cursoId) {
          // NOVO MODELO: Sempre usar CursoDisciplina para buscar disciplinas vinculadas ao curso
          const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
            where: { cursoId },
            select: { disciplinaId: true },
          });
          const disciplinaIdsFromCurso = cursoDisciplinas.map(cd => cd.disciplinaId);
          if (disciplinaIdsFromCurso.length > 0) {
            whereDisciplina.id = { in: disciplinaIdsFromCurso };
          } else {
            // Se não há disciplinas vinculadas ao curso, retornar array vazio
            return res.status(200).json([]);
          }
        }

        // Filtrar por período baseado no tipo acadêmico
        if (tipoAcademico === 'SECUNDARIO') {
          // Para secundário: filtrar por trimestresOferecidos (campo opcional da Disciplina)
          const trimestreNum = parseInt(semestre);
          if (trimestreNum) {
            whereDisciplina.trimestresOferecidos = {
              has: trimestreNum,
            };
          }
        } else if (tipoAcademico === 'SUPERIOR' && semestre && semestre !== 'todos') {
          // REGRA SIGA/SIGAE: Para Ensino Superior, usar PlanoEnsino como fonte de verdade para semestre
          // Disciplina não possui semestre - o semestre pertence ao PlanoEnsino
          // Buscar disciplinas através de PlanoEnsino filtrado por semestre
          
          // Buscar ano letivo ativo para o aluno
          const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
            where: {
              instituicaoId: instituicaoIdFinal,
              status: 'ATIVO',
            },
            select: { id: true, ano: true },
          });

          if (!anoLetivoAtivo) {
            throw new AppError('Não há ano letivo ativo. Cadastre um ano letivo antes de matricular em disciplinas.', 400);
          }

          // Buscar PlanoEnsino com o semestre especificado
          const wherePlanoEnsino: any = {
            instituicaoId: instituicaoIdFinal,
            anoLetivoId: anoLetivoAtivo.id,
            status: { in: ['APROVADO', 'ENCERRADO'] }, // Apenas planos aprovados
          };

          if (cursoId) {
            wherePlanoEnsino.cursoId = cursoId;
          }

          // Filtrar por semestre (pode ser número ou semestreId)
          const semestreNum = parseInt(semestre);
          if (semestreNum) {
            // Buscar por semestre numérico (1 ou 2) ou semestreId
            // Usar OR apenas se ambos os campos existirem
            const orConditions: any[] = [];
            orConditions.push({ semestre: semestreNum });
            orConditions.push({ semestreRef: { numero: semestreNum } });
            wherePlanoEnsino.OR = orConditions;
          }

          const planosEnsino = await prisma.planoEnsino.findMany({
            where: wherePlanoEnsino,
            select: {
              disciplinaId: true,
              disciplina: {
                select: {
                  id: true,
                  nome: true,
                  codigo: true,
                  cargaHoraria: true,
                  instituicaoId: true,
                },
              },
            },
            distinct: ['disciplinaId'], // Evitar disciplinas duplicadas
          });

          // Extrair IDs das disciplinas dos planos de ensino
          const disciplinaIdsFromPlano = planosEnsino.map(p => p.disciplinaId);
          
          if (disciplinaIdsFromPlano.length > 0) {
            // Filtrar disciplinas pelos IDs encontrados nos planos de ensino
            whereDisciplina.id = { in: disciplinaIdsFromPlano };
          } else {
            // Se não encontrou planos de ensino para este semestre, retornar erro
            // Isso garante que apenas disciplinas com plano de ensino aprovado sejam matriculadas
            throw new AppError(
              `Nenhuma disciplina encontrada para o semestre ${semestre} no curso selecionado. ` +
              `Certifique-se de que existem Planos de Ensino APROVADOS para este semestre.`,
              404
            );
          }
        }
        // Se não for Ensino Superior ou se semestre for "todos", buscar todas as disciplinas do curso

        disciplinasDoPeriodo = await prisma.disciplina.findMany({
          where: whereDisciplina,
          include: {
            curso: {
              include: {
                instituicao: {
                  select: { id: true, tipoAcademico: true },
                },
              },
            },
          },
          orderBy: { nome: 'asc' },
        });
      }
    }

    if (disciplinasDoPeriodo.length === 0) {
      const mensagemErro = isModoManual
        ? 'Nenhuma das disciplinas selecionadas foi encontrada ou não pertence à instituição do aluno'
        : 'Nenhuma disciplina encontrada para este período';
      throw new AppError(mensagemErro, 404);
    }

    // REGRA SIGA/SIGAE: Validar que existe Plano de Ensino APROVADO para cada disciplina (modo manual)
    // Nenhuma matrícula pode ser feita sem um Plano de Ensino válido e ativo
    if (isModoManual) {
      const tipoAcademicoBulk = req.user?.tipoAcademico || aluno.instituicao?.tipoAcademico || null;
      
      // Buscar planos de ensino aprovados para as disciplinas selecionadas
      if (!instituicaoIdFinal) {
        throw new AppError('Instituição não identificada', 400);
      }
      const wherePlano: any = {
        instituicaoId: instituicaoIdFinal,
        disciplinaId: { in: disciplinaIds },
        anoLetivoId: matriculaAnualAtiva.anoLetivoId,
        estado: 'APROVADO',
        bloqueado: false,
      };
      if (tipoAcademicoBulk === 'SUPERIOR' && cursoId) {
        wherePlano.cursoId = cursoId;
      }
      if (tipoAcademicoBulk === 'SECUNDARIO' && matriculaAnualAtiva.classeId) {
        wherePlano.classeId = matriculaAnualAtiva.classeId;
      }
      const planosEnsinoAprovados = await prisma.planoEnsino.findMany({
        where: wherePlano,
        select: { disciplinaId: true },
        distinct: ['disciplinaId'],
      });

      const disciplinasComPlanoAprovado = new Set(planosEnsinoAprovados.map(p => p.disciplinaId));
      const disciplinasSemPlano = disciplinasDoPeriodo.filter(
        d => !disciplinasComPlanoAprovado.has(d.id)
      );

      if (disciplinasSemPlano.length > 0) {
        const nomesDisciplinas = disciplinasSemPlano.map(d => d.nome).join(', ');
        throw new AppError(
          `Não é possível matricular o aluno nas seguintes disciplinas: ${nomesDisciplinas}. ` +
          `Não existem Planos de Ensino APROVADOS para estas disciplinas no contexto atual (Ano Letivo, Curso/Classe). ` +
          `É necessário criar e aprovar Planos de Ensino antes de permitir matrículas.`,
          400
        );
      }
    }

    // 5. Criar matrículas para cada período
    let todasMatriculasCriadas: any[] = [];
    let totalDuplicadas = 0;

    for (const periodo of periodos) {
      // Verificar matrículas existentes para este período
      const matriculasExistentes = await prisma.alunoDisciplina.findMany({
        where: {
          alunoId,
          ano: anoNumero,
          semestre: periodo,
          disciplinaId: { in: disciplinasDoPeriodo.map(d => d.id) },
        },
        select: {
          disciplinaId: true,
        },
      });

      const disciplinaIdsExistentes = new Set(matriculasExistentes.map(m => m.disciplinaId));
      const disciplinasParaMatricular = disciplinasDoPeriodo.filter(
        d => !disciplinaIdsExistentes.has(d.id)
      );

      totalDuplicadas += disciplinasDoPeriodo.length - disciplinasParaMatricular.length;

      // Criar matrículas para este período
      if (disciplinasParaMatricular.length > 0) {
        const matriculasCriadas = await prisma.$transaction(
          disciplinasParaMatricular.map(disciplina =>
            prisma.alunoDisciplina.create({
              data: {
                alunoId,
                disciplinaId: disciplina.id,
                turmaId: turmaId,
                matriculaAnualId: matriculaAnualAtiva.id,
                ano: anoNumero,
                semestre: periodo,
                status: status || 'Cursando',
              },
              include: {
                disciplina: {
                  include: {
                    curso: true,
                  },
                },
              },
            })
          )
        );

        todasMatriculasCriadas = todasMatriculasCriadas.concat(matriculasCriadas);
      }
    }

    if (todasMatriculasCriadas.length === 0) {
      throw new AppError('O aluno já está matriculado em todas as disciplinas para os períodos selecionados', 409);
    }

    res.status(201).json({
      message: `${todasMatriculasCriadas.length} matrícula(s) criada(s) com sucesso`,
      matriculas: todasMatriculasCriadas,
      total: todasMatriculasCriadas.length,
      duplicadas: totalDuplicadas,
    });
  } catch (error) {
    next(error);
  }
};

