import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import {
  getBibliotecaConfig,
  verificarLimiteEmprestimos,
  calcularECriarMulta,
} from '../services/biblioteca.service.js';

/**
 * Listar itens da biblioteca (consulta)
 * PROFESSOR: Pode consultar todos os itens da sua instituição
 */
export const getItens = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { busca, tipo, categoria } = req.query;

    const where: any = {
      ...filter,
    };

    // Filtros opcionais
    if (busca) {
      where.OR = [
        { titulo: { contains: busca as string, mode: 'insensitive' } },
        { autor: { contains: busca as string, mode: 'insensitive' } },
        { isbn: { contains: busca as string, mode: 'insensitive' } },
      ];
    }

    if (tipo && tipo !== 'all') {
      where.tipo = tipo;
    }

    if (categoria && categoria !== 'all') {
      where.categoria = categoria;
    }

    const itens = await prisma.bibliotecaItem.findMany({
      where,
      include: {
        _count: {
          select: {
            emprestimos: {
              where: {
                status: 'ATIVO',
              },
            },
          },
        },
      },
      orderBy: { titulo: 'asc' },
    });

    // Calcular disponibilidade
    const itensComDisponibilidade = itens.map((item) => {
      const emprestados = item._count.emprestimos;
      const disponivel = item.tipo === 'FISICO' 
        ? Math.max(0, item.quantidade - emprestados)
        : item.quantidade; // Digital sempre disponível

      return {
        id: item.id,
        titulo: item.titulo,
        autor: item.autor,
        isbn: item.isbn,
        tipo: item.tipo,
        categoria: item.categoria,
        quantidade: item.quantidade,
        disponivel,
        emprestados,
        localizacao: item.localizacao,
        arquivoUrl: item.arquivoUrl,
        thumbnailUrl: item.thumbnailUrl,
        descricao: item.descricao,
        editora: item.editora,
        anoPublicacao: item.anoPublicacao,
        edicao: item.edicao,
      };
    });

    res.json(itensComDisponibilidade);
  } catch (error) {
    next(error);
  }
};

/**
 * Obter item por ID
 * PROFESSOR: Pode consultar itens da sua instituição
 */
export const getItemById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const whereClause: any = { id };
    if (filter.instituicaoId) {
      whereClause.instituicaoId = filter.instituicaoId;
    }
    
    const item = await prisma.bibliotecaItem.findFirst({
      where: whereClause,
      include: {
        _count: {
          select: {
            emprestimos: true,
          },
        },
      },
    });

    if (!item) {
      throw new AppError('Item não encontrado', 404);
    }

    const emprestados = item._count.emprestimos;
    const disponivel = item.tipo === 'FISICO' 
      ? Math.max(0, item.quantidade - emprestados)
      : item.quantidade;

    res.json({
      ...item,
      disponivel,
      emprestados,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar meus empréstimos
 * PROFESSOR: Pode consultar seus próprios empréstimos
 */
export const getMeusEmprestimos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const filter = addInstitutionFilter(req);

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const { status } = req.query;

    const where: any = {
      usuarioId: userId,
      ...filter,
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const emprestimos = await prisma.emprestimoBiblioteca.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            titulo: true,
            autor: true,
            tipo: true,
            categoria: true,
            thumbnailUrl: true,
          },
        },
      },
      orderBy: { dataEmprestimo: 'desc' },
    });

    res.json(emprestimos);
  } catch (error) {
    next(error);
  }
};

/**
 * Solicitar empréstimo (PROFESSOR/ALUNO para si) ou criar em nome de terceiros (ADMIN/SECRETARIA)
 */
export const solicitarEmprestimo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const loggedUserId = req.user?.userId;
    const roles = req.user?.roles || [];
    const isAdminOrSecretaria = roles.includes('ADMIN') || roles.includes('SECRETARIA') || roles.includes('SUPER_ADMIN');
    const instituicaoId = requireTenantScope(req);

    if (!loggedUserId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const { itemId, usuarioId: bodyUsuarioId, dataPrevista, observacoes } = req.body;

    if (!itemId) {
      throw new AppError('Item é obrigatório', 400);
    }

    // ADMIN/SECRETARIA pode criar empréstimo para outro usuário (usuarioId no body)
    let userId = (isAdminOrSecretaria && bodyUsuarioId) ? bodyUsuarioId : loggedUserId;

    // Resolver: frontend pode enviar professores.id; precisamos de users.id
    const professor = await prisma.professor.findFirst({
      where: { id: userId, instituicaoId },
      select: { userId: true },
    });
    if (professor) {
      userId = professor.userId;
    }

    // Validar que usuarioId existe e pertence à instituição
    const userExists = await prisma.user.findFirst({
      where: { id: userId },
      select: { instituicaoId: true },
    });
    if (!userExists) {
      throw new AppError('Usuário não encontrado', 404);
    }
    if (userExists.instituicaoId !== instituicaoId) {
      throw new AppError('Usuário não pertence à instituição', 403);
    }

    // Verificar se item existe e pertence à instituição
    const item = await prisma.bibliotecaItem.findFirst({
      where: {
        id: itemId,
        instituicaoId,
      },
      include: {
        _count: {
          select: {
            emprestimos: {
              where: {
                status: 'ATIVO',
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new AppError('Item não encontrado', 404);
    }

    // Para itens físicos, verificar disponibilidade
    if (item.tipo === 'FISICO') {
      const emprestados = item._count.emprestimos;
      const disponivel = Math.max(0, item.quantidade - emprestados);

      if (disponivel <= 0) {
        throw new AppError('Item não disponível no momento. Todos os exemplares estão emprestados.', 400);
      }

      // Verificar se já tem empréstimo ativo deste item
      const emprestimoAtivo = await prisma.emprestimoBiblioteca.findFirst({
        where: {
          itemId,
          usuarioId: userId,
          status: 'ATIVO',
          instituicaoId,
        },
      });

      if (emprestimoAtivo) {
        throw new AppError('Este usuário já possui um empréstimo ativo deste item', 400);
      }
    }

    // Verificar limite de empréstimos por usuário
    const { permitido, atual, limite } = await verificarLimiteEmprestimos(instituicaoId, userId);
    if (!permitido) {
      throw new AppError(
        `Limite de empréstimos atingido. Você possui ${atual} empréstimo(s) ativo(s). O limite é ${limite}.`,
        400
      );
    }

    // Calcular data prevista (padrão: 15 dias)
    const dataPrevistaFinal = dataPrevista 
      ? new Date(dataPrevista)
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    // Criar empréstimo
    const emprestimo = await prisma.emprestimoBiblioteca.create({
      data: {
        itemId,
        usuarioId: userId,
        dataPrevista: dataPrevistaFinal,
        observacoes: observacoes || null,
        instituicaoId,
        status: 'ATIVO',
      },
      include: {
        item: {
          select: {
            id: true,
            titulo: true,
            autor: true,
            tipo: true,
            arquivoUrl: true,
            thumbnailUrl: true,
          },
        },
      },
    });

    // Auditoria: Log CREATE
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.EMPRESTIMO_BIBLIOTECA,
      entidadeId: emprestimo.id,
      dadosNovos: emprestimo,
      observacao: `Empréstimo solicitado: ${emprestimo.item.titulo}`,
    });

    res.status(201).json(emprestimo);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar todos os empréstimos (ADMIN/SECRETARIA)
 */
export const getEmprestimos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status, usuarioId } = req.query;

    const where: any = { ...filter };
    if (status && status !== 'all') {
      where.status = status;
    }
    if (usuarioId) {
      where.usuarioId = usuarioId;
    }

    const emprestimos = await prisma.emprestimoBiblioteca.findMany({
      where,
      include: {
        item: {
          select: {
            id: true,
            titulo: true,
            autor: true,
            tipo: true,
            categoria: true,
            thumbnailUrl: true,
          },
        },
        usuario: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          },
        },
      },
      orderBy: { dataEmprestimo: 'desc' },
    });

    res.json(emprestimos);
  } catch (error) {
    next(error);
  }
};

/**
 * Devolver empréstimo (ADMIN/SECRETARIA)
 */
export const devolverEmprestimo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const emprestimo = await prisma.emprestimoBiblioteca.findFirst({
      where: { id, ...filter },
      include: { item: { select: { titulo: true } } },
    });

    if (!emprestimo) {
      throw new AppError('Empréstimo não encontrado', 404);
    }
    if (emprestimo.status !== 'ATIVO') {
      throw new AppError('Empréstimo já foi devolvido', 400);
    }

    const dataDevolucao = new Date();
    const updated = await prisma.emprestimoBiblioteca.update({
      where: { id },
      data: {
        status: 'DEVOLVIDO',
        dataDevolucao,
      },
      include: {
        item: { select: { id: true, titulo: true, autor: true, tipo: true } },
        usuario: { select: { id: true, nomeCompleto: true, email: true } },
      },
    });

    // Calcular e criar multa se houver atraso
    let multaInfo: { multaId?: string; valor: number; diasAtraso: number } | null = null;
    try {
      multaInfo = await calcularECriarMulta(
        id,
        emprestimo.dataPrevista,
        dataDevolucao,
        emprestimo.instituicaoId
      );
    } catch (err) {
      console.warn('[devolverEmprestimo] Erro ao calcular multa (não crítico):', err);
    }

    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.EMPRESTIMO_BIBLIOTECA,
      entidadeId: id,
      dadosAnteriores: emprestimo,
      dadosNovos: updated,
      observacao: `Devolução: ${emprestimo.item.titulo}`,
    });

    res.json({ ...updated, multa: multaInfo });
  } catch (error) {
    next(error);
  }
};

/**
 * Renovar empréstimo (ADMIN/SECRETARIA)
 */
export const renovarEmprestimo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const { dataPrevista } = req.body;

    const emprestimo = await prisma.emprestimoBiblioteca.findFirst({
      where: { id, ...filter },
      include: { item: { select: { titulo: true } } },
    });

    if (!emprestimo) {
      throw new AppError('Empréstimo não encontrado', 404);
    }
    if (emprestimo.status !== 'ATIVO') {
      throw new AppError('Apenas empréstimos ativos podem ser renovados', 400);
    }

    const novaDataPrevista = dataPrevista
      ? new Date(dataPrevista)
      : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);

    const updated = await prisma.emprestimoBiblioteca.update({
      where: { id },
      data: { dataPrevista: novaDataPrevista },
      include: {
        item: { select: { id: true, titulo: true, autor: true, tipo: true } },
        usuario: { select: { id: true, nomeCompleto: true, email: true } },
      },
    });

    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.EMPRESTIMO_BIBLIOTECA,
      entidadeId: id,
      dadosAnteriores: emprestimo,
      dadosNovos: updated,
      observacao: `Renovação: ${emprestimo.item.titulo}`,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Acessar item digital
 * PROFESSOR: Pode acessar itens digitais que solicitou
 */
export const acessarItemDigital = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { itemId } = req.params;
    const filter = addInstitutionFilter(req);

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Verificar se item existe e é digital
    const item = await prisma.bibliotecaItem.findFirst({
      where: {
        id: itemId,
        tipo: 'DIGITAL',
        ...filter,
      },
    });

    if (!item) {
      throw new AppError('Item digital não encontrado', 404);
    }

    // Verificar se tem empréstimo ativo ou criar automaticamente
    const whereClauseEmprestimo: any = {
      itemId,
      usuarioId: userId,
      status: 'ATIVO',
    };
    if (filter.instituicaoId) {
      whereClauseEmprestimo.item = {
        instituicaoId: filter.instituicaoId,
      };
    }
    
    let emprestimo = await prisma.emprestimoBiblioteca.findFirst({
      where: whereClauseEmprestimo,
    });

    // Se não tem empréstimo, criar automaticamente para digitais
    if (!emprestimo && item.tipo === 'DIGITAL') {
      const dataPrevista = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 ano para digitais

      emprestimo = await prisma.emprestimoBiblioteca.create({
        data: {
          itemId,
          usuarioId: userId,
          dataPrevista,
          instituicaoId: filter.instituicaoId as string,
          status: 'ATIVO',
        },
      });

      // Auditoria
      await AuditService.logCreate(req, {
        modulo: ModuloAuditoria.BIBLIOTECA,
        entidade: EntidadeAuditoria.EMPRESTIMO_BIBLIOTECA,
        entidadeId: emprestimo.id,
        dadosNovos: emprestimo,
        observacao: `Acesso a item digital: ${item.titulo}`,
      });
    }

    if (!item.arquivoUrl) {
      throw new AppError('Arquivo digital não disponível', 404);
    }

    res.json({
      arquivoUrl: item.arquivoUrl,
      titulo: item.titulo,
      autor: item.autor,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Criar item (ADMIN/SECRETARIA)
 */
export const createItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const body = req.body as Record<string, string>;
    const files = req.files as { arquivo?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;

    const titulo = body.titulo?.trim();
    if (!titulo) {
      throw new AppError('Título é obrigatório', 400);
    }

    const tipo = (body.tipo || 'FISICO') as 'FISICO' | 'DIGITAL';
    if (tipo === 'DIGITAL') {
      const arquivo = files?.arquivo?.[0];
      if (!arquivo) {
        throw new AppError('Arquivo PDF é obrigatório para itens digitais', 400);
      }
    }

    let arquivoUrl: string | null = null;
    let thumbnailUrl: string | null = null;

    if (tipo === 'DIGITAL' && files?.arquivo?.[0]) {
      const arq = files.arquivo[0];
      arquivoUrl = `/uploads/biblioteca/${arq.filename}`;
    }
    if (tipo === 'DIGITAL' && files?.thumbnail?.[0]) {
      const thumb = files.thumbnail[0];
      thumbnailUrl = `/uploads/biblioteca/thumbnails/${path.basename(thumb.filename)}`;
    }

    const item = await prisma.bibliotecaItem.create({
      data: {
        titulo,
        autor: body.autor?.trim() || null,
        isbn: body.isbn?.trim() || null,
        tipo,
        categoria: body.categoria?.trim() || null,
        quantidade: tipo === 'FISICO' ? Math.max(1, parseInt(body.quantidade || '1', 10) || 1) : 1,
        localizacao: body.localizacao?.trim() || null,
        descricao: body.descricao?.trim() || null,
        editora: body.editora?.trim() || null,
        anoPublicacao: body.anoPublicacao ? parseInt(body.anoPublicacao, 10) : null,
        edicao: body.edicao?.trim() || null,
        arquivoUrl,
        thumbnailUrl,
        instituicaoId,
      },
    });

    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.BIBLIOTECA_ITEM,
      entidadeId: item.id,
      dadosNovos: item,
      observacao: `Item criado: ${item.titulo}`,
    });

    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar item (ADMIN/SECRETARIA)
 */
export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const body = req.body as Record<string, string>;
    const files = req.files as { arquivo?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] } | undefined;

    const existing = await prisma.bibliotecaItem.findFirst({
      where: { id, ...filter },
    });

    if (!existing) {
      throw new AppError('Item não encontrado', 404);
    }

    const updateData: Record<string, unknown> = {};
    if (body.titulo !== undefined) updateData.titulo = body.titulo.trim();
    if (body.autor !== undefined) updateData.autor = body.autor?.trim() || null;
    if (body.isbn !== undefined) updateData.isbn = body.isbn?.trim() || null;
    if (body.tipo !== undefined) updateData.tipo = body.tipo;
    if (body.categoria !== undefined) updateData.categoria = body.categoria?.trim() || null;
    if (body.quantidade !== undefined) updateData.quantidade = Math.max(1, parseInt(body.quantidade || '1', 10) || 1);
    if (body.localizacao !== undefined) updateData.localizacao = body.localizacao?.trim() || null;
    if (body.descricao !== undefined) updateData.descricao = body.descricao?.trim() || null;
    if (body.editora !== undefined) updateData.editora = body.editora?.trim() || null;
    if (body.anoPublicacao !== undefined) updateData.anoPublicacao = body.anoPublicacao ? parseInt(body.anoPublicacao, 10) : null;
    if (body.edicao !== undefined) updateData.edicao = body.edicao?.trim() || null;

    if (existing.tipo === 'DIGITAL') {
      if (files?.arquivo?.[0]) {
        const arq = files.arquivo[0];
        updateData.arquivoUrl = `/uploads/biblioteca/${arq.filename}`;
      }
      if (files?.thumbnail?.[0]) {
        const thumb = files.thumbnail[0];
        updateData.thumbnailUrl = `/uploads/biblioteca/thumbnails/${thumb.filename}`;
      }
    }

    const item = await prisma.bibliotecaItem.update({
      where: { id },
      data: updateData,
    });

    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.BIBLIOTECA_ITEM,
      entidadeId: item.id,
      dadosAnteriores: existing,
      dadosNovos: item,
      observacao: `Item atualizado: ${item.titulo}`,
    });

    res.json(item);
  } catch (error) {
    next(error);
  }
};

/**
 * Excluir item (ADMIN/SECRETARIA)
 */
export const deleteItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const item = await prisma.bibliotecaItem.findFirst({
      where: { id, ...filter },
    });

    if (!item) {
      throw new AppError('Item não encontrado', 404);
    }

    // Verificar se há empréstimos ativos
    const emprestimosAtivos = await prisma.emprestimoBiblioteca.count({
      where: { itemId: id, status: 'ATIVO' },
    });
    if (emprestimosAtivos > 0) {
      throw new AppError('Não é possível excluir item com empréstimos ativos. Registre as devoluções primeiro.', 400);
    }

    await prisma.bibliotecaItem.delete({ where: { id } });

    // Remover arquivos do disco (opcional, não quebra se falhar)
    if (item.arquivoUrl) {
      try {
        const fullPath = path.join(process.cwd(), item.arquivoUrl.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch {
        // Ignorar erro de arquivo
      }
    }
    if (item.thumbnailUrl) {
      try {
        const fullPath = path.join(process.cwd(), item.thumbnailUrl.replace(/^\//, ''));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      } catch {
        // Ignorar erro de arquivo
      }
    }

    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.BIBLIOTECA,
      entidade: EntidadeAuditoria.BIBLIOTECA_ITEM,
      entidadeId: id,
      dadosAnteriores: item,
      observacao: `Item excluído: ${item.titulo}`,
    });

    res.json({ message: 'Item excluído com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Download/visualização de arquivo digital (protegido)
 */
export const downloadItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const item = await prisma.bibliotecaItem.findFirst({
      where: { id, ...filter },
    });

    if (!item) {
      throw new AppError('Item não encontrado', 404);
    }

    if (item.tipo !== 'DIGITAL' || !item.arquivoUrl) {
      throw new AppError('Arquivo digital não disponível', 404);
    }

    const fullPath = path.join(process.cwd(), item.arquivoUrl.replace(/^\//, ''));
    if (!fs.existsSync(fullPath)) {
      throw new AppError('Arquivo não encontrado no servidor', 404);
    }

    const preview = req.query.preview === 'true';
    if (preview) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(item.titulo) + '.pdf"');
    } else {
      res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURIComponent(item.titulo) + '.pdf"');
    }
    res.sendFile(path.resolve(fullPath));
  } catch (error) {
    next(error);
  }
};

/**
 * Obter configuração da biblioteca (ADMIN/SECRETARIA)
 */
export const getConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const config = await getBibliotecaConfig(instituicaoId);
    res.json(config);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar configuração da biblioteca (ADMIN/SECRETARIA)
 */
export const updateConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { limiteEmprestimosPorUsuario, multaPorDiaAtraso, diasParaNotificarVencimento, diasValidadeReserva } = req.body;

    const config = await prisma.bibliotecaConfig.upsert({
      where: { instituicaoId },
      create: {
        instituicaoId,
        limiteEmprestimosPorUsuario: limiteEmprestimosPorUsuario ?? 5,
        multaPorDiaAtraso: multaPorDiaAtraso ?? 0,
        diasParaNotificarVencimento: diasParaNotificarVencimento ?? 3,
        diasValidadeReserva: diasValidadeReserva ?? 7,
      },
      update: {
        ...(limiteEmprestimosPorUsuario !== undefined && { limiteEmprestimosPorUsuario }),
        ...(multaPorDiaAtraso !== undefined && { multaPorDiaAtraso }),
        ...(diasParaNotificarVencimento !== undefined && { diasParaNotificarVencimento }),
        ...(diasValidadeReserva !== undefined && { diasValidadeReserva }),
      },
    });

    res.json(config);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar reserva (PROFESSOR/ALUNO para si, ADMIN para outros)
 */
export const criarReserva = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const roles = req.user?.roles || [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('SECRETARIA') || roles.includes('SUPER_ADMIN');
    const instituicaoId = requireTenantScope(req);

    if (!userId) throw new AppError('Usuário não autenticado', 401);

    const { itemId, usuarioId: bodyUsuarioId } = req.body;
    const targetUserId = (isAdmin && bodyUsuarioId) ? bodyUsuarioId : userId;

    if (!itemId) throw new AppError('Item é obrigatório', 400);

    const item = await prisma.bibliotecaItem.findFirst({
      where: { id: itemId, instituicaoId },
      include: {
        _count: { select: { emprestimos: { where: { status: 'ATIVO' } } } },
      },
    });
    if (!item) throw new AppError('Item não encontrado', 404);
    if (item.tipo !== 'FISICO') throw new AppError('Apenas itens físicos podem ser reservados', 400);

    const disponivel = item.quantidade - (item._count?.emprestimos || 0);
    if (disponivel <= 0) throw new AppError('Item indisponível para reserva', 400);

    const config = await getBibliotecaConfig(instituicaoId);
    const dataExpiracao = new Date();
    dataExpiracao.setDate(dataExpiracao.getDate() + config.diasValidadeReserva);

    const reservaExistente = await prisma.reservaBiblioteca.findFirst({
      where: { itemId, usuarioId: targetUserId, status: 'PENDENTE' },
    });
    if (reservaExistente) throw new AppError('Você já possui uma reserva pendente deste item', 400);

    const reserva = await prisma.reservaBiblioteca.create({
      data: { itemId, usuarioId: targetUserId, dataExpiracao, instituicaoId },
      include: {
        item: { select: { id: true, titulo: true, autor: true } },
        usuario: { select: { id: true, nomeCompleto: true } },
      },
    });

    res.status(201).json(reserva);
  } catch (error) {
    next(error);
  }
};

/**
 * Cancelar reserva
 */
export const cancelarReserva = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const userId = req.user?.userId;

    const reserva = await prisma.reservaBiblioteca.findFirst({
      where: { id, ...filter },
    });
    if (!reserva) throw new AppError('Reserva não encontrada', 404);
    if (reserva.status !== 'PENDENTE') throw new AppError('Apenas reservas pendentes podem ser canceladas', 400);

    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SECRETARIA');
    if (!isAdmin && reserva.usuarioId !== userId) {
      throw new AppError('Você só pode cancelar suas próprias reservas', 403);
    }

    await prisma.reservaBiblioteca.update({
      where: { id },
      data: { status: 'CANCELADA' },
    });

    res.json({ message: 'Reserva cancelada' });
  } catch (error) {
    next(error);
  }
};

/**
 * Listar reservas (ADMIN todas, usuário as suas)
 */
export const getReservas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { status, usuarioId } = req.query;
    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SECRETARIA');

    const where: any = { ...filter };
    if (status && status !== 'all') where.status = status;
    if (!isAdmin) where.usuarioId = req.user?.userId;
    else if (usuarioId) where.usuarioId = usuarioId;

    const reservas = await prisma.reservaBiblioteca.findMany({
      where,
      include: {
        item: { select: { id: true, titulo: true, autor: true, tipo: true } },
        usuario: { select: { id: true, nomeCompleto: true, email: true } },
      },
      orderBy: { dataReserva: 'desc' },
    });

    res.json(reservas);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar multas (ADMIN todas, usuário as suas)
 */
export const getMultas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const statusParam = req.query.status as string | undefined;
    const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SECRETARIA');
    const validStatuses = ['PENDENTE', 'PAGA', 'ISENTA'] as const;
    const statusFilter = statusParam && statusParam !== 'all' && validStatuses.includes(statusParam as any)
      ? { status: statusParam as 'PENDENTE' | 'PAGA' | 'ISENTA' }
      : {};

    const multas = await prisma.multaBiblioteca.findMany({
      where: {
        ...filter,
        ...statusFilter,
        ...(!isAdmin ? { emprestimo: { usuarioId: req.user?.userId } } : {}),
      },
      include: {
        emprestimo: {
          include: {
            item: { select: { titulo: true, autor: true } },
            usuario: { select: { nomeCompleto: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(multas);
  } catch (error) {
    next(error);
  }
};

/**
 * Registrar pagamento de multa (ADMIN/SECRETARIA)
 */
export const pagarMulta = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const multa = await prisma.multaBiblioteca.findFirst({
      where: { id, ...filter },
    });
    if (!multa) throw new AppError('Multa não encontrada', 404);
    if (multa.status !== 'PENDENTE') throw new AppError('Multa já foi paga ou isenta', 400);

    const updated = await prisma.multaBiblioteca.update({
      where: { id },
      data: { status: 'PAGA', dataPagamento: new Date() },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

/**
 * Relatórios da biblioteca (ADMIN/SECRETARIA)
 */
export const getRelatorios = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);

    const [gruposEmprestimos, totalEmprestimosAtivos, totalEmprestimosMes, atrasados] = await Promise.all([
      prisma.emprestimoBiblioteca.groupBy({
        by: ['itemId'],
        where: { ...filter, status: { in: ['ATIVO', 'DEVOLVIDO'] } },
        _count: { id: true },
      }),
      prisma.emprestimoBiblioteca.count({ where: { ...filter, status: 'ATIVO' } }),
      prisma.emprestimoBiblioteca.count({
        where: {
          ...filter,
          dataEmprestimo: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      prisma.emprestimoBiblioteca.count({
        where: {
          ...filter,
          status: 'ATIVO',
          dataPrevista: { lt: new Date() },
        },
      }),
    ]);

    const itensMaisEmprestados = gruposEmprestimos
      .sort((a, b) => b._count.id - a._count.id)
      .slice(0, 10);

    const itemIds = itensMaisEmprestados.map((g) => g.itemId);
    const itens = await prisma.bibliotecaItem.findMany({
      where: { id: { in: itemIds } },
      select: { id: true, titulo: true, autor: true },
    });
    const itensMap = Object.fromEntries(itens.map((i) => [i.id, i]));

    const topItens = itensMaisEmprestados.map((g) => ({
      ...itensMap[g.itemId],
      totalEmprestimos: g._count.id,
    }));

    res.json({
      itensMaisEmprestados: topItens,
      totalEmprestimosAtivos,
      totalEmprestimosMes,
      empréstimosAtrasados: atrasados,
    });
  } catch (error) {
    next(error);
  }
};

