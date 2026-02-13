import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * Verificar se um trimestre está encerrado
 */
export const verificarTrimestreEncerrado = async (
  instituicaoId: string,
  anoLetivo: number,
  trimestre: number
): Promise<boolean> => {
  const encerramento = await prisma.encerramentoAcademico.findFirst({
    where: {
      instituicaoId,
      anoLetivo,
      periodo: `TRIMESTRE_${trimestre}` as any,
      status: {
        in: ['ENCERRADO'],
      },
    },
  });

  return !!encerramento;
};

/**
 * Verificar se o ano letivo está encerrado
 */
export const verificarAnoEncerrado = async (
  instituicaoId: string,
  anoLetivo: number
): Promise<boolean> => {
  const encerramento = await prisma.encerramentoAcademico.findFirst({
    where: {
      instituicaoId,
      anoLetivo,
      periodo: 'ANO',
      status: {
        in: ['ENCERRADO'],
      },
    },
  });

  return !!encerramento;
};

/**
 * Verificar pré-requisitos para encerramento de trimestre
 */
const verificarPreRequisitosTrimestre = async (
  instituicaoId: string,
  anoLetivo: number,
  trimestre: number
): Promise<{ valido: boolean; erros: string[] }> => {
  const erros: string[] = [];

  // 1. Verificar se todas as aulas do trimestre estão lançadas
  const planos = await prisma.planoEnsino.findMany({
    where: {
      instituicaoId,
      anoLetivo,
    },
    include: {
      aulas: {
        where: {
          trimestre,
        },
        include: {
          aulasLancadas: true,
        },
      },
    },
  });

  for (const plano of planos) {
    for (const aula of plano.aulas) {
      const totalLancado = aula.aulasLancadas.length;
      if (totalLancado < aula.quantidadeAulas) {
        erros.push(
          `Aula "${aula.titulo}" tem apenas ${totalLancado}/${aula.quantidadeAulas} aulas lançadas`
        );
      }
    }
  }

  // 2. Verificar se todas as aulas lançadas têm presenças
  const aulasLancadas = await prisma.aulaLancada.findMany({
    where: {
      instituicaoId,
      planoAula: {
        trimestre,
        planoEnsino: {
          anoLetivo,
        },
      },
    },
    include: {
      presencas: true,
      planoAula: {
        include: {
          planoEnsino: {
            include: {
              disciplina: true,
            },
          },
        },
      },
    },
  });

  for (const aulaLancada of aulasLancadas) {
    // Buscar alunos matriculados na disciplina
    const alunosMatriculados = await prisma.alunoDisciplina.count({
      where: {
        disciplinaId: aulaLancada.planoAula.planoEnsino.disciplinaId,
        ano: anoLetivo,
      },
    });

    if (aulaLancada.presencas.length < alunosMatriculados) {
      erros.push(
        `Aula de ${aulaLancada.planoAula.planoEnsino.disciplina.nome} em ${aulaLancada.data.toLocaleDateString()} não tem todas as presenças registradas`
      );
    }
  }

  // 3. Verificar se todas as avaliações do trimestre estão concluídas
  const avaliacoes = await prisma.avaliacao.findMany({
    where: {
      instituicaoId,
      trimestre,
      planoEnsino: {
        anoLetivo,
      },
      fechada: false,
    },
    include: {
      planoEnsino: {
        include: {
          disciplina: true,
        },
      },
    },
  });

  if (avaliacoes.length > 0) {
    erros.push(
      `${avaliacoes.length} avaliação(ões) ainda não estão fechadas no ${trimestre}º trimestre`
    );
  }

  return {
    valido: erros.length === 0,
    erros,
  };
};

/**
 * Verificar pré-requisitos para encerramento de ano letivo
 */
const verificarPreRequisitosAno = async (
  instituicaoId: string,
  anoLetivo: number,
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null
): Promise<{ valido: boolean; erros: string[] }> => {
  const erros: string[] = [];

  // 1. Verificar se todos os períodos estão encerrados (baseado no tipo acadêmico)
  if (tipoAcademico === 'SECUNDARIO') {
    // Ensino Secundário: buscar trimestres do banco e verificar se cada um está encerrado
    const trimestres = await prisma.trimestre.findMany({
      where: {
        instituicaoId,
        anoLetivo,
      },
      select: {
        numero: true,
      },
      orderBy: {
        numero: 'asc',
      },
    });

    if (trimestres.length === 0) {
      erros.push('Não há trimestres cadastrados para este ano letivo. Cadastre trimestres antes de encerrar o ano letivo.');
    } else {
      for (const trimestre of trimestres) {
        const encerramento = await prisma.encerramentoAcademico.findFirst({
          where: {
            instituicaoId,
            anoLetivo,
            periodo: `TRIMESTRE_${trimestre.numero}` as any,
            status: 'ENCERRADO',
          },
        });

        if (!encerramento) {
          erros.push(`Trimestre ${trimestre.numero} ainda não está encerrado`);
        }
      }
    }
  } else if (tipoAcademico === 'SUPERIOR') {
    // Ensino Superior: buscar semestres do banco e verificar se cada um está encerrado
    const semestres = await prisma.semestre.findMany({
      where: {
        instituicaoId,
        anoLetivo,
      },
      select: {
        numero: true,
      },
      orderBy: {
        numero: 'asc',
      },
    });

    if (semestres.length === 0) {
      erros.push('Não há semestres cadastrados para este ano letivo. Cadastre semestres antes de encerrar o ano letivo.');
    } else {
      for (const semestre of semestres) {
        const encerramento = await prisma.encerramentoAcademico.findFirst({
          where: {
            instituicaoId,
            anoLetivo,
            periodo: `SEMESTRE_${semestre.numero}` as any,
            status: 'ENCERRADO',
          },
        });

        if (!encerramento) {
          erros.push(`Semestre ${semestre.numero} ainda não está encerrado`);
        }
      }
    }
  } else {
    // Tipo não identificado: verificar ambos (compatibilidade)
    // Buscar trimestres do banco
    const trimestres = await prisma.trimestre.findMany({
      where: {
        instituicaoId,
        anoLetivo,
      },
      select: {
        numero: true,
      },
      orderBy: {
        numero: 'asc',
      },
    });

    for (const trimestre of trimestres) {
      const encerramento = await prisma.encerramentoAcademico.findFirst({
        where: {
          instituicaoId,
          anoLetivo,
          periodo: `TRIMESTRE_${trimestre}` as any,
          status: 'ENCERRADO',
        },
      });

      if (!encerramento) {
        erros.push(`Trimestre ${trimestre} ainda não está encerrado`);
      }
    }
  }

  // 2. Verificar se não há planos de ensino pendentes
  const planosPendentes = await prisma.planoEnsino.count({
    where: {
      instituicaoId,
      anoLetivo,
      bloqueado: false,
    },
  });

  if (planosPendentes > 0) {
    erros.push(`${planosPendentes} plano(s) de ensino ainda não estão aprovados/bloqueados`);
  }

  // 3. Verificar se não há avaliações em aberto
  const avaliacoesAbertas = await prisma.avaliacao.count({
    where: {
      instituicaoId,
      planoEnsino: {
        anoLetivo,
      },
      fechada: false,
    },
  });

  if (avaliacoesAbertas > 0) {
    erros.push(`${avaliacoesAbertas} avaliação(ões) ainda não estão fechadas`);
  }

  return {
    valido: erros.length === 0,
    erros,
  };
};

/**
 * Obter status de encerramento
 */
export const getStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo } = req.query;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Obter tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    const where: any = {
      ...filter,
    };

    if (anoLetivo) {
      where.anoLetivo = parseInt(anoLetivo as string);
    }

    // Filtrar períodos baseado no tipo acadêmico
    // Ensino Secundário: TRIMESTRE_1, TRIMESTRE_2, TRIMESTRE_3, ANO
    // Ensino Superior: SEMESTRE_1, SEMESTRE_2, ANO
    if (tipoAcademico === 'SECUNDARIO') {
      where.periodo = {
        in: ['TRIMESTRE_1', 'TRIMESTRE_2', 'TRIMESTRE_3', 'ANO'],
      };
    } else if (tipoAcademico === 'SUPERIOR') {
      where.periodo = {
        in: ['SEMESTRE_1', 'SEMESTRE_2', 'ANO'],
      };
    }
    // Se tipoAcademico é null, retornar todos (compatibilidade)

    const encerramentos = await prisma.encerramentoAcademico.findMany({
      where,
      include: {
        usuarioEncerrou: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
        usuarioReabriu: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { periodo: 'asc' },
      ],
    });

    res.json(encerramentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Iniciar processo de encerramento (mover para EM_ENCERRAMENTO)
 */
export const iniciarEncerramento = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, periodo } = req.body;

    if (!anoLetivo || !periodo) {
      throw new AppError('AnoLetivo e Periodo são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões (apenas ADMIN, DIRECAO, SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const podeEncerrar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeEncerrar) {
      throw new AppError('Você não tem permissão para encerrar períodos acadêmicos', 403);
    }

    // Obter tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    // Validar período baseado no tipo acadêmico
    if (tipoAcademico === 'SUPERIOR' && periodo.startsWith('TRIMESTRE_')) {
      throw new AppError('Ensino Superior não utiliza trimestres. Use SEMESTRE_1 ou SEMESTRE_2.', 400);
    }
    if (tipoAcademico === 'SECUNDARIO' && periodo.startsWith('SEMESTRE_')) {
      throw new AppError('Ensino Secundário não utiliza semestres. Use TRIMESTRE_1, TRIMESTRE_2 ou TRIMESTRE_3.', 400);
    }

    // Buscar ou criar registro de encerramento
    const encerramento = await prisma.encerramentoAcademico.upsert({
      where: {
        instituicaoId_anoLetivo_periodo: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          periodo: periodo as any,
        },
      },
      update: {
        status: 'EM_ENCERRAMENTO',
      },
      create: {
        instituicaoId,
        anoLetivo: parseInt(anoLetivo),
        periodo: periodo as any,
        status: 'EM_ENCERRAMENTO',
      },
    });

    // Auditoria: Log SUBMIT (início do processo)
    const moduloAuditoria = periodo.startsWith('TRIMESTRE_') 
      ? ModuloAuditoria.TRIMESTRE 
      : periodo.startsWith('SEMESTRE_')
      ? ModuloAuditoria.ANO_LETIVO // Usar ANO_LETIVO para semestres
      : ModuloAuditoria.ANO_LETIVO;
    const entidadeAuditoria = periodo.startsWith('TRIMESTRE_') 
      ? EntidadeAuditoria.TRIMESTRE 
      : periodo.startsWith('SEMESTRE_')
      ? EntidadeAuditoria.ANO_LETIVO // Usar ANO_LETIVO para semestres
      : EntidadeAuditoria.ANO_LETIVO;
    
    await AuditService.logSubmit(req, {
      modulo: moduloAuditoria,
      entidade: entidadeAuditoria,
      entidadeId: encerramento.id,
      dadosNovos: encerramento,
      observacao: `Início do processo de encerramento do período ${periodo}`,
    });

    res.json(encerramento);
  } catch (error) {
    next(error);
  }
};

/**
 * Encerrar período acadêmico
 */
export const encerrar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, periodo, justificativa } = req.body;

    if (!anoLetivo || !periodo) {
      throw new AppError('AnoLetivo e Periodo são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões
    const userRoles = req.user?.roles || [];
    const podeEncerrar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeEncerrar) {
      throw new AppError('Você não tem permissão para encerrar períodos acadêmicos', 403);
    }

    // VALIDAÇÃO OBRIGATÓRIA: Verificar aceite de termo legal (apenas para encerramento de ANO)
    if (periodo === 'ANO') {
      const { TermoLegalService, TipoAcaoTermoLegal } = await import('../services/termoLegal.service.js');
      const verificarAceite = await TermoLegalService.verificarAceite(
        userId,
        instituicaoId,
        TipoAcaoTermoLegal.ENCERRAMENTO_ANO
      );

      if (!verificarAceite.aceito) {
        // Retornar erro especial para o frontend exibir modal
        return res.status(403).json({
          error: 'TERMO_NAO_ACEITO',
          message: 'É necessário aceitar o termo legal antes de encerrar o ano letivo',
          termo: verificarAceite.termo,
          termoId: verificarAceite.termoId,
        });
      }
    }

    // Obter tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    // Validar período baseado no tipo acadêmico
    if (tipoAcademico === 'SUPERIOR' && periodo.startsWith('TRIMESTRE_')) {
      throw new AppError('Ensino Superior não utiliza trimestres. Use SEMESTRE_1 ou SEMESTRE_2.', 400);
    }
    if (tipoAcademico === 'SECUNDARIO' && periodo.startsWith('SEMESTRE_')) {
      throw new AppError('Ensino Secundário não utiliza semestres. Use TRIMESTRE_1, TRIMESTRE_2 ou TRIMESTRE_3.', 400);
    }

    // Verificar pré-requisitos
    if (periodo.startsWith('TRIMESTRE_')) {
      if (tipoAcademico !== 'SECUNDARIO') {
        throw new AppError('Trimestres são permitidos apenas para Ensino Secundário', 400);
      }
      const trimestre = parseInt(periodo.split('_')[1]);
      const validacao = await verificarPreRequisitosTrimestre(instituicaoId, parseInt(anoLetivo), trimestre);

      if (!validacao.valido) {
        throw new AppError(
          `Não é possível encerrar o ${trimestre}º trimestre. Erros encontrados:\n${validacao.erros.join('\n')}`,
          400
        );
      }
    } else if (periodo.startsWith('SEMESTRE_')) {
      if (tipoAcademico !== 'SUPERIOR') {
        throw new AppError('Semestres são permitidos apenas para Ensino Superior', 400);
      }
      // TODO: Implementar verificarPreRequisitosSemestre quando necessário
      // Por enquanto, apenas validar que é Ensino Superior
    } else if (periodo === 'ANO') {
      const validacao = await verificarPreRequisitosAno(instituicaoId, parseInt(anoLetivo), tipoAcademico);

      if (!validacao.valido) {
        throw new AppError(
          `Não é possível encerrar o ano letivo. Erros encontrados:\n${validacao.erros.join('\n')}`,
          400
        );
      }
    }

    // Buscar registro existente
    let encerramento = await prisma.encerramentoAcademico.findUnique({
      where: {
        instituicaoId_anoLetivo_periodo: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          periodo: periodo as any,
        },
      },
    });

    const statusAnterior = encerramento?.status || 'ABERTO';

    // Atualizar ou criar encerramento
    encerramento = await prisma.encerramentoAcademico.upsert({
      where: {
        instituicaoId_anoLetivo_periodo: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          periodo: periodo as any,
        },
      },
      update: {
        status: 'ENCERRADO',
        encerradoPor: userId,
        encerradoEm: new Date(),
        justificativa: justificativa || null,
      },
      create: {
        instituicaoId,
        anoLetivo: parseInt(anoLetivo),
        periodo: periodo as any,
        status: 'ENCERRADO',
        encerradoPor: userId,
        encerradoEm: new Date(),
        justificativa: justificativa || null,
      },
    });

    // CORREÇÃO CRÍTICA: Atualizar status do semestre/trimestre para ENCERRADO
    if (periodo.startsWith('SEMESTRE_')) {
      const numeroSemestre = parseInt(periodo.split('_')[1]);
      const semestre = await prisma.semestre.findFirst({
        where: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          numero: numeroSemestre,
        },
      });

      if (semestre) {
        await prisma.semestre.update({
          where: { id: semestre.id },
          data: {
            status: 'ENCERRADO',
            encerradoPor: userId,
            encerradoEm: new Date(),
          },
        });
      }
    } else if (periodo.startsWith('TRIMESTRE_')) {
      const numeroTrimestre = parseInt(periodo.split('_')[1]);
      const trimestre = await prisma.trimestre.findFirst({
        where: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          numero: numeroTrimestre,
        },
      });

      if (trimestre) {
        await prisma.trimestre.update({
          where: { id: trimestre.id },
          data: {
            status: 'ENCERRADO',
            encerradoPor: userId,
            encerradoEm: new Date(),
          },
        });
      }
    } else if (periodo === 'ANO') {
      // Encerrar todos os semestres e trimestres do ano letivo
      const semestres = await prisma.semestre.findMany({
        where: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
        },
      });

      const trimestres = await prisma.trimestre.findMany({
        where: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
        },
      });

      // Atualizar semestres
      for (const semestre of semestres) {
        try {
          await prisma.semestre.update({
            where: { id: semestre.id },
            data: {
              status: 'ENCERRADO',
              encerradoPor: userId,
              encerradoEm: new Date(),
            },
          });
        } catch (error) {
          console.error(`[encerrar] Erro ao atualizar status do semestre ${semestre.id}:`, error);
        }
      }

      // Atualizar trimestres
      for (const trimestre of trimestres) {
        try {
          await prisma.trimestre.update({
            where: { id: trimestre.id },
            data: {
              status: 'ENCERRADO',
              encerradoPor: userId,
              encerradoEm: new Date(),
            },
          });
        } catch (error) {
          console.error(`[encerrar] Erro ao atualizar status do trimestre ${trimestre.id}:`, error);
        }
      }
    }

    // Auditoria: Log CLOSE
    const moduloAuditoria = periodo.startsWith('TRIMESTRE_') 
      ? ModuloAuditoria.TRIMESTRE 
      : periodo.startsWith('SEMESTRE_')
      ? ModuloAuditoria.ANO_LETIVO // Usar ANO_LETIVO para semestres
      : ModuloAuditoria.ANO_LETIVO;
    const entidadeAuditoria = periodo.startsWith('TRIMESTRE_') 
      ? EntidadeAuditoria.TRIMESTRE 
      : periodo.startsWith('SEMESTRE_')
      ? EntidadeAuditoria.ANO_LETIVO // Usar ANO_LETIVO para semestres
      : EntidadeAuditoria.ANO_LETIVO;
    
    await AuditService.logClose(req, {
      modulo: moduloAuditoria,
      entidade: entidadeAuditoria,
      entidadeId: encerramento.id,
      dadosAnteriores: encerramento ? { status: statusAnterior } : null,
      dadosNovos: encerramento,
      observacao: justificativa || `Encerramento do período ${periodo}`,
    });

    // Notificação sistêmica: Encerramento de Ano Letivo (apenas se período = 'ANO')
    if (periodo === 'ANO') {
      try {
        const { NotificacaoService } = await import('../services/notificacao.service.js');
        await NotificacaoService.notificarEncerramentoAnoLetivo(req, instituicaoId, parseInt(anoLetivo));
      } catch (notifError: any) {
        // Não bloquear se notificação falhar
        console.error('[encerrar] Erro ao enviar notificação de encerramento (não crítico):', notifError.message);
      }
    }

    res.json({
      ...encerramento,
      mensagem: `Período ${periodo} encerrado com sucesso`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reabrir período acadêmico (exceção administrativa)
 */
export const reabrir = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, periodo, justificativaReabertura } = req.body;

    if (!anoLetivo || !periodo || !justificativaReabertura) {
      throw new AppError('AnoLetivo, Periodo e JustificativaReabertura são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões (apenas ADMIN, DIRECAO, SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const podeReabrir = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeReabrir) {
      throw new AppError('Você não tem permissão para reabrir períodos acadêmicos', 403);
    }

    // Buscar encerramento existente
    const encerramento = await prisma.encerramentoAcademico.findUnique({
      where: {
        instituicaoId_anoLetivo_periodo: {
          instituicaoId,
          anoLetivo: parseInt(anoLetivo),
          periodo: periodo as any,
        },
      },
    });

    if (!encerramento) {
      throw new AppError('Encerramento não encontrado', 404);
    }

    if (encerramento.status !== 'ENCERRADO') {
      throw new AppError('Apenas períodos ENCERRADOS podem ser reabertos', 400);
    }

    // VALIDAÇÃO OBRIGATÓRIA: Verificar aceite de termo legal (apenas para reabertura de ANO)
    if (encerramento.periodo === 'ANO') {
      const { TermoLegalService, TipoAcaoTermoLegal } = await import('../services/termoLegal.service.js');
      const verificarAceite = await TermoLegalService.verificarAceite(
        userId,
        instituicaoId,
        TipoAcaoTermoLegal.REABERTURA_ANO
      );

      if (!verificarAceite.aceito) {
        // Retornar erro especial para o frontend exibir modal
        return res.status(403).json({
          error: 'TERMO_NAO_ACEITO',
          message: 'É necessário aceitar o termo legal antes de reabrir o ano letivo',
          termo: verificarAceite.termo,
          termoId: verificarAceite.termoId,
        });
      }
    }

    const statusAnterior = encerramento.status;

    // Atualizar para REABERTO
    const encerramentoAtualizado = await prisma.encerramentoAcademico.update({
      where: {
        id: encerramento.id,
      },
      data: {
        status: 'REABERTO',
        reabertoPor: userId,
        reabertoEm: new Date(),
        justificativaReabertura,
      },
    });

    // Auditoria: Log REOPEN (requer justificativa obrigatória)
    await AuditService.logReopen(req, {
      modulo: periodo.startsWith('TRIMESTRE_') ? ModuloAuditoria.TRIMESTRE : ModuloAuditoria.ANO_LETIVO,
      entidade: periodo.startsWith('TRIMESTRE_') ? EntidadeAuditoria.TRIMESTRE : EntidadeAuditoria.ANO_LETIVO,
      entidadeId: encerramento.id,
      dadosAnteriores: encerramento,
      dadosNovos: encerramentoAtualizado,
      observacao: justificativaReabertura, // OBRIGATÓRIO para reabertura
    });

    // Notificação sistêmica: Reabertura de Ano Letivo (apenas se período = 'ANO')
    if (periodo === 'ANO') {
      try {
        const { NotificacaoService } = await import('../services/notificacao.service.js');
        await NotificacaoService.notificarReaberturaAnoLetivo(req, instituicaoId, parseInt(anoLetivo));
      } catch (notifError: any) {
        // Não bloquear se notificação falhar
        console.error('[reabrir] Erro ao enviar notificação de reabertura (não crítico):', notifError.message);
      }
    }

    res.json({
      ...encerramentoAtualizado,
      mensagem: `Período ${periodo} reaberto com sucesso`,
    });
  } catch (error) {
    next(error);
  }
};

