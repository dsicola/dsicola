import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

/**
 * Gerar distribuição automática de aulas baseado no calendário acadêmico
 * Ignora feriados e períodos bloqueados
 */
export const gerarDistribuicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId, dataInicio, diasSemana } = req.body;

    if (!planoEnsinoId || !dataInicio || !diasSemana || !Array.isArray(diasSemana) || diasSemana.length === 0) {
      throw new AppError('PlanoEnsinoId, DataInicio e DiasSemana são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se o plano de ensino existe e pertence à instituição
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        ...filter,
      },
      include: {
        aulas: {
          orderBy: { ordem: 'asc' },
        },
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO CONFORME DOCUMENTO: Verificar se o plano está APROVADO
    // O documento especifica que apenas planos APROVADOS podem ter aulas distribuídas
    // Verificar tanto status (workflow) quanto estado (controle de edição)
    const planoAprovado = plano.status === 'APROVADO' || plano.estado === 'APROVADO' || plano.estado === 'ENCERRADO';
    
    if (!planoAprovado) {
      throw new AppError(
        'É necessário ter um Plano de Ensino APROVADO antes de distribuir aulas. ' +
        'Acesse a aba "Plano de Ensino" e finalize/aprove o plano primeiro.',
        400
      );
    }

    // Verificar se existe calendário ativo (pelo menos um evento cadastrado)
    const calendarioAtivo = await prisma.eventoCalendario.findFirst({
      where: {
        instituicaoId,
      },
    });

    if (!calendarioAtivo) {
      throw new AppError('É necessário ter um calendário acadêmico ativo antes de distribuir aulas', 400);
    }

    // Buscar feriados e eventos que bloqueiam aulas
    const feriados = await prisma.eventoCalendario.findMany({
      where: {
        instituicaoId,
        tipo: {
          in: ['feriado', 'ferias'],
        },
      },
    });

    // Buscar períodos letivos ativos (se existir tabela no futuro)
    // Por enquanto, usamos apenas eventos do calendário

    const dataInicioDate = new Date(dataInicio);
    // Normalizar para início do dia para comparações precisas
    dataInicioDate.setHours(0, 0, 0, 0);
    
    const distribuicoes: Array<{
      planoAulaId: string;
      datas: string[];
    }> = [];

    // Preparar feriados para comparação eficiente
    const feriadosNormalizados = feriados.map((feriado) => {
      const inicio = new Date(feriado.dataInicio);
      inicio.setHours(0, 0, 0, 0);
      const fim = feriado.dataFim ? new Date(feriado.dataFim) : inicio;
      fim.setHours(23, 59, 59, 999);
      return { inicio, fim };
    });

    // Para cada aula do plano, gerar as datas
    for (const aula of plano.aulas) {
      const datas: Date[] = [];
      let dataAtual = new Date(dataInicioDate);
      let aulasGeradas = 0;
      let diasPercorridos = 0;
      const limiteDias = 365; // Limite de segurança: máximo 1 ano

      // Gerar datas até completar a quantidade de aulas
      while (aulasGeradas < aula.quantidadeAulas && diasPercorridos < limiteDias) {
        // Verificar se o dia da semana está nos dias selecionados
        const diaSemana = dataAtual.getDay();
        if (diasSemana.includes(diaSemana)) {
          // Verificar se não é feriado (comparação simplificada e correta)
          const dataAtualNormalizada = new Date(dataAtual);
          dataAtualNormalizada.setHours(12, 0, 0, 0); // Meio-dia para evitar problemas de timezone
          
          const isFeriado = feriadosNormalizados.some((feriado) => {
            return dataAtualNormalizada >= feriado.inicio && dataAtualNormalizada <= feriado.fim;
          });

          if (!isFeriado) {
            // Clonar a data para evitar referência
            datas.push(new Date(dataAtual));
            aulasGeradas++;
          }
        }

        // Avançar para o próximo dia
        dataAtual.setDate(dataAtual.getDate() + 1);
        diasPercorridos++;

        // Limite de segurança adicional
        if (diasPercorridos >= limiteDias && aulasGeradas < aula.quantidadeAulas) {
          throw new AppError(
            `Não foi possível gerar todas as datas para a aula "${aula.titulo}". ` +
            `Apenas ${aulasGeradas} de ${aula.quantidadeAulas} datas foram geradas no período de ${limiteDias} dias. ` +
            `Verifique se há dias da semana suficientes ou ajuste o calendário acadêmico.`,
            400
          );
        }
      }

      distribuicoes.push({
        planoAulaId: aula.id,
        datas: datas.map((d) => {
          // Garantir formato YYYY-MM-DD
          const date = new Date(d);
          date.setHours(0, 0, 0, 0);
          return date.toISOString().split('T')[0];
        }),
      });
    }

    // IMPORTANTE: A distribuição NÃO cria AulaLancada diretamente
    // Ela apenas calcula e salva as datas sugeridas na tabela DistribuicaoAula
    // O lançamento deve ser feito na aba "Lançamento de Aulas"
    // Isso respeita o fluxo: Calendário → Plano → Distribuição → Lançamento → Presenças → Avaliações

    // Salvar distribuições no banco de dados
    // Primeiro, deletar distribuições existentes para este plano (permitir re-gerar)
    await prisma.distribuicaoAula.deleteMany({
      where: {
        planoEnsinoId: planoEnsinoId,
        instituicaoId: instituicaoId,
      },
    });

    // Criar registros de distribuição para cada data sugerida
    const distribuicoesParaSalvar: Array<{
      planoAulaId: string;
      planoEnsinoId: string;
      data: Date;
      instituicaoId: string;
    }> = [];

    for (const distribuicao of distribuicoes) {
      for (const dataStr of distribuicao.datas) {
        distribuicoesParaSalvar.push({
          planoAulaId: distribuicao.planoAulaId,
          planoEnsinoId: planoEnsinoId,
          data: new Date(dataStr),
          instituicaoId: instituicaoId,
        });
      }
    }

    // Inserir todas as distribuições em lote
    if (distribuicoesParaSalvar.length > 0) {
      await prisma.distribuicaoAula.createMany({
        data: distribuicoesParaSalvar,
        skipDuplicates: true, // Evitar erros se houver duplicatas
      });
    }

    // Auditoria: Log CREATE (distribuição de aulas - datas salvas no banco)
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.DISTRIBUICAO_AULAS,
      entidade: EntidadeAuditoria.DISTRIBUICAO_AULA,
      entidadeId: planoEnsinoId,
      dadosNovos: {
        planoEnsinoId,
        totalAulas: plano.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0),
        totalDatasSugeridas: distribuicoes.reduce((sum, dist) => sum + dist.datas.length, 0),
        dataInicio,
        diasSemana,
        distribuicoes: distribuicoes.map((d) => ({
          planoAulaId: d.planoAulaId,
          totalDatas: d.datas.length,
        })),
      },
      observacao: `Distribuição automática salva: ${distribuicoes.reduce((sum, dist) => sum + dist.datas.length, 0)} datas sugeridas`,
    });

    res.json({
      planoEnsinoId,
      distribuicoes,
      totalAulas: plano.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0),
      totalDatasSugeridas: distribuicoes.reduce((sum, dist) => sum + dist.datas.length, 0),
      mensagem: 'Distribuição calculada e salva com sucesso. Use a aba "Lançamento de Aulas" para registrar as aulas.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar distribuição de aulas por plano de ensino
 */
export const getDistribuicaoByPlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    if (!planoEnsinoId) {
      throw new AppError('PlanoEnsinoId é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);

    // Verificar se o plano existe e pertence à instituição
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        ...filter,
      },
      include: {
        aulas: {
          orderBy: { ordem: 'asc' },
          include: {
            aulasLancadas: {
              orderBy: { data: 'desc' },
            },
          },
        },
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // Buscar distribuições salvas na tabela DistribuicaoAula
    const distribuicoesSalvas = await prisma.distribuicaoAula.findMany({
      where: {
        planoEnsinoId: planoEnsinoId,
        ...filter,
      },
      orderBy: {
        data: 'asc',
      },
    });

    // Agrupar distribuições por planoAulaId
    const distribuicoesPorAula: Record<string, string[]> = {};
    for (const dist of distribuicoesSalvas) {
      if (!distribuicoesPorAula[dist.planoAulaId]) {
        distribuicoesPorAula[dist.planoAulaId] = [];
      }
      const date = new Date(dist.data);
      date.setHours(0, 0, 0, 0);
      distribuicoesPorAula[dist.planoAulaId].push(date.toISOString().split('T')[0]);
    }

    // Mapear aulas com suas distribuições salvas
    const distribuicao = plano.aulas.map((aula) => ({
      planoAulaId: aula.id,
      ordem: aula.ordem,
      titulo: aula.titulo,
      trimestre: aula.trimestre,
      quantidadeAulas: aula.quantidadeAulas,
      aulasLancadas: aula.aulasLancadas?.length || 0, // Número de aulas já lançadas
      // Retornar datas distribuídas (sugeridas) + datas das aulas já lançadas
      datas: [
        ...(distribuicoesPorAula[aula.id] || []), // Datas sugeridas da distribuição
        ...aula.aulasLancadas.map((lancada) => { // Datas já lançadas (para compatibilidade)
          const date = new Date(lancada.data);
          date.setHours(0, 0, 0, 0);
          return date.toISOString().split('T')[0];
        }),
      ].filter((v, i, a) => a.indexOf(v) === i), // Remover duplicatas
    }));

    res.json(distribuicao);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar distribuição de aulas por plano de ensino
 */
export const deleteDistribuicao = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    if (!planoEnsinoId) {
      throw new AppError('PlanoEnsinoId é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    // Verificar se o plano existe e pertence à instituição
    const plano = await prisma.planoEnsino.findFirst({
      where: {
        id: planoEnsinoId,
        ...filter,
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // Deletar todas as distribuições do plano
    const deleted = await prisma.distribuicaoAula.deleteMany({
      where: {
        planoEnsinoId: planoEnsinoId,
        instituicaoId: instituicaoId,
      },
    });

    // Auditoria: Log DELETE
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.DISTRIBUICAO_AULAS,
      entidade: EntidadeAuditoria.DISTRIBUICAO_AULA,
      entidadeId: planoEnsinoId,
      dadosAnteriores: {
        planoEnsinoId,
        totalDeletado: deleted.count,
      },
      observacao: `Distribuição de aulas removida: ${deleted.count} datas deletadas`,
    });

    res.json({
      mensagem: `Distribuição removida com sucesso. ${deleted.count} data(s) deletada(s).`,
      totalDeletado: deleted.count,
    });
  } catch (error) {
    next(error);
  }
};

