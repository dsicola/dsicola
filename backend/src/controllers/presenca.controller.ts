import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { verificarTrimestreEncerrado } from './encerramentoAcademico.controller.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { validarPermissaoPresenca } from '../middlewares/role-permissions.middleware.js';
import { calcularFrequenciaAluno, consolidarPlanoEnsino } from '../services/frequencia.service.js';
import { validarBloqueioAcademicoInstitucionalOuErro } from '../services/bloqueioAcademico.service.js';
import { validarPlanoEnsinoAtivo, validarVinculoProfessorDisciplinaTurma } from '../services/validacaoAcademica.service.js';

/**
 * Listar presenças de uma aula lançada
 * GET /presencas/aula/:aula_id
 */
export const getPresencasByAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aula_id } = req.params;
    const filter = addInstitutionFilter(req);

    if (!aula_id) {
      throw new AppError('ID da aula é obrigatório', 400);
    }

    // Verificar se a aula lançada existe e pertence à instituição
    const aulaLancada = await prisma.aulaLancada.findFirst({
      where: { id: aula_id, ...filter },
      include: {
        planoAula: {
          include: {
            planoEnsino: {
              include: {
                disciplina: true,
                turma: true,
              },
            },
          },
        },
      },
    });

    if (!aulaLancada) {
      throw new AppError('Aula lançada não encontrada', 404);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode visualizar presenças desta aula
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor) {
      // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id quando disponível (middleware aplicado)
      // planoEnsino.professorId é professores.id (NÃO users.id)
      if (req.professor?.id) {
        // Middleware resolveProfessor aplicado - usar diretamente
        if (aulaLancada.planoAula.planoEnsino.professorId !== req.professor.id) {
          throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
        }
      } else {
        // Fallback: resolver manualmente se middleware não foi aplicado
        const userId = req.user?.userId;
        const userInstituicaoId = req.user?.instituicaoId;
        if (userId && userInstituicaoId) {
          const { isProfessorOfPlanoEnsino } = await import('../utils/professorResolver.js');
          const isOwner = await isProfessorOfPlanoEnsino(userId, aulaLancada.planoAula.planoEnsino.professorId, userInstituicaoId);
          if (!isOwner) {
            throw new AppError('Acesso negado: você não é o professor responsável por esta aula.', 403);
          }
        } else {
          throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado nesta rota.', 500);
        }
      }
    }

    const planoEnsino = aulaLancada.planoAula.planoEnsino;
    const turmaId = planoEnsino.turmaId;
    const disciplinaId = planoEnsino.disciplinaId;
    const anoLetivo = planoEnsino.anoLetivo;
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!disciplinaId) {
      throw new AppError('Aula lançada não possui disciplina associada', 400);
    }

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada', 400);
    }

    // Identificar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    // Fallback para instituicao?.tipoAcademico apenas se não estiver no JWT (compatibilidade)
    const tipoAcademico = req.user?.tipoAcademico || instituicao?.tipoAcademico || null;

    // Buscar informações da turma para validação
    let turma = null;
    if (turmaId) {
      turma = await prisma.turma.findUnique({
        where: { id: turmaId },
        select: {
          id: true,
          classeId: true,
          cursoId: true,
        },
      });
    }

    // VALIDAÇÃO INSTITUCIONAL: Aplicar regras diferentes conforme tipo de ensino
    let alunosMatriculados: any[] = [];

    if (tipoAcademico === 'SECUNDARIO') {
      // REGRA PARA ENSINO SECUNDÁRIO:
      // Considerar APENAS MatriculaAnual ATIVA vinculada à turma/classe
      // NÃO exigir AlunoDisciplina (aluno cursa automaticamente todas as disciplinas da turma)
      
      if (!turma || !turma.classeId) {
        return res.json({
          hasStudents: false,
          reason: 'SEM_MATRICULAS',
          message: 'Turma não possui classe vinculada. Ensino Secundário requer classe.',
          aulaLancada: {
            id: aulaLancada.id,
            data: aulaLancada.data,
            observacoes: aulaLancada.observacoes,
            disciplina: planoEnsino.disciplina.nome,
            turma: planoEnsino.turma?.nome || null,
          },
          presencas: [],
        });
      }

      // Buscar MatriculaAnual ATIVA para alunos da classe e ano letivo
      const matriculasAnuais = await prisma.matriculaAnual.findMany({
        where: {
          instituicaoId: instituicaoId,
          anoLetivo: anoLetivo,
          status: 'ATIVA',
          classeId: turma.classeId,
          nivelEnsino: 'SECUNDARIO',
        },
        include: {
          aluno: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              numeroIdentificacao: true,
              numeroIdentificacaoPublica: true,
              instituicaoId: true,
            },
          },
        },
        orderBy: {
          aluno: {
            nomeCompleto: 'asc',
          },
        },
      });

      if (matriculasAnuais.length === 0) {
        return res.json({
          hasStudents: false,
          reason: 'SEM_MATRICULAS',
          message: `Não existem matrículas anuais ATIVAS para a classe da turma no ano letivo ${anoLetivo}.`,
          aulaLancada: {
            id: aulaLancada.id,
            data: aulaLancada.data,
            observacoes: aulaLancada.observacoes,
            disciplina: planoEnsino.disciplina.nome,
            turma: planoEnsino.turma?.nome || null,
          },
          presencas: [],
        });
      }

      // Converter MatriculaAnual para formato compatível com a lógica existente
      alunosMatriculados = matriculasAnuais.map((ma) => ({
        alunoId: ma.alunoId,
        aluno: ma.aluno,
        matriculaAnual: {
          id: ma.id,
          anoLetivo: ma.anoLetivo,
          status: ma.status,
          instituicaoId: ma.instituicaoId,
        },
        matriculaAnualId: ma.id,
      }));

    } else {
      // REGRA PARA ENSINO SUPERIOR (ou tipo não definido):
      // Exigir MatriculaAnual ATIVA E AlunoDisciplina com status "Cursando"
      
      // 1. Primeiro, verificar se existem matrículas (AlunoDisciplina) para esta disciplina/turma
      //    independente do status, para poder diferenciar os casos
      const todasMatriculasDisciplina = await prisma.alunoDisciplina.findMany({
        where: {
          disciplinaId,
          ...(turmaId ? { turmaId } : {}),
          aluno: {
            instituicaoId: instituicaoId,
          },
          // CRITICAL: Validar que o AlunoDisciplina está vinculado a uma MatriculaAnual ATIVA
          matriculaAnual: {
            status: 'ATIVA',
            anoLetivo: anoLetivo,
            instituicaoId: instituicaoId,
          },
        },
        select: {
          id: true,
          status: true,
          alunoId: true,
        },
      });

      // 2. Se não existem matrículas, retornar SEM_MATRICULAS
      if (todasMatriculasDisciplina.length === 0) {
        return res.json({
          hasStudents: false,
          reason: 'SEM_MATRICULAS',
          message: 'Não existem alunos matriculados nesta disciplina/turma para o ano letivo.',
          aulaLancada: {
            id: aulaLancada.id,
            data: aulaLancada.data,
            observacoes: aulaLancada.observacoes,
            disciplina: planoEnsino.disciplina.nome,
            turma: planoEnsino.turma?.nome || null,
          },
          presencas: [],
        });
      }

      // 3. Verificar quantos alunos estão com status "Matriculado" vs "Cursando"
      const alunosComStatusMatriculado = todasMatriculasDisciplina.filter(m => m.status === 'Matriculado');
      const alunosComStatusCursando = todasMatriculasDisciplina.filter(m => m.status === 'Cursando');

      // 4. Se existem matrículas mas todas estão com status "Matriculado", retornar STATUS_MATRICULADO
      if (alunosComStatusCursando.length === 0 && alunosComStatusMatriculado.length > 0) {
        return res.json({
          hasStudents: false,
          reason: 'STATUS_MATRICULADO',
          message: `Existem ${alunosComStatusMatriculado.length} aluno(s) matriculado(s) nesta disciplina, mas o status ainda é "Matriculado". É necessário iniciar o semestre para que os alunos passem a "Cursando" e possam ter presenças registradas.`,
          aulaLancada: {
            id: aulaLancada.id,
            data: aulaLancada.data,
            observacoes: aulaLancada.observacoes,
            disciplina: planoEnsino.disciplina.nome,
            turma: planoEnsino.turma?.nome || null,
          },
          presencas: [],
        });
      }

      // 5. Se há alunos com status "Cursando", buscar dados completos
      const alunosMatriculadosDisciplina = await prisma.alunoDisciplina.findMany({
        where: {
          disciplinaId,
          ...(turmaId ? { turmaId } : {}),
          status: 'Cursando',
          aluno: {
            instituicaoId: instituicaoId,
          },
          // CRITICAL: Validar que o AlunoDisciplina está vinculado a uma MatriculaAnual ATIVA
          matriculaAnual: {
            status: 'ATIVA',
            anoLetivo: anoLetivo,
            instituicaoId: instituicaoId,
          },
        },
        include: {
          aluno: {
            select: {
              id: true,
              nomeCompleto: true,
              email: true,
              numeroIdentificacao: true,
              numeroIdentificacaoPublica: true,
              instituicaoId: true,
            },
          },
          matriculaAnual: {
            select: {
              id: true,
              anoLetivo: true,
              status: true,
              instituicaoId: true,
            },
          },
        },
        orderBy: {
          aluno: {
            nomeCompleto: 'asc',
          },
        },
      });

      alunosMatriculados = alunosMatriculadosDisciplina;
    }

    // 3. Para Ensino Superior, validar matrícula anual vinculada
    if (tipoAcademico !== 'SECUNDARIO') {
      alunosMatriculados = alunosMatriculados.filter(ad => {
        // Verificar se tem matrícula anual vinculada
        if (!ad.matriculaAnual || !ad.matriculaAnualId) return false;
        
        // Verificar se a matrícula anual é ATIVA
        if (ad.matriculaAnual.status !== 'ATIVA') return false;
        
        // Verificar se a matrícula anual é do mesmo ano letivo
        if (ad.matriculaAnual.anoLetivo !== anoLetivo) return false;
        
        // Verificar se a matrícula anual é da mesma instituição
        if (ad.matriculaAnual.instituicaoId !== instituicaoId) return false;
        
        return true;
      });
    }

    // 4. Se não houver alunos válidos após validação final, retornar resposta clara
    if (alunosMatriculados.length === 0) {
      const mensagem = tipoAcademico === 'SECUNDARIO'
        ? `Não existem matrículas anuais ATIVAS para a classe da turma no ano letivo ${anoLetivo}.`
        : 'Não existem alunos matriculados ativamente nesta disciplina/turma com matrícula anual ATIVA para o ano letivo';
      
      return res.json({
        hasStudents: false,
        reason: 'SEM_MATRICULAS',
        message: mensagem,
        aulaLancada: {
          id: aulaLancada.id,
          data: aulaLancada.data,
          observacoes: aulaLancada.observacoes,
          disciplina: planoEnsino.disciplina.nome,
          turma: planoEnsino.turma?.nome || null,
        },
        presencas: [],
      });
    }

    // Buscar presenças já registradas para esta aula
    const presencas = await prisma.presenca.findMany({
      where: {
        aulaLancadaId: aula_id,
        ...filter,
      },
    });

    // Criar mapa de presenças por aluno
    const presencasMap = new Map(presencas.map((p) => [p.alunoId, p]));

    // Combinar alunos com suas presenças
    const presencasCompletas = alunosMatriculados.map((matricula) => {
      const presenca = presencasMap.get(matricula.alunoId);
      return {
        id: presenca?.id || null,
        alunoId: matricula.alunoId,
        alunoNome: matricula.aluno.nomeCompleto,
        alunoEmail: matricula.aluno.email,
        numeroIdentificacao: matricula.aluno.numeroIdentificacao,
        numeroIdentificacaoPublica: matricula.aluno.numeroIdentificacaoPublica,
        status: presenca?.status || null,
        observacoes: presenca?.observacoes || null,
      };
    });

    // Retornar resposta com validação de matrículas
    res.json({
      hasStudents: true,
      aulaLancada: {
        id: aulaLancada.id,
        data: aulaLancada.data,
        observacoes: aulaLancada.observacoes,
        disciplina: planoEnsino.disciplina.nome,
        turma: planoEnsino.turma?.nome || null,
      },
      presencas: presencasCompletas,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar ou atualizar presenças em lote
 * POST /presencas
 */
export const createOrUpdatePresencas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaLancadaId, presencas } = req.body;
    const instituicaoId = requireTenantScope(req);

    if (!aulaLancadaId || !Array.isArray(presencas)) {
      throw new AppError('aulaLancadaId e presencas (array) são obrigatórios', 400);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode lançar presenças
    await validarPermissaoPresenca(req, aulaLancadaId);

    // Verificar se a aula lançada existe e pertence à instituição
    const aulaLancada = await prisma.aulaLancada.findFirst({
      where: { id: aulaLancadaId, instituicaoId },
      include: {
        planoAula: {
          include: {
            planoEnsino: {
              include: {
                disciplina: true,
                turma: true,
              },
            },
          },
        },
      },
    });

    if (!aulaLancada) {
      throw new AppError('Aula lançada não encontrada ou não pertence à sua instituição', 404);
    }

    const planoEnsino = aulaLancada.planoAula.planoEnsino;

    // REGRA MESTRA SIGA/SIGAE: Validar que Plano de Ensino está ATIVO (APROVADO)
    // NADA acadêmico pode existir sem um PLANO DE ENSINO válido e ATIVO
    await validarPlanoEnsinoAtivo(instituicaoId, planoEnsino.id, 'lançar presenças');

    // REGRA MESTRA SIGA/SIGAE: Validar vínculo Professor-Disciplina-Turma via Plano de Ensino ATIVO
    // Garantir que o professor autenticado está vinculado à disciplina e turma através do plano
    // IMPORTANTE: Sempre validar vínculo - isso garante que o plano tem turma vinculada e está ativo
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id) - middleware resolveProfessor aplicado
    if (!req.professor?.id) {
      throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado.', 500);
    }
    const professorId = req.professor.id; // professores.id (NÃO users.id)
    
    // Sempre validar vínculo - isso garante que:
    // 1. O plano está ATIVO (APROVADO e não bloqueado)
    // 2. O plano tem turma vinculada (bloqueia disciplinas sem turma)
    // 3. O professor está vinculado corretamente
    await validarVinculoProfessorDisciplinaTurma(
      instituicaoId,
      professorId,
      planoEnsino.disciplinaId,
      planoEnsino.turmaId || null,
      'lançar presenças'
    );

    // REGRA MESTRA: Ano Letivo é contexto, não bloqueio.
    if (planoEnsino.anoLetivoId) {
      const anoLetivoStatus = await prisma.anoLetivo.findUnique({
        where: { id: planoEnsino.anoLetivoId },
        select: { status: true },
      });
      if (anoLetivoStatus?.status !== 'ATIVO') {
        console.warn(`[createPresenca] Ano Letivo ${planoEnsino.anoLetivoId} do plano de ensino ${planoEnsino.id} não está ATIVO. Status: ${anoLetivoStatus?.status}. Operação de registro de presença permitida, mas com aviso.`);
      }
    } else {
      console.warn(`[createPresenca] Plano de ensino ${planoEnsino.id} não possui ano letivo vinculado. Operação de registro de presença permitida, mas com aviso.`);
    }

    // VALIDAÇÃO DE BLOQUEIO: Verificar se o trimestre está encerrado
    const trimestreEncerrado = await verificarTrimestreEncerrado(
      instituicaoId,
      planoEnsino.anoLetivo,
      aulaLancada.planoAula.trimestre
    );

    if (trimestreEncerrado) {
      throw new AppError(
        `Não é possível editar presenças. O ${aulaLancada.planoAula.trimestre}º trimestre está ENCERRADO. Para reabrir, entre em contato com a direção.`,
        403
      );
    }

    // Verificar se todos os alunos pertencem à instituição
    const alunoIds = presencas.map((p: any) => p.alunoId);
    const alunos = await prisma.user.findMany({
      where: {
        id: { in: alunoIds },
        instituicaoId,
      },
      select: { id: true },
    });

    const alunosValidos = new Set(alunos.map((a) => a.id));
    const alunosInvalidos = alunoIds.filter((id: string) => !alunosValidos.has(id));

    if (alunosInvalidos.length > 0) {
      throw new AppError(
        `Alguns alunos não pertencem à sua instituição: ${alunosInvalidos.join(', ')}`,
        400
      );
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe de todos os alunos
    const tipoAcademico = req.user?.tipoAcademico || null;
    const disciplinaIdPresenca = planoEnsino.disciplinaId;
    const anoLetivoIdPresenca = planoEnsino.anoLetivoId || undefined;

    // Validar cada aluno antes de processar
    for (const alunoId of alunoIds) {
      await validarBloqueioAcademicoInstitucionalOuErro(
        alunoId,
        instituicaoId,
        tipoAcademico,
        disciplinaIdPresenca,
        anoLetivoIdPresenca
      );
    }

    // Buscar presenças existentes para comparar (antes)
    const presencasExistentes = await prisma.presenca.findMany({
      where: { aulaLancadaId },
    });
    const presencasAntesMap = new Map(presencasExistentes.map(p => [p.alunoId, p]));

    // Criar ou atualizar presenças
    const resultados = await Promise.all(
      presencas.map(async (presenca: any) => {
        const { alunoId, status, observacoes, origem } = presenca;

        if (!alunoId || !status) {
          throw new AppError('alunoId e status são obrigatórios para cada presença', 400);
        }

        // Verificar se status é válido
        if (!['PRESENTE', 'AUSENTE', 'JUSTIFICADO'].includes(status)) {
          throw new AppError(`Status inválido: ${status}. Deve ser PRESENTE, AUSENTE ou JUSTIFICADO`, 400);
        }

        // Validar origem (MANUAL ou BIOMETRIA)
        const origemValida = origem === 'BIOMETRIA' ? 'BIOMETRIA' : 'MANUAL';

        // Validar que instituicaoId está presente (obrigatório)
        if (!instituicaoId) {
          throw new AppError('Instituição não identificada', 400);
        }

        const data = {
          aulaLancadaId,
          alunoId,
          status,
          origem: origemValida as 'MANUAL' | 'BIOMETRIA', // OrigemPresenca
          observacoes: observacoes || null,
          instituicaoId, // OBRIGATÓRIO: Multi-tenant
        };

        const presencaAntes = presencasAntesMap.get(alunoId);

        // Upsert: criar ou atualizar
        const resultado = await prisma.presenca.upsert({
          where: {
            aulaLancadaId_alunoId: {
              aulaLancadaId,
              alunoId,
            },
          },
          create: data,
          update: {
            status,
            observacoes: observacoes || null,
            updatedAt: new Date(),
          },
        });

        // Auditoria: Log CREATE ou UPDATE
        if (presencaAntes) {
          await AuditService.logUpdate(req, {
            modulo: ModuloAuditoria.PRESENCAS,
            entidade: EntidadeAuditoria.PRESENCA,
            entidadeId: resultado.id,
            dadosAnteriores: presencaAntes,
            dadosNovos: resultado,
            observacao: `Presença atualizada: Aluno ${alunoId} - ${status}`,
          });
        } else {
          await AuditService.logCreate(req, {
            modulo: ModuloAuditoria.PRESENCAS,
            entidade: EntidadeAuditoria.PRESENCA,
            entidadeId: resultado.id,
            dadosNovos: resultado,
            observacao: `Presença criada: Aluno ${alunoId} - ${status}`,
          });
        }

        return resultado;
      })
    );

    res.status(201).json({
      message: 'Presenças registradas com sucesso',
      total: resultados.length,
      presencas: resultados,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar frequência de um aluno por disciplina
 * GET /frequencia/aluno
 */
export const getFrequenciaAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, disciplinaId, anoLetivo, turmaId } = req.query;
    const filter = addInstitutionFilter(req);

    if (!alunoId || !disciplinaId) {
      throw new AppError('alunoId e disciplinaId são obrigatórios', 400);
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: String(alunoId),
        instituicaoId: getInstituicaoIdFromFilter(filter) || undefined,
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
    }

    // Buscar plano de ensino que corresponde aos filtros
    const planoWhere: any = {
      disciplinaId: String(disciplinaId),
      ...filter,
    };

    if (anoLetivo) {
      planoWhere.anoLetivo = Number(anoLetivo);
    }

    if (turmaId) {
      planoWhere.turmaId = String(turmaId);
    }

    const planosEnsino = await prisma.planoEnsino.findMany({
      where: planoWhere,
      include: {
        aulas: {
          include: {
            aulasLancadas: {
              where: {
                instituicaoId: getInstituicaoIdFromFilter(filter) || undefined,
              },
              include: {
                presencas: {
                  where: {
                    alunoId: String(alunoId),
                  },
                },
              },
            },
          },
        },
      },
    });

    // Calcular frequência
    let totalAulas = 0;
    let presencas = 0;
    let ausencias = 0;
    let justificadas = 0;

    planosEnsino.forEach((plano) => {
      plano.aulas.forEach((aula) => {
        aula.aulasLancadas.forEach((aulaLancada) => {
          totalAulas++;
          const presenca = aulaLancada.presencas[0];
          if (presenca) {
            if (presenca.status === 'PRESENTE') {
              presencas++;
            } else if (presenca.status === 'AUSENTE') {
              ausencias++;
            } else if (presenca.status === 'JUSTIFICADO') {
              justificadas++;
            }
          }
        });
      });
    });

    const frequencia = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;
    const percentualTotal = totalAulas > 0 ? ((presencas + justificadas) / totalAulas) * 100 : 0;

    res.json({
      alunoId: String(alunoId),
      disciplinaId: String(disciplinaId),
      anoLetivo: anoLetivo ? Number(anoLetivo) : null,
      turmaId: turmaId ? String(turmaId) : null,
      totalAulas,
      presencas,
      ausencias,
      justificadas,
      frequencia: Number(frequencia.toFixed(2)),
      percentualTotal: Number(percentualTotal.toFixed(2)),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular frequência de um aluno em um Plano de Ensino (usando serviço dedicado)
 * GET /frequencia/:planoEnsinoId/:alunoId
 */
export const calcularFrequenciaAlunoPlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId, alunoId } = req.params;
    const instituicaoId = requireTenantScope(req);

    if (!planoEnsinoId || !alunoId) {
      throw new AppError('planoEnsinoId e alunoId são obrigatórios', 400);
    }

    // Verificar se o plano de ensino pertence à instituição
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId,
      },
      select: { id: true },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
      },
      select: { id: true },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à sua instituição', 404);
    }

    // Usar serviço dedicado para calcular frequência
    const frequencia = await calcularFrequenciaAluno(planoEnsinoId, alunoId, instituicaoId);

    res.json(frequencia);
  } catch (error) {
    next(error);
  }
};

/**
 * Consolidar dados do Plano de Ensino (frequência + notas)
 * GET /consolidar/:planoEnsinoId
 */
export const consolidarPlanoEnsinoEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);

    if (!planoEnsinoId) {
      throw new AppError('planoEnsinoId é obrigatório', 400);
    }

    // Verificar se o plano de ensino pertence à instituição
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        instituicaoId,
      },
      select: { id: true },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // Usar serviço dedicado para consolidar
    const consolidacao = await consolidarPlanoEnsino(
      planoEnsinoId, 
      instituicaoId,
      req.user?.tipoAcademico || null // CRÍTICO: tipoAcademico vem do JWT
    );

    res.json(consolidacao);
  } catch (error) {
    next(error);
  }
};

