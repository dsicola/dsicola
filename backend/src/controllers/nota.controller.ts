import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, getInstituicaoIdFromAuth, requireTenantScope } from '../middlewares/auth.js';
import {
  assertLancamentoSecundarioRespeitaSequenciaTrimestres,
  verificarTrimestreEncerrado,
  verificarSemestreEncerrado,
} from './encerramentoAcademico.controller.js';

/** NUNCA confiar no frontend: rejeitar instituicaoId vindo do body */
const rejectBodyInstituicaoId = (req: Request) => {
  if (req.body?.instituicaoId !== undefined && req.body?.instituicaoId !== null) {
    throw new AppError('Violação multi-tenant: instituicaoId não pode ser enviado pelo cliente.', 403);
  }
};

/** Garantir que entidade pertence à instituição do usuário autenticado */
const assertTenantInstituicao = (req: Request, entityInstituicaoId: string | null | undefined) => {
  const userInstId = getInstituicaoIdFromAuth(req);
  if (!userInstId) return; // SUPER_ADMIN sem escopo - permitir
  if (!entityInstituicaoId) return; // Entidade sem instituição (legacy) - validar por outros meios
  if (entityInstituicaoId.trim() !== userInstId.trim()) {
    throw new AppError('Violação multi-tenant: recurso não pertence à sua instituição.', 403);
  }
};
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { validarPermissaoNota } from '../middlewares/role-permissions.middleware.js';
import { validarAnoLetivoIdAtivo, validarPlanoEnsinoAtivo, validarVinculoProfessorDisciplinaTurma } from '../services/validacaoAcademica.service.js';
import {
  calcularMedia,
  calcularMediaLote,
  DadosCalculoNota,
  obterMediaAcSuperiorPauta,
} from '../services/calculoNota.service.js';
import { verificarAlunoConcluido } from '../services/conclusaoCurso.service.js';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '../services/email.service.js';
import { validarBloqueioAcademicoInstitucionalOuErro, verificarBloqueioAcademico, TipoOperacaoBloqueada } from '../services/bloqueioAcademico.service.js';
import { calcularFrequenciaAluno } from '../services/frequencia.service.js';
import { validarJanelaLancamentoNotas } from '../services/periodoLancamentoNotas.service.js';
import {
  TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA,
  TIPOS_SECUNDARIO_TRIMESTRE_LEGADO,
} from '../types/notaDisciplinaSecundarioAngola.js';

export const getNotas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, exameId, turmaId } = req.query;
    const filter = addInstitutionFilter(req);

    if (req.user?.roles?.includes('RESPONSAVEL') && (turmaId || exameId)) {
      throw new AppError('Responsável só pode consultar notas com o parâmetro alunoId.', 403);
    }
    
    // REGRA ARQUITETURAL institucional (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    const where: any = {};
    if (alunoId) where.alunoId = alunoId as string;
    if (exameId) where.exameId = exameId as string;

    // If turmaId, get all notas for exames in that turma
    if (turmaId) {
      // Para professores, garantir que a turma pertence ao professor através de planos de ensino
      const turmaWhere: any = { id: turmaId as string };
      if (filter.instituicaoId) {
        turmaWhere.instituicaoId = filter.instituicaoId;
      }

      // REGRA institucional: Professor só vê notas da SUA disciplina (planos de ensino do professor nesta turma)
      let planoEnsinoIdsTurma: string[] | null = null;
      if (isProfessor && professorId) {
        const planosDoProfessor = await prisma.planoEnsino.findMany({
          where: {
            turmaId: turmaId as string,
            professorId,
            ...filter,
          },
          select: { id: true },
        });

        if (planosDoProfessor.length === 0) {
          // Professor não tem plano de ensino para esta turma
          return res.json([]);
        }
        planoEnsinoIdsTurma = planosDoProfessor.map((p) => p.id);
      }

      const turma = await prisma.turma.findFirst({
        where: turmaWhere,
        select: { id: true },
      });

      if (!turma) {
        // Se professor e turma não encontrada, retornar vazio
        if (isProfessor) {
          return res.json([]);
        }
        throw new AppError('Turma não encontrada ou sem permissão', 404);
      }

      // Incluir exames da turma: professor vê só globais ou do seu plano (cada professor tem o seu "1º Trimestre")
      const examesWhereTurma: any = { turmaId: turma.id };
      if (planoEnsinoIdsTurma !== null && planoEnsinoIdsTurma.length > 0) {
        examesWhereTurma.OR = [
          { planoEnsinoId: null },
          { planoEnsinoId: { in: planoEnsinoIdsTurma } },
        ];
      }
      const exames = await prisma.exame.findMany({
        where: examesWhereTurma,
        select: { id: true },
      });
      const exameIds = exames.map(e => e.id);
      where.OR = [
        ...(exameIds.length ? [{ exameId: { in: exameIds } }] : []),
        { avaliacao: { turmaId: turma.id } },
      ];

      if (planoEnsinoIdsTurma !== null) {
        where.planoEnsinoId = { in: planoEnsinoIdsTurma };
      }
    } else if (!turmaId && !exameId && req.user?.roles?.includes('ALUNO')) {
      // GET /notas sem turmaId por ALUNO: retornar apenas as notas do próprio estudante (evita vazar todas as notas)
      const alunoIdReq = req.user?.userId;
      if (!alunoIdReq) {
        return res.json([]);
      }
      where.alunoId = alunoIdReq;
      if (filter.instituicaoId) {
        where.OR = [
          { instituicaoId: filter.instituicaoId },
          { instituicaoId: null },
        ];
      }
    } else if (!turmaId && !exameId && req.user?.roles?.includes('RESPONSAVEL')) {
      const alunoIdNorm = typeof alunoId === 'string' ? alunoId.trim() : '';
      if (!alunoIdNorm) {
        throw new AppError('Parâmetro alunoId é obrigatório para consultar notas.', 403);
      }
      const instId = getInstituicaoIdFromFilter(filter) ?? req.user?.instituicaoId ?? null;
      if (!instId) {
        throw new AppError('Instituição não identificada', 400);
      }
      const vinculo = await prisma.responsavelAluno.findUnique({
        where: {
          responsavelId_alunoId: {
            responsavelId: req.user!.userId,
            alunoId: alunoIdNorm,
          },
        },
      });
      if (!vinculo) {
        throw new AppError('Sem permissão para consultar notas deste aluno.', 403);
      }
      const alunoInst = await prisma.user.findFirst({
        where: { id: alunoIdNorm, instituicaoId: instId },
        select: { id: true },
      });
      if (!alunoInst) {
        throw new AppError('Sem permissão para consultar notas deste aluno.', 403);
      }
      where.alunoId = alunoIdNorm;
      if (filter.instituicaoId) {
        where.OR = [
          { instituicaoId: filter.instituicaoId },
          { instituicaoId: null },
        ];
      }
    } else if (isProfessor && professorId) {
      // Se professor busca todas as notas, filtrar apenas pelas suas turmas e SEUS planos (sua disciplina)
      const planosEnsino = await prisma.planoEnsino.findMany({
        where: {
          professorId,
          ...filter,
        },
        select: {
          id: true,
          turmaId: true,
        },
      });

      const planoIds = planosEnsino.map((p) => p.id);
      const turmaIds = planosEnsino
        .map((plano) => plano.turmaId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (turmaIds.length === 0 || planoIds.length === 0) {
        return res.json([]);
      }

      // Incluir exames das turmas do professor: globais (planoEnsinoId null) ou do seu plano
      const exames = await prisma.exame.findMany({
        where: {
          turmaId: { in: turmaIds },
          OR: [
            { planoEnsinoId: null },
            { planoEnsinoId: { in: planoIds } },
          ],
        },
        select: { id: true },
      });
      const exameIds = exames.map(e => e.id);
      where.OR = [
        ...(exameIds.length ? [{ exameId: { in: exameIds } }] : []),
        { avaliacao: { turmaId: { in: turmaIds } } },
      ];
      // REGRA institucional: Professor vê apenas notas dos SEUS planos de ensino (sua disciplina)
      where.planoEnsinoId = { in: planoIds };
    }

    const notas = await prisma.nota.findMany({
      where,
      include: {
        aluno: { 
          select: { 
            id: true, 
            nomeCompleto: true, 
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true 
          } 
        },
        disciplina: { select: { id: true, nome: true } },
        planoEnsino: {
          select: {
            id: true,
            turmaId: true,
            disciplina: { select: { id: true, nome: true } },
            turma: {
              select: {
                id: true,
                nome: true,
                curso: { select: { id: true, nome: true } },
                classe: { select: { id: true, nome: true } },
                disciplina: { select: { id: true, nome: true } },
              },
            },
          },
        },
        exame: { 
          include: {
            turma: { 
              include: {
                disciplina: true,
                curso: true,
                classe: { select: { id: true, nome: true } },
              }
            }
          }
        },
        avaliacao: {
          include: {
            turma: {
              include: {
                disciplina: true,
                curso: true,
                classe: { select: { id: true, nome: true } },
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notas);
  } catch (error) {
    next(error);
  }
};

export const getNotaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // IMPORTANTE: Nota não tem instituicaoId diretamente, filtra através de aluno ou turma
    // Usar findFirst com validação nested para garantir multi-tenant
    let nota;
    
    if (filter.instituicaoId) {
      // Multi-tenant: filtrar por instituicaoId (nota, aluno, exame.turma ou avaliacao.turma)
      nota = await prisma.nota.findFirst({
        where: {
          id,
          OR: [
            { instituicaoId: filter.instituicaoId },
            { instituicaoId: null, aluno: { instituicaoId: filter.instituicaoId } },
            { instituicaoId: null, exame: { turma: { instituicaoId: filter.instituicaoId } } },
            { instituicaoId: null, avaliacao: { turma: { instituicaoId: filter.instituicaoId } } },
          ],
        },
        include: {
          aluno: {
            select: {
              id: true,
              nomeCompleto: true,
              instituicaoId: true
            }
          },
          planoEnsino: { select: { professorId: true } },
          exame: {
            include: {
              turma: {
                select: {
                  id: true,
                  nome: true,
                  instituicaoId: true
                }
              }
            }
          },
          avaliacao: {
            include: {
              turma: {
                select: {
                  id: true,
                  nome: true,
                  instituicaoId: true
                }
              }
            }
          }
        }
      });
    } else {
      // Se não tem instituicaoId (SUPER_ADMIN sem contexto), buscar sem filtro
      // Mas isso deve ser raro - maioria dos casos tem instituicaoId
      nota = await prisma.nota.findUnique({
        where: { id },
        include: {
          aluno: {
            select: {
              id: true,
              nomeCompleto: true,
              instituicaoId: true
            }
          },
          planoEnsino: { select: { professorId: true } },
          exame: {
            include: {
              turma: {
                select: {
                  id: true,
                  nome: true,
                  instituicaoId: true
                }
              }
            }
          },
          avaliacao: {
            include: {
              turma: {
                select: {
                  id: true,
                  nome: true,
                  instituicaoId: true
                }
              }
            }
          }
        }
      });
    }

    if (!nota) {
      throw new AppError('Nota não encontrada ou não pertence à sua instituição', 404);
    }

    // RBAC: PROFESSOR só vê notas dos seus planos (João nunca vê nota de Maria)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor && professorId) {
      const pertenceAoProfessor =
        (nota as any).professorId === professorId ||
        (nota as any).planoEnsino?.professorId === professorId;
      if (!pertenceAoProfessor) {
        throw new AppError('Acesso negado: você só pode visualizar notas das suas disciplinas', 403);
      }
    }

    // RBAC: ALUNO só pode visualizar a própria nota + comentarioProfessor
    const userRoles = req.user?.roles || [];
    const roleNames = userRoles.map((r: any) => (typeof r === 'string' ? r : r.role || r.name)).filter(Boolean);
    const isAluno = roleNames.includes('ALUNO');
    const isAdmin = roleNames.includes('ADMIN') || roleNames.includes('SECRETARIA') || roleNames.includes('SUPER_ADMIN') || roleNames.includes('PROFESSOR');
    if (isAluno && !isAdmin && nota.alunoId !== req.user?.userId) {
      throw new AppError('Acesso negado: você só pode visualizar suas próprias notas', 403);
    }

    res.json(nota);
  } catch (error) {
    next(error);
  }
};

export const createNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const { alunoId, exameId, avaliacaoId, valor, observacoes, comentarioProfessor } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    // Validate valor
    if (valor < 0 || valor > 20) {
      throw new AppError('Valor da nota deve estar entre 0 e 20', 400);
    }

    // Verificar se é exame ou avaliação
    if (!exameId && !avaliacaoId) {
      throw new AppError('exameId ou avaliacaoId é obrigatório', 400);
    }

    if (exameId && avaliacaoId) {
      throw new AppError('Informe apenas exameId ou avaliacaoId', 400);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode lançar notas
    await validarPermissaoNota(req, avaliacaoId, exameId);

    // JANELA DE LANÇAMENTO: Sempre validar período ativo. Buscar instituicaoId do exame/avaliacao se não vier do filtro.
    let instIdParaJanela = instituicaoId;
    if (!instIdParaJanela && (exameId || avaliacaoId)) {
      if (exameId) {
        const ex = await prisma.exame.findUnique({
          where: { id: exameId },
          select: { turma: { select: { instituicaoId: true } } },
        });
        instIdParaJanela = ex?.turma?.instituicaoId ?? undefined;
      } else if (avaliacaoId) {
        const av = await prisma.avaliacao.findFirst({
          where: { id: avaliacaoId },
          select: { turma: { select: { instituicaoId: true } } },
        });
        instIdParaJanela = av?.turma?.instituicaoId ?? undefined;
      }
    }
    if (instIdParaJanela) {
      const janela = await validarJanelaLancamentoNotas(instIdParaJanela);
      if (!janela.permitido) {
        throw new AppError(janela.motivo || 'Período de lançamento de notas não está aberto.', 403);
      }
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId || '',
      tipoAcademico
    );

    // REGRA CRÍTICA institucional: Bloquear lançamento de notas após conclusão do curso
    // Buscar curso/classe do aluno através da matrícula ou plano de ensino
    let cursoIdParaVerificacao: string | null = null;
    let classeIdParaVerificacao: string | null = null;

    if (exameId) {
      const exame = await prisma.exame.findUnique({
        where: { id: exameId },
        include: {
          turma: {
            include: {
              curso: { select: { id: true } },
              classe: { select: { id: true } },
            },
          },
        },
      });

      if (exame?.turma) {
        cursoIdParaVerificacao = exame.turma.cursoId || null;
        classeIdParaVerificacao = exame.turma.classeId || null;
      }
    } else if (avaliacaoId) {
      const avaliacao = await prisma.avaliacao.findFirst({
        where: { id: avaliacaoId },
        include: {
          turma: {
            include: {
              curso: { select: { id: true } },
              classe: { select: { id: true } },
            },
          },
        },
      });

      if (avaliacao?.turma) {
        cursoIdParaVerificacao = avaliacao.turma.cursoId || null;
        classeIdParaVerificacao = avaliacao.turma.classeId || null;
      }
    }

    // Verificar se aluno já concluiu o curso/classe
    if (cursoIdParaVerificacao || classeIdParaVerificacao) {
      const verificacao = await verificarAlunoConcluido(
        alunoId,
        cursoIdParaVerificacao,
        classeIdParaVerificacao,
        instituicaoId || ''
      );

      if (verificacao.concluido) {
        throw new AppError(
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Não é permitido lançar notas após conclusão. O histórico acadêmico é imutável conforme padrão institucional.`,
          403
        );
      }
    }

    if (exameId) {
      // Lógica existente para exames
      const exame = await prisma.exame.findFirst({
        where: {
          id: exameId,
          ...(filter.instituicaoId && { turma: { instituicaoId: filter.instituicaoId } }),
        },
        select: {
          id: true,
          turmaId: true,
          planoEnsinoId: true,
          tipo: true,
          nome: true,
          turma: {
            select: {
              id: true,
              professorId: true,
              instituicaoId: true,
              anoLetivoRef: { select: { ano: true } },
            }
          }
        }
      });

      if (!exame) {
        throw new AppError('Exame não encontrado', 404);
      }

      assertTenantInstituicao(req, exame.turma?.instituicaoId);

      // Check if nota already exists for this aluno+exame
      const existing = await prisma.nota.findUnique({
        where: {
          alunoId_exameId: { alunoId, exameId }
        }
      });

      if (existing) {
        throw new AppError('Nota já existe para este aluno neste exame', 400);
      }

      // Obter planoEnsinoId: CRÍTICO - usar SEMPRE o plano do professor que está lançando (evita conflito entre professores na mesma turma)
      // Se exame tem planoEnsinoId, validar que pertence ao professor. Senão, buscar plano por turma + professorId.
      const professorIdParaPlano = (req as any).professor?.id;
      const isProfessor = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('SUPER_ADMIN');

      let planoExame: {
        id: string;
        disciplinaId: string;
        turmaId: string | null;
        professorId: string;
        semestreId: string | null;
        pautaStatus?: unknown;
        anoLetivo: number;
      } | null = null;

      if (exame.planoEnsinoId) {
        const plano = await prisma.planoEnsino.findUnique({
          where: { id: exame.planoEnsinoId },
          select: { id: true, disciplinaId: true, turmaId: true, professorId: true, semestreId: true, pautaStatus: true, anoLetivo: true },
        });
        if (plano && isProfessor && professorIdParaPlano && plano.professorId !== professorIdParaPlano) {
          throw new AppError('Este exame pertence a outro professor. Use apenas os exames da sua disciplina.', 403);
        }
        planoExame = plano;
      }

      if (!planoExame) {
        if (isProfessor && !professorIdParaPlano) {
          throw new AppError(
            'Não foi possível identificar o seu perfil de professor. Faça logout, entre novamente e tente lançar a nota.',
            403
          );
        }
        planoExame = await prisma.planoEnsino.findFirst({
          where: {
            turmaId: exame.turma.id,
            instituicaoId: instituicaoId || undefined,
            ...(professorIdParaPlano ? { professorId: professorIdParaPlano } : {}),
          },
          select: { id: true, disciplinaId: true, turmaId: true, professorId: true, semestreId: true, pautaStatus: true, anoLetivo: true },
        });
      }

      if (!planoExame) {
        throw new AppError(
          'Nenhum Plano de Ensino encontrado para a turma deste exame. Vincule um plano à turma antes de lançar notas. ' +
          (isProfessor ? 'Certifique-se de que o plano pertence ao seu perfil de professor.' : ''),
          400
        );
      }

      const turmaIdNota = exame.turma.id;

      const instEnc = instituicaoId || exame.turma.instituicaoId;
      const anoPlanoExame = planoExame.anoLetivo ?? exame.turma.anoLetivoRef?.ano ?? null;
      const trimExame = trimestreNumeroDeExameSecundario(
        String(exame.tipo || exame.nome || '')
      );
      if (trimExame != null && instEnc && anoPlanoExame != null) {
        await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
          tipoAcademico: req.user?.tipoAcademico,
          instituicaoId: instEnc,
          anoLetivo: anoPlanoExame,
          trimestre: trimExame,
          roles: req.user?.roles || [],
        });
        const trimEncerradoExame = await verificarTrimestreEncerrado(instEnc, anoPlanoExame, trimExame);
        if (trimEncerradoExame) {
          throw new AppError(
            `Não é possível lançar notas. O ${trimExame}º trimestre está ENCERRADO. Para reabrir, entre em contato com a direção.`,
            403
          );
        }
      }

      if (instEnc) {
        await assertSuperiorLancamentoExameFinalAcMinima(
          req,
          alunoId,
          planoExame.id,
          instEnc,
          String(exame.tipo || exame.nome || ''),
        );
      }

      // REGRA CRÍTICA INSTITUCIONAL: Bloquear lançamento quando pauta está FECHADA ou APROVADA
      const pautaStatusExame = (planoExame as any)?.pautaStatus ?? null;
      if (pautaStatusExame && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatusExame as any)) {
        const label = pautaStatusExame === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
        throw new AppError(
          `Não é possível lançar nota. A pauta está ${label}. O histórico acadêmico é imutável após fechamento conforme padrão institucional.`,
          403
        );
      }

      // OBRIGATÓRIO: Professor só pode lançar nota se estiver vinculado à disciplina/turma (PlanoEnsino APROVADO)
      if (isProfessor && professorIdParaPlano && instituicaoId) {
        await validarVinculoProfessorDisciplinaTurma(
          instituicaoId,
          professorIdParaPlano,
          planoExame.disciplinaId,
          turmaIdNota,
          'lançar nota',
          planoExame.id
        );
      }
      const componenteExame = `exame-${exameId}`;

      const nota = await prisma.nota.create({
        data: {
          alunoId,
          planoEnsinoId: planoExame.id,
          exameId,
          valor,
          observacoes: observacoes || null,
          lancadoPor: req.user?.userId || null,
          instituicaoId: instituicaoId || null,
          // Campos explícitos para evitar conflito entre professores (institucional)
          estudanteId: alunoId,
          disciplinaId: planoExame.disciplinaId,
          turmaId: turmaIdNota,
          professorId: planoExame.professorId,
          semestreId: planoExame.semestreId,
          componente: componenteExame,
        },
        include: {
          aluno: true,
          exame: {
            include: {
              turma: true
            }
          }
        }
      });

      // Auditoria: Log CREATE
      await AuditService.logCreate(req, {
        modulo: ModuloAuditoria.AVALIACOES_NOTAS,
        entidade: EntidadeAuditoria.NOTA,
        entidadeId: nota.id,
        dadosNovos: nota,
        observacao: `Nota de exame lançada: ${valor}`,
      });

      return res.status(201).json(nota);
    } else {
      // Nova lógica para avaliações
      const avaliacao = await prisma.avaliacao.findFirst({
        where: {
          id: avaliacaoId,
          ...(filter.instituicaoId && { instituicaoId: filter.instituicaoId }),
        },
        include: {
          turma: { select: { instituicaoId: true } },
          planoEnsino: {
            select: {
              professorId: true,
              disciplinaId: true,
              turmaId: true,
              anoLetivo: true,
              anoLetivoId: true,
              pautaStatus: true,
              semestreId: true,
            }
          }
        }
      });

      if (!avaliacao) {
        throw new AppError('Avaliação não encontrada', 404);
      }
      assertTenantInstituicao(req, avaliacao.instituicaoId ?? avaliacao.turma?.instituicaoId);

      // Verificar se avaliação está fechada
      if (avaliacao.fechada) {
        throw new AppError('Não é possível lançar notas em uma avaliação fechada', 400);
      }

      // REGRA CRÍTICA INSTITUCIONAL: Bloquear lançamento quando pauta está FECHADA ou APROVADA
      const pautaStatusAval = (avaliacao.planoEnsino as any)?.pautaStatus ?? null;
      if (pautaStatusAval && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatusAval as any)) {
        const label = pautaStatusAval === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
        throw new AppError(
          `Não é possível lançar nota. A pauta está ${label}. O histórico acadêmico é imutável após fechamento conforme padrão institucional.`,
          403
        );
      }

      // REGRA MESTRA institucional: Validar que Plano de Ensino está ATIVO (APROVADO)
      // NADA acadêmico pode existir sem um PLANO DE ENSINO válido e ATIVO
      const instituicaoIdNota = requireTenantScope(req);
      await validarPlanoEnsinoAtivo(instituicaoIdNota, avaliacao.planoEnsinoId, 'lançar nota');

      // REGRA MESTRA institucional: Validar vínculo Professor-Disciplina-Turma via Plano de Ensino ATIVO
      // Garantir que o professor autenticado está vinculado à disciplina e turma através do plano
      // IMPORTANTE: Sempre validar vínculo - isso garante que o plano tem turma vinculada e está ativo
      // REGRA ARQUITETURAL institucional (OPÇÃO B): Usar req.professor.id do middleware
      if (!req.professor) {
        throw new AppError(messages.professor.naoIdentificado, 500);
      }
      const professorId = req.professor.id;
      
      // Sempre validar vínculo - isso garante que:
      // 1. O plano está ATIVO (APROVADO e não bloqueado)
      // 2. O plano tem turma vinculada (bloqueia disciplinas sem turma)
      // 3. O professor está vinculado corretamente
      await validarVinculoProfessorDisciplinaTurma(
        instituicaoIdNota,
        professorId,
        avaliacao.planoEnsino.disciplinaId,
        avaliacao.turmaId || null,
        'lançar nota',
        avaliacao.planoEnsinoId
      );

      // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno e matrícula na disciplina
      const tipoAcademicoAvaliacao = req.user?.tipoAcademico || null;
      await validarBloqueioAcademicoInstitucionalOuErro(
        alunoId,
        instituicaoIdNota,
        tipoAcademicoAvaliacao,
        avaliacao.planoEnsino.disciplinaId, // Validar matrícula na disciplina
        avaliacao.planoEnsino.anoLetivoId || undefined
      );

      // BLOQUEIO FINANCEIRO (institucional): Se instituição configurou bloquear avaliações por situação financeira
      const bloqueioFinanceiro = await verificarBloqueioAcademico(
        alunoId,
        instituicaoIdNota,
        TipoOperacaoBloqueada.AVALIACOES
      );
      if (bloqueioFinanceiro.bloqueado && bloqueioFinanceiro.motivo) {
        throw new AppError(bloqueioFinanceiro.motivo, 403);
      }

      // REGRA: Ano Letivo é contexto, não dependência técnica
      // Se o plano tiver ano letivo, tentar validar (mas não bloquear se não estiver ativo)
      const planoEnsino = avaliacao.planoEnsino;
      
      if (planoEnsino.anoLetivoId) {
        try {
          await validarAnoLetivoIdAtivo(instituicaoIdNota, planoEnsino.anoLetivoId, 'lançar notas');
        } catch (error) {
          // Não bloquear - ano letivo é contexto, não dependência
          console.warn(`[createNota] Ano letivo do plano não está ativo, mas permitindo lançamento de notas (contexto, não dependência)`);
        }
      } else if (planoEnsino.anoLetivo) {
        // Se não tem anoLetivoId, tentar buscar pelo número do ano (mas não bloquear)
        const anoLetivoRecord = await prisma.anoLetivo.findFirst({
          where: {
            instituicaoId: instituicaoIdNota,
            ano: planoEnsino.anoLetivo,
          },
        });
        if (anoLetivoRecord && anoLetivoRecord.status !== 'ATIVO') {
          // Apenas avisar, não bloquear
          console.warn(`[createNota] Ano letivo ${planoEnsino.anoLetivo} não está ativo, mas permitindo lançamento de notas (contexto, não dependência)`);
        }
        // Se não encontrou ou não está ativo, permitir lançar notas mesmo assim
      }

      const anoLetivoNum = avaliacao.planoEnsino?.anoLetivo ?? null;
      await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
        tipoAcademico: tipoAcademicoAvaliacao,
        instituicaoId: instituicaoIdNota,
        anoLetivo: anoLetivoNum,
        trimestre: avaliacao.trimestre ?? null,
        roles: req.user?.roles || [],
      });

      // VALIDAÇÃO DE BLOQUEIO: Verificar se o trimestre está encerrado
      const trimestreEncerrado = anoLetivoNum != null && avaliacao.trimestre != null
        ? await verificarTrimestreEncerrado(instituicaoIdNota, anoLetivoNum, avaliacao.trimestre)
        : false;

      if (trimestreEncerrado) {
        throw new AppError(
          `Não é possível lançar notas. O ${avaliacao.trimestre}º trimestre está ENCERRADO. Para reabrir, entre em contato com a direção.`,
          403
        );
      }

      // Verificar se nota já existe
      const existing = await prisma.nota.findUnique({
        where: {
          alunoId_avaliacaoId: { alunoId, avaliacaoId }
        }
      });

      if (existing) {
        throw new AppError('Nota já existe para este aluno nesta avaliação', 400);
      }

      // Obter planoEnsinoId e anoLetivoId da avaliação
      const planoEnsinoId = avaliacao.planoEnsinoId;
      const anoLetivoId = avaliacao.planoEnsino?.anoLetivoId || null;

      if (!planoEnsinoId) {
        throw new AppError('Avaliação não possui Plano de Ensino vinculado', 400);
      }

      // REGRA 4: Validar frequência mínima antes de permitir lançamento de notas
      // Calcular frequência do aluno no plano de ensino até a data da avaliação
      try {
        const frequencia = await calcularFrequenciaAluno(
          planoEnsinoId,
          alunoId,
          instituicaoIdNota
        );

        // Verificar se aluno atingiu frequência mínima
        const freqMin = frequencia.frequenciaMinima ?? 0;
        if (frequencia.percentualFrequencia < freqMin) {
          throw new AppError(
            `Não é possível lançar nota. O aluno possui frequência de ${frequencia.percentualFrequencia.toFixed(2)}%, abaixo do mínimo exigido de ${freqMin}%. ` +
            `Total de aulas: ${frequencia.totalAulas}, Presenças: ${frequencia.presencas}, Faltas: ${frequencia.faltas}, Faltas Justificadas: ${frequencia.faltasJustificadas}. ` +
            `É necessário regularizar a frequência antes de lançar notas.`,
            403
          );
        }
      } catch (error: any) {
        // Se o erro já é AppError (frequência insuficiente), propagar
        if (error instanceof AppError && error.statusCode === 403) {
          throw error;
        }
        // Se for erro de cálculo (ex: plano não encontrado), permitir lançar nota mesmo assim
        // (não bloquear por erro técnico, apenas por frequência insuficiente)
        console.warn(`[createNota] Erro ao calcular frequência (não bloqueante):`, error.message);
      }

      // Campos explícitos para evitar conflito entre professores (institucional)
      const turmaIdAvaliacao = avaliacao.turmaId;
      const componenteAvaliacao = `av-${avaliacaoId}`;

      const nota = await prisma.nota.create({
        data: {
          alunoId,
          planoEnsinoId, // OBRIGATÓRIO
          avaliacaoId,
          anoLetivoId, // Opcional: pode vir via PlanoEnsino
          valor,
          observacoes,
          comentarioProfessor: comentarioProfessor?.trim() || null,
          lancadoPor: req.user?.userId,
          ...(instituicaoIdNota && { instituicaoId: instituicaoIdNota }),
          estudanteId: alunoId,
          disciplinaId: avaliacao.planoEnsino.disciplinaId,
          turmaId: turmaIdAvaliacao,
          professorId: avaliacao.planoEnsino.professorId,
          semestreId: avaliacao.planoEnsino.semestreId ?? null,
          componente: componenteAvaliacao,
        },
        include: {
          aluno: true,
          avaliacao: {
            include: {
              turma: {
                include: {
                  disciplina: true,
                  curso: true,
                  classe: true,
                },
              },
            },
          },
        }
      });

      // Auditoria: Log CREATE
      await AuditService.logCreate(req, {
        modulo: ModuloAuditoria.AVALIACOES_NOTAS,
        entidade: EntidadeAuditoria.NOTA,
        entidadeId: nota.id,
        dadosNovos: nota,
        observacao: `Nota de avaliação lançada: ${valor}`,
      });

      // Enviar e-mail de notificação ao aluno (não bloqueia se falhar)
      if (nota.aluno?.email) {
        try {
          await EmailService.sendEmail(
            req,
            nota.aluno.email,
            'NOTA_LANCADA',
            {
              nomeAluno: nota.aluno.nomeCompleto || 'Aluno',
              disciplina: nota.avaliacao?.turma?.disciplina?.nome || 'N/A',
              tipoAvaliacao: nota.avaliacao?.tipo || 'N/A',
              nota: Number(nota.valor),
              turma: nota.avaliacao?.turma?.nome || 'N/A',
            },
            {
              destinatarioNome: nota.aluno.nomeCompleto || undefined,
              instituicaoId: instituicaoId || undefined,
            }
          );
        } catch (emailError: any) {
          // Não quebrar o fluxo se o e-mail falhar
          console.error('[NotaController] Erro ao enviar e-mail de notificação:', emailError.message);
        }
      }

      // Notificação interna: Nota lançada
      try {
        const { NotificacaoService } = await import('../services/notificacao.service.js');
        await NotificacaoService.notificarNotaLancada(
          req,
          alunoId,
          nota.avaliacao?.turma?.disciplina?.nome || 'N/A',
          Number(valor),
          instituicaoId
        );
      } catch (notifError: any) {
        // Não bloquear se notificação falhar
        console.error('[createNota] Erro ao criar notificação (não crítico):', notifError.message);
      }

      // Auditoria: Log CREATE (ação crítica - lançamento de nota)
      await AuditService.logCreate(req, {
        modulo: ModuloAuditoria.AVALIACOES_NOTAS,
        entidade: EntidadeAuditoria.NOTA,
        entidadeId: nota.id,
        dadosNovos: {
          alunoId: nota.alunoId,
          valor: Number(valor),
          avaliacaoId: nota.avaliacaoId,
          exameId: nota.exameId,
        },
        observacao: `Nota ${valor} lançada para aluno ${nota.aluno?.nomeCompleto || alunoId}`,
      });

      return res.status(201).json(nota);
    }
  } catch (error) {
    next(error);
  }
};

/** Estados da pauta que bloqueiam edição de notas (padrão institucional) */
const PAUTA_STATUS_BLOQUEIA_EDICAO = ['FECHADA', 'APROVADA'] as const;

/** Superior: exame final habitualmente na 3ª prova ou texto explícito. */
function isTextoExameFinalSuperior(tipoOuNome: string | null | undefined): boolean {
  const s = String(tipoOuNome || '').trim();
  return (
    /^3\s*[º°o]\s*prova\b/i.test(s) ||
    /\bexame\s*final\b/i.test(s) ||
    /^prova\s*final\b/i.test(s)
  );
}

/**
 * Ensino superior + modelo AC/Exame: opcionalmente bloqueia lançamento da 3ª prova se AC < mínimo (parametrizável).
 */
async function assertSuperiorLancamentoExameFinalAcMinima(
  req: Request,
  alunoId: string,
  planoEnsinoId: string,
  instituicaoIdStr: string,
  tipoOuNomeExame: string,
): Promise<void> {
  if (!isTextoExameFinalSuperior(tipoOuNomeExame)) return;

  let tipoAcademicoCtx: string | null | undefined = req.user?.tipoAcademico ?? undefined;
  if (!tipoAcademicoCtx) {
    const inst = await prisma.instituicao.findUnique({
      where: { id: instituicaoIdStr },
      select: { tipoAcademico: true },
    });
    tipoAcademicoCtx = inst?.tipoAcademico ?? null;
  }
  if (tipoAcademicoCtx !== 'SUPERIOR') return;

  const params = await prisma.parametrosSistema.findUnique({
    where: { instituicaoId: instituicaoIdStr },
    select: {
      superiorModeloCalculo: true,
      superiorBloquearExameSeAcInsuficiente: true,
      superiorNotaMinimaAcContaExame: true,
    },
  });
  if (
    params?.superiorModeloCalculo !== 'AC_EXAME_PONDERADO' ||
    !params.superiorBloquearExameSeAcInsuficiente
  ) {
    return;
  }

  const minAc = Number(params.superiorNotaMinimaAcContaExame ?? 10);
  const ac = await obterMediaAcSuperiorPauta({
    alunoId,
    planoEnsinoId,
    instituicaoId: instituicaoIdStr,
    tipoAcademico: 'SUPERIOR',
    professorId: req.professor?.id,
  });

  if (ac == null) {
    throw new AppError(
      'Lance primeiro a avaliação contínua (1ª/2ª prova, trabalho, testes, participação) antes do exame final.',
      403,
    );
  }
  if (ac < minAc) {
    throw new AppError(
      `Não é possível lançar o exame final: a média da AC (${ac}) é inferior ao mínimo exigido (${minAc}).`,
      403,
    );
  }
}

/** Secundário: extrai 1–3 do texto do exame (ex.: "2º Trimestre — NPT"); não aplica ao superior. */
function trimestreNumeroDeExameSecundario(tipoOuNome: string | null | undefined): number | null {
  const s = String(tipoOuNome || '').trim();
  const m = s.match(/^([123])[º°o]\s*trimestre\b/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Multi-tenant: tipo académico do JWT ou, em falta (ex.: SUPER_ADMIN), o da instituição da turma.
 */
async function resolverTipoAcademicoEfetivo(params: {
  jwtTipo: string | null | undefined;
  turmaId: string | null | undefined;
  instituicaoIdTenant?: string | null;
}): Promise<'SECUNDARIO' | 'SUPERIOR' | null> {
  const j = params.jwtTipo;
  if (j === 'SECUNDARIO' || j === 'SUPERIOR') return j;
  if (!params.turmaId) return null;
  const row = await prisma.turma.findFirst({
    where: {
      id: params.turmaId,
      ...(params.instituicaoIdTenant ? { instituicaoId: params.instituicaoIdTenant } : {}),
    },
    select: { instituicao: { select: { tipoAcademico: true } } },
  });
  const t = row?.instituicao?.tipoAcademico;
  return t === 'SECUNDARIO' || t === 'SUPERIOR' ? t : null;
}

/**
 * Verificar se nota pode ser editada (trimestre não encerrado, pauta não fechada/aprovada)
 */
const verificarNotaEditavel = async (
  notaId: string,
  instituicaoId: string
): Promise<{ editavel: boolean; mensagem?: string }> => {
  const nota = await prisma.nota.findFirst({
    where: {
      id: notaId,
      instituicaoId,
    },
    include: {
      avaliacao: {
        include: {
          planoEnsino: {
            select: {
              anoLetivo: true,
              pautaStatus: true,
            },
          },
        },
      },
      planoEnsino: {
        select: { pautaStatus: true },
      },
    },
  });

  if (!nota || !nota.avaliacao) {
    return { editavel: false, mensagem: 'Nota não encontrada' };
  }

  // REGRA CRÍTICA INSTITUCIONAL: Bloquear edição quando pauta está FECHADA ou APROVADA
  const plano = nota.planoEnsino ?? nota.avaliacao?.planoEnsino;
  const pautaStatus = (plano as any)?.pautaStatus ?? null;
  if (pautaStatus && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatus as any)) {
    const label = pautaStatus === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
    return {
      editavel: false,
      mensagem: `Não é possível editar notas. A pauta está ${label}. O histórico acadêmico é imutável após fechamento.`,
    };
  }

  const anoLetivoVal = nota.avaliacao.planoEnsino?.anoLetivo ?? null;
  const trimestreVal = nota.avaliacao.trimestre ?? null;
  const trimestreEncerrado = anoLetivoVal != null && trimestreVal != null
    ? await verificarTrimestreEncerrado(instituicaoId, anoLetivoVal, trimestreVal)
    : false;

  if (trimestreEncerrado) {
    return {
      editavel: false,
      mensagem: `Não é possível editar notas. O ${nota.avaliacao.trimestre}º trimestre está ENCERRADO.`,
    };
  }

  return { editavel: true };
};

/**
 * Atualizar nota (DEPRECATED - usar corrigirNota para correções)
 * Mantido para compatibilidade, mas cria histórico se valor mudar
 */
export const updateNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const { id } = req.params;
    const { valor, observacoes } = req.body;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL institucional (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const instituicaoId = requireTenantScope(req);

    const existing = await prisma.nota.findFirst({
      where: {
        id,
        ...(filter.instituicaoId && {
          OR: [{ instituicaoId: filter.instituicaoId }, { instituicaoId: null }],
        }),
      },
      include: {
        avaliacao: {
          include: {
            planoEnsino: {
              select: {
                id: true,
                turmaId: true,
                professorId: true,
                anoLetivo: true,
                disciplinaId: true,
              }
            }
          }
        },
        exame: {
          include: {
            turma: {
              select: {
                id: true,
                professorId: true,
                instituicaoId: true
              }
            }
          }
        },
        planoEnsino: {
          select: {
            id: true,
            turmaId: true,
            professorId: true,
            cursoId: true,
            classeId: true,
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Nota não encontrada', 404);
    }
    assertTenantInstituicao(req, existing.instituicaoId ?? (existing.exame?.turma as any)?.instituicaoId ?? (existing.avaliacao as any)?.instituicaoId);

    // Verificar permissão: professor só pode atualizar notas de seus planos de ensino
    if (isProfessor && professorId) {
      const planoEnsinoId = existing.planoEnsinoId;
      if (!planoEnsinoId) {
        throw new AppError('Nota não vinculada a um Plano de Ensino', 400);
      }

      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          id: planoEnsinoId,
          professorId,
          ...filter,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        throw new AppError('Você não tem permissão para atualizar esta nota. A nota deve estar vinculada ao seu Plano de Ensino.', 403);
      }
    }

    // Verificar instituição (multi-tenant)
    if (filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado', 403);
    }

    // JANELA DE LANÇAMENTO: Validar período ativo para edição de observações
    const instIdUpdate = existing.instituicaoId ?? instituicaoId;
    if (instIdUpdate) {
      const janela = await validarJanelaLancamentoNotas(instIdUpdate);
      if (!janela.permitido) {
        throw new AppError(janela.motivo || 'Período de lançamento de notas não está aberto.', 403);
      }
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno antes de atualizar
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // Buscar disciplinaId e anoLetivoId do plano de ensino vinculado à nota
    let disciplinaIdUpdate: string | undefined = undefined;
    let anoLetivoIdUpdate: string | undefined = undefined;
    
    let planoEnsino: { cursoId: string | null; classeId: string | null } | null = null;
    if (existing.planoEnsinoId) {
      const planoEnsinoDetalhes = await prisma.planoEnsino.findUnique({
        where: { id: existing.planoEnsinoId },
        select: { disciplinaId: true, anoLetivoId: true, cursoId: true, classeId: true }
      });
      disciplinaIdUpdate = planoEnsinoDetalhes?.disciplinaId;
      anoLetivoIdUpdate = planoEnsinoDetalhes?.anoLetivoId || undefined;
      planoEnsino = planoEnsinoDetalhes;
    }

    await validarBloqueioAcademicoInstitucionalOuErro(
      existing.alunoId,
      instituicaoId,
      tipoAcademico,
      disciplinaIdUpdate,
      anoLetivoIdUpdate
    );

    // REGRA CRÍTICA institucional: Bloquear edição de notas após conclusão do curso
    if (planoEnsino) {
      const instId = existing.instituicaoId ?? instituicaoId;
      const verificacao = await verificarAlunoConcluido(
        existing.alunoId,
        planoEnsino.cursoId || null,
        planoEnsino.classeId || null,
        instId
      );

      if (verificacao.concluido) {
        throw new AppError(
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Notas não podem ser editadas após conclusão. O histórico acadêmico é imutável conforme padrão institucional.`,
          403
        );
      }
    }

    // REGRA CRÍTICA institucional: Mudança de valor DEVE usar endpoint de correção
    // updateNota apenas para atualizar observacoes (sem mudança de valor)
    if (valor !== undefined) {
      const valorMudou = existing.valor.toString() !== valor.toString();
      if (valorMudou) {
        throw new AppError(
          'Não é permitido alterar o valor da nota diretamente. Use o endpoint de correção (/notas/:id/corrigir) que exige motivo obrigatório e cria histórico imutável conforme padrão institucional.',
          400
        );
      }
      // Se valor não mudou, permitir apenas para compatibilidade (mas não atualizar)
    }

    // updateNota apenas atualiza observacoes (sem mudança de valor)
    const nota = await prisma.nota.update({
      where: { id },
      data: {
        ...(observacoes !== undefined && { observacoes })
      },
      include: {
        aluno: true,
        avaliacao: {
          include: {
            planoEnsino: {
              select: {
                disciplina: { select: { nome: true } },
              }
            }
          }
        },
        exame: {
          include: {
            turma: true
          }
        },
        planoEnsino: {
          select: {
            disciplina: { select: { nome: true } },
          }
        },
        historico: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
              }
            }
          },
          take: 5, // Últimas 5 correções
        }
      }
    });

    // Auditoria: Log UPDATE
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.NOTA,
      entidadeId: id,
      dadosAnteriores: existing,
      dadosNovos: nota,
      observacao: `Observações da nota atualizadas (sem mudança de valor)`,
    });

    res.json(nota);
  } catch (error) {
    next(error);
  }
};

/**
 * Corrigir nota (método oficial para correções)
 * Cria histórico obrigatório e exige motivo
 * POST /notas/:id/corrigir
 */
export const corrigirNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const { id } = req.params;
    const { valor, motivo, observacoes, comentarioProfessor } = req.body;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL institucional (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const isAdmin =
      req.user?.roles?.includes('ADMIN') ||
      req.user?.roles?.includes('SUPER_ADMIN') ||
      req.user?.roles?.includes('DIRECAO');
    const instituicaoId = requireTenantScope(req);

    // JANELA DE LANÇAMENTO: Validar período ativo antes de corrigir nota
    if (instituicaoId) {
      const janela = await validarJanelaLancamentoNotas(instituicaoId);
      if (!janela.permitido) {
        throw new AppError(janela.motivo || 'Período de lançamento de notas não está aberto.', 403);
      }
    }

    // Validações: valor ou comentarioProfessor deve ser fornecido
    const temComentario = comentarioProfessor !== undefined && comentarioProfessor !== null;
    if (valor === undefined && !temComentario) {
      throw new AppError('Informe valor ou comentarioProfessor para atualizar', 400);
    }
    if (valor !== undefined && (valor < 0 || valor > 20)) {
      throw new AppError('Valor da nota deve estar entre 0 e 20', 400);
    }
    // Motivo obrigatório quando valor é alterado (validado mais abaixo)

    // Buscar nota existente (sempre filtrar por instituição)
    const existing = await prisma.nota.findFirst({
      where: {
        id,
        ...(filter.instituicaoId && {
          OR: [{ instituicaoId: filter.instituicaoId }, { instituicaoId: null }],
        }),
      },
      include: {
        avaliacao: {
          include: {
            planoEnsino: {
              select: {
                id: true,
                turmaId: true,
                professorId: true,
                anoLetivo: true,
                disciplinaId: true,
              }
            }
          }
        },
        exame: {
          select: {
            tipo: true,
            nome: true,
            turma: {
              select: {
                id: true,
                professorId: true,
                instituicaoId: true,
                anoLetivoRef: { select: { ano: true } },
              }
            }
          }
        },
        planoEnsino: {
          select: {
            id: true,
            turmaId: true,
            professorId: true,
            cursoId: true,
            classeId: true,
            pautaStatus: true,
            anoLetivo: true,
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Nota não encontrada', 404);
    }
    assertTenantInstituicao(req, existing.instituicaoId ?? (existing.exame?.turma as any)?.instituicaoId ?? (existing.avaliacao as any)?.instituicaoId);

    const turmaIdParaTipoAcademico =
      existing.avaliacao?.planoEnsino?.turmaId ??
      existing.exame?.turma?.id ??
      existing.planoEnsino?.turmaId ??
      null;
    const tipoAcademico = await resolverTipoAcademicoEfetivo({
      jwtTipo: req.user?.tipoAcademico,
      turmaId: turmaIdParaTipoAcademico,
      instituicaoIdTenant: instituicaoId,
    });

    // REGRA CRÍTICA INSTITUCIONAL: Bloquear correção quando pauta está FECHADA ou APROVADA
    const pautaStatusCorrecao = (existing.planoEnsino as any)?.pautaStatus ?? (existing.avaliacao as any)?.planoEnsino?.pautaStatus ?? null;
    if (pautaStatusCorrecao && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatusCorrecao as any)) {
      const label = pautaStatusCorrecao === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
      throw new AppError(
        `Não é possível corrigir nota. A pauta está ${label}. O histórico acadêmico é imutável após fechamento conforme padrão institucional.`,
        403
      );
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno antes de corrigir nota
    // tipoAcademico já resolvido (JWT ou instituição da turma)
    // Buscar disciplinaId e anoLetivoId do plano de ensino vinculado à nota
    let disciplinaIdCorrecao: string | undefined = undefined;
    let anoLetivoIdCorrecao: string | undefined = undefined;
    
    const planoEnsino = existing.planoEnsino;
    if (planoEnsino) {
      const planoEnsinoDetalhes = await prisma.planoEnsino.findUnique({
        where: { id: planoEnsino.id },
        select: { disciplinaId: true, anoLetivoId: true }
      });
      disciplinaIdCorrecao = planoEnsinoDetalhes?.disciplinaId;
      anoLetivoIdCorrecao = planoEnsinoDetalhes?.anoLetivoId || undefined;
    }

    await validarBloqueioAcademicoInstitucionalOuErro(
      existing.alunoId,
      instituicaoId,
      tipoAcademico,
      disciplinaIdCorrecao,
      anoLetivoIdCorrecao
    );

    // BLOQUEIO FINANCEIRO (institucional): Se instituição configurou bloquear avaliações por situação financeira
    const bloqueioFinanceiroCorrecao = await verificarBloqueioAcademico(
      existing.alunoId,
      instituicaoId,
      TipoOperacaoBloqueada.AVALIACOES
    );
    if (bloqueioFinanceiroCorrecao.bloqueado && bloqueioFinanceiroCorrecao.motivo) {
      throw new AppError(bloqueioFinanceiroCorrecao.motivo, 403);
    }

    // REGRA CRÍTICA institucional: Bloquear correção de notas após conclusão do curso
    if (planoEnsino) {
      const instId = existing.instituicaoId ?? instituicaoId;
      const verificacao = await verificarAlunoConcluido(
        existing.alunoId,
        planoEnsino.cursoId || null,
        planoEnsino.classeId || null,
        instId
      );

      if (verificacao.concluido) {
        throw new AppError(
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Notas não podem ser corrigidas após conclusão. O histórico acadêmico é imutável conforme padrão institucional.`,
          403
        );
      }
    }

    // Verificar permissão: professor só pode corrigir notas de seus planos de ensino
    if (isProfessor && professorId && !isAdmin) {
      const planoEnsinoId = existing.planoEnsinoId;
      if (!planoEnsinoId) {
        throw new AppError('Nota não vinculada a um Plano de Ensino', 400);
      }

      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          id: planoEnsinoId,
          professorId,
          ...filter,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        throw new AppError('Você não tem permissão para corrigir esta nota. A nota deve estar vinculada ao seu Plano de Ensino.', 403);
      }
    }

    // Verificar se valor ou comentarioProfessor mudou
    const valorDecimal = valor !== undefined ? new Decimal(valor) : existing.valor;
    const valorMudou = valor !== undefined && existing.valor.toString() !== valorDecimal.toString();
    const comentarioMudou = comentarioProfessor !== undefined && (comentarioProfessor?.trim() || null) !== (existing.comentarioProfessor || null);
    if (!valorMudou && !comentarioMudou) {
      throw new AppError('O valor da correção deve ser diferente do valor atual ou informe um comentário', 400);
    }

    // Se apenas comentário mudou (sem alterar valor), não exige motivo nem cria histórico
    if (!valorMudou && comentarioMudou) {
      const notaAtualizada = await prisma.nota.update({
        where: { id },
        data: { comentarioProfessor: comentarioProfessor?.trim() || null },
        include: {
          aluno: { select: { id: true, nomeCompleto: true, numeroIdentificacao: true } },
          avaliacao: { include: { planoEnsino: { select: { disciplina: { select: { nome: true } } } } } },
          planoEnsino: { select: { disciplina: { select: { nome: true } } } },
        },
      });
      return res.json(notaAtualizada);
    }

    // Motivo obrigatório quando valor muda
    if (!motivo || motivo.trim() === '') {
      throw new AppError('Motivo da correção é obrigatório quando o valor da nota é alterado', 400);
    }

    if (valorMudou && existing.avaliacao) {
      const anoSeq = existing.avaliacao.planoEnsino?.anoLetivo ?? null;
      await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
        tipoAcademico,
        instituicaoId,
        anoLetivo: anoSeq,
        trimestre: existing.avaliacao.trimestre ?? null,
        roles: req.user?.roles || [],
      });
    }

    if (valorMudou && existing.exame && !existing.avaliacao) {
      const trimEx = trimestreNumeroDeExameSecundario(
        String(existing.exame.tipo || existing.exame.nome || '')
      );
      const anoSeqEx =
        existing.planoEnsino?.anoLetivo ?? existing.exame.turma?.anoLetivoRef?.ano ?? null;
      await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
        tipoAcademico,
        instituicaoId,
        anoLetivo: anoSeqEx,
        trimestre: trimEx,
        roles: req.user?.roles || [],
      });
    }

    // VALIDAÇÃO CRÍTICA: período encerrado (avaliação ou exame com trimestre no nome)
    if (existing.avaliacao) {
      const anoL = existing.avaliacao.planoEnsino?.anoLetivo ?? null;
      const trim = existing.avaliacao.trimestre ?? null;
      const trimestreEncerrado = anoL != null && trim != null
        ? await verificarTrimestreEncerrado(instituicaoId, anoL, trim)
        : false;

      if (trimestreEncerrado) {
        if (!isAdmin) {
          throw new AppError(
            `Não é possível corrigir nota. O ${existing.avaliacao.trimestre}º trimestre está ENCERRADO. Apenas ADMIN, DIRECAO ou SUPER_ADMIN podem corrigir notas de períodos encerrados.`,
            403
          );
        }
        if (motivo.trim().length < 20) {
          throw new AppError(
            'Para corrigir nota de período encerrado, é necessário fornecer uma justificativa administrativa detalhada (mínimo 20 caracteres).',
            400
          );
        }
      }
    } else if (existing.exame) {
      const trimEx = trimestreNumeroDeExameSecundario(
        String(existing.exame.tipo || existing.exame.nome || '')
      );
      const anoL = existing.planoEnsino?.anoLetivo ?? existing.exame.turma?.anoLetivoRef?.ano ?? null;
      const trimestreEncerradoEx =
        anoL != null && trimEx != null
          ? await verificarTrimestreEncerrado(instituicaoId, anoL, trimEx)
          : false;

      if (trimestreEncerradoEx) {
        if (!isAdmin) {
          throw new AppError(
            `Não é possível corrigir nota. O ${trimEx}º trimestre está ENCERRADO. Apenas ADMIN, DIRECAO ou SUPER_ADMIN podem corrigir notas de períodos encerrados.`,
            403
          );
        }
        if (motivo.trim().length < 20) {
          throw new AppError(
            'Para corrigir nota de período encerrado, é necessário fornecer uma justificativa administrativa detalhada (mínimo 20 caracteres).',
            400
          );
        }
      }
    }

    // REGRA CRÍTICA: Criar histórico ANTES de atualizar (imutável)
    const historico = await prisma.notaHistorico.create({
      data: {
        notaId: id,
        valorAnterior: existing.valor,
        valorNovo: valorDecimal,
        motivo: motivo.trim(),
        observacoes: observacoes || null,
        // REGRA ARQUITETURAL institucional: Usar req.professor.id (professores.id) do middleware resolveProfessorMiddleware
        // NÃO usar req.user?.userId como fallback - lógica híbrida removida
        corrigidoPor: professorId || req.professor?.id || req.user?.userId || '',
        instituicaoId: instituicaoId || existing.instituicaoId || null,
      },
    });

    // Atualizar nota (valor atual + comentário professor se fornecido)
    const nota = await prisma.nota.update({
      where: { id },
      data: {
        valor: valorDecimal,
        observacoes: observacoes || existing.observacoes,
        comentarioProfessor: comentarioProfessor !== undefined ? (comentarioProfessor?.trim() || null) : existing.comentarioProfessor,
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacao: true,
          }
        },
        avaliacao: {
          include: {
            planoEnsino: {
              select: {
                disciplina: { select: { nome: true } },
              }
            }
          }
        },
        exame: {
          include: {
            turma: true
          }
        },
        planoEnsino: {
          select: {
            disciplina: { select: { nome: true } },
          }
        },
        historico: {
          orderBy: { createdAt: 'desc' },
          include: {
            usuario: {
              select: {
                id: true,
                nomeCompleto: true,
                email: true,
              }
            }
          },
          take: 10, // Últimas 10 correções
        }
      }
    });

    // Auditoria: Log CORREÇÃO
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.AVALIACOES_NOTAS,
      entidade: EntidadeAuditoria.NOTA,
      entidadeId: id,
      dadosAnteriores: existing,
      dadosNovos: nota,
      observacao: `Nota corrigida: ${existing.valor} → ${valor}. Motivo: ${motivo}`,
    });

    res.status(200).json({
      nota,
      historico,
      message: 'Nota corrigida com sucesso. Histórico preservado.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter histórico de correções de uma nota
 * GET /notas/:id/historico
 */
export const getHistoricoNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Buscar nota e verificar permissão (multi-tenant)
    const nota = await prisma.nota.findFirst({
      where: {
        id,
        ...(filter.instituicaoId && {
          OR: [{ instituicaoId: filter.instituicaoId }, { instituicaoId: null }],
        }),
      },
      select: {
        id: true,
        valor: true,
        professorId: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
          }
        },
        planoEnsino: {
          select: {
            professorId: true,
            disciplina: {
              select: {
                nome: true,
              }
            }
          }
        }
      }
    });

    if (!nota) {
      throw new AppError('Nota não encontrada', 404);
    }

    // RBAC: PROFESSOR só vê histórico de notas dos seus planos
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    if (isProfessor && professorId) {
      const pertenceAoProfessor =
        nota.professorId === professorId || nota.planoEnsino?.professorId === professorId;
      if (!pertenceAoProfessor) {
        throw new AppError('Acesso negado: você só pode visualizar histórico de notas das suas disciplinas', 403);
      }
    }

    // Buscar histórico completo
    const historico = await prisma.notaHistorico.findMany({
      where: {
        notaId: id,
        ...(filter.instituicaoId && { instituicaoId: filter.instituicaoId }),
      },
      include: {
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      nota: {
        id: nota.id,
        valorAtual: nota.valor,
        aluno: nota.aluno,
        disciplina: nota.planoEnsino?.disciplina?.nome,
      },
      historico,
      totalCorrecoes: historico.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Bloquear DELETE de notas - Histórico imutável
 * Notas nunca devem ser deletadas, apenas corrigidas
 * REGRA institucional: Histórico acadêmico é imutável
 */
export const deleteNota = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Notas não podem ser deletadas. O histórico acadêmico é imutável conforme padrão institucional. Use o endpoint de correção (/notas/:id/corrigir) para ajustar valores.',
    403
  );
};

export const getNotasByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alunoId = req.user?.userId;
    const filter = addInstitutionFilter(req);

    if (!alunoId) {
      return res.json([]);
    }

    // BLOQUEIO: Aluno inadimplente não pode ver notas
    const instituicaoId = getInstituicaoIdFromFilter(filter);
    if (instituicaoId) {
      const bloqueio = await verificarBloqueioAcademico(alunoId, instituicaoId, TipoOperacaoBloqueada.PAUTA_NOTAS);
      if (bloqueio.bloqueado) {
        throw new AppError(bloqueio.motivo || 'Acesso às notas bloqueado devido a situação financeira irregular.', 403);
      }
    }

    // Additional security: verify aluno belongs to institution
    if (filter.instituicaoId) {
      const aluno = await prisma.user.findFirst({
        where: {
          id: alunoId,
          instituicaoId: filter.instituicaoId
        }
      });

      if (!aluno) {
        return res.json([]);
      }
    }

    // Filtrar por instituição no where (nota.instituicaoId) para refletir todas as notas da instituição
    const whereNotas: Record<string, unknown> = { alunoId };
    if (filter.instituicaoId) {
      whereNotas.OR = [
        { instituicaoId: filter.instituicaoId },
        { instituicaoId: null },
      ];
    }

    const notas = await prisma.nota.findMany({
      where: whereNotas as { alunoId: string; OR?: Array<{ instituicaoId: string | null }> },
      include: {
        exame: {
          include: {
            turma: {
              include: {
                disciplina: true,
                curso: true,
                instituicao: { select: { id: true } }
              }
            }
          }
        },
        avaliacao: {
          include: {
            planoEnsino: {
              include: {
                turma: {
                  include: {
                    disciplina: true,
                    curso: true,
                    instituicao: { select: { id: true } }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter by institution if needed (extra security layer)
    type NotaComRelacoes = typeof notas[number];
    const getTurmaInstituicaoId = (n: NotaComRelacoes): string | null => {
      const exameTurma = (n as any).exame?.turma;
      const avaliacaoPlano = (n as any).avaliacao?.planoEnsino?.turma;
      return exameTurma?.instituicaoId ?? exameTurma?.instituicao?.id ?? avaliacaoPlano?.instituicaoId ?? avaliacaoPlano?.instituicao?.id ?? null;
    };
    const filtered = filter.instituicaoId
      ? notas.filter(n => getTurmaInstituicaoId(n) === filter.instituicaoId)
      : notas;

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};

export const createNotasEmLote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const { notas } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!Array.isArray(notas) || notas.length === 0) {
      throw new AppError('Lista de notas inválida', 400);
    }

    // Validate all notas
    for (const nota of notas) {
      if (!nota.alunoId) {
        throw new AppError('alunoId é obrigatório para cada nota', 400);
      }
      if (!nota.exameId) {
        throw new AppError('exameId é obrigatório para cada nota', 400);
      }
      if (nota.valor === undefined || nota.valor === null) {
        throw new AppError('Valor da nota é obrigatório', 400);
      }
      if (nota.valor < 0 || nota.valor > 20) {
        throw new AppError('Valores das notas devem estar entre 0 e 20', 400);
      }
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode lançar notas para cada exame
    // Pegar o primeiro exameId para validar (todos devem ser do mesmo contexto)
    const primeiroExameId = notas[0]?.exameId;
    if (primeiroExameId) {
      await validarPermissaoNota(req, undefined, primeiroExameId);
    }

    // REGRA: Professor deve estar identificado (req.professor) para que a nota seja gravada no SEU plano
    // Sem isto, a nota seria associada ao primeiro plano da turma e não refletiria no painel do professor
    const isProfessor = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('SUPER_ADMIN');
    if (isProfessor && !(req as any).professor?.id) {
      throw new AppError(
        'Não foi possível identificar o seu perfil de professor. Faça logout, entre novamente e tente lançar a nota. Se o problema continuar, contacte a direção para verificar o seu vínculo como professor.',
        403
      );
    }

    const instituicaoIdLote = requireTenantScope(req);
    const tipoAcademicoLote = req.user?.tipoAcademico || null;
    const instituicaoIdFinal = requireTenantScope(req);

    // Buscar exame com plano/ano para validar trimestre/semestre
    let disciplinaIdExame: string | undefined = undefined;
    let tipoPeriodoNumero: { tipoPeriodo: string; numeroPeriodo: number } | undefined;
    let anoLetivoNum: number | null = null;
    let tipoAcademicoEfetivoLote: string | null | undefined = tipoAcademicoLote ?? undefined;

    if (primeiroExameId) {
      const exame = await prisma.exame.findUnique({
        where: { id: primeiroExameId },
        include: {
          turma: {
            include: {
              disciplina: { select: { id: true } },
              anoLetivoRef: { select: { ano: true } },
              instituicao: { select: { tipoAcademico: true } },
            }
          },
          planoEnsino: {
            select: {
              semestreId: true,
              anoLetivoRef: { select: { ano: true } },
              pautaStatus: true,
            }
          }
        }
      });
      disciplinaIdExame = exame?.turma?.disciplina?.id;
      anoLetivoNum = exame?.turma?.anoLetivoRef?.ano ?? exame?.planoEnsino?.anoLetivoRef?.ano ?? null;
      tipoAcademicoEfetivoLote =
        tipoAcademicoEfetivoLote || exame?.turma?.instituicao?.tipoAcademico || undefined;

      const tipoExame = (exame?.tipo ?? exame?.nome ?? '').trim();
      const tipoInst = (exame?.turma?.instituicao?.tipoAcademico ?? tipoAcademicoLote ?? '').toString().toUpperCase();

      const mTrim = tipoExame.match(/^([123])[º°o]\s*trimestre/i);
      if (mTrim) {
        tipoPeriodoNumero = { tipoPeriodo: 'TRIMESTRE', numeroPeriodo: parseInt(mTrim[1], 10) };
      } else if (tipoInst === 'SUPERIOR' && exame?.planoEnsino?.semestreId) {
        const sem = await prisma.semestre.findUnique({
          where: { id: exame.planoEnsino.semestreId },
          select: { numero: true },
        });
        if (sem?.numero) {
          tipoPeriodoNumero = { tipoPeriodo: 'SEMESTRE', numeroPeriodo: sem.numero };
        }
      } else if (tipoExame.match(/^([12])[ªa]\s*prova/i)) {
        const m = tipoExame.match(/^([12])/i);
        if (m) tipoPeriodoNumero = { tipoPeriodo: 'SEMESTRE', numeroPeriodo: parseInt(m[1], 10) };
      }

      // REGRA CRÍTICA INSTITUCIONAL: Bloquear lançamento quando pauta está FECHADA ou APROVADA
      let pautaStatusLote: string | null = (exame?.planoEnsino as any)?.pautaStatus ?? null;
      if (!pautaStatusLote && exame?.turma?.id) {
        const planoFallback = await prisma.planoEnsino.findFirst({
          where: { turmaId: exame.turma.id },
          select: { pautaStatus: true },
        });
        pautaStatusLote = planoFallback?.pautaStatus ?? null;
      }
      if (pautaStatusLote && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatusLote as any)) {
        const label = pautaStatusLote === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
        throw new AppError(
          `Não é possível lançar notas. A pauta está ${label}. O histórico acadêmico é imutável após fechamento conforme padrão institucional.`,
          403
        );
      }
    }

    // JANELA DE LANÇAMENTO: Validar período ativo (e que corresponde ao trimestre/semestre da nota)
    if (instituicaoIdLote) {
      const janela = await validarJanelaLancamentoNotas(instituicaoIdLote, tipoPeriodoNumero);
      if (!janela.permitido) {
        throw new AppError(janela.motivo || 'Período de lançamento de notas não está aberto.', 403);
      }
    }

    // Secundário: sequência I → II → III (paridade com lançamento por avaliação)
    if (
      instituicaoIdLote &&
      anoLetivoNum != null &&
      tipoPeriodoNumero?.tipoPeriodo === 'TRIMESTRE'
    ) {
      await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
        tipoAcademico: tipoAcademicoEfetivoLote,
        instituicaoId: instituicaoIdLote,
        anoLetivo: anoLetivoNum,
        trimestre: tipoPeriodoNumero.numeroPeriodo,
        roles: req.user?.roles || [],
      });
    }

    // TRIMESTRE/SEMESTRE ENCERRADO: Rejeitar se o período está encerrado
    if (instituicaoIdLote && anoLetivoNum != null && tipoPeriodoNumero) {
      if (tipoPeriodoNumero.tipoPeriodo === 'TRIMESTRE') {
        const encerrado = await verificarTrimestreEncerrado(instituicaoIdLote, anoLetivoNum, tipoPeriodoNumero.numeroPeriodo);
        if (encerrado) {
          throw new AppError(
            `Não é possível lançar notas. O ${tipoPeriodoNumero.numeroPeriodo}º trimestre está ENCERRADO. Só é possível lançar notas no trimestre aberto ou ativo.`,
            403
          );
        }
      } else if (tipoPeriodoNumero.tipoPeriodo === 'SEMESTRE') {
        const encerrado = await verificarSemestreEncerrado(instituicaoIdLote, anoLetivoNum, tipoPeriodoNumero.numeroPeriodo);
        if (encerrado) {
          throw new AppError(
            `Não é possível lançar notas. O ${tipoPeriodoNumero.numeroPeriodo}º semestre está ENCERRADO. Só é possível lançar notas no semestre aberto ou ativo.`,
            403
          );
        }
      }
    }

    // Validar cada aluno antes de processar
    for (const nota of notas) {
      if (nota.alunoId) {
        await validarBloqueioAcademicoInstitucionalOuErro(
          nota.alunoId,
          instituicaoIdFinal,
          tipoAcademicoLote,
          disciplinaIdExame
        );
        // BLOQUEIO FINANCEIRO (institucional): Se instituição configurou bloquear avaliações por situação financeira
        const bloqueioLoteExame = await verificarBloqueioAcademico(
          nota.alunoId,
          instituicaoIdFinal,
          TipoOperacaoBloqueada.AVALIACOES
        );
        if (bloqueioLoteExame.bloqueado && bloqueioLoteExame.motivo) {
          throw new AppError(bloqueioLoteExame.motivo, 403);
        }
      }
    }

    // Use transaction to handle upserts (create or update)
    const results = await Promise.all(
      notas.map(async (n: any) => {
        const existing = await prisma.nota.findUnique({
          where: {
            alunoId_exameId: {
              alunoId: n.alunoId,
              exameId: n.exameId
            }
          }
        });

        if (existing) {
          return await prisma.nota.update({
            where: { id: existing.id },
            data: {
              valor: n.valor,
              observacoes: n.observacoes,
              lancadoPor: req.user?.userId
            }
          });
        } else {
          const exameN = await prisma.exame.findUnique({
            where: { id: n.exameId },
            select: { turmaId: true, planoEnsinoId: true, tipo: true, nome: true },
          });
          // CRÍTICO: usar SEMPRE o plano do professor que está lançando (req.professor.id). Nunca usar o primeiro plano da turma.
          const professorIdParaPlano = (req as any).professor?.id;
          if (!exameN) {
            throw new AppError(`Exame ${n.exameId} não encontrado.`, 404);
          }
          // Se o exame já está vinculado a um plano (ex.: "1º Trimestre" por plano), usar esse plano para a nota
          const planoSelect = { id: true, disciplinaId: true, turmaId: true, professorId: true, semestreId: true };
          let planoN: { id: string; disciplinaId: string; turmaId: string | null; professorId: string; semestreId: string | null } | null = exameN.planoEnsinoId
            ? await prisma.planoEnsino.findUnique({
                where: { id: exameN.planoEnsinoId },
                select: planoSelect,
              })
            : null;
          if (planoN && exameN.planoEnsinoId && isProfessor && professorIdParaPlano && planoN.professorId !== professorIdParaPlano) {
            throw new AppError('Este exame pertence a outro professor. Use apenas os exames da sua disciplina.', 403);
          }
          if (!planoN) {
            // Professor: obrigatório estar identificado para a nota ir para o SEU plano. ADMIN pode usar primeiro plano da turma.
            if (isProfessor && !professorIdParaPlano) {
              throw new AppError(
                'Para lançar notas por exame é necessário estar identificado como professor (cada nota fica associada ao seu plano de ensino). Faça login como professor ou contacte a direção.',
                403
              );
            }
            planoN = await prisma.planoEnsino.findFirst({
              where: {
                turmaId: exameN.turmaId,
                instituicaoId: instituicaoIdFinal,
                ...(professorIdParaPlano ? { professorId: professorIdParaPlano } : {}),
              },
              select: planoSelect,
            });
            // Fallback 1: plano pode estar com instituicaoId da turma em vez do tenant do JWT
            if (!planoN && instituicaoIdFinal) {
              const turmaInst = await prisma.turma.findUnique({
                where: { id: exameN.turmaId },
                select: { instituicaoId: true },
              });
              if (turmaInst?.instituicaoId && turmaInst.instituicaoId !== instituicaoIdFinal) {
                planoN = await prisma.planoEnsino.findFirst({
                  where: {
                    turmaId: exameN.turmaId,
                    instituicaoId: turmaInst.instituicaoId,
                    ...(professorIdParaPlano ? { professorId: professorIdParaPlano } : {}),
                  },
                  select: planoSelect,
                });
              }
            }
            // Fallback 2 (painel do professor): buscar plano só por turma + professor
            if (!planoN && professorIdParaPlano) {
              planoN = await prisma.planoEnsino.findFirst({
                where: {
                  turmaId: exameN.turmaId,
                  professorId: professorIdParaPlano,
                },
                select: planoSelect,
              });
            }
          }
          if (!planoN) {
            throw new AppError(
              'Nenhum Plano de Ensino seu encontrado para esta turma. Só pode lançar notas nas disciplinas em que é o professor responsável. Verifique em Configuração de Ensino > Plano de Ensino se tem um plano para esta turma e disciplina.',
              400
            );
          }
          // OBRIGATÓRIO: Professor só pode lançar nota se estiver vinculado à disciplina/turma (PlanoEnsino APROVADO)
          if (isProfessor && professorIdParaPlano && instituicaoIdFinal) {
            await validarVinculoProfessorDisciplinaTurma(
              instituicaoIdFinal,
              professorIdParaPlano,
              planoN.disciplinaId,
              exameN.turmaId,
              'lançar nota por exame',
              planoN.id
            );
          }
          const instituicaoIdNota = instituicaoId || instituicaoIdFinal || null;
          await assertSuperiorLancamentoExameFinalAcMinima(
            req,
            n.alunoId,
            planoN.id,
            instituicaoIdFinal,
            String(exameN.tipo || exameN.nome || ''),
          );
          const componenteExame = `exame-${n.exameId}`;
          return await prisma.nota.create({
            data: {
              alunoId: n.alunoId,
              planoEnsinoId: planoN.id,
              exameId: n.exameId,
              valor: n.valor,
              observacoes: n.observacoes || null,
              lancadoPor: req.user?.userId || null,
              ...(instituicaoIdNota && { instituicaoId: instituicaoIdNota }),
              estudanteId: n.alunoId,
              disciplinaId: planoN.disciplinaId,
              turmaId: exameN.turmaId,
              professorId: planoN.professorId,
              semestreId: planoN.semestreId,
              componente: componenteExame,
            },
          });
        }
      })
    );

    res.status(201).json({ count: results.length });
  } catch (error) {
    next(error);
  }
};

/**
 * Endpoint específico para professor buscar alunos e notas de uma turma
 * Retorna alunos matriculados com suas notas organizadas por tipo de avaliação
 */
export const getAlunosNotasByTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { turmaId, planoEnsinoId: planoEnsinoIdQuery } = req.query;
    const filter = addInstitutionFilter(req);
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const planoIdParam =
      typeof planoEnsinoIdQuery === 'string' && planoEnsinoIdQuery.trim() ? planoEnsinoIdQuery.trim() : null;

    if (!turmaId) {
      throw new AppError('turmaId é obrigatório', 400);
    }

    const turmaWhere: any = { id: turmaId as string };
    let professorPlanoIds: string[] | null = null;
    if (isProfessor) {
      if (!professorId) return res.json({ pautaStatus: null, alunos: [] });
      if (planoIdParam) {
        const plano = await prisma.planoEnsino.findFirst({
          where: {
            id: planoIdParam,
            turmaId: turmaId as string,
            professorId,
            ...filter,
          },
          select: { id: true },
        });
        if (!plano) return res.json({ pautaStatus: null, alunos: [] });
        professorPlanoIds = [plano.id];
      } else {
        const planosProfessor = await prisma.planoEnsino.findMany({
          where: {
            turmaId: turmaId as string,
            professorId,
            ...filter,
          },
          select: { id: true },
        });
        if (planosProfessor.length === 0) return res.json({ pautaStatus: null, alunos: [] });
        professorPlanoIds = planosProfessor.map((p) => p.id);
      }
    }
    if (filter.instituicaoId) {
      turmaWhere.instituicaoId = filter.instituicaoId;
    }

    const turma = await prisma.turma.findFirst({
      where: turmaWhere,
      include: {
        disciplina: true,
        curso: true,
        instituicao: {
          select: {
            tipoAcademico: true
          }
        }
      }
    });

    if (!turma) {
      if (isProfessor) {
        return res.json({ pautaStatus: null, alunos: [] });
      }
      throw new AppError('Turma não encontrada ou sem permissão', 404);
    }

    let adminPlanoIds: string[] | null = null;
    if (!isProfessor && planoIdParam) {
      const planoAdmin = await prisma.planoEnsino.findFirst({
        where: {
          id: planoIdParam,
          turmaId: turma.id,
          ...(filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {}),
        },
        select: { id: true },
      });
      if (!planoAdmin) {
        throw new AppError('Plano de ensino não encontrado nesta turma', 404);
      }
      adminPlanoIds = [planoAdmin.id];
    }

    const planoIdsFiltro = professorPlanoIds ?? adminPlanoIds;

    // Buscar matrículas ativas da turma
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId: turma.id,
        status: 'Ativa'
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true
          }
        }
      },
      orderBy: {
        aluno: {
          nomeCompleto: 'asc'
        }
      }
    });

    // Buscar exames: com planoEnsinoId na query = só exames desse plano (evitar mistura). Sem plano = incluir globais para notas já gravadas aparecerem.
    const examesWhere: any = { turmaId: turma.id };
    if (planoIdsFiltro !== null && planoIdsFiltro.length > 0) {
      if (isProfessor && planoIdParam) {
        examesWhere.planoEnsinoId = { in: planoIdsFiltro };
      } else if (isProfessor) {
        examesWhere.OR = [
          { planoEnsinoId: null },
          { planoEnsinoId: { in: planoIdsFiltro } },
        ];
      } else {
        examesWhere.planoEnsinoId = { in: planoIdsFiltro };
      }
    }
    const exames = await prisma.exame.findMany({
      where: examesWhere,
      select: {
        id: true,
        nome: true,
        tipo: true
      }
    });

    const alunoIds = matriculas.map(m => m.aluno.id);
    const exameIds = exames.map(e => e.id);

    // REGRA institucional: Professor vê apenas notas dos SEUS planos de ensino (sua disciplina)
    // EVITAR CONFLITO: João nunca vê notas de Maria, Maria nunca vê notas de João
    const notasWhere: any = {
      alunoId: { in: alunoIds },
      OR: [
        ...(exameIds.length ? [{ exameId: { in: exameIds } }] : []),
        { avaliacao: { turmaId: turma.id } },
      ],
    };
    if (planoIdsFiltro !== null) {
      notasWhere.planoEnsinoId = { in: planoIdsFiltro };
    }
    // Filtro explícito por professorId: João nunca vê notas de Maria, Maria nunca vê notas de João
    if (isProfessor && professorId) {
      notasWhere.AND = [
        ...(notasWhere.AND || []),
        { OR: [{ professorId }, { professorId: null }] },
      ];
    }

    const notas = await prisma.nota.findMany({
      where: notasWhere,
      include: {
        exame: {
          select: {
            id: true,
            tipo: true,
            nome: true
          }
        },
        avaliacao: {
          select: {
            id: true,
            tipo: true,
            nome: true
          }
        }
      }
    });

    const instituicaoId = getInstituicaoIdFromFilter(filter) || '';
    const planoParaMedia = planoIdsFiltro && planoIdsFiltro.length === 1 ? planoIdsFiltro[0] : null;

    // Buscar pautaStatus quando temos um único plano (para exibir estado da pauta no frontend)
    let pautaStatus: string | null = null;
    if (planoParaMedia) {
      const plano = await prisma.planoEnsino.findUnique({
        where: { id: planoParaMedia },
        select: { pautaStatus: true },
      });
      pautaStatus = plano?.pautaStatus ?? null;
    }

    // Organizar dados: aluno -> notas por tipo (com média calculada no servidor quando possível)
    const resultado = await Promise.all(
      matriculas.map(async (matricula) => {
        const alunoNotas = notas.filter(n => n.alunoId === matricula.aluno.id);
        const notasPorTipo: { [tipo: string]: { valor: number; id: string } | null } = {};

        // Inicializar todos os tipos possíveis como null
        const tiposPossiveis = [
          '1ª Prova', '2ª Prova', '3ª Prova', 'Trabalho', 'Exame de Recurso',
          ...TIPOS_SECUNDARIO_TRIMESTRE_LEGADO,
          ...TIPOS_SECUNDARIO_LANCAMENTO_ANGOLA,
          'Prova Final', 'Recuperação',
          'P1', 'P2', 'P3' // Superior: provas parciais
        ];
        tiposPossiveis.forEach(tipo => {
          notasPorTipo[tipo] = null;
        });

        // Preencher com notas existentes (exame ou avaliação)
        // Normalizar tipo (º vs °) e mapear para chave canónica para o frontend mostrar a nota após salvar
        const normalizarTipoNota = (t: string) => String(t || '').trim().replace(/°/g, 'º');
        const tipoParaChaveCanonica = (t: string): string | null => {
          const n = normalizarTipoNota(t);
          if (!n) return null;
          const lower = n.toLowerCase().replace(/ª/g, 'a').replace(/º/g, 'o');
          const match = tiposPossiveis.find(
            (c) => c.toLowerCase().replace(/ª/g, 'a').replace(/º/g, 'o') === lower
          );
          if (match) return match;
          if (tiposPossiveis.includes(n)) return n;
          // Mini-pauta secundário: "1º Trimestre - MAC" (antes do prefixo genérico só "1º Trimestre")
          const mAng = n.match(/^([123])[º°o]\s*trimestre\s*-\s*(MAC|NPP|NPT)\b/i);
          if (mAng) {
            const tr = mAng[1];
            const comp = mAng[2].toUpperCase();
            return `${tr}º Trimestre - ${comp}`;
          }
          // Avaliação com nome "1º Trimestre Matemática" ou "P1 Programação": extrair prefixo
          const m1 = n.match(/^(1[oº°]\s*trimestre)(?!\s*-)/i);
          if (m1) return '1º Trimestre';
          const m2 = n.match(/^(2[oº°]\s*trimestre)(?!\s*-)/i);
          if (m2) return '2º Trimestre';
          const m3 = n.match(/^(3[oº°]\s*trimestre)(?!\s*-)/i);
          if (m3) return '3º Trimestre';
          const mp1 = n.match(/^p1\b/i);
          if (mp1) return 'P1';
          const mp2 = n.match(/^p2\b/i);
          if (mp2) return 'P2';
          const mp3 = n.match(/^p3\b/i);
          if (mp3) return 'P3';
          return null;
        };
        alunoNotas.forEach(nota => {
          const aval = (nota as any).avaliacao;
          const exame = nota.exame;
          // Preferir nome da avaliação (ex: "1º Trimestre Matemática", "P1 Programação") quando tipo não mapeia
          const tipoBruto = aval?.nome ?? aval?.tipo ?? exame?.tipo ?? exame?.nome ?? 'Exame';
          const tipoCanonico = tipoParaChaveCanonica(tipoBruto);
          if (tipoCanonico) {
            notasPorTipo[tipoCanonico] = {
              valor: Number(nota.valor),
              id: nota.id
            };
          }
        });

        // CÁLCULO SEGURO: Média calculada no servidor (fonte única de verdade)
        let mediaFinal: number | null = null;
        let media: number | null = null;
        if (instituicaoId && planoParaMedia) {
          try {
            const resultadoCalc = await calcularMedia({
              alunoId: matricula.aluno.id,
              planoEnsinoId: planoParaMedia,
              professorId: professorId || undefined,
              instituicaoId,
              tipoAcademico: req.user?.tipoAcademico || (turma?.instituicao as any)?.tipoAcademico || null,
            });
            mediaFinal = resultadoCalc.media_final;
            media = resultadoCalc.media_parcial ?? mediaFinal;
          } catch {
            // Manter null em caso de erro (frontend pode calcular localmente como fallback)
          }
        }

        return {
          matricula_id: matricula.id,
          aluno_id: matricula.aluno.id,
          nome_completo: matricula.aluno.nomeCompleto,
          numero_identificacao: matricula.aluno.numeroIdentificacao,
          numero_identificacao_publica: matricula.aluno.numeroIdentificacaoPublica,
          notas: notasPorTipo,
          mediaFinal: mediaFinal != null ? Math.round(mediaFinal * 100) / 100 : null,
          media: media != null ? Math.round(media * 100) / 100 : null,
        };
      })
    );

    // Resposta padronizada: sempre { pautaStatus, alunos } para consistência
    res.json({ pautaStatus, alunos: resultado });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar notas em lote para avaliação
 * POST /notas/avaliacao/lote
 */
export const createNotasAvaliacaoEmLote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    rejectBodyInstituicaoId(req);
    const { avaliacaoId, notas } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!avaliacaoId) {
      throw new AppError('avaliacaoId é obrigatório', 400);
    }

    if (!Array.isArray(notas) || notas.length === 0) {
      throw new AppError('Lista de notas inválida', 400);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode lançar notas
    await validarPermissaoNota(req, avaliacaoId);

    // Verificar se a avaliação existe - MODELO CORRETO: Avaliação SEMPRE pertence ao Plano de Ensino
    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: avaliacaoId,
        ...(filter.instituicaoId && { instituicaoId: filter.instituicaoId }),
      },
      include: {
        turma: {
          include: {
            anoLetivoRef: {
              select: { id: true, ano: true, status: true },
            },
          },
        },
        planoEnsino: {
          select: {
            id: true,
            anoLetivoId: true,
            anoLetivo: true,
            disciplinaId: true,
            professorId: true,
            semestreId: true,
            semestreRef: { select: { numero: true } },
            pautaStatus: true,
          },
        },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
    }
    assertTenantInstituicao(req, avaliacao.instituicaoId ?? (avaliacao.turma as { instituicaoId?: string })?.instituicaoId);

    // REGRA CRÍTICA INSTITUCIONAL: Bloquear lançamento quando pauta está FECHADA ou APROVADA
    const pautaStatusLote = (avaliacao.planoEnsino as any)?.pautaStatus ?? null;
    if (pautaStatusLote && PAUTA_STATUS_BLOQUEIA_EDICAO.includes(pautaStatusLote as any)) {
      const label = pautaStatusLote === 'FECHADA' ? 'FECHADA (definitiva)' : 'APROVADA (pelo conselho)';
      throw new AppError(
        `Não é possível lançar notas. A pauta está ${label}. O histórico acadêmico é imutável após fechamento conforme padrão institucional.`,
        403
      );
    }

    // JANELA DE LANÇAMENTO: Validar período ativo e que corresponde ao trimestre/semestre
    const instituicaoIdAvaliacao = requireTenantScope(req);
    let tipoPeriodoNumeroAval: { tipoPeriodo: string; numeroPeriodo: number } | undefined;
    const anoLetivoAval = avaliacao.turma?.anoLetivoRef?.ano ?? null;
    if (avaliacao.trimestre != null) {
      tipoPeriodoNumeroAval = { tipoPeriodo: 'TRIMESTRE', numeroPeriodo: avaliacao.trimestre };
    } else if (avaliacao.planoEnsino?.semestreRef?.numero != null) {
      tipoPeriodoNumeroAval = { tipoPeriodo: 'SEMESTRE', numeroPeriodo: avaliacao.planoEnsino.semestreRef.numero };
    } else if (avaliacao.semestreId) {
      const sem = await prisma.semestre.findUnique({
        where: { id: avaliacao.semestreId },
        select: { numero: true },
      });
      if (sem?.numero) tipoPeriodoNumeroAval = { tipoPeriodo: 'SEMESTRE', numeroPeriodo: sem.numero };
    }
    if (instituicaoIdAvaliacao) {
      const janela = await validarJanelaLancamentoNotas(instituicaoIdAvaliacao, tipoPeriodoNumeroAval);
      if (!janela.permitido) {
        throw new AppError(janela.motivo || 'Período de lançamento de notas não está aberto.', 403);
      }
      if (anoLetivoAval != null && avaliacao.trimestre != null) {
        await assertLancamentoSecundarioRespeitaSequenciaTrimestres({
          tipoAcademico: req.user?.tipoAcademico,
          instituicaoId: instituicaoIdAvaliacao,
          anoLetivo: anoLetivoAval,
          trimestre: avaliacao.trimestre,
          roles: req.user?.roles || [],
        });
      }
      if (anoLetivoAval != null && tipoPeriodoNumeroAval) {
        if (tipoPeriodoNumeroAval.tipoPeriodo === 'TRIMESTRE') {
          const encerrado = await verificarTrimestreEncerrado(instituicaoIdAvaliacao, anoLetivoAval, tipoPeriodoNumeroAval.numeroPeriodo);
          if (encerrado) {
            throw new AppError(
              `Não é possível lançar notas. O ${tipoPeriodoNumeroAval.numeroPeriodo}º trimestre está ENCERRADO. Só é possível lançar notas no trimestre aberto ou ativo.`,
              403
            );
          }
        } else if (tipoPeriodoNumeroAval.tipoPeriodo === 'SEMESTRE') {
          const encerrado = await verificarSemestreEncerrado(instituicaoIdAvaliacao, anoLetivoAval, tipoPeriodoNumeroAval.numeroPeriodo);
          if (encerrado) {
            throw new AppError(
              `Não é possível lançar notas. O ${tipoPeriodoNumeroAval.numeroPeriodo}º semestre está ENCERRADO. Só é possível lançar notas no semestre aberto ou ativo.`,
              403
            );
          }
        }
      }
    }

    // OBRIGATÓRIO: Professor só pode lançar nota se estiver vinculado à disciplina/turma (PlanoEnsino APROVADO)
    const professorIdLote = req.professor?.id;
    const isProfessorLote = req.user?.roles?.includes('PROFESSOR') && !req.user?.roles?.includes('SUPER_ADMIN');
    if (isProfessorLote && professorIdLote && instituicaoIdAvaliacao) {
      await validarVinculoProfessorDisciplinaTurma(
        instituicaoIdAvaliacao,
        professorIdLote,
        avaliacao.planoEnsino!.disciplinaId,
        avaliacao.turmaId || null,
        'lançar notas em lote',
        avaliacao.planoEnsinoId
      );
    }

    // Verificar se avaliação está fechada
    if (avaliacao.fechada) {
      throw new AppError('Não é possível lançar notas em uma avaliação fechada', 400);
    }

    // REGRA MESTRA: Ano Letivo é CONTEXTO, não dependência técnica
    const instituicaoIdFinal = requireTenantScope(req);

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe de todos os alunos
    const tipoAcademicoLote = req.user?.tipoAcademico || null;
    const disciplinaIdAvaliacao = avaliacao.planoEnsino?.disciplinaId;
    const anoLetivoIdAvaliacao = avaliacao.planoEnsino?.anoLetivoId || avaliacao.turma?.anoLetivoRef?.id;

    // Validar cada aluno antes de processar
    for (const nota of notas) {
      if (nota.alunoId) {
        await validarBloqueioAcademicoInstitucionalOuErro(
          nota.alunoId,
          instituicaoIdFinal,
          tipoAcademicoLote,
          disciplinaIdAvaliacao,
          anoLetivoIdAvaliacao
        );
        // BLOQUEIO FINANCEIRO (institucional): Se instituição configurou bloquear avaliações por situação financeira
        const bloqueioLoteAvaliacao = await verificarBloqueioAcademico(
          nota.alunoId,
          instituicaoIdFinal,
          TipoOperacaoBloqueada.AVALIACOES
        );
        if (bloqueioLoteAvaliacao.bloqueado && bloqueioLoteAvaliacao.motivo) {
          throw new AppError(bloqueioLoteAvaliacao.motivo, 403);
        }
      }
    }
    
    // Obter planoEnsinoId e anoLetivoId da avaliação (OBRIGATÓRIO)
    const planoEnsinoId = avaliacao.planoEnsinoId;
    const anoLetivoId = avaliacao.planoEnsino?.anoLetivoId || null;
    
    if (!planoEnsinoId) {
      console.error('[createNotasAvaliacaoEmLote] Avaliação sem planoEnsinoId:', {
        avaliacaoId,
        avaliacao: {
          id: avaliacao.id,
          planoEnsinoId: avaliacao.planoEnsinoId,
          planoEnsino: avaliacao.planoEnsino,
        },
      });
      throw new AppError('Avaliação não possui Plano de Ensino vinculado. Por favor, verifique a configuração da avaliação.', 400);
    }
    
    // Validar que o planoEnsinoId existe no banco
    const planoEnsinoExiste = await prisma.planoEnsino.findUnique({
      where: { id: planoEnsinoId },
      select: { id: true },
    });
    
    if (!planoEnsinoExiste) {
      console.error('[createNotasAvaliacaoEmLote] Plano de Ensino não encontrado:', {
        planoEnsinoId,
        avaliacaoId,
      });
      throw new AppError(`Plano de Ensino (${planoEnsinoId}) vinculado à avaliação não foi encontrado no banco de dados.`, 404);
    }

    // CRÍTICO: Garantir instituicaoId na Nota para multi-tenant (boletim/painel filtram por instituicaoId)
    const instituicaoIdParaNota =
      instituicaoId ||
      instituicaoIdFinal ||
      avaliacao.instituicaoId ||
      (avaliacao.turma as { instituicaoId?: string } | null)?.instituicaoId ||
      null;
    
    if (anoLetivoId) {
      // Tentar validar, mas não bloquear se não estiver ativo
      try {
        await validarAnoLetivoIdAtivo(instituicaoIdFinal, anoLetivoId, 'lançar notas em lote');
      } catch (error) {
        console.warn(`[createNotasAvaliacaoEmLote] Ano letivo do plano não está ativo, mas permitindo lançamento de notas (contexto, não dependência)`);
      }
    }

    // Validar todas as notas
    for (const nota of notas) {
      if (!nota.alunoId) {
        throw new AppError('alunoId é obrigatório para cada nota', 400);
      }
      if (nota.valor === undefined || nota.valor === null) {
        throw new AppError('Valor da nota é obrigatório', 400);
      }
      if (nota.valor < 0 || nota.valor > 20) {
        throw new AppError('Valores das notas devem estar entre 0 e 20', 400);
      }
    }

    // Buscar dados da avaliação para usar nos e-mails
    const avaliacaoCompleta = await prisma.avaliacao.findFirst({
      where: { id: avaliacaoId },
      include: {
        turma: {
          include: {
            disciplina: {
              select: { nome: true },
            },
            curso: {
              select: { nome: true },
            },
          },
        },
      },
    });

    // Performance: Buscar notas existentes e alunos em batch (evita N+1)
    const alunoIds = [...new Set(notas.map((n) => n.alunoId))];
    const [existingNotas, alunosBatch] = await Promise.all([
      prisma.nota.findMany({
        where: { avaliacaoId, alunoId: { in: alunoIds } },
        include: { aluno: { select: { email: true, nomeCompleto: true } } },
      }),
      prisma.user.findMany({
        where: { id: { in: alunoIds } },
        select: { id: true, email: true, nomeCompleto: true },
      }),
    ]);
    const existingNotaMap = new Map(existingNotas.map((no) => [`${no.alunoId}-${no.avaliacaoId}`, no]));
    const alunosMap = new Map(alunosBatch.map((a) => [a.id, a]));

    // Criar ou atualizar notas em lote
    const results = await Promise.all(
      notas.map(async (n: { alunoId: string; valor: number; observacoes?: string | null }) => {
        const existing = existingNotaMap.get(`${n.alunoId}-${avaliacaoId}`);

        if (existing) {
          const notaAtualizada = await prisma.nota.update({
            where: { id: existing.id },
            data: {
              valor: n.valor,
              observacoes: n.observacoes || null,
              lancadoPor: req.user?.userId,
            },
            include: {
              aluno: {
                select: { email: true, nomeCompleto: true },
              },
            },
          });

          // Auditoria: Log UPDATE (em lote)
          await AuditService.logUpdate(req, {
            modulo: ModuloAuditoria.AVALIACOES_NOTAS,
            entidade: EntidadeAuditoria.NOTA,
            entidadeId: existing.id,
            dadosAnteriores: existing,
            dadosNovos: notaAtualizada,
            observacao: `Nota atualizada em lote: ${n.valor}`,
          });

          // Enviar e-mail de notificação ao aluno (não bloqueia se falhar)
          if (notaAtualizada.aluno?.email) {
            try {
              await EmailService.sendEmail(
                req,
                notaAtualizada.aluno.email,
                'NOTA_LANCADA',
                {
                  nomeAluno: notaAtualizada.aluno.nomeCompleto || 'Aluno',
                  disciplina: avaliacaoCompleta?.turma?.disciplina?.nome || 'N/A',
                  tipoAvaliacao: avaliacaoCompleta?.tipo || 'N/A',
                  nota: Number(notaAtualizada.valor),
                  turma: avaliacaoCompleta?.turma?.nome || 'N/A',
                },
                {
                  destinatarioNome: notaAtualizada.aluno.nomeCompleto || undefined,
                  instituicaoId: instituicaoId || undefined,
                }
              );
            } catch (emailError: any) {
              console.error(`[NotaController] Erro ao enviar e-mail para ${notaAtualizada.aluno.email}:`, emailError.message);
            }
          }

          return notaAtualizada;
        } else {
          const aluno = alunosMap.get(n.alunoId);

          // Validar dados antes de criar
          if (!n.alunoId || !planoEnsinoId || !avaliacaoId || n.valor === undefined || n.valor === null) {
            console.error('[createNotasAvaliacaoEmLote] Dados inválidos para criar nota:', {
              alunoId: n.alunoId,
              planoEnsinoId,
              avaliacaoId,
              valor: n.valor,
              instituicaoId,
            });
            throw new AppError(`Dados inválidos para criar nota: alunoId=${n.alunoId}, planoEnsinoId=${planoEnsinoId}, avaliacaoId=${avaliacaoId}, valor=${n.valor}`, 400);
          }
          
          const notaCriada = await prisma.nota.create({
            data: {
              alunoId: n.alunoId,
              planoEnsinoId, // OBRIGATÓRIO: Nota sempre vinculada ao Plano de Ensino
              avaliacaoId,
              anoLetivoId: anoLetivoId || null, // Opcional: pode vir via PlanoEnsino
              valor: n.valor,
              observacoes: n.observacoes || null,
              lancadoPor: req.user?.userId || null,
              ...(instituicaoIdParaNota && { instituicaoId: instituicaoIdParaNota }),
              estudanteId: n.alunoId,
              disciplinaId: avaliacao.planoEnsino?.disciplinaId,
              turmaId: avaliacao.turmaId,
              professorId: avaliacao.planoEnsino?.professorId ?? avaliacao.professorId,
              semestreId: avaliacao.planoEnsino?.semestreId ?? null,
              componente: `av-${avaliacaoId}`,
            },
          });

          // Auditoria: Log CREATE (em lote)
          await AuditService.logCreate(req, {
            modulo: ModuloAuditoria.AVALIACOES_NOTAS,
            entidade: EntidadeAuditoria.NOTA,
            entidadeId: notaCriada.id,
            dadosNovos: notaCriada,
            observacao: `Nota criada em lote: ${n.valor}`,
          });

          // Enviar e-mail de notificação ao aluno (não bloqueia se falhar)
          if (aluno?.email) {
            try {
              await EmailService.sendEmail(
                req,
                aluno.email,
                'NOTA_LANCADA',
                {
                  nomeAluno: aluno.nomeCompleto || 'Aluno',
                  disciplina: avaliacaoCompleta?.turma?.disciplina?.nome || 'N/A',
                  tipoAvaliacao: avaliacaoCompleta?.tipo || 'N/A',
                  nota: Number(n.valor),
                  turma: avaliacaoCompleta?.turma?.nome || 'N/A',
                },
                {
                  destinatarioNome: aluno.nomeCompleto || aluno.nomeCompleto || undefined,
                  instituicaoId: instituicaoId || undefined,
                }
              );
            } catch (emailError: any) {
              console.error(`[NotaController] Erro ao enviar e-mail para ${aluno.email}:`, emailError.message);
            }
          }

          // Notificação interna: Nota lançada
          try {
            const { NotificacaoService } = await import('../services/notificacao.service.js');
            await NotificacaoService.notificarNotaLancada(
              req,
              n.alunoId,
              avaliacaoCompleta?.turma?.disciplina?.nome || 'N/A',
              Number(n.valor),
              instituicaoId
            );
          } catch (notifError: any) {
            // Não bloquear se notificação falhar
            console.error('[createNotasAvaliacaoEmLote] Erro ao criar notificação (não crítico):', notifError.message);
          }

          return notaCriada;
        }
      })
    );

    res.status(201).json({ count: results.length, notas: results });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar alunos com frequência para lançar notas
 * GET /notas/avaliacao/:avaliacaoId/alunos
 */
export const getAlunosParaLancarNotas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { avaliacaoId } = req.params;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!avaliacaoId) {
      throw new AppError('avaliacaoId é obrigatório', 400);
    }

    // Buscar avaliação - MODELO CORRETO: Avaliação pertence diretamente à Turma
    const avaliacao = await prisma.avaliacao.findFirst({
      where: {
        id: avaliacaoId,
        instituicaoId: instituicaoId || undefined,
      },
      include: {
        turma: {
          include: {
            disciplina: {
              select: { id: true, nome: true },
            },
            curso: {
              select: { id: true, nome: true },
            },
            classe: {
              select: { id: true, nome: true },
            },
            anoLetivoRef: {
              select: { id: true, ano: true },
            },
          },
        },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
    }

    // MODELO CORRETO: Buscar alunos diretamente pela Turma (via Matricula)
    const turmaId = avaliacao.turmaId;

    // Buscar matrículas ativas da turma
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId,
        status: 'Ativa',
        aluno: {
          instituicaoId: instituicaoId || undefined,
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
          },
        },
      },
      orderBy: {
        aluno: {
          nomeCompleto: 'asc',
        },
      },
    });

    // Transformar para formato esperado
    const alunosMatriculados = matriculas.map(m => ({
      alunoId: m.alunoId,
      aluno: m.aluno,
    }));

    // Buscar notas já lançadas
    const notas = await prisma.nota.findMany({
      where: {
        avaliacaoId,
        alunoId: {
          in: alunosMatriculados.map((a) => a.alunoId),
        },
      },
    });

    // Calcular frequência para cada aluno
    // NOTA: Frequência pode ser calculada via AulaLancada (se houver PlanoEnsino) ou via Aula diretamente
    // Por enquanto, vamos buscar via Turma diretamente (Aula) e também via AulaLancada se disponível
    const alunosComFrequencia = await Promise.all(
      alunosMatriculados.map(async (item) => {
        const alunoId = item.alunoId;
        
        // Buscar aulas da turma até a data da avaliação (modelo direto)
        const aulasTurma = await prisma.aula.findMany({
          where: {
            turmaId,
            data: {
              lte: avaliacao.data,
            },
          },
          include: {
            frequencias: {
              where: {
                alunoId,
              },
            },
          },
        });

        // Calcular frequência
        let totalAulas = aulasTurma.length;
        let presencas = 0;
        let ausencias = 0;
        let justificadas = 0;

        aulasTurma.forEach((aula) => {
          const frequencia = aula.frequencias[0];
          if (frequencia) {
            if (frequencia.presente) {
              presencas++;
            } else {
              ausencias++;
            }
          }
        });

        const frequenciaPercentual =
          totalAulas > 0 ? ((presencas) / totalAulas) * 100 : 0;

        // Verificar se tem frequência mínima (75%)
        const temFrequenciaMinima = frequenciaPercentual >= 75;

        // Buscar nota existente
        const notaExistente = notas.find((n) => n.alunoId === alunoId);

        return {
          alunoId,
          nomeCompleto: item.aluno.nomeCompleto,
          email: item.aluno.email,
          numeroIdentificacao: item.aluno.numeroIdentificacao,
          numeroIdentificacaoPublica: item.aluno.numeroIdentificacaoPublica,
          frequencia: {
            totalAulas,
            presencas,
            ausencias,
            justificadas, // Mantido para compatibilidade
            percentual: Number(frequenciaPercentual.toFixed(2)),
            temFrequenciaMinima,
          },
          nota: notaExistente
            ? {
                id: notaExistente.id,
                valor: Number(notaExistente.valor),
                observacoes: notaExistente.observacoes,
              }
            : null,
          bloqueado: !temFrequenciaMinima,
        };
      })
    );

    res.json({
      avaliacao: {
        id: avaliacao.id,
        tipo: avaliacao.tipo,
        trimestre: avaliacao.trimestre,
        nome: avaliacao.nome,
        data: avaliacao.data,
        turma: {
          id: avaliacao.turma.id,
          nome: avaliacao.turma.nome,
          disciplina: avaliacao.turma.disciplina ? {
            id: avaliacao.turma.disciplina.id,
            nome: avaliacao.turma.disciplina.nome,
          } : null,
          curso: avaliacao.turma.curso ? {
            id: avaliacao.turma.curso.id,
            nome: avaliacao.turma.curso.nome,
          } : null,
          classe: avaliacao.turma.classe ? {
            id: avaliacao.turma.classe.id,
            nome: avaliacao.turma.classe.nome,
          } : null,
          anoLetivo: avaliacao.turma.anoLetivoRef ? {
            id: avaliacao.turma.anoLetivoRef.id,
            ano: avaliacao.turma.anoLetivoRef.ano,
          } : null,
        },
      },
      alunos: alunosComFrequencia,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar boletim do aluno
 * GET /boletim/aluno/:alunoId
 */
export const getBoletimAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const { planoEnsinoId, anoLetivo } = req.query;
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    // SEGURANÇA: ALUNO só pode ver próprio boletim
    const isAlunoOnly = userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('PROFESSOR');
    if (isAlunoOnly) {
      if (alunoId !== req.user?.userId) {
        throw new AppError('Você só pode acessar seu próprio boletim', 403);
      }
    }

    // BLOQUEIO: Aluno inadimplente não pode ver boletim
    const instituicaoIdBoletim = getInstituicaoIdFromFilter(filter);
    if (instituicaoIdBoletim && isAlunoOnly) {
      const bloqueio = await verificarBloqueioAcademico(alunoId, instituicaoIdBoletim, TipoOperacaoBloqueada.PAUTA_NOTAS);
      if (bloqueio.bloqueado) {
        throw new AppError(bloqueio.motivo || 'Acesso ao boletim bloqueado devido a situação financeira irregular.', 403);
      }
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId: getInstituicaoIdFromFilter(filter) || undefined,
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    // Buscar plano de ensino
    const planoWhere: any = {
      ...filter,
    };

    if (planoEnsinoId) {
      planoWhere.id = planoEnsinoId;
    }

    if (anoLetivo) {
      planoWhere.anoLetivo = Number(anoLetivo);
    }

    const planosEnsino = await prisma.planoEnsino.findMany({
      where: planoWhere,
      orderBy: {
        disciplina: { nome: 'asc' },
      },
      include: {
        disciplina: {
          select: { id: true, nome: true },
        },
        turma: {
          select: { id: true, nome: true },
        },
        avaliacoes: {
          include: {
            notas: {
              where: {
                alunoId,
              },
            },
          },
          orderBy: [
            { trimestre: 'asc' },
            { data: 'asc' },
          ],
        },
      },
    });

    const instituicaoId = getInstituicaoIdFromFilter(filter) || '';

    // Processar dados do boletim (com campos institucionais alinhados)
    const boletim = await Promise.all(
      planosEnsino.map(async (plano) => {
        // Calcular médias por trimestre (lógica original mantida)
        const mediasPorTrimestre: { [key: number]: number } = {};
        const notasPorTrimestre: { [key: number]: Array<{ tipo: string; valor: number; peso: number }> } = {};

        plano.avaliacoes.forEach((avaliacao) => {
          const trim = avaliacao.trimestre ?? 0;
          const nota = avaliacao.notas[0];
          if (nota) {
            if (!mediasPorTrimestre[trim]) {
              mediasPorTrimestre[trim] = 0;
              notasPorTrimestre[trim] = [];
            }

            const peso = Number(avaliacao.peso);
            const valor = Number(nota.valor);

            notasPorTrimestre[trim].push({
              tipo: avaliacao.tipo,
              valor,
              peso,
            });
          }
        });

        // Calcular média ponderada por trimestre
        Object.keys(notasPorTrimestre).forEach((trim) => {
          const trimestre = Number(trim);
          const notas = notasPorTrimestre[trimestre];
          const somaPonderada = notas.reduce((acc, n) => acc + n.valor * n.peso, 0);
          const somaPesos = notas.reduce((acc, n) => acc + n.peso, 0);
          mediasPorTrimestre[trimestre] = somaPesos > 0 ? somaPonderada / somaPesos : 0;
        });

        // Calcular média final (média aritmética dos trimestres)
        const mediasTrimestres = Object.values(mediasPorTrimestre);
        const mediaFinal =
          mediasTrimestres.length > 0
            ? mediasTrimestres.reduce((acc, m) => acc + m, 0) / mediasTrimestres.length
            : 0;

        // Campos institucionais (alinhados com relatorios.controller)
        let frequencia: { totalAulas: number; presencas: number; percentualFrequencia: number; situacao: string; frequenciaMinima?: number } | undefined;
        let situacaoAcademica: string | undefined;
        let estadoDisciplina: 'Em Andamento' | 'Finalizada' | 'Consolidada' | undefined;
        let ultimaAtualizacao: string | undefined;

        if (instituicaoId) {
          try {
            const freq = await calcularFrequenciaAluno(plano.id, alunoId, instituicaoId);
            frequencia = {
              totalAulas: freq.totalAulas,
              presencas: freq.presencas,
              percentualFrequencia: freq.percentualFrequencia,
              situacao: freq.situacao,
              frequenciaMinima: freq.frequenciaMinima,
            };
            const resultadoNotas = await calcularMedia({
              alunoId,
              planoEnsinoId: plano.id,
              professorId: plano.professorId || undefined,
              instituicaoId,
              tipoAcademico: req.user?.tipoAcademico || null,
            });
            situacaoAcademica =
              freq.situacao === 'IRREGULAR'
                ? 'REPROVADO_FALTA'
                : resultadoNotas.status === 'APROVADO'
                  ? 'APROVADO'
                  : resultadoNotas.status === 'REPROVADO_FALTA'
                    ? 'REPROVADO_FALTA'
                    : resultadoNotas.status === 'REPROVADO'
                      ? 'REPROVADO'
                      : 'EM_CURSO';
            estadoDisciplina =
              freq.situacao === 'IRREGULAR'
                ? 'Finalizada'
                : resultadoNotas.status === 'EXAME_RECURSO' || resultadoNotas.status === 'EM_CURSO'
                  ? 'Em Andamento'
                  : resultadoNotas.status === 'APROVADO'
                    ? 'Consolidada'
                    : (resultadoNotas.detalhes_calculo?.observacoes || []).some((o: string) =>
                        /aguardando|nenhuma nota|incompleta/i.test(String(o))
                      )
                      ? 'Em Andamento'
                      : 'Finalizada';
            const ultimaNota = await prisma.nota.findFirst({
              where: { alunoId, planoEnsinoId: plano.id },
              orderBy: { updatedAt: 'desc' },
              select: { updatedAt: true },
            });
            const planoUpdated = (plano as { updatedAt?: Date }).updatedAt;
            const ult =
              ultimaNota?.updatedAt && planoUpdated
                ? (new Date(ultimaNota.updatedAt) > new Date(planoUpdated) ? ultimaNota.updatedAt : planoUpdated)
                : ultimaNota?.updatedAt ?? planoUpdated ?? undefined;
            ultimaAtualizacao = ult ? new Date(ult).toISOString() : undefined;
          } catch {
            // Manter campos opcionais vazios em caso de erro
          }
        }

        return {
          planoEnsinoId: plano.id,
          disciplina: plano.disciplina.nome,
          turma: plano.turma?.nome || null,
          anoLetivo: plano.anoLetivo,
          avaliacoes: plano.avaliacoes.map((a) => ({
            id: a.id,
            tipo: a.tipo,
            trimestre: a.trimestre,
            peso: Number(a.peso),
            data: a.data,
            nome: a.nome,
            nota: a.notas[0] ? Number(a.notas[0].valor) : null,
          })),
          mediasPorTrimestre,
          mediaFinal: Number(mediaFinal.toFixed(2)),
          frequencia,
          situacaoAcademica,
          estadoDisciplina,
          ultimaAtualizacao,
        };
      })
    );

    res.json({
      alunoId,
      alunoNome: aluno.nomeCompleto,
      boletim,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular média de notas para um aluno
 * POST /notas/calcular
 */
export const calcularMediaNota = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, disciplinaId, turmaId, avaliacaoId, anoLetivoId, anoLetivo, semestreId, trimestreId, trimestre } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada. Faça login novamente.', 401);
    }

    // Verificar se o aluno pertence à instituição
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId,
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado ou não pertence à instituição', 404);
    }

    // Preparar dados para cálculo
    // REGRA MESTRA: Cálculo baseado em Plano de Ensino
    // Se avaliacaoId for fornecido, obter planoEnsinoId da avaliação
    let planoEnsinoId: string | undefined = undefined;
    if (avaliacaoId) {
      const avaliacao = await prisma.avaliacao.findFirst({
        where: {
          id: avaliacaoId,
          instituicaoId: instituicaoId || undefined,
        },
        select: {
          planoEnsinoId: true,
        },
      });
      planoEnsinoId = avaliacao?.planoEnsinoId;
    }

    const dadosCalculo: DadosCalculoNota = {
      alunoId,
      instituicaoId,
      planoEnsinoId: planoEnsinoId || undefined,
      disciplinaId: disciplinaId || undefined,
      turmaId: turmaId || undefined,
      professorId: req.professor?.id || undefined, // CRÍTICO: Professor vê média apenas com suas notas
      avaliacaoId: avaliacaoId || undefined,
      anoLetivoId: anoLetivoId || undefined,
      anoLetivo: anoLetivo ? Number(anoLetivo) : undefined,
      semestreId: semestreId || undefined,
      trimestreId: trimestreId || undefined,
      trimestre: trimestre ? Number(trimestre) : undefined,
      tipoAcademico: req.user?.tipoAcademico || null, // CRÍTICO: tipoAcademico vem do JWT
    };

    // Calcular média usando o serviço (filtra por professorId quando professor)
    const resultado = await calcularMedia(dadosCalculo);

    res.json(resultado);
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular média de notas para múltiplos alunos (lote)
 * POST /notas/calcular/lote
 */
export const calcularMediaNotaLote = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunos } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = getInstituicaoIdFromFilter(filter);

    if (!Array.isArray(alunos) || alunos.length === 0) {
      throw new AppError('Lista de alunos é obrigatória e deve conter pelo menos um aluno', 400);
    }

    if (!instituicaoId) {
      throw new AppError('Instituição não identificada. Faça login novamente.', 401);
    }

    // Preparar dados para cálculo em lote
    // REGRA MESTRA: Cálculo baseado em Plano de Ensino
    // Se avaliacaoId for fornecido, obter planoEnsinoId da avaliação
    const dadosCalculo: DadosCalculoNota[] = await Promise.all(
      alunos.map(async (aluno: any) => {
        let planoEnsinoId: string | undefined = undefined;
        if (aluno.avaliacaoId) {
          const avaliacao = await prisma.avaliacao.findFirst({
            where: {
              id: aluno.avaliacaoId,
              instituicaoId: instituicaoId || undefined,
            },
            select: {
              planoEnsinoId: true,
            },
          });
          planoEnsinoId = avaliacao?.planoEnsinoId;
        }

        return {
          alunoId: aluno.alunoId,
          instituicaoId,
          planoEnsinoId: planoEnsinoId || aluno.planoEnsinoId || undefined,
          disciplinaId: aluno.disciplinaId || undefined,
          turmaId: aluno.turmaId || undefined,
          professorId: req.professor?.id || aluno.professorId || undefined, // CRÍTICO: Professor vê média apenas com suas notas
          avaliacaoId: aluno.avaliacaoId || undefined,
          anoLetivoId: aluno.anoLetivoId || undefined,
          anoLetivo: aluno.anoLetivo ? Number(aluno.anoLetivo) : undefined,
          semestreId: aluno.semestreId || undefined,
          trimestreId: aluno.trimestreId || undefined,
          trimestre: aluno.trimestre ? Number(aluno.trimestre) : undefined,
          tipoAcademico: req.user?.tipoAcademico || null,
        };
      })
    );

    // Validar que todos os alunos pertencem à instituição
    const alunoIds = dadosCalculo.map(d => d.alunoId);
    const alunosValidos = await prisma.user.findMany({
      where: {
        id: { in: alunoIds },
        instituicaoId,
      },
      select: { id: true },
    });

    const alunosValidosIds = new Set(alunosValidos.map(a => a.id));
    const alunosInvalidos = alunoIds.filter(id => !alunosValidosIds.has(id));

    if (alunosInvalidos.length > 0) {
      throw new AppError(`Alguns alunos não foram encontrados ou não pertencem à instituição: ${alunosInvalidos.join(', ')}`, 400);
    }

    // Calcular médias em lote usando o serviço
    const resultados = await calcularMediaLote(dadosCalculo);

    res.json({ resultados });
  } catch (error) {
    next(error);
  }
};