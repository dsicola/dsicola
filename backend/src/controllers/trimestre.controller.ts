import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

/**
 * Listar trimestres
 * VALIDAÇÃO: Trimestres são apenas para Ensino Secundário
 */
export const listTrimestres = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, anoLetivoId } = req.query;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // VALIDAÇÃO CRÍTICA: Trimestres são apenas para Ensino Secundário
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    if (tipoAcademico === 'SUPERIOR') {
      // Para Ensino Superior, retornar array vazio (não deve ter trimestres)
      return res.json([]);
    }

    const where: any = {
      ...filter,
    };

    if (anoLetivoId) {
      where.anoLetivoId = anoLetivoId as string;
    } else if (anoLetivo) {
      where.anoLetivo = Number(anoLetivo);
    }

    const trimestres = await prisma.trimestre.findMany({
      where,
      orderBy: [
        { anoLetivo: 'desc' },
        { numero: 'desc' },
      ],
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

    res.json(trimestres);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar trimestre por ano letivo e número
 */
export const getTrimestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, numero } = req.query;

    if (!anoLetivo || !numero) {
      throw new AppError('AnoLetivo e Número são obrigatórios', 400);
    }

    const filter = addInstitutionFilter(req);

    const trimestre = await prisma.trimestre.findFirst({
      where: {
        anoLetivo: Number(anoLetivo),
        numero: Number(numero),
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
      },
    });

    if (!trimestre) {
      return res.json(null);
    }

    res.json(trimestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar trimestre atual (mais recente) por ano letivo
 */
export const getTrimestreAtual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo } = req.query;

    if (!anoLetivo) {
      throw new AppError('AnoLetivo é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);

    const trimestre = await prisma.trimestre.findFirst({
      where: {
        anoLetivo: Number(anoLetivo),
        ...filter,
      },
      orderBy: {
        numero: 'desc',
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

    if (!trimestre) {
      return res.json(null);
    }

    res.json(trimestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar trimestre
 */
export const createTrimestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, anoLetivoId, numero, dataInicio, dataFim, dataInicioNotas, dataFimNotas, observacoes } = req.body;

    if ((!anoLetivo && !anoLetivoId) || !numero || !dataInicio) {
      throw new AppError('AnoLetivo (ou anoLetivoId), Número e DataInicio são obrigatórios', 400);
    }

    if (numero < 1 || numero > 3) {
      throw new AppError('Número do trimestre deve ser 1, 2 ou 3', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // VALIDAÇÃO DE SEGURANÇA: Verificar se prisma está inicializado
    if (!prisma || !prisma.anoLetivo) {
      throw new AppError('Erro interno: banco de dados não inicializado', 500);
    }

    // VALIDAÇÃO CRÍTICA: Trimestres são apenas para Ensino Secundário
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    if (tipoAcademico === 'SUPERIOR') {
      throw new AppError('Trimestres são permitidos apenas para instituições de Ensino Secundário. Instituições de Ensino Superior devem usar Semestres.', 400);
    }

    // REGRA MESTRA: Validar ano letivo - priorizar anoLetivoId quando fornecido
    let anoLetivoRecord;
    let anoLetivoFinal: number;
    
    if (anoLetivoId) {
      // Se recebeu anoLetivoId, buscar e validar diretamente
      anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: {
          id: anoLetivoId,
          ...filter,
        },
      });
      if (!anoLetivoRecord) {
        throw new AppError(`Ano letivo com ID ${anoLetivoId} não encontrado ou não pertence à sua instituição.`, 404);
      }
      anoLetivoFinal = anoLetivoRecord.ano;
    } else if (anoLetivo) {
      // Se recebeu apenas o número do ano, buscar o registro
      anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: {
          ano: Number(anoLetivo),
          ...filter,
        },
      });
      if (!anoLetivoRecord) {
        throw new AppError(`Ano letivo ${anoLetivo} não encontrado. É necessário criar o ano letivo primeiro.`, 404);
      }
      anoLetivoFinal = Number(anoLetivo);
    } else {
      throw new AppError('Ano letivo é obrigatório para criar trimestre', 400);
    }

    // VALIDAÇÃO: Verificar se datas do trimestre estão dentro do período do ano letivo
    const dataInicioTrimestre = new Date(dataInicio);
    const dataFimTrimestre = dataFim ? new Date(dataFim) : null;
    const dataInicioAno = new Date(anoLetivoRecord.dataInicio);
    const dataFimAno = anoLetivoRecord.dataFim ? new Date(anoLetivoRecord.dataFim) : null;

    if (dataInicioTrimestre < dataInicioAno) {
      throw new AppError(
        `A data de início do trimestre (${dataInicioTrimestre.toLocaleDateString('pt-BR')}) está antes do início do ano letivo (${dataInicioAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    if (dataFimAno && dataInicioTrimestre > dataFimAno) {
      throw new AppError(
        `A data de início do trimestre (${dataInicioTrimestre.toLocaleDateString('pt-BR')}) está após o fim do ano letivo (${dataFimAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    if (dataFimTrimestre && dataFimAno && dataFimTrimestre > dataFimAno) {
      throw new AppError(
        `A data de fim do trimestre (${dataFimTrimestre.toLocaleDateString('pt-BR')}) está após o fim do ano letivo (${dataFimAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar se dataInicio < dataFim (se dataFim fornecida)
    if (dataFimTrimestre && dataInicioTrimestre >= dataFimTrimestre) {
      throw new AppError('A data de início do trimestre deve ser anterior à data de fim.', 400);
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar datas de notas (se fornecidas)
    if (dataInicioNotas && dataFimNotas) {
      const dataInicioNotasObj = new Date(dataInicioNotas);
      const dataFimNotasObj = new Date(dataFimNotas);
      
      if (dataInicioNotasObj >= dataFimNotasObj) {
        throw new AppError('A data de início de notas deve ser anterior à data de fim de notas.', 400);
      }

      // Verificar se datas de notas estão dentro do período do trimestre
      if (dataInicioNotasObj < dataInicioTrimestre) {
        throw new AppError('A data de início de notas não pode ser anterior à data de início do trimestre.', 400);
      }

      if (dataFimTrimestre && dataFimNotasObj > dataFimTrimestre) {
        throw new AppError('A data de fim de notas não pode ser posterior à data de fim do trimestre.', 400);
      }
    }

    // Verificar se já existe trimestre com mesmo ano e número
    const trimestreExistente = await prisma.trimestre.findFirst({
      where: {
        anoLetivoId: anoLetivoRecord.id,
        numero: Number(numero),
        ...filter,
      },
    });

    if (trimestreExistente) {
      throw new AppError(`Já existe um trimestre ${numero} para o ano letivo ${anoLetivoFinal}`, 400);
    }

    const trimestre = await prisma.trimestre.create({
      data: {
        anoLetivoId: anoLetivoRecord.id, // OBRIGATÓRIO: Vincular pelo ID do AnoLetivo
        anoLetivo: anoLetivoFinal, // Mantido para compatibilidade
        numero: Number(numero),
        dataInicio: new Date(dataInicio),
        dataFim: dataFim ? new Date(dataFim) : null,
        dataInicioNotas: dataInicioNotas ? new Date(dataInicioNotas) : null,
        dataFimNotas: dataFimNotas ? new Date(dataFimNotas) : null,
        observacoes: observacoes || null,
        instituicaoId,
        status: 'PLANEJADO',
        estado: 'RASCUNHO',
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
      entidade: EntidadeAuditoria.PERIODO_LETIVO,
      entidadeId: trimestre.id,
      instituicaoId,
      dadosNovos: {
        anoLetivo: trimestre.anoLetivo,
        numero: trimestre.numero,
        dataInicio: trimestre.dataInicio,
        dataFim: trimestre.dataFim,
        status: trimestre.status,
      },
    });

    res.status(201).json(trimestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar trimestre
 */
export const updateTrimestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim, dataInicioNotas, dataFimNotas, observacoes } = req.body;

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Buscar trimestre
    const trimestreAtual = await prisma.trimestre.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!trimestreAtual) {
      throw new AppError('Trimestre não encontrado ou não pertence à sua instituição', 404);
    }

    // Não permitir editar se já foi ativado ou encerrado
    if (trimestreAtual.status === 'ATIVO' || trimestreAtual.status === 'ENCERRADO') {
      throw new AppError(`Não é possível editar um trimestre com status ${trimestreAtual.status}`, 400);
    }

    const dadosAnteriores = {
      dataInicio: trimestreAtual.dataInicio,
      dataFim: trimestreAtual.dataFim,
      dataInicioNotas: trimestreAtual.dataInicioNotas,
      dataFimNotas: trimestreAtual.dataFimNotas,
      observacoes: trimestreAtual.observacoes,
    };

    const updateData: any = {};
    if (dataInicio !== undefined) updateData.dataInicio = new Date(dataInicio);
    if (dataFim !== undefined) updateData.dataFim = dataFim ? new Date(dataFim) : null;
    if (dataInicioNotas !== undefined) updateData.dataInicioNotas = dataInicioNotas ? new Date(dataInicioNotas) : null;
    if (dataFimNotas !== undefined) updateData.dataFimNotas = dataFimNotas ? new Date(dataFimNotas) : null;
    if (observacoes !== undefined) updateData.observacoes = observacoes || null;

    const trimestre = await prisma.trimestre.update({
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
      entidade: EntidadeAuditoria.PERIODO_LETIVO,
      entidadeId: trimestre.id,
      instituicaoId,
      dadosAnteriores,
      dadosNovos: updateData,
    });

    res.json(trimestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Ativar trimestre manualmente
 */
export const ativarTrimestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { trimestreId, anoLetivo, numero } = req.body;

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões
    const userRoles = req.user?.roles || [];
    const podeAtivar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeAtivar) {
      throw new AppError('Você não tem permissão para ativar trimestres', 403);
    }

    const filter = addInstitutionFilter(req);

    // Buscar trimestre
    let trimestre;
    if (trimestreId) {
      trimestre = await prisma.trimestre.findFirst({
        where: {
          id: trimestreId,
          ...filter,
        },
      });
    } else if (anoLetivo && numero) {
      trimestre = await prisma.trimestre.findFirst({
        where: {
          anoLetivo: Number(anoLetivo),
          numero: Number(numero),
          ...filter,
        },
      });
    } else {
      throw new AppError('TrimestreId ou (AnoLetivo e Número) são obrigatórios', 400);
    }

    if (!trimestre) {
      throw new AppError('Trimestre não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se está encerrado ou cancelado
    if (trimestre.status === 'ENCERRADO' || trimestre.status === 'CANCELADO') {
      throw new AppError(`Não é possível ativar um trimestre com status ${trimestre.status}`, 400);
    }

    // VALIDAÇÃO CRÍTICA: Verificar se ano letivo está ATIVO
    const anoLetivoRecord = await prisma.anoLetivo.findFirst({
      where: {
        ano: trimestre.anoLetivo,
        ...filter,
      },
    });

    if (!anoLetivoRecord) {
      throw new AppError(`Ano letivo ${trimestre.anoLetivo} não encontrado.`, 404);
    }

    if (anoLetivoRecord.status !== 'ATIVO') {
      throw new AppError(
        `Não é possível ativar o trimestre. O ano letivo ${trimestre.anoLetivo} ainda não está ativo. Status atual: ${anoLetivoRecord.status}. É necessário ativar o ano letivo primeiro.`,
        400
      );
    }

    // VALIDAÇÃO PROFISSIONAL: Não pode haver múltiplos trimestres ATIVOS no mesmo ano letivo
    const trimestreAtivoExistente = await prisma.trimestre.findFirst({
      where: {
        ...filter,
        anoLetivo: trimestre.anoLetivo,
        status: 'ATIVO',
        id: { not: trimestre.id },
      },
    });

    if (trimestreAtivoExistente) {
      throw new AppError(
        `Não é possível ativar o ${trimestre.numero}º trimestre. Já existe um trimestre ATIVO (${trimestreAtivoExistente.numero}º trimestre) no ano letivo ${trimestre.anoLetivo}. É necessário encerrar o trimestre ativo antes de ativar um novo.`,
        400
      );
    }

    // VALIDAÇÃO: Verificar sequência de trimestres (não pode ativar 2º/3º trimestre se anterior não estiver encerrado)
    if (trimestre.numero > 1) {
      const trimestreAnterior = await prisma.trimestre.findFirst({
        where: {
          anoLetivo: trimestre.anoLetivo,
          numero: trimestre.numero - 1,
          ...filter,
        },
      });

      if (trimestreAnterior && trimestreAnterior.status !== 'ENCERRADO' && trimestreAnterior.status !== 'CANCELADO') {
        throw new AppError(
          `Não é possível ativar o ${trimestre.numero}º trimestre. O ${trimestre.numero - 1}º trimestre ainda não foi encerrado. Status atual: ${trimestreAnterior.status}.`,
          400
        );
      }
    }

    // Se já está ativo, apenas atualizar alunos (idempotência)
    if (trimestre.status === 'ATIVO') {
      // Atualizar apenas alunos que ainda estão "Matriculado"
      const resultado = await prisma.alunoDisciplina.updateMany({
        where: {
          ano: trimestre.anoLetivo,
          semestre: String(trimestre.numero),
          status: 'Matriculado',
          aluno: {
            ...(instituicaoId ? { instituicaoId } : {}),
          },
        },
        data: {
          status: 'Cursando',
        },
      });

      const alunosAtualizados = resultado.count;

      res.json({
        message: 'Trimestre já estava ativo. Alunos atualizados.',
        trimestre,
        alunosAtualizados,
      });
      return;
    }

    // Atualizar status do trimestre para ATIVO
    const trimestreAtualizado = await prisma.trimestre.update({
      where: { id: trimestre.id },
      data: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
      },
    });

    // Atualizar AlunoDisciplina.status de "Matriculado" para "Cursando"
    const resultado = await prisma.alunoDisciplina.updateMany({
      where: {
        ano: trimestre.anoLetivo,
        semestre: String(trimestre.numero),
        status: 'Matriculado',
        aluno: {
          ...(instituicaoId ? { instituicaoId } : {}),
        },
      },
      data: {
        status: 'Cursando',
      },
    });

    const alunosAtualizados = resultado.count;

    // Registrar auditoria
    await AuditService.log(req, {
      modulo: ModuloAuditoria.ANO_LETIVO,
      acao: AcaoAuditoria.TRIMESTRE_INICIADO_MANUAL,
      entidade: EntidadeAuditoria.PERIODO_LETIVO,
      entidadeId: trimestre.id,
      instituicaoId,
      dadosAnteriores: {
        status: 'PLANEJADO',
        dataInicio: trimestre.dataInicio,
      },
      dadosNovos: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
        alunosAtualizados: alunosAtualizados,
      },
      observacao: `Trimestre ${trimestre.anoLetivo}/${trimestre.numero} ativado manualmente por ${userId}. ${alunosAtualizados} aluno(s) atualizado(s) de "Matriculado" para "Cursando".`,
    });

    res.json({
      message: 'Trimestre ativado com sucesso',
      trimestre: trimestreAtualizado,
      alunosAtualizados,
    });
  } catch (error) {
    next(error);
  }
};

