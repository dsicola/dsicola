import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';

type EntidadeWorkflow = 'EventoCalendario' | 'PlanoEnsino' | 'Avaliacao';

interface TransicaoPermitida {
  de: string[];
  para: string;
  roles: string[];
}

const TRANSICOES_PERMITIDAS: Record<string, TransicaoPermitida[]> = {
  RASCUNHO: [
    { de: ['RASCUNHO'], para: 'SUBMETIDO', roles: ['PROFESSOR', 'SECRETARIA', 'ADMIN'] },
  ],
  SUBMETIDO: [
    { de: ['SUBMETIDO'], para: 'APROVADO', roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'] },
    { de: ['SUBMETIDO'], para: 'REJEITADO', roles: ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'] },
    { de: ['SUBMETIDO'], para: 'RASCUNHO', roles: ['ADMIN', 'SUPER_ADMIN'] }, // Reabertura
  ],
  APROVADO: [
    { de: ['APROVADO'], para: 'BLOQUEADO', roles: ['ADMIN', 'SUPER_ADMIN'] },
  ],
  REJEITADO: [
    { de: ['REJEITADO'], para: 'RASCUNHO', roles: ['PROFESSOR', 'SECRETARIA', 'ADMIN'] },
  ],
  BLOQUEADO: [
    // Apenas ADMIN pode desbloquear (exceção)
    { de: ['BLOQUEADO'], para: 'APROVADO', roles: ['ADMIN', 'SUPER_ADMIN'] },
  ],
};

/**
 * Verificar se usuário tem permissão para ação
 */
const verificarPermissao = (userRoles: string[], rolesPermitidos: string[]): boolean => {
  return userRoles.some(role => rolesPermitidos.includes(role));
};

/**
 * Obter entidade pelo tipo e ID
 */
const obterEntidade = async (
  entidade: EntidadeWorkflow,
  entidadeId: string,
  filter: any
) => {
  switch (entidade) {
    case 'EventoCalendario':
      return await prisma.eventoCalendario.findFirst({
        where: { id: entidadeId, ...filter },
      });
    case 'PlanoEnsino':
      return await prisma.planoEnsino.findFirst({
        where: { id: entidadeId, ...filter },
      });
    case 'Avaliacao':
      return await prisma.avaliacao.findFirst({
        where: { id: entidadeId, ...filter },
      });
    default:
      throw new AppError('Tipo de entidade inválido', 400);
  }
};

/**
 * Atualizar status da entidade
 */
const atualizarStatusEntidade = async (
  entidade: EntidadeWorkflow,
  entidadeId: string,
  novoStatus: string,
  filter: any
) => {
  switch (entidade) {
    case 'EventoCalendario':
      return await prisma.eventoCalendario.update({
        where: { id: entidadeId },
        data: { status: novoStatus as any },
      });
    case 'PlanoEnsino':
      // Sincronizar status (workflow) e estado (controle de edição)
      const updateData: any = { status: novoStatus as any };
      
      // Mapear status do workflow para estado
      if (novoStatus === 'APROVADO') {
        updateData.estado = 'APROVADO';
      } else if (novoStatus === 'REJEITADO') {
        updateData.estado = 'RASCUNHO'; // Volta para rascunho quando rejeitado
      } else if (novoStatus === 'SUBMETIDO') {
        updateData.estado = 'EM_REVISAO';
      } else if (novoStatus === 'RASCUNHO') {
        updateData.estado = 'RASCUNHO';
      } else if (novoStatus === 'BLOQUEADO') {
        updateData.estado = 'ENCERRADO'; // Bloqueado = Encerrado
      }
      
      return await prisma.planoEnsino.update({
        where: { id: entidadeId },
        data: updateData,
      });
    case 'Avaliacao':
      return await prisma.avaliacao.update({
        where: { id: entidadeId },
        data: { status: novoStatus as any },
      });
    default:
      throw new AppError('Tipo de entidade inválido', 400);
  }
};

/**
 * Submeter para aprovação
 */
export const submeter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidade, entidadeId } = req.body;

    if (!entidade || !entidadeId) {
      throw new AppError('Entidade e EntidadeId são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Obter entidade atual
    const entidadeAtual = await obterEntidade(entidade as EntidadeWorkflow, entidadeId, filter);

    if (!entidadeAtual) {
      throw new AppError('Entidade não encontrada ou não pertence à sua instituição', 404);
    }

    const statusAtual = (entidadeAtual as any).status || 'RASCUNHO';

    // Verificar transição permitida
    const transicoes = TRANSICOES_PERMITIDAS[statusAtual] || [];
    const transicao = transicoes.find(t => t.para === 'SUBMETIDO');

    if (!transicao) {
      throw new AppError(`Não é possível submeter um item com status ${statusAtual}`, 400);
    }

    if (!verificarPermissao(userRoles, transicao.roles)) {
      throw new AppError('Você não tem permissão para submeter este item', 403);
    }

    // Verificar regras de bloqueio do fluxo
    if (entidade === 'PlanoEnsino') {
      // Verificar se calendário está aprovado
      const calendarioAprovado = await prisma.eventoCalendario.findFirst({
        where: {
          instituicaoId,
          status: 'APROVADO',
        },
      });

      if (!calendarioAprovado) {
        throw new AppError('É necessário ter um Calendário Acadêmico APROVADO antes de submeter o Plano de Ensino', 400);
      }
    }

    // Atualizar status
    await atualizarStatusEntidade(entidade as EntidadeWorkflow, entidadeId, 'SUBMETIDO', filter);

    // Registrar log
    await prisma.workflowLog.create({
      data: {
        entidade,
        entidadeId,
        statusAnterior: statusAtual as any,
        statusNovo: 'SUBMETIDO',
        acao: 'SUBMETER',
        usuarioId: userId,
        instituicaoId,
      },
    });

    res.json({ message: 'Item submetido com sucesso', status: 'SUBMETIDO' });
  } catch (error) {
    next(error);
  }
};

/**
 * Aprovar item
 */
export const aprovar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidade, entidadeId, observacao } = req.body;

    if (!entidade || !entidadeId) {
      throw new AppError('Entidade e EntidadeId são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const entidadeAtual = await obterEntidade(entidade as EntidadeWorkflow, entidadeId, filter);

    if (!entidadeAtual) {
      throw new AppError('Entidade não encontrada ou não pertence à sua instituição', 404);
    }

    const statusAtual = (entidadeAtual as any).status || 'RASCUNHO';

    // Verificar transição permitida
    const transicoes = TRANSICOES_PERMITIDAS[statusAtual] || [];
    const transicao = transicoes.find(t => t.para === 'APROVADO');

    if (!transicao) {
      throw new AppError(`Não é possível aprovar um item com status ${statusAtual}`, 400);
    }

    if (!verificarPermissao(userRoles, transicao.roles)) {
      throw new AppError('Você não tem permissão para aprovar este item', 403);
    }

    // VALIDAÇÕES ESPECÍFICAS PARA PLANO DE ENSINO
    if (entidade === 'PlanoEnsino') {
      const plano = entidadeAtual as any;
      const erros: string[] = [];

      // 1. Validar campos obrigatórios da Apresentação
      if (!plano.ementa || plano.ementa.trim().length === 0) {
        erros.push('Ementa não preenchida. Preencha a aba "1. Apresentação" antes de aprovar.');
      }
      if (!plano.objetivos || plano.objetivos.trim().length === 0) {
        erros.push('Objetivos não preenchidos. Preencha a aba "1. Apresentação" antes de aprovar.');
      }
      if (!plano.metodologia || plano.metodologia.trim().length === 0) {
        erros.push('Metodologia não preenchida. Preencha a aba "1. Apresentação" antes de aprovar.');
      }
      if (!plano.criteriosAvaliacao || plano.criteriosAvaliacao.trim().length === 0) {
        erros.push('Critérios de Avaliação não preenchidos. Preencha a aba "1. Apresentação" antes de aprovar.');
      }

      // 2. Validar se há pelo menos uma aula cadastrada
      const planoCompleto = await prisma.planoEnsino.findFirst({
        where: { id: entidadeId, ...filter },
        include: {
          aulas: true,
          disciplina: { select: { cargaHoraria: true } },
        },
      });

      if (!planoCompleto) {
        throw new AppError('Plano de ensino não encontrado', 404);
      }

      if (!planoCompleto.aulas || planoCompleto.aulas.length === 0) {
        erros.push('Nenhuma aula cadastrada. Cadastre pelo menos uma aula na aba "2. Planejar" antes de aprovar.');
      }

      // 3. Validar carga horária
      // REGRA SIGA/SIGAE: cargaHorariaExigida SEMPRE vem da Disciplina
      // REGRA SIGA/SIGAE: cargaHorariaPlanejada = soma(aulas.quantidadeAulas)
      // REGRA SIGA/SIGAE: BLOQUEAR aprovação se diferenca ≠ 0 (sem tolerância)
      const totalExigido = planoCompleto.disciplina?.cargaHoraria || 0;
      const totalPlanejado = planoCompleto.aulas.reduce((sum: number, aula: any) => sum + aula.quantidadeAulas, 0);
      const diferenca = totalExigido - totalPlanejado;

      // REGRA SIGA/SIGAE: Bloquear se diferença ≠ 0 (sem tolerância)
      if (diferenca !== 0) {
        if (diferenca < 0) {
          erros.push(
            `Carga horária excedida. Total planejado: ${totalPlanejado}h, Total exigido: ${totalExigido}h. ` +
            `Excedente: ${Math.abs(diferenca)}h. Ajuste a carga horária na aba "2. Planejar" antes de aprovar. ` +
            `A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida.`
          );
        } else {
          erros.push(
            `Carga horária incompleta. Total planejado: ${totalPlanejado}h, Total exigido: ${totalExigido}h. ` +
            `Faltam: ${diferenca}h. Adicione mais aulas na aba "2. Planejar" antes de aprovar. ` +
            `A carga horária planejada deve ser EXATAMENTE igual à carga horária exigida.`
          );
        }
      }

      // 4. Validar se não há disciplinas duplicadas no mesmo contexto
      // REGRA SIGA/SIGAE: Não pode haver múltiplos planos APROVADOS para a mesma disciplina no mesmo contexto
      const planoDuplicado = await prisma.planoEnsino.findFirst({
        where: {
          ...filter,
          id: { not: entidadeId }, // Excluir o plano atual
          disciplinaId: planoCompleto.disciplinaId,
          anoLetivoId: planoCompleto.anoLetivoId,
          estado: 'APROVADO', // Apenas planos aprovados causam conflito
          ...(planoCompleto.cursoId ? { cursoId: planoCompleto.cursoId } : {}),
          ...(planoCompleto.classeId ? { classeId: planoCompleto.classeId } : {}),
          ...(planoCompleto.semestreId ? { semestreId: planoCompleto.semestreId } : {}),
          ...(planoCompleto.turmaId ? { turmaId: planoCompleto.turmaId } : {}),
        },
      });

      if (planoDuplicado) {
        erros.push(
          `Já existe um Plano de Ensino APROVADO para esta disciplina no mesmo contexto (Ano Letivo, Curso/Classe, Semestre, Turma). ` +
          `Encerre o plano existente ou ajuste o contexto antes de aprovar este plano. ` +
          `Plano duplicado: ID ${planoDuplicado.id}`
        );
      }

      // 5. Validar se há aulas com quantidade inválida
      const aulasInvalidas = planoCompleto.aulas.filter((aula: any) => !aula.quantidadeAulas || aula.quantidadeAulas <= 0);
      if (aulasInvalidas.length > 0) {
        erros.push(
          `Existem ${aulasInvalidas.length} aula(s) com quantidade inválida (zero ou negativa). ` +
          `Todas as aulas devem ter quantidade maior que zero.`
        );
      }

      // 6. Validar se há aulas sem título
      const aulasSemTitulo = planoCompleto.aulas.filter((aula: any) => !aula.titulo || aula.titulo.trim().length === 0);
      if (aulasSemTitulo.length > 0) {
        erros.push(
          `Existem ${aulasSemTitulo.length} aula(s) sem título. ` +
          `Todas as aulas devem ter um título descritivo.`
        );
      }

      // Se houver erros, retornar todos
      if (erros.length > 0) {
        throw new AppError(
          `Não é possível aprovar o plano de ensino. Erros encontrados:\n${erros.join('\n')}`,
          400
        );
      }
    }

    // Atualizar status
    await atualizarStatusEntidade(entidade as EntidadeWorkflow, entidadeId, 'APROVADO', filter);

    // Se for Avaliacao, marcar como fechada também
    if (entidade === 'Avaliacao') {
      await prisma.avaliacao.update({
        where: { id: entidadeId },
        data: {
          fechada: true,
          fechadaPor: userId,
          fechadaEm: new Date(),
        },
      });
    }

    // Registrar log
    await prisma.workflowLog.create({
      data: {
        entidade,
        entidadeId,
        statusAnterior: statusAtual as any,
        statusNovo: 'APROVADO',
        acao: 'APROVAR',
        usuarioId: userId,
        instituicaoId,
        observacao: observacao || null,
      },
    });

    res.json({ message: 'Item aprovado com sucesso', status: 'APROVADO' });
  } catch (error) {
    next(error);
  }
};

/**
 * Rejeitar item
 */
export const rejeitar = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidade, entidadeId, observacao } = req.body;

    if (!entidade || !entidadeId) {
      throw new AppError('Entidade e EntidadeId são obrigatórios', 400);
    }

    if (!observacao) {
      throw new AppError('Observação é obrigatória ao rejeitar', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const entidadeAtual = await obterEntidade(entidade as EntidadeWorkflow, entidadeId, filter);

    if (!entidadeAtual) {
      throw new AppError('Entidade não encontrada ou não pertence à sua instituição', 404);
    }

    const statusAtual = (entidadeAtual as any).status || 'RASCUNHO';

    // Verificar transição permitida
    const transicoes = TRANSICOES_PERMITIDAS[statusAtual] || [];
    const transicao = transicoes.find(t => t.para === 'REJEITADO');

    if (!transicao) {
      throw new AppError(`Não é possível rejeitar um item com status ${statusAtual}`, 400);
    }

    if (!verificarPermissao(userRoles, transicao.roles)) {
      throw new AppError('Você não tem permissão para rejeitar este item', 403);
    }

    // Atualizar status
    await atualizarStatusEntidade(entidade as EntidadeWorkflow, entidadeId, 'REJEITADO', filter);

    // Registrar log
    await prisma.workflowLog.create({
      data: {
        entidade,
        entidadeId,
        statusAnterior: statusAtual as any,
        statusNovo: 'REJEITADO',
        acao: 'REJEITAR',
        usuarioId: userId,
        instituicaoId,
        observacao,
      },
    });

    res.json({ message: 'Item rejeitado', status: 'REJEITADO' });
  } catch (error) {
    next(error);
  }
};

/**
 * Bloquear item
 */
export const bloquear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidade, entidadeId, observacao } = req.body;

    if (!entidade || !entidadeId) {
      throw new AppError('Entidade e EntidadeId são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);
    const userRoles = req.user?.roles || [];
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const entidadeAtual = await obterEntidade(entidade as EntidadeWorkflow, entidadeId, filter);

    if (!entidadeAtual) {
      throw new AppError('Entidade não encontrada ou não pertence à sua instituição', 404);
    }

    const statusAtual = (entidadeAtual as any).status || 'RASCUNHO';

    // Verificar transição permitida
    const transicoes = TRANSICOES_PERMITIDAS[statusAtual] || [];
    const transicao = transicoes.find(t => t.para === 'BLOQUEADO');

    if (!transicao) {
      throw new AppError(`Não é possível bloquear um item com status ${statusAtual}`, 400);
    }

    if (!verificarPermissao(userRoles, transicao.roles)) {
      throw new AppError('Você não tem permissão para bloquear este item', 403);
    }

    // Atualizar status
    await atualizarStatusEntidade(entidade as EntidadeWorkflow, entidadeId, 'BLOQUEADO', filter);

    // Se for PlanoEnsino, atualizar campo bloqueado também
    if (entidade === 'PlanoEnsino') {
      await prisma.planoEnsino.update({
        where: { id: entidadeId },
        data: {
          bloqueado: true,
          bloqueadoPor: userId,
          dataBloqueio: new Date(),
        },
      });
    }

    // Registrar log
    await prisma.workflowLog.create({
      data: {
        entidade,
        entidadeId,
        statusAnterior: statusAtual as any,
        statusNovo: 'BLOQUEADO',
        acao: 'BLOQUEAR',
        usuarioId: userId,
        instituicaoId,
        observacao: observacao || null,
      },
    });

    res.json({ message: 'Item bloqueado com sucesso', status: 'BLOQUEADO' });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter histórico de workflow
 */
export const getHistorico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { entidade, entidadeId } = req.query;

    if (!entidade || !entidadeId) {
      throw new AppError('Entidade e EntidadeId são obrigatórios', 400);
    }

    const filter = addInstitutionFilter(req);

    const logs = await prisma.workflowLog.findMany({
      where: {
        entidade: entidade as string,
        entidadeId: entidadeId as string,
        ...filter,
      },
      include: {
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: {
        data: 'desc',
      },
    });

    res.json(logs);
  } catch (error) {
    next(error);
  }
};

