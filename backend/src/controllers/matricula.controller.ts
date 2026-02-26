import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { gerarMensalidadeAutomatica } from './mensalidade.controller.js';
import { StatusMatricula } from '@prisma/client';
import { gerarNumeroIdentificacaoPublica } from '../services/user.service.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';
import { parseListQuery, listMeta } from '../utils/parseListQuery.js';

export const getMatriculas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { turmaId, alunoId, status } = req.query;
    const { page, pageSize, skip, take } = parseListQuery(req.query as Record<string, string | string[] | undefined>);

    const where: any = {};
    if (turmaId) where.turmaId = turmaId as string;
    if (alunoId) where.alunoId = alunoId as string;
    if (status) where.status = status as string;

    if (filter.instituicaoId) {
      where.aluno = alunoId
        ? { id: alunoId as string, instituicaoId: filter.instituicaoId }
        : { instituicaoId: filter.instituicaoId };
    }

    const [matriculas, total] = await Promise.all([
      prisma.matricula.findMany({
        where,
        skip,
        take,
        include: {
        aluno: { select: { id: true, nomeCompleto: true, email: true, numeroIdentificacao: true, numeroIdentificacaoPublica: true, instituicaoId: true } },
        turma: {
          include: {
            curso: { select: { id: true, nome: true, valorMensalidade: true, taxaMatricula: true } },
            classe: { select: { id: true, nome: true, valorMensalidade: true, taxaMatricula: true } },
            disciplina: { select: { id: true, nome: true } },
            turno: { select: { id: true, nome: true } },
            instituicao: {
              select: {
                nome: true,
                logoUrl: true,
                emailContato: true,
                telefone: true,
                endereco: true,
                configuracao: {
                  select: {
                    nomeInstituicao: true,
                    logoUrl: true,
                    email: true,
                    telefone: true,
                    endereco: true,
                  },
                },
              },
            },
          },
        },
        anoLetivoRef: { select: { ano: true } },
      },
      orderBy: { createdAt: 'desc' },
      }),
      prisma.matricula.count({ where }),
    ]);

    // Backfill numeroIdentificacaoPublica em background (não bloqueia resposta)
    const toBackfill: { alunoId: string; instituicaoId: string | null }[] = [];
    for (const m of matriculas) {
      const aluno = m.aluno as { id: string; numeroIdentificacaoPublica?: string | null; instituicaoId?: string | null } | null;
      if (aluno && !aluno.numeroIdentificacaoPublica && !toBackfill.some(b => b.alunoId === aluno.id)) {
        toBackfill.push({ alunoId: aluno.id, instituicaoId: aluno.instituicaoId ?? null });
      }
    }
    if (toBackfill.length > 0) {
      setImmediate(async () => {
        for (const { alunoId, instituicaoId } of toBackfill) {
          try {
            const num = await gerarNumeroIdentificacaoPublica('ALUNO', instituicaoId ?? undefined);
            await prisma.user.update({ where: { id: alunoId }, data: { numeroIdentificacaoPublica: num } });
          } catch {
            /* ignora - próximo fetch trará o número */
          }
        }
      });
    }

    const sanitized = matriculas.map((m) => {
      const t = m.turma as Record<string, unknown> | null;
      if (t && 'instituicaoId' in t) {
        const { instituicaoId: _ti, ...rest } = t;
        return { ...m, turma: rest };
      }
      return m;
    });
    res.json({ data: sanitized, meta: listMeta(page, pageSize, total) });
  } catch (error) {
    next(error);
  }
};

export const getMatriculaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const matricula = await prisma.matricula.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            instituicaoId: true,
            numeroIdentificacaoPublica: true
          }
        },
        turma: {
          include: {
            curso: true,
            disciplina: true
          },
          select: {
            id: true,
            nome: true,
            instituicaoId: true,
            curso: true,
            disciplina: true
          }
        },
        mensalidades: {
          include: {
            pagamentos: { orderBy: { dataPagamento: 'desc' } },
            recibos: {
              where: { status: 'EMITIDO' },
              orderBy: { dataEmissao: 'desc' },
              take: 1,
            },
          },
        },
      }
    });

    if (!matricula) {
      throw new AppError('Matrícula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId) {
      if (matricula.aluno.instituicaoId !== filter.instituicaoId) {
        throw new AppError('Matrícula não encontrada', 404);
      }
    }

    // Resumo financeiro: pendente/pago (sem vazar instituicaoId no frontend)
    let resumoFinanceiro: { pendente: number; pago: number; ultimoRecibo: { numeroRecibo: string; dataEmissao: Date } | null } = { pendente: 0, pago: 0, ultimoRecibo: null };
    if (matricula.mensalidades?.length) {
      let ultimoRecibo: { numeroRecibo: string; dataEmissao: Date } | null = null;

      for (const m of matricula.mensalidades) {
        const valorBase = Number(m.valor);
        const valorDesconto = Number(m.valorDesconto || 0);
        const valorMulta = Number(m.valorMulta || 0);
        const valorTotal = valorBase - valorDesconto + valorMulta;
        const totalPago = m.pagamentos?.reduce((s, p) => s + Number(p.valor), 0) || 0;

        if (m.status === 'Pago' || totalPago >= valorTotal) {
          resumoFinanceiro.pago += valorTotal;
        } else {
          resumoFinanceiro.pendente += valorTotal - totalPago;
        }

        const rec = m.recibos?.[0];
        if (rec && (!ultimoRecibo || rec.dataEmissao > ultimoRecibo.dataEmissao)) {
          ultimoRecibo = { numeroRecibo: rec.numeroRecibo, dataEmissao: rec.dataEmissao };
        }
      }
      resumoFinanceiro.ultimoRecibo = ultimoRecibo;
    }

    const { mensalidades, ...matriculaBase } = matricula;
    // Não vazar instituicaoId no frontend (multi-tenant)
    const { instituicaoId: _ai, ...alunoSemInst } = matriculaBase.aluno as { instituicaoId?: string; [k: string]: unknown };
    const turmaSemInst = matriculaBase.turma && 'instituicaoId' in matriculaBase.turma
      ? (() => { const { instituicaoId: _ti, ...t } = matriculaBase.turma as { instituicaoId?: string; [k: string]: unknown }; return t; })()
      : matriculaBase.turma;
    res.json({
      ...matriculaBase,
      aluno: alunoSemInst,
      turma: turmaSemInst,
      resumoFinanceiro,
    });
  } catch (error) {
    next(error);
  }
};

export const createMatricula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO MULTI-TENANT: Rejeitar explicitamente instituicaoId do body (segurança)
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }

    // REGRA SIGA/SIGAE: Rejeitar explicitamente Ano, Classe e Semestre do body
    // Esses dados vêm da Matrícula Anual e NÃO podem ser duplicados ou sobrescritos
    if (req.body.ano !== undefined || req.body.anoLetivo !== undefined || req.body.ano_letivo !== undefined) {
      throw new AppError('Campo "ano" não é permitido. O ano letivo é obtido automaticamente da matrícula anual ativa do aluno.', 400);
    }
    if (req.body.classe !== undefined || req.body.classeId !== undefined || req.body.classe_id !== undefined || req.body.classeOuAnoCurso !== undefined) {
      throw new AppError('Campo "classe" não é permitido. A classe/ano do curso é obtida automaticamente da matrícula anual ativa do aluno.', 400);
    }
    if (req.body.semestre !== undefined || req.body.semestreId !== undefined || req.body.semestre_id !== undefined) {
      throw new AppError('Campo "semestre" não é permitido. O semestre é obtido automaticamente da turma selecionada.', 400);
    }
    if (req.body.anoLetivoId !== undefined || req.body.ano_letivo_id !== undefined) {
      throw new AppError('Campo "anoLetivoId" não é permitido. O ano letivo é obtido automaticamente da matrícula anual ativa do aluno.', 400);
    }

    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const { alunoId, turmaId, status } = req.body;

    if (!alunoId || !turmaId) {
      throw new AppError('alunoId e turmaId são obrigatórios', 400);
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
      throw new AppError('Usuário não é um aluno. Apenas usuários com role ALUNO podem ser matriculados.', 400);
    }

    // Verificar instituição
    if (filter.instituicaoId && aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este aluno', 403);
    }

    // 1.5. Buscar matrícula anual ativa do aluno
    // REGRA: Matrícula em Turma deve ter uma matrícula anual ativa prévia
    const matriculaAnual = await prisma.matriculaAnual.findFirst({
      where: {
        alunoId,
        instituicaoId: filter.instituicaoId || aluno.instituicaoId || instituicaoId,
        status: 'ATIVA',
      },
      include: {
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
        instituicao: {
          select: { tipoAcademico: true },
        },
      },
    });

    if (!matriculaAnual) {
      throw new AppError('O aluno não possui uma matrícula anual ativa. É necessário cadastrar uma matrícula anual antes de matricular em turma.', 400);
    }

    // Usar anoLetivoId da matrícula anual (não do body)
    const anoLetivoId = matriculaAnual.anoLetivoId;
    if (!anoLetivoId) {
      throw new AppError('A matrícula anual não possui um ano letivo vinculado. Por favor, atualize a matrícula anual.', 400);
    }

    const anoLetivo = matriculaAnual.anoLetivo || matriculaAnual.anoLetivoRef?.ano;
    if (!anoLetivo) {
      throw new AppError('Não foi possível determinar o ano letivo da matrícula anual.', 400);
    }

    // 2. Verificar se a turma existe e pertence à instituição - REGRA MESTRA: Incluir anoLetivoId
    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      include: {
        curso: {
          include: {
            instituicao: { select: { id: true } },
          },
        },
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
        _count: { select: { matriculas: true } },
      },
    });

    if (!turma) {
      throw new AppError('Turma não encontrada', 404);
    }

    // Verificar instituição da turma
    if (filter.instituicaoId) {
      const turmaInstituicaoId = turma.instituicaoId || turma.curso?.instituicao?.id;
      if (turmaInstituicaoId !== filter.instituicaoId) {
        throw new AppError('Acesso negado a esta turma', 403);
      }
    }

    // Verificar se aluno e turma pertencem à mesma instituição
    if (aluno.instituicaoId && turma.instituicaoId && aluno.instituicaoId !== turma.instituicaoId) {
      throw new AppError('Aluno e turma devem pertencer à mesma instituição', 400);
    }

    // Validar que o anoLetivoId da matrícula anual existe e pertence à instituição
    const anoLetivoRecord = matriculaAnual.anoLetivoRef || await prisma.anoLetivo.findFirst({
      where: { id: anoLetivoId, instituicaoId },
    });

    if (!anoLetivoRecord) {
      throw new AppError('Ano letivo da matrícula anual não encontrado ou não pertence à sua instituição', 404);
    }

    // Validar que o ano letivo da turma corresponde ao da matrícula anual
    if (turma.anoLetivoId && turma.anoLetivoId !== anoLetivoId) {
      throw new AppError('A turma selecionada pertence a um ano letivo diferente da matrícula anual do aluno.', 400);
    }

    // VALIDAÇÃO PADRÃO SIGA/SIGAE: Regras por tipo de instituição
    // REGRA POR TIPO DE INSTITUIÇÃO:
    // ENSINO SUPERIOR: Curso obrigatório, Semestre obrigatório, Sem matrícula/nota sem curso
    // ENSINO SECUNDÁRIO: Classe obrigatória, Curso opcional, Sem semestre
    const tipoAcademico = req.user?.tipoAcademico || matriculaAnual.instituicao?.tipoAcademico || null;
    
    if (tipoAcademico === 'SUPERIOR' && !matriculaAnual.cursoId) {
      throw new AppError(
        'Não é possível matricular o estudante em turma. A matrícula anual não possui curso definido. ' +
        'No Ensino Superior, é obrigatório definir um curso na matrícula anual antes de matricular em turmas. ' +
        'Acesse a matrícula anual do estudante e defina o curso.',
        400
      );
    }
    
    if (tipoAcademico === 'SECUNDARIO' && !matriculaAnual.classeId) {
      throw new AppError(
        'Não é possível matricular o estudante em turma. A matrícula anual não possui classe definida. ' +
        'No Ensino Secundário, é obrigatório definir uma classe na matrícula anual antes de matricular em turmas. ' +
        'Acesse a matrícula anual do estudante e defina a classe.',
        400
      );
    }

    // Validar compatibilidade da turma com a matrícula anual
    // Para Ensino Superior: turma deve ter o mesmo cursoId
    if (matriculaAnual.nivelEnsino === 'SUPERIOR' && matriculaAnual.cursoId) {
      if (turma.cursoId !== matriculaAnual.cursoId) {
        throw new AppError('A turma selecionada pertence a um curso diferente da matrícula anual do aluno.', 400);
      }
    }

    // Para Ensino Secundário: turma deve ter a mesma classeId (se a turma tiver classe)
    if (matriculaAnual.nivelEnsino === 'SECUNDARIO' && matriculaAnual.classeId) {
      if (turma.classeId && turma.classeId !== matriculaAnual.classeId) {
        throw new AppError('A turma selecionada pertence a uma classe diferente da matrícula anual do aluno.', 400);
      }
    }

    // 3. Verificar capacidade da turma
    if (turma._count.matriculas >= turma.capacidade) {
      throw new AppError('Turma já atingiu capacidade máxima', 400);
    }

    // 4. Verificar se já está matriculado nesta turma
    const existing = await prisma.matricula.findFirst({
      where: { alunoId, turmaId },
    });

    if (existing) {
      throw new AppError('Aluno já matriculado nesta turma', 409);
    }

    // 5. Criar matrícula - REGRA MESTRA: Ano Letivo vem da Matrícula Anual
    // Garantir que status seja um valor válido do enum StatusMatricula
    const statusFinal = (status && ['Ativa', 'Trancada', 'Concluida', 'Cancelada'].includes(status)) 
      ? (status as StatusMatricula) 
      : StatusMatricula.Ativa;
    
    const matriculaData: any = {
      alunoId,
      turmaId,
      status: statusFinal,
      anoLetivo: anoLetivoRecord.ano,
      anoLetivoId, // OBRIGATÓRIO - vem da Matrícula Anual
    };
    
    const matricula = await prisma.matricula.create({
      data: matriculaData,
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
        turma: {
          include: {
            curso: { select: { id: true, nome: true } },
            disciplina: { select: { id: true, nome: true } },
            turno: { select: { id: true, nome: true } },
          },
        },
      },
    });

    // 6. Gerar mensalidade (lançamento PENDENTE) - recibo só ao confirmar pagamento
    // Apenas gerar se a matrícula está ativa
    if ((status || 'Ativa') === 'Ativa') {
      const instituicaoIdFinal = getInstituicaoIdFromFilter(filter) || aluno.instituicaoId || turma.instituicaoId || turma.curso?.instituicao?.id;
      gerarMensalidadeAutomatica(alunoId, turmaId, instituicaoIdFinal, matricula.id).catch((error) => {
        // Log erro mas não interrompe a resposta
        console.error('[createMatricula] Erro ao gerar mensalidade automática:', error);
      });
    }

    // 7. Enviar e-mail e notificação em background - não bloquear resposta (reduz atraso)
    if (matricula.aluno?.email && (status || 'Ativa') === 'Ativa') {
      const { EmailService } = await import('../services/email.service.js');
      EmailService.sendEmail(
        req,
        matricula.aluno.email,
        'MATRICULA_ALUNO',
        {
          nomeAluno: matricula.aluno.nomeCompleto || 'Aluno',
          curso: matricula.turma?.curso?.nome || 'N/A',
          turma: matricula.turma?.nome || 'N/A',
          anoLetivo: matricula.anoLetivo?.toString() || 'N/A',
          numeroMatricula: matricula.aluno.numeroIdentificacaoPublica || matricula.aluno.numeroIdentificacao || undefined,
        },
        {
          destinatarioNome: matricula.aluno.nomeCompleto || undefined,
          instituicaoId: getInstituicaoIdFromFilter(filter) || aluno.instituicaoId || undefined,
        }
      ).catch((emailError: any) => {
        console.error('[createMatricula] Erro ao enviar e-mail (não crítico):', emailError?.message);
      });
    }

    // Notificação administrativa em background - não bloquear resposta
    if ((status || 'Ativa') === 'Ativa') {
      import('../services/notificacao.service.js').then(({ NotificacaoService }) =>
        NotificacaoService.notificarMatriculaRealizada(
          req,
          alunoId,
          matricula.turma?.nome || 'N/A',
          getInstituicaoIdFromFilter(filter) || aluno.instituicaoId || undefined
        )
      ).catch((notifError: any) => {
        console.error('[createMatricula] Erro ao criar notificação (não crítico):', notifError?.message);
      });
    }

    res.status(201).json(matricula);
  } catch (error) {
    next(error);
  }
};

export const updateMatricula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status, turmaId } = req.body;
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    const existing = await prisma.matricula.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            instituicaoId: true
          }
        },
        turma: {
          select: {
            id: true,
            nome: true,
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Matrícula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Matrícula não encontrada', 404);
    }

    // VALIDAÇÃO: Transferência de turma (permitirTransferenciaTurma)
    if (turmaId && turmaId !== existing.turmaId) {
      // Buscar parâmetros do sistema
      const parametrosSistema = await prisma.parametrosSistema.findUnique({
        where: { instituicaoId },
      });

      const permitirTransferenciaTurma = parametrosSistema?.permitirTransferenciaTurma ?? true;

      if (!permitirTransferenciaTurma) {
        throw new AppError(
          'Transferência de turma está desativada para esta instituição. ' +
          'Entre em contato com a administração para mais informações.',
          403
        );
      }

      // Validar se a nova turma existe e pertence à instituição
      const novaTurma = await prisma.turma.findFirst({
        where: {
          id: turmaId,
          ...filter,
        },
        include: {
          _count: { select: { matriculas: true } },
        },
      });

      if (!novaTurma) {
        throw new AppError('Nova turma não encontrada ou não pertence à sua instituição', 404);
      }

      // Verificar capacidade da nova turma
      if (novaTurma._count.matriculas >= novaTurma.capacidade) {
        throw new AppError('A nova turma já atingiu a capacidade máxima', 400);
      }

      // Verificar se aluno já está matriculado na nova turma
      const matriculaExistente = await prisma.matricula.findFirst({
        where: {
          alunoId: existing.alunoId,
          turmaId,
        },
      });

      if (matriculaExistente && matriculaExistente.id !== id) {
        throw new AppError('Aluno já está matriculado nesta turma', 409);
      }
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (turmaId !== undefined && turmaId !== existing.turmaId) {
      updateData.turmaId = turmaId;
    }

    const matricula = await prisma.matricula.update({
      where: { id },
      data: updateData,
      include: {
        aluno: true,
        turma: true
      }
    });

    res.json(matricula);
  } catch (error) {
    next(error);
  }
};

export const deleteMatricula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.matricula.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            id: true,
            instituicaoId: true
          }
        }
      }
    });

    if (!existing) {
      throw new AppError('Matrícula não encontrada', 404);
    }

    // CRITICAL: Multi-tenant check
    if (filter.instituicaoId && existing.aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Matrícula não encontrada', 404);
    }

    // Auditoria: quem apagou matrícula (rastreabilidade total)
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ALUNOS,
      acao: AcaoAuditoria.DELETE,
      entidade: EntidadeAuditoria.MATRICULA,
      entidadeId: id,
      dadosAnteriores: {
        alunoId: existing.alunoId,
        turmaId: existing.turmaId,
        status: existing.status,
        anoLetivoId: existing.anoLetivoId,
      },
      observacao: 'Matrícula removida',
    }).catch((err) => console.error('[deleteMatricula] Erro audit:', err));

    await prisma.matricula.delete({ where: { id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getMatriculasByAluno = async (req: Request, res: Response, next: NextFunction) => {
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

    const matriculas = await prisma.matricula.findMany({
      where: { alunoId },
      include: {
        turma: {
          include: {
            curso: true,
            disciplina: true,
            turno: true,
            instituicao: { select: { id: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter by institution if needed (extra security layer)
    const filtered = filter.instituicaoId
      ? matriculas.filter(m => m.turma?.instituicaoId === filter.instituicaoId)
      : matriculas;

    res.json(filtered);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar alunos de uma turma específica do professor
 * Garante que o professor só veja alunos das suas próprias turmas
 */
export const getAlunosByTurmaProfessor = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id) - middleware resolveProfessor aplicado
    if (!req.professor?.id) {
      throw new AppError(messages.professor.naoIdentificado, 500);
    }
    const professorId = req.professor.id; // professores.id (NÃO users.id)
    const { turmaId } = req.params;
    const filter = addInstitutionFilter(req);

    if (!turmaId) {
      throw new AppError('ID da turma é obrigatório', 400);
    }

    // 1. Verificar se a turma pertence ao professor e à instituição
    // REGRA: Verificar através dos planos de ensino do professor (novo padrão)
    const planoEnsino = await prisma.planoEnsino.findFirst({
      where: {
        turmaId: turmaId,
        professorId,
        ...filter,
      },
      select: {
        turmaId: true,
        professorId: true,
      },
    });

    if (!planoEnsino) {
      throw new AppError('Turma não encontrada ou você não tem permissão para acessá-la. Verifique se existe um Plano de Ensino vinculando você a esta turma.', 404);
    }

    // Buscar turma para validar
    const turma = await prisma.turma.findFirst({
      where: {
        id: turmaId,
        ...filter,
      },
      select: {
        id: true,
        nome: true,
        instituicaoId: true,
      },
    });

    if (!turma) {
      throw new AppError('Turma não encontrada ou não pertence à sua instituição', 404);
    }

    // 2. Buscar matrículas ativas da turma
    const matriculas = await prisma.matricula.findMany({
      where: {
        turmaId,
        status: 'Ativa' // Apenas matrículas ativas
      },
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacao: true,
            numeroIdentificacaoPublica: true,
            statusAluno: true,
            instituicaoId: true
          }
        }
      },
      orderBy: {
        aluno: {
          nomeCompleto: 'asc'
        }
      }
    });

    // 3. Filtrar alunos que pertencem à mesma instituição (segurança adicional)
    const alunosFiltrados = matriculas.filter(m => {
      if (!filter.instituicaoId) return true; // SUPER_ADMIN pode ver todos
      return m.aluno.instituicaoId === filter.instituicaoId;
    });

    res.json({
      turma: {
        id: turma.id,
        nome: turma.nome
      },
      alunos: alunosFiltrados.map(m => ({
        id: m.aluno.id,
        nomeCompleto: m.aluno.nomeCompleto,
        email: m.aluno.email,
        numeroIdentificacao: m.aluno.numeroIdentificacao,
        numeroIdentificacaoPublica: m.aluno.numeroIdentificacaoPublica,
        statusAluno: m.aluno.statusAluno,
        matriculaId: m.id,
        dataMatricula: m.dataMatricula,
        statusMatricula: m.status
      }))
    });
  } catch (error) {
    next(error);
  }
};

