import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

/**
 * Listar anos letivos
 */
export const listAnosLetivos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const anosLetivos = await prisma.anoLetivo.findMany({
      where: filter,
      orderBy: {
        ano: 'desc',
      },
      include: {
        usuarioAtivou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        usuarioEncerrou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    res.json(anosLetivos);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar ano letivo por ano
 */
export const getAnoLetivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ano } = req.query;

    if (!ano) {
      throw new AppError('Ano é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);

    const anoLetivo = await prisma.anoLetivo.findFirst({
      where: {
        ano: Number(ano),
        ...filter,
      },
      include: {
        usuarioAtivou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        usuarioEncerrou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        semestres: {
          orderBy: { numero: 'asc' },
        },
        trimestres: {
          orderBy: { numero: 'asc' },
        },
      },
    });

    if (!anoLetivo) {
      return res.json(null);
    }

    res.json(anoLetivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar ano letivo
 */
export const createAnoLetivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ano, dataInicio, dataFim, observacoes } = req.body;

    if (!ano || !dataInicio) {
      throw new AppError('Ano e DataInicio são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se já existe ano letivo
    const anoExistente = await prisma.anoLetivo.findFirst({
      where: {
        ano: Number(ano),
        ...filter,
      },
    });

    if (anoExistente) {
      throw new AppError(`Já existe um ano letivo ${ano}`, 400);
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar se dataInicio < dataFim (se dataFim fornecida)
    const dataInicioObj = new Date(dataInicio);
    const dataFimObj = dataFim ? new Date(dataFim) : null;
    
    if (dataFimObj && dataInicioObj >= dataFimObj) {
      throw new AppError('A data de início deve ser anterior à data de fim do ano letivo.', 400);
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar se não há sobreposição com outros anos letivos
    // Só valida se dataFim fornecida (anos letivos sem dataFim podem coexistir)
    if (dataFimObj) {
      const anosSobrepostos = await prisma.anoLetivo.findMany({
        where: {
          ...filter,
          OR: [
            // Ano letivo que começa antes e termina depois do início do novo ano
            {
              dataInicio: { lte: dataInicioObj },
              dataFim: { gte: dataInicioObj, not: null },
            },
            // Ano letivo que começa dentro do período do novo ano
            {
              dataInicio: { gte: dataInicioObj, lte: dataFimObj },
              dataFim: { not: null },
            },
            // Ano letivo que começa antes e termina dentro do período do novo ano
            {
              dataInicio: { lte: dataInicioObj },
              dataFim: { gte: dataInicioObj, lte: dataFimObj, not: null },
            },
          ],
        },
      });

      if (anosSobrepostos.length > 0) {
        throw new AppError(
          `Não é possível criar ano letivo com datas sobrepostas. Existe(m) ${anosSobrepostos.length} ano(s) letivo(s) com períodos sobrepostos.`,
          400
        );
      }
    }

    const anoLetivo = await prisma.anoLetivo.create({
      data: {
        ano: Number(ano),
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : null,
        observacoes: observacoes || null,
        instituicaoId,
        status: 'PLANEJADO',
      },
      include: {
        usuarioAtivou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.CREATE,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: anoLetivo.id,
      instituicaoId,
      dadosNovos: {
        ano: anoLetivo.ano,
        dataInicio: anoLetivo.dataInicio,
        dataFim: anoLetivo.dataFim,
        status: anoLetivo.status,
      },
    });

    res.status(201).json(anoLetivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar ano letivo
 */
export const updateAnoLetivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim, observacoes } = req.body;

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Buscar ano letivo
    const anoLetivoAtual = await prisma.anoLetivo.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!anoLetivoAtual) {
      throw new AppError('Ano letivo não encontrado ou não pertence à sua instituição', 404);
    }

    // Não permitir editar se já foi ativado ou encerrado
    if (anoLetivoAtual.status === 'ATIVO' || anoLetivoAtual.status === 'ENCERRADO') {
      throw new AppError(`Não é possível editar um ano letivo com status ${anoLetivoAtual.status}`, 400);
    }

    const dadosAnteriores = {
      dataInicio: anoLetivoAtual.dataInicio,
      dataFim: anoLetivoAtual.dataFim,
      observacoes: anoLetivoAtual.observacoes,
    };

    const updateData: any = {};
    if (dataInicio !== undefined) updateData.dataInicio = new Date(dataInicio);
    if (dataFim !== undefined) updateData.dataFim = dataFim ? new Date(dataFim) : null;
    if (observacoes !== undefined) updateData.observacoes = observacoes || null;

    const anoLetivo = await prisma.anoLetivo.update({
      where: { id },
      data: updateData,
      include: {
        usuarioAtivou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.UPDATE,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: anoLetivo.id,
      instituicaoId,
      dadosAnteriores,
      dadosNovos: updateData,
    });

    res.json(anoLetivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Ativar ano letivo
 */
export const ativarAnoLetivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivoId } = req.body;

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões
    const userRoles = req.user?.roles || [];
    const podeAtivar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeAtivar) {
      throw new AppError('Você não tem permissão para ativar anos letivos', 403);
    }

    const filter = addInstitutionFilter(req);

    // Buscar ano letivo
    const anoLetivo = await prisma.anoLetivo.findFirst({
      where: {
        id: anoLetivoId,
        ...filter,
      },
    });

    if (!anoLetivo) {
      throw new AppError('Ano letivo não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se está encerrado ou cancelado
    if (anoLetivo.status === 'ENCERRADO') {
      throw new AppError('Não é possível ativar um ano letivo encerrado', 400);
    }

    // Se já está ativo, retornar sucesso (idempotência)
    if (anoLetivo.status === 'ATIVO') {
      res.json({
        message: 'Ano letivo já estava ativo',
        anoLetivo,
      });
      return;
    }

    // VALIDAÇÃO PROFISSIONAL CRÍTICA: Não pode haver múltiplos anos letivos ATIVOS simultaneamente
    const anoAtivoExistente = await prisma.anoLetivo.findFirst({
      where: {
        ...filter,
        status: 'ATIVO',
        id: { not: anoLetivo.id },
      },
    });

    if (anoAtivoExistente) {
      throw new AppError(
        `Não é possível ativar o ano letivo ${anoLetivo.ano}. Já existe um ano letivo ATIVO (${anoAtivoExistente.ano}). É necessário encerrar o ano letivo ativo antes de ativar um novo.`,
        400
      );
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar se dataInicio < dataFim (se dataFim fornecida)
    if (anoLetivo.dataFim && anoLetivo.dataInicio >= anoLetivo.dataFim) {
      throw new AppError('A data de início deve ser anterior à data de fim do ano letivo.', 400);
    }

    // Atualizar status para ATIVO
    const anoLetivoAtualizado = await prisma.anoLetivo.update({
      where: { id: anoLetivo.id },
      data: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
      },
    });

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.ANO_LETIVO_ATIVADO,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: anoLetivo.id,
      instituicaoId,
      dadosAnteriores: {
        status: 'PLANEJADO',
        dataInicio: anoLetivo.dataInicio,
      },
      dadosNovos: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
      },
      observacao: `Ano letivo ${anoLetivo.ano} ativado manualmente por ${userId}.`,
    });

    res.json({
      message: 'Ano letivo ativado com sucesso',
      anoLetivo: anoLetivoAtualizado,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Verificar se ano letivo está encerrado (endpoint para frontend)
 */
export const verificarAnoLetivoEncerradoEndpoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivoId } = req.query;
    const instituicaoId = requireTenantScope(req);

    const { verificarAnoLetivoEncerrado } = await import('../middlewares/bloquearAnoLetivoEncerrado.middleware.js');
    
    const verificacao = await verificarAnoLetivoEncerrado(
      anoLetivoId as string | null | undefined,
      instituicaoId
    );

    res.json(verificacao);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar ano letivo ativo da instituição
 */
export const getAnoLetivoAtivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    const anoLetivoAtivo = await prisma.anoLetivo.findFirst({
      where: {
        ...filter,
        status: 'ATIVO',
      },
      orderBy: {
        ano: 'desc',
      },
      include: {
        usuarioAtivou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
    });

    if (!anoLetivoAtivo) {
      return res.json(null);
    }

    res.json(anoLetivoAtivo);
  } catch (error) {
    next(error);
  }
};

/**
 * Encerrar ano letivo
 */
export const encerrarAnoLetivo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivoId, justificativa } = req.body;

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões
    const userRoles = req.user?.roles || [];
    const podeEncerrar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeEncerrar) {
      throw new AppError('Você não tem permissão para encerrar anos letivos', 403);
    }

    const filter = addInstitutionFilter(req);

    // Buscar ano letivo
    const anoLetivo = await prisma.anoLetivo.findFirst({
      where: {
        id: anoLetivoId,
        ...filter,
      },
      include: {
        semestres: true,
        trimestres: true,
      },
    });

    if (!anoLetivo) {
      throw new AppError('Ano letivo não encontrado ou não pertence à sua instituição', 404);
    }

    // Buscar tipo acadêmico da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    const tipoAcademico = instituicao?.tipoAcademico || null;

    // Validações por tipo de instituição
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: verificar semestres
      const todosSemestresEncerrados = anoLetivo.semestres.every(s => s.status === 'ENCERRADO');
      if (!todosSemestresEncerrados) {
        const semestresPendentes = anoLetivo.semestres.filter(s => s.status !== 'ENCERRADO');
        throw new AppError(
          `Não é possível encerrar o ano letivo. Os seguintes semestres ainda não estão encerrados: ${semestresPendentes.map(s => s.numero).join(', ')}`,
          400
        );
      }

      // Verificar se todas as avaliações foram lançadas e processadas
      const avaliacoesPendentes = await prisma.avaliacao.count({
        where: {
          instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivo.id,
          },
          fechada: false,
        },
      });

      if (avaliacoesPendentes > 0) {
        throw new AppError(
          `Não é possível encerrar o ano letivo. Existem ${avaliacoesPendentes} avaliação(ões) ainda não fechadas.`,
          400
        );
      }

      // Verificar se exames/recursos foram processados
      // Buscar avaliações do tipo PROVA_FINAL ou RECUPERACAO que não foram fechadas
      const examesPendentes = await prisma.avaliacao.count({
        where: {
          instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivo.id,
          },
          tipo: {
            in: ['PROVA_FINAL', 'RECUPERACAO'],
          },
          fechada: false,
        },
      });

      if (examesPendentes > 0) {
        throw new AppError(
          `Não é possível encerrar o ano letivo. Existem ${examesPendentes} exame(s)/recurso(s) ainda não processados.`,
          400
        );
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: verificar trimestres
      const todosTrimestresEncerrados = anoLetivo.trimestres.every(t => t.status === 'ENCERRADO');
      if (!todosTrimestresEncerrados) {
        const trimestresPendentes = anoLetivo.trimestres.filter(t => t.status !== 'ENCERRADO');
        throw new AppError(
          `Não é possível encerrar o ano letivo. Os seguintes trimestres ainda não estão encerrados: ${trimestresPendentes.map(t => t.numero).join(', ')}`,
          400
        );
      }

      // Verificar se todas as avaliações por trimestre foram consolidadas
      const avaliacoesPendentes = await prisma.avaliacao.count({
        where: {
          instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivo.id,
          },
          fechada: false,
        },
      });

      if (avaliacoesPendentes > 0) {
        throw new AppError(
          `Não é possível encerrar o ano letivo. Existem ${avaliacoesPendentes} avaliação(ões) ainda não fechadas.`,
          400
        );
      }

      // Verificar se médias finais foram calculadas
      // Para Ensino Secundário, verificar se todos os alunos têm notas em avaliações fechadas
      const planosEnsino = await prisma.planoEnsino.findMany({
        where: {
          instituicaoId,
          anoLetivoId: anoLetivo.id,
        },
        include: {
          turma: {
            include: {
              matriculas: {
                where: {
                  status: 'Ativa',
                },
                select: {
                  alunoId: true,
                },
              },
            },
          },
        },
      });

      // Verificar se há alunos sem notas em avaliações fechadas
      let alunosSemNotas = 0;
      for (const plano of planosEnsino) {
        if (plano.turma?.matriculas) {
          // Buscar avaliações fechadas deste plano
          const avaliacoesFechadas = await prisma.avaliacao.findMany({
            where: {
              planoEnsinoId: plano.id,
              fechada: true,
            },
            select: {
              id: true,
            },
          });

          // Para cada aluno da turma, verificar se tem notas em todas as avaliações fechadas
          for (const matricula of plano.turma.matriculas) {
            for (const avaliacao of avaliacoesFechadas) {
              const temNota = await prisma.nota.count({
                where: {
                  avaliacaoId: avaliacao.id,
                  alunoId: matricula.alunoId,
                },
              });

              if (temNota === 0) {
                alunosSemNotas++;
                break; // Contar aluno apenas uma vez
              }
            }
          }
        }
      }

      if (alunosSemNotas > 0) {
        throw new AppError(
          `Não é possível encerrar o ano letivo. Existem ${alunosSemNotas} aluno(s) sem notas em avaliações fechadas.`,
          400
        );
      }
    } else {
      // Tipo não identificado: verificar ambos (compatibilidade)
      const todosSemestresEncerrados = anoLetivo.semestres.every(s => s.status === 'ENCERRADO');
      const todosTrimestresEncerrados = anoLetivo.trimestres.every(t => t.status === 'ENCERRADO');

      if (!todosSemestresEncerrados || !todosTrimestresEncerrados) {
        throw new AppError(
          'Não é possível encerrar o ano letivo. Todos os semestres/trimestres devem estar encerrados primeiro.',
          400
        );
      }
    }

    // Coletar estatísticas para auditoria (antes de encerrar)
    const [totalTurmas, totalAlunos, totalAvaliacoes, totalNotas, totalAulas, totalPresencas] = await Promise.all([
      prisma.turma.count({
        where: {
          instituicaoId,
          anoLetivoId: anoLetivo.id,
        },
      }),
      prisma.matriculaAnual.count({
        where: {
          instituicaoId,
          anoLetivoId: anoLetivo.id,
          status: 'ATIVA',
        },
      }),
      prisma.avaliacao.count({
        where: {
          instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivo.id,
          },
        },
      }),
      prisma.nota.count({
        where: {
          instituicaoId,
          avaliacao: {
            planoEnsino: {
              anoLetivoId: anoLetivo.id,
            },
          },
        },
      }),
      prisma.aulaLancada.count({
        where: {
          instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivo.id,
          },
        },
      }),
      prisma.presenca.count({
        where: {
          instituicaoId,
          aulaLancada: {
            planoEnsino: {
              anoLetivoId: anoLetivo.id,
            },
          },
        },
      }),
    ]);

    // Atualizar status para ENCERRADO
    const anoLetivoAtualizado = await prisma.anoLetivo.update({
      where: { id: anoLetivo.id },
      data: {
        status: 'ENCERRADO',
        encerradoEm: new Date(),
        encerradoPor: userId,
      },
    });

    // CRÍTICO: Gerar snapshot do histórico acadêmico (IMUTÁVEL)
    const { gerarSnapshotHistorico } = await import('../services/historicoAcademico.service.js');
    let resultadoHistorico: { totalGerado: number; erros: string[] } | null = null;
    
    try {
      resultadoHistorico = await gerarSnapshotHistorico(
        anoLetivo.id, 
        instituicaoId, 
        userId,
        req.user?.tipoAcademico || null // CRÍTICO: tipoAcademico vem do JWT
      );
    } catch (error: any) {
      // Log do erro mas não bloqueia o encerramento
      console.error(`Erro ao gerar histórico acadêmico para ano letivo ${anoLetivo.id}:`, error);
    }

    // REGRA PROGRESSÃO: Calcular status_final e classe_proxima para cada MatriculaAnual do ano
    try {
      const { calcularStatusFinalAno, obterClasseProximaSugerida } = await import('../services/progressaoAcademica.service.js');
      const matriculasAnuais = await prisma.matriculaAnual.findMany({
        where: {
          instituicaoId,
          OR: [
            { anoLetivoId: anoLetivo.id },
            { anoLetivo: anoLetivo.ano },
          ],
        },
        include: { classe: { select: { id: true, nome: true, ordem: true } } },
      });

      for (const ma of matriculasAnuais) {
        try {
          const resultado = await calcularStatusFinalAno(ma.alunoId, anoLetivo.id, instituicaoId);
          const sugestao = await obterClasseProximaSugerida(
            {
              classeOuAnoCurso: ma.classeOuAnoCurso,
              classeId: ma.classeId,
              cursoId: ma.cursoId,
            },
            resultado.statusFinal,
            instituicaoId,
            tipoAcademico
          );

          await prisma.matriculaAnual.update({
            where: { id: ma.id },
            data: {
              statusFinal: resultado.statusFinal,
              classeProximaSugerida: sugestao.classeProximaSugerida,
              classeProximaSugeridaId: sugestao.classeProximaSugeridaId,
            },
          });
        } catch (err: any) {
          console.error(`[encerrarAnoLetivo] Erro ao atualizar MatriculaAnual ${ma.id}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error('[encerrarAnoLetivo] Erro ao processar progressão acadêmica (não crítico):', err?.message);
    }

    // Registrar auditoria completa com estatísticas
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.ANO_LETIVO_ENCERRADO,
      entidade: EntidadeAuditoria.ANO_LETIVO,
      entidadeId: anoLetivo.id,
      instituicaoId,
      dadosAnteriores: {
        status: anoLetivo.status,
      },
      dadosNovos: {
        status: 'ENCERRADO',
        encerradoEm: new Date(),
        encerradoPor: userId,
        estatisticas: {
          totalTurmas,
          totalAlunos,
          totalAvaliacoes,
          totalNotas,
          totalAulas,
          totalPresencas,
          semestresEncerrados: tipoAcademico === 'SUPERIOR' ? anoLetivo.semestres.filter(s => s.status === 'ENCERRADO').length : 0,
          trimestresEncerrados: tipoAcademico === 'SECUNDARIO' ? anoLetivo.trimestres.filter(t => t.status === 'ENCERRADO').length : 0,
          historicoAcademicoGerado: resultadoHistorico?.totalGerado || 0,
        },
      },
      observacao: justificativa || `Ano letivo ${anoLetivo.ano} encerrado por ${userId}. Estatísticas: ${totalTurmas} turmas, ${totalAlunos} alunos, ${totalAvaliacoes} avaliações, ${totalNotas} notas, ${totalAulas} aulas, ${totalPresencas} presenças. Histórico acadêmico: ${resultadoHistorico?.totalGerado || 0} registros gerados.`,
    });

    // Enviar e-mail de encerramento de ano letivo para ADMINs da instituição (não abortar se falhar)
    try {
      const { EmailService } = await import('../services/email.service.js');
      
      // Buscar todos os ADMINs da instituição
      const admins = await prisma.user.findMany({
        where: {
          instituicaoId,
          roles: {
            some: {
              role: 'ADMIN',
            },
          },
        },
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
        },
      });

      // Enviar e-mail para cada ADMIN
      for (const admin of admins) {
        if (admin.email) {
          try {
            await EmailService.sendEmail(
              req,
              admin.email,
              'ENCERRAMENTO_ANO_LETIVO',
              {
                nomeDestinatario: admin.nomeCompleto || 'Administrador',
                anoLetivo: anoLetivo.ano.toString(),
                dataEncerramento: new Date().toLocaleDateString('pt-BR'),
                estatisticas: {
                  totalTurmas,
                  totalAlunos,
                  totalAvaliacoes,
                  totalNotas,
                  totalAulas,
                  totalPresencas,
                },
              },
              {
                destinatarioNome: admin.nomeCompleto || undefined,
                instituicaoId: instituicaoId || undefined,
              }
            );
          } catch (emailError: any) {
            console.error(`[encerrarAnoLetivo] Erro ao enviar e-mail para ${admin.email} (não crítico):`, emailError.message);
          }
        }
      }
    } catch (emailError: any) {
      // Log do erro mas não abortar encerramento
      console.error('[encerrarAnoLetivo] Erro ao enviar e-mails (não crítico):', emailError.message);
    }

    res.json({
      message: 'Ano letivo encerrado com sucesso',
      anoLetivo: anoLetivoAtualizado,
      estatisticas: {
        totalTurmas,
        totalAlunos,
        totalAvaliacoes,
        totalNotas,
        totalAulas,
        totalPresencas,
        historicoAcademicoGerado: resultadoHistorico?.totalGerado || 0,
      },
      historicoAcademico: resultadoHistorico,
    });
  } catch (error) {
    next(error);
  }
};

