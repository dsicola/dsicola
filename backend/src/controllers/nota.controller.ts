import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { verificarTrimestreEncerrado } from './encerramentoAcademico.controller.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { validarPermissaoNota } from '../middlewares/role-permissions.middleware.js';
import { validarAnoLetivoIdAtivo, validarPlanoEnsinoAtivo, validarVinculoProfessorDisciplinaTurma } from '../services/validacaoAcademica.service.js';
import { calcularMedia, calcularMediaLote, DadosCalculoNota } from '../services/calculoNota.service.js';
import { verificarAlunoConcluido } from '../services/conclusaoCurso.service.js';
import { Decimal } from '@prisma/client/runtime/library';
import { EmailService } from '../services/email.service.js';
import { validarBloqueioAcademicoInstitucionalOuErro, verificarBloqueioAcademico, TipoOperacaoBloqueada } from '../services/bloqueioAcademico.service.js';
import { calcularFrequenciaAluno } from '../services/frequencia.service.js';

export const getNotas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId, exameId, turmaId } = req.query;
    const filter = addInstitutionFilter(req);
    
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
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

      // Se for professor, verificar se existe plano de ensino vinculando professor à turma
      if (isProfessor && professorId) {
        const planoEnsino = await prisma.planoEnsino.findFirst({
          where: {
            turmaId: turmaId as string,
            professorId,
            ...filter,
          },
          select: { id: true },
        });

        if (!planoEnsino) {
          // Professor não tem plano de ensino para esta turma
          return res.json([]);
        }
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

      // Incluir notas de EXAMES e de AVALIAÇÕES (P1, P2, P3, Trabalho) da turma
      const exames = await prisma.exame.findMany({
        where: { turmaId: turma.id },
        select: { id: true },
      });
      const exameIds = exames.map(e => e.id);
      where.OR = [
        ...(exameIds.length ? [{ exameId: { in: exameIds } }] : []),
        { avaliacao: { turmaId: turma.id } },
      ];
    } else if (isProfessor && professorId) {
      // Se professor busca todas as notas, filtrar apenas pelas suas turmas via planos de ensino
      const planosEnsino = await prisma.planoEnsino.findMany({
        where: {
          professorId,
          ...filter,
        },
        select: {
          turmaId: true,
        },
        distinct: ['turmaId'],
      });

      const turmaIds = planosEnsino
        .map((plano) => plano.turmaId)
        .filter((id): id is string => id !== null && id !== undefined);

      if (turmaIds.length === 0) {
        return res.json([]);
      }

      // Incluir notas de EXAMES e de AVALIAÇÕES (P1, P2, P3, Trabalho) das turmas do professor
      const exames = await prisma.exame.findMany({
        where: { turmaId: { in: turmaIds } },
        select: { id: true },
      });
      const exameIds = exames.map(e => e.id);
      where.OR = [
        ...(exameIds.length ? [{ exameId: { in: exameIds } }] : []),
        { avaliacao: { turmaId: { in: turmaIds } } },
      ];
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
        exame: { 
          include: {
            turma: { 
              include: {
                disciplina: true,
                curso: true
              }
            }
          }
        },
        avaliacao: {
          include: {
            turma: {
              include: {
                disciplina: true,
                curso: true
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
      // Filtrar através do aluno ou turma que têm instituicaoId
      nota = await prisma.nota.findFirst({
        where: {
          id,
          OR: [
            // Filtrar através do aluno
            { aluno: { instituicaoId: filter.instituicaoId } },
            // Filtrar através da turma (via exame)
            { exame: { turma: { instituicaoId: filter.instituicaoId } } },
            // Filtrar através da turma (via avaliacao)
            { avaliacao: { turma: { instituicaoId: filter.instituicaoId } } },
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

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno
    const tipoAcademico = req.user?.tipoAcademico || null;
    await validarBloqueioAcademicoInstitucionalOuErro(
      alunoId,
      instituicaoId || '',
      tipoAcademico
    );

    // REGRA CRÍTICA SIGA/SIGAE: Bloquear lançamento de notas após conclusão do curso
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
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Não é permitido lançar notas após conclusão. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE.`,
          403
        );
      }
    }

    if (exameId) {
      // Lógica existente para exames
      const exame = await prisma.exame.findUnique({
        where: { id: exameId },
        include: {
          turma: {
            select: {
              id: true,
              professorId: true,
              instituicaoId: true
            }
          }
        }
      });

      if (!exame) {
        throw new AppError('Exame não encontrado', 404);
      }

      // Verificar instituição (multi-tenant)
      if (instituicaoId && exame.turma.instituicaoId !== instituicaoId) {
        throw new AppError('Acesso negado', 403);
      }

      // Check if nota already exists for this aluno+exame
      const existing = await prisma.nota.findUnique({
        where: {
          alunoId_exameId: { alunoId, exameId }
        }
      });

      if (existing) {
        throw new AppError('Nota já existe para este aluno neste exame', 400);
      }

      // Obter planoEnsinoId: Exame tem turma; buscar PlanoEnsino da turma (exame é legacy - uma turma pode ter vários planos)
      const planoExame = await prisma.planoEnsino.findFirst({
        where: { turmaId: exame.turma.id, instituicaoId: instituicaoId || undefined },
        select: { id: true },
      });
      if (!planoExame) {
        throw new AppError('Nenhum Plano de Ensino encontrado para a turma deste exame. Vincule um plano à turma antes de lançar notas.', 400);
      }

      const nota = await prisma.nota.create({
        data: {
          alunoId,
          planoEnsinoId: planoExame.id,
          exameId,
          valor,
          observacoes: observacoes || null,
          lancadoPor: req.user?.userId || null,
          instituicaoId: instituicaoId || null,
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
          instituicaoId: instituicaoId || undefined,
        },
        include: {
          planoEnsino: {
            select: {
              professorId: true,
              disciplinaId: true,
              turmaId: true,
              anoLetivo: true,
              anoLetivoId: true,
            }
          }
        }
      });

      if (!avaliacao) {
        throw new AppError('Avaliação não encontrada', 404);
      }

      // Verificar se avaliação está fechada
      if (avaliacao.fechada) {
        throw new AppError('Não é possível lançar notas em uma avaliação fechada', 400);
      }

      // REGRA MESTRA SIGA/SIGAE: Validar que Plano de Ensino está ATIVO (APROVADO)
      // NADA acadêmico pode existir sem um PLANO DE ENSINO válido e ATIVO
      const instituicaoIdNota = requireTenantScope(req);
      await validarPlanoEnsinoAtivo(instituicaoIdNota, avaliacao.planoEnsinoId, 'lançar nota');

      // REGRA MESTRA SIGA/SIGAE: Validar vínculo Professor-Disciplina-Turma via Plano de Ensino ATIVO
      // Garantir que o professor autenticado está vinculado à disciplina e turma através do plano
      // IMPORTANTE: Sempre validar vínculo - isso garante que o plano tem turma vinculada e está ativo
      // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
      if (!req.professor) {
        throw new AppError('Professor não identificado. O middleware resolveProfessor deve ser aplicado nesta rota.', 500);
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
        'lançar nota'
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

      // BLOQUEIO FINANCEIRO (SIGAE): Se instituição configurou bloquear avaliações por situação financeira
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

      // VALIDAÇÃO DE BLOQUEIO: Verificar se o trimestre está encerrado
      const anoLetivoNum = avaliacao.planoEnsino?.anoLetivo ?? null;
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

/**
 * Verificar se nota pode ser editada (trimestre não encerrado)
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
            },
          },
        },
      },
    },
  });

  if (!nota || !nota.avaliacao) {
    return { editavel: false, mensagem: 'Nota não encontrada' };
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
    const { id } = req.params;
    const { valor, observacoes } = req.body;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const instituicaoId = requireTenantScope(req);

    const existing = await prisma.nota.findUnique({
      where: { id },
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

    // REGRA CRÍTICA SIGA/SIGAE: Bloquear edição de notas após conclusão do curso
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
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Notas não podem ser editadas após conclusão. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE.`,
          403
        );
      }
    }

    // REGRA CRÍTICA SIGA/SIGAE: Mudança de valor DEVE usar endpoint de correção
    // updateNota apenas para atualizar observacoes (sem mudança de valor)
    if (valor !== undefined) {
      const valorMudou = existing.valor.toString() !== valor.toString();
      if (valorMudou) {
        throw new AppError(
          'Não é permitido alterar o valor da nota diretamente. Use o endpoint de correção (/notas/:id/corrigir) que exige motivo obrigatório e cria histórico imutável conforme padrão SIGA/SIGAE.',
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
    const { id } = req.params;
    const { valor, motivo, observacoes, comentarioProfessor } = req.body;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SUPER_ADMIN');
    const instituicaoId = requireTenantScope(req);

    // Validações: valor ou comentarioProfessor deve ser fornecido
    const temComentario = comentarioProfessor !== undefined && comentarioProfessor !== null;
    if (valor === undefined && !temComentario) {
      throw new AppError('Informe valor ou comentarioProfessor para atualizar', 400);
    }
    if (valor !== undefined && (valor < 0 || valor > 20)) {
      throw new AppError('Valor da nota deve estar entre 0 e 20', 400);
    }
    // Motivo obrigatório quando valor é alterado (validado mais abaixo)

    // Buscar nota existente
    const existing = await prisma.nota.findUnique({
      where: { id },
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

    // Verificar instituição (multi-tenant)
    if (filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado', 403);
    }

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe do aluno antes de corrigir nota
    const tipoAcademico = req.user?.tipoAcademico || null;
    
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

    // BLOQUEIO FINANCEIRO (SIGAE): Se instituição configurou bloquear avaliações por situação financeira
    const bloqueioFinanceiroCorrecao = await verificarBloqueioAcademico(
      existing.alunoId,
      instituicaoId,
      TipoOperacaoBloqueada.AVALIACOES
    );
    if (bloqueioFinanceiroCorrecao.bloqueado && bloqueioFinanceiroCorrecao.motivo) {
      throw new AppError(bloqueioFinanceiroCorrecao.motivo, 403);
    }

    // REGRA CRÍTICA SIGA/SIGAE: Bloquear correção de notas após conclusão do curso
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
          `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Notas não podem ser corrigidas após conclusão. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE.`,
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

    // VALIDAÇÃO CRÍTICA: Verificar se período está encerrado (para avaliações)
    if (existing.avaliacao) {
      const anoL = existing.avaliacao.planoEnsino?.anoLetivo ?? null;
      const trim = existing.avaliacao.trimestre ?? null;
      const trimestreEncerrado = anoL != null && trim != null
        ? await verificarTrimestreEncerrado(instituicaoId, anoL, trim)
        : false;

      if (trimestreEncerrado) {
        // ADMIN pode corrigir mesmo com trimestre encerrado (com justificativa obrigatória)
        if (!isAdmin) {
          throw new AppError(
            `Não é possível corrigir nota. O ${existing.avaliacao.trimestre}º trimestre está ENCERRADO. Apenas ADMIN pode corrigir notas de períodos encerrados.`,
            403
          );
        }
        // Para ADMIN: validar que motivo é mais detalhado (exigir justificativa administrativa)
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
        // REGRA ARQUITETURAL SIGA/SIGAE: Usar req.professor.id (professores.id) do middleware resolveProfessorMiddleware
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

    // Buscar nota e verificar permissão
    const nota = await prisma.nota.findFirst({
      where: {
        id,
        ...(filter.instituicaoId && { instituicaoId: filter.instituicaoId }),
      },
      select: {
        id: true,
        valor: true,
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
          }
        },
        planoEnsino: {
          select: {
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
 * REGRA SIGA/SIGAE: Histórico acadêmico é imutável
 */
export const deleteNota = async (req: Request, res: Response, next: NextFunction) => {
  throw new AppError(
    'Notas não podem ser deletadas. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE. Use o endpoint de correção (/notas/:id/corrigir) para ajustar valores.',
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

    const notas = await prisma.nota.findMany({
      where: { alunoId },
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

    // BLOQUEIO ACADÊMICO INSTITUCIONAL: Validar curso/classe de todos os alunos
    const tipoAcademicoLote = req.user?.tipoAcademico || null;
    const instituicaoIdFinal = requireTenantScope(req);

    // Buscar disciplinaId do primeiro exame para validação
    let disciplinaIdExame: string | undefined = undefined;
    if (primeiroExameId) {
      const exame = await prisma.exame.findUnique({
        where: { id: primeiroExameId },
        include: {
          turma: {
            include: {
              disciplina: {
                select: { id: true }
              }
            }
          }
        }
      });
      disciplinaIdExame = exame?.turma?.disciplina?.id;
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
        // BLOQUEIO FINANCEIRO (SIGAE): Se instituição configurou bloquear avaliações por situação financeira
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
            select: { turmaId: true },
          });
          const planoN = exameN ? await prisma.planoEnsino.findFirst({
            where: { turmaId: exameN.turmaId, instituicaoId: instituicaoIdFinal },
            select: { id: true },
          }) : null;
          if (!planoN) {
            throw new AppError(`Nenhum Plano de Ensino encontrado para o exame ${n.exameId}. Vincule um plano à turma antes de lançar notas.`, 400);
          }
          return await prisma.nota.create({
            data: {
              alunoId: n.alunoId,
              planoEnsinoId: planoN.id,
              exameId: n.exameId,
              valor: n.valor,
              observacoes: n.observacoes || null,
              lancadoPor: req.user?.userId || null,
              instituicaoId: instituicaoIdFinal || null,
            }
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
    const { turmaId } = req.query;
    const filter = addInstitutionFilter(req);
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // Se middleware não foi aplicado, professorId será undefined (não é erro)
    const professorId = req.professor?.id;
    const isProfessor = req.user?.roles?.includes('PROFESSOR');

    if (!turmaId) {
      throw new AppError('turmaId é obrigatório', 400);
    }

    // Verificar se a turma pertence ao professor (se for professor)
    // REGRA SIGAE: Professor SEMPRE precisa de req.professor.id (middleware resolveProfessorOptional)
    const turmaWhere: any = { id: turmaId as string };
    if (isProfessor) {
      if (!professorId) {
        // Professor sem identificação - falha silenciosa (sem plano)
        return res.json([]);
      }
      // REGRA: Professor deve estar vinculado via Plano de Ensino
      const planoEnsino = await prisma.planoEnsino.findFirst({
        where: {
          turmaId: turmaId as string,
          professorId,
          ...filter,
        },
        select: { id: true },
      });

      if (!planoEnsino) {
        return res.json([]);
      }
      // Opcional: validar plano ativo para lançamento (consultar sempre permitido)
      // Bloqueio de ações é feito no frontend via podeLancarNota
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
        return res.json([]);
      }
      throw new AppError('Turma não encontrada ou sem permissão', 404);
    }

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

    // Buscar todos os exames da turma
    const exames = await prisma.exame.findMany({
      where: { turmaId: turma.id },
      select: {
        id: true,
        nome: true,
        tipo: true
      }
    });

    // Buscar todas as notas dos alunos da turma
    const alunoIds = matriculas.map(m => m.aluno.id);
    const exameIds = exames.map(e => e.id);

    const notas = await prisma.nota.findMany({
      where: {
        alunoId: { in: alunoIds },
        exameId: { in: exameIds }
      },
      include: {
        exame: {
          select: {
            id: true,
            tipo: true,
            nome: true
          }
        }
      }
    });

    // Organizar dados: aluno -> notas por tipo
    const resultado = matriculas.map(matricula => {
      const alunoNotas = notas.filter(n => n.alunoId === matricula.aluno.id);
      const notasPorTipo: { [tipo: string]: { valor: number; id: string } | null } = {};

      // Inicializar todos os tipos possíveis como null
      const tiposPossiveis = [
        '1ª Prova', '2ª Prova', '3ª Prova', 'Trabalho', 'Exame de Recurso',
        '1º Trimestre', '2º Trimestre', '3º Trimestre', 'Prova Final', 'Recuperação'
      ];
      tiposPossiveis.forEach(tipo => {
        notasPorTipo[tipo] = null;
      });

      // Preencher com notas existentes
      alunoNotas.forEach(nota => {
        const tipo = nota.exame?.tipo || nota.exame?.nome || 'Exame';
        if (tipo) {
          notasPorTipo[tipo] = {
            valor: Number(nota.valor),
            id: nota.id
          };
        }
      });

      return {
        matricula_id: matricula.id,
        aluno_id: matricula.aluno.id,
        nome_completo: matricula.aluno.nomeCompleto,
        numero_identificacao: matricula.aluno.numeroIdentificacao,
        numero_identificacao_publica: matricula.aluno.numeroIdentificacaoPublica,
        notas: notasPorTipo
      };
    });

    res.json(resultado);
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
        instituicaoId: instituicaoId || undefined,
      },
      include: {
        planoEnsino: {
          select: {
            id: true,
            anoLetivoId: true,
            anoLetivo: true,
            disciplinaId: true,
          },
        },
        turma: {
          include: {
            anoLetivoRef: {
              select: {
                id: true,
                ano: true,
                status: true,
              },
            },
          },
        },
      },
    });

    if (!avaliacao) {
      throw new AppError('Avaliação não encontrada', 404);
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
        // BLOQUEIO FINANCEIRO (SIGAE): Se instituição configurou bloquear avaliações por situação financeira
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

    // Criar ou atualizar notas em lote
    const results = await Promise.all(
      notas.map(async (n: any) => {
        const existing = await prisma.nota.findUnique({
          where: {
            alunoId_avaliacaoId: {
              alunoId: n.alunoId,
              avaliacaoId,
            },
          },
          include: {
            aluno: {
              select: { email: true, nomeCompleto: true },
            },
          },
        });

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
          // Buscar dados do aluno antes de criar
          const aluno = await prisma.user.findUnique({
            where: { id: n.alunoId },
            select: { email: true, nomeCompleto: true },
          });

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
              ...(instituicaoId && { instituicaoId }),
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
    if (userRoles.includes('ALUNO') && !userRoles.includes('ADMIN') && !userRoles.includes('SECRETARIA') && !userRoles.includes('PROFESSOR')) {
      if (alunoId !== req.user?.userId) {
        throw new AppError('Você só pode acessar seu próprio boletim', 403);
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

    // Processar dados do boletim
    const boletim = planosEnsino.map((plano) => {
      // Calcular médias por trimestre
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
      };
    });

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
      avaliacaoId: avaliacaoId || undefined,
      anoLetivoId: anoLetivoId || undefined,
      anoLetivo: anoLetivo ? Number(anoLetivo) : undefined,
      semestreId: semestreId || undefined,
      trimestreId: trimestreId || undefined,
      trimestre: trimestre ? Number(trimestre) : undefined,
      tipoAcademico: req.user?.tipoAcademico || null, // CRÍTICO: tipoAcademico vem do JWT
    };

    // Calcular média usando o serviço
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
          avaliacaoId: aluno.avaliacaoId || undefined,
          anoLetivoId: aluno.anoLetivoId || undefined,
          anoLetivo: aluno.anoLetivo ? Number(aluno.anoLetivo) : undefined,
          semestreId: aluno.semestreId || undefined,
          trimestreId: aluno.trimestreId || undefined,
          trimestre: aluno.trimestre ? Number(aluno.trimestre) : undefined,
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