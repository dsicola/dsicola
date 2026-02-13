import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria, AcaoAuditoria } from '../services/audit.service.js';

/**
 * Listar semestres
 * VALIDAÇÃO: Semestres são apenas para Ensino Superior
 */
export const listSemestres = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, anoLetivoId } = req.query;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // VALIDAÇÃO CRÍTICA: Semestres são apenas para Ensino Superior
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    if (tipoAcademico === 'SECUNDARIO') {
      // Para Ensino Secundário, retornar array vazio (não deve ter semestres)
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

    const semestres = await prisma.semestre.findMany({
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

    res.json(semestres);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar semestre por ano letivo e número
 */
export const getSemestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, numero } = req.query;

    if (!anoLetivo || !numero) {
      throw new AppError('AnoLetivo e Número são obrigatórios', 400);
    }

    const filter = addInstitutionFilter(req);

    const semestre = await prisma.semestre.findFirst({
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

    if (!semestre) {
      return res.json(null);
    }

    res.json(semestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar semestre atual (mais recente) por ano letivo
 */
export const getSemestreAtual = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo } = req.query;

    if (!anoLetivo) {
      throw new AppError('AnoLetivo é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);

    const semestre = await prisma.semestre.findFirst({
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

    if (!semestre) {
      return res.json(null);
    }

    res.json(semestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar semestre
 */
export const createSemestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { anoLetivo, anoLetivoId, numero, dataInicio, dataFim, dataInicioNotas, dataFimNotas, observacoes } = req.body;

    if ((!anoLetivo && !anoLetivoId) || !numero || !dataInicio) {
      throw new AppError('AnoLetivo (ou anoLetivoId), Número e DataInicio são obrigatórios', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // VALIDAÇÃO DE SEGURANÇA: Verificar se prisma está inicializado
    if (!prisma || !prisma.anoLetivo) {
      throw new AppError('Erro interno: banco de dados não inicializado', 500);
    }

    // VALIDAÇÃO CRÍTICA: Semestres são apenas para Ensino Superior
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    if (tipoAcademico === 'SECUNDARIO') {
      throw new AppError('Semestres são permitidos apenas para instituições de Ensino Superior. Instituições de Ensino Secundário devem usar Trimestres.', 400);
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
      throw new AppError('Ano letivo é obrigatório para criar semestre', 400);
    }

    // VALIDAÇÃO: Verificar se datas do semestre estão dentro do período do ano letivo
    const dataInicioSemestre = new Date(dataInicio);
    const dataFimSemestre = dataFim ? new Date(dataFim) : null;
    const dataInicioAno = new Date(anoLetivoRecord.dataInicio);
    const dataFimAno = anoLetivoRecord.dataFim ? new Date(anoLetivoRecord.dataFim) : null;

    if (dataInicioSemestre < dataInicioAno) {
      throw new AppError(
        `A data de início do semestre (${dataInicioSemestre.toLocaleDateString('pt-BR')}) está antes do início do ano letivo (${dataInicioAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    if (dataFimAno && dataInicioSemestre > dataFimAno) {
      throw new AppError(
        `A data de início do semestre (${dataInicioSemestre.toLocaleDateString('pt-BR')}) está após o fim do ano letivo (${dataFimAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    if (dataFimSemestre && dataFimAno && dataFimSemestre > dataFimAno) {
      throw new AppError(
        `A data de fim do semestre (${dataFimSemestre.toLocaleDateString('pt-BR')}) está após o fim do ano letivo (${dataFimAno.toLocaleDateString('pt-BR')}).`,
        400
      );
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar se dataInicio < dataFim (se dataFim fornecida)
    if (dataFimSemestre && dataInicioSemestre >= dataFimSemestre) {
      throw new AppError('A data de início do semestre deve ser anterior à data de fim.', 400);
    }

    // VALIDAÇÃO PROFISSIONAL: Verificar datas de notas (se fornecidas)
    if (dataInicioNotas && dataFimNotas) {
      const dataInicioNotasObj = new Date(dataInicioNotas);
      const dataFimNotasObj = new Date(dataFimNotas);
      
      if (dataInicioNotasObj >= dataFimNotasObj) {
        throw new AppError('A data de início de notas deve ser anterior à data de fim de notas.', 400);
      }

      // Verificar se datas de notas estão dentro do período do semestre
      if (dataInicioNotasObj < dataInicioSemestre) {
        throw new AppError('A data de início de notas não pode ser anterior à data de início do semestre.', 400);
      }

      if (dataFimSemestre && dataFimNotasObj > dataFimSemestre) {
        throw new AppError('A data de fim de notas não pode ser posterior à data de fim do semestre.', 400);
      }
    }

    // Verificar se já existe semestre com mesmo ano e número
    const semestreExistente = await prisma.semestre.findFirst({
      where: {
        anoLetivoId: anoLetivoRecord.id,
        numero: Number(numero),
        ...filter,
      },
    });

    if (semestreExistente) {
      throw new AppError(`Já existe um semestre ${numero} para o ano letivo ${anoLetivoFinal}`, 400);
    }

    const semestre = await prisma.semestre.create({
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
      entidadeId: semestre.id,
      instituicaoId,
      dadosNovos: {
        anoLetivo: semestre.anoLetivo,
        numero: semestre.numero,
        dataInicio: semestre.dataInicio,
        dataFim: semestre.dataFim,
        status: semestre.status,
      },
    });

    res.status(201).json(semestre);
  } catch (error: any) {
    // Log detalhado do erro para debug
    console.error('[createSemestre] Erro ao criar semestre:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      body: req.body,
    });
    next(error);
  }
};

/**
 * Atualizar semestre
 */
export const updateSemestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { dataInicio, dataFim, observacoes } = req.body;

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Buscar semestre
    const semestreAtual = await prisma.semestre.findFirst({
      where: {
        id,
        ...filter,
      },
    });

    if (!semestreAtual) {
      throw new AppError('Semestre não encontrado ou não pertence à sua instituição', 404);
    }

    // Não permitir editar se já foi ativado ou encerrado
    if (semestreAtual.status === 'ATIVO' || semestreAtual.status === 'ENCERRADO') {
      throw new AppError(`Não é possível editar um semestre com status ${semestreAtual.status}`, 400);
    }

    const dadosAnteriores = {
      dataInicio: semestreAtual.dataInicio,
      dataFim: semestreAtual.dataFim,
      observacoes: semestreAtual.observacoes,
    };

    const updateData: any = {};
    if (dataInicio !== undefined) updateData.dataInicio = new Date(dataInicio);
    if (dataFim !== undefined) updateData.dataFim = dataFim ? new Date(dataFim) : null;
    if (observacoes !== undefined) updateData.observacoes = observacoes || null;
    
    // Campos de datas de notas (opcionais)
    const { dataInicioNotas, dataFimNotas } = req.body;
    if (dataInicioNotas !== undefined) updateData.dataInicioNotas = dataInicioNotas ? new Date(dataInicioNotas) : null;
    if (dataFimNotas !== undefined) updateData.dataFimNotas = dataFimNotas ? new Date(dataFimNotas) : null;

    const semestre = await prisma.semestre.update({
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
      entidadeId: semestre.id,
      instituicaoId,
      dadosAnteriores,
      dadosNovos: updateData,
    });

    res.json(semestre);
  } catch (error) {
    next(error);
  }
};

/**
 * Ativar semestre manualmente
 */
export const ativarSemestre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { semestreId, anoLetivo, numero } = req.body;

    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId;

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar permissões (apenas ADMIN, DIRECAO, SUPER_ADMIN)
    const userRoles = req.user?.roles || [];
    const podeIniciar = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].some(role => userRoles.includes(role as any));

    if (!podeIniciar) {
      throw new AppError('Você não tem permissão para ativar semestres', 403);
    }

    const filter = addInstitutionFilter(req);

    // Buscar semestre
    let semestre;
    if (semestreId) {
      semestre = await prisma.semestre.findFirst({
        where: {
          id: semestreId,
          ...filter,
        },
      });
    } else if (anoLetivo && numero) {
      semestre = await prisma.semestre.findFirst({
        where: {
          anoLetivo: Number(anoLetivo),
          numero: Number(numero),
          ...filter,
        },
      });
    } else {
      throw new AppError('SemestreId ou (AnoLetivo e Número) são obrigatórios', 400);
    }

    if (!semestre) {
      throw new AppError('Semestre não encontrado ou não pertence à sua instituição', 404);
    }

    // Verificar se está encerrado ou cancelado
    if (semestre.status === 'ENCERRADO' || semestre.status === 'CANCELADO') {
      throw new AppError(`Não é possível ativar um semestre com status ${semestre.status}`, 400);
    }

    // VALIDAÇÃO CRÍTICA: Verificar se ano letivo está ATIVO
    const anoLetivoRecord = await prisma.anoLetivo.findFirst({
      where: {
        ano: semestre.anoLetivo,
        ...filter,
      },
    });

    if (!anoLetivoRecord) {
      throw new AppError(`Ano letivo ${semestre.anoLetivo} não encontrado.`, 404);
    }

    if (anoLetivoRecord.status !== 'ATIVO') {
      throw new AppError(
        `Não é possível ativar o semestre. O ano letivo ${semestre.anoLetivo} ainda não está ativo. Status atual: ${anoLetivoRecord.status}. É necessário ativar o ano letivo primeiro.`,
        400
      );
    }

    // VALIDAÇÃO PROFISSIONAL: Não pode haver múltiplos semestres ATIVOS no mesmo ano letivo
    const semestreAtivoExistente = await prisma.semestre.findFirst({
      where: {
        ...filter,
        anoLetivo: semestre.anoLetivo,
        status: 'ATIVO',
        id: { not: semestre.id },
      },
    });

    if (semestreAtivoExistente) {
      throw new AppError(
        `Não é possível ativar o ${semestre.numero}º semestre. Já existe um semestre ATIVO (${semestreAtivoExistente.numero}º semestre) no ano letivo ${semestre.anoLetivo}. É necessário encerrar o semestre ativo antes de ativar um novo.`,
        400
      );
    }

    // VALIDAÇÃO: Verificar sequência de semestres (não pode ativar 2º semestre se 1º não estiver encerrado)
    if (semestre.numero > 1) {
      const semestreAnterior = await prisma.semestre.findFirst({
        where: {
          anoLetivo: semestre.anoLetivo,
          numero: semestre.numero - 1,
          ...filter,
        },
      });

      if (semestreAnterior && semestreAnterior.status !== 'ENCERRADO' && semestreAnterior.status !== 'CANCELADO') {
        throw new AppError(
          `Não é possível ativar o ${semestre.numero}º semestre. O ${semestre.numero - 1}º semestre ainda não foi encerrado. Status atual: ${semestreAnterior.status}.`,
          400
        );
      }
    }

    // Se já está ativo, apenas atualizar alunos (idempotência)
    if (semestre.status === 'ATIVO') {
      // Atualizar apenas alunos que ainda estão "Matriculado"
      const resultado = await prisma.alunoDisciplina.updateMany({
        where: {
          ano: semestre.anoLetivo,
          semestre: String(semestre.numero),
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
        message: 'Semestre já estava ativo. Alunos atualizados.',
        semestre,
        alunosAtualizados,
      });
      return;
    }

    // Atualizar status do semestre para ATIVO
    const semestreAtualizado = await prisma.semestre.update({
      where: { id: semestre.id },
      data: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
      },
    });

    // Atualizar AlunoDisciplina.status de "Matriculado" para "Cursando"
    const resultado = await prisma.alunoDisciplina.updateMany({
      where: {
        ano: semestre.anoLetivo,
        semestre: String(semestre.numero),
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
      acao: AcaoAuditoria.SEMESTRE_ATIVADO_MANUAL,
      entidade: EntidadeAuditoria.PERIODO_LETIVO,
      entidadeId: semestre.id,
      instituicaoId,
      dadosAnteriores: {
        status: 'PLANEJADO',
        dataInicio: semestre.dataInicio,
      },
      dadosNovos: {
        status: 'ATIVO',
        ativadoEm: new Date(),
        ativadoPor: userId,
        alunosAtualizados: alunosAtualizados,
      },
      observacao: `Semestre ${semestre.anoLetivo}/${semestre.numero} ativado manualmente por ${userId}. ${alunosAtualizados} aluno(s) atualizado(s) de "Matriculado" para "Cursando".`,
    });

    res.json({
      message: 'Semestre ativado com sucesso',
      semestre: semestreAtualizado,
      alunosAtualizados,
    });
  } catch (error) {
    next(error);
  }
};

