import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { validarPermissaoCalendario } from '../middlewares/role-permissions.middleware.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { tipo } = req.query;
    
    const eventos = await prisma.eventoCalendario.findMany({
      where: {
        ...filter,
        ...(tipo && { tipo: tipo as string }),
      },
      orderBy: { dataInicio: 'desc' },
    });
    
    res.json(eventos);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    
    const evento = await prisma.eventoCalendario.findFirst({
      where: { id, ...filter },
    });
    
    if (!evento) {
      throw new AppError('Evento não encontrado', 404);
    }
    
    res.json(evento);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode criar calendário
    await validarPermissaoCalendario(req);
    
    const instituicaoId = requireTenantScope(req);
    
    const { titulo, descricao, dataInicio, dataFim, horaInicio, horaFim, tipo, cor, recorrente, visivelPara } = req.body;

    // Validações obrigatórias
    if (!titulo || !dataInicio) {
      throw new AppError('Título e Data de Início são obrigatórios', 400);
    }

    // NUNCA aceitar instituicaoId do body - sempre usar do JWT
    const data = {
      titulo,
      descricao: descricao || null,
      dataInicio: new Date(dataInicio),
      dataFim: dataFim ? new Date(dataFim) : null,
      horaInicio: horaInicio || null,
      horaFim: horaFim || null,
      tipo: tipo || 'evento',
      cor: cor || '#3b82f6',
      recorrente: recorrente || false,
      visivelPara: visivelPara || ['todos'],
      instituicaoId, // Vem do JWT, nunca do body
    };

    const evento = await prisma.eventoCalendario.create({ data });
    
    // Auditoria: Log CREATE
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.CALENDARIO_ACADEMICO,
      entidade: EntidadeAuditoria.EVENTO_CALENDARIO,
      entidadeId: evento.id,
      dadosNovos: evento,
    });
    
    res.status(201).json(evento);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar calendário
    await validarPermissaoCalendario(req);
    
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    // Verificar se o evento existe e pertence à instituição
    const eventoExistente = await prisma.eventoCalendario.findFirst({
      where: { id, ...filter },
    });

    if (!eventoExistente) {
      throw new AppError('Evento não encontrado ou não pertence à sua instituição', 404);
    }

    const { titulo, descricao, dataInicio, dataFim, horaInicio, horaFim, tipo, cor, recorrente, visivelPara } = req.body;

    // NUNCA permitir mudança de instituicaoId
    const data: any = {};
    if (titulo !== undefined) data.titulo = titulo;
    if (descricao !== undefined) data.descricao = descricao || null;
    if (dataInicio !== undefined) data.dataInicio = new Date(dataInicio);
    if (dataFim !== undefined) data.dataFim = dataFim ? new Date(dataFim) : null;
    if (horaInicio !== undefined) data.horaInicio = horaInicio || null;
    if (horaFim !== undefined) data.horaFim = horaFim || null;
    if (tipo !== undefined) data.tipo = tipo;
    if (cor !== undefined) data.cor = cor;
    if (recorrente !== undefined) data.recorrente = recorrente;
    if (visivelPara !== undefined) data.visivelPara = visivelPara;
    
    const evento = await prisma.eventoCalendario.update({
      where: { id },
      data,
    });
    
    // Auditoria: Log UPDATE
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.CALENDARIO_ACADEMICO,
      entidade: EntidadeAuditoria.EVENTO_CALENDARIO,
      entidadeId: id,
      dadosAnteriores: eventoExistente,
      dadosNovos: evento,
    });
    
    res.json(evento);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode deletar calendário
    await validarPermissaoCalendario(req);
    
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    // Verificar se o evento existe e pertence à instituição
    const evento = await prisma.eventoCalendario.findFirst({
      where: { id, ...filter },
    });

    if (!evento) {
      throw new AppError('Evento não encontrado ou não pertence à sua instituição', 404);
    }

    // Auditoria: Log DELETE
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.CALENDARIO_ACADEMICO,
      entidade: EntidadeAuditoria.EVENTO_CALENDARIO,
      entidadeId: id,
      dadosAnteriores: evento,
    });

    await prisma.eventoCalendario.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
