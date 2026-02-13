import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';

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
 * Solicitar empréstimo (PROFESSOR/ALUNO)
 * PROFESSOR: Pode solicitar empréstimo de livros físicos e acessar digitais
 */
export const solicitarEmprestimo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const instituicaoId = requireTenantScope(req);

    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const { itemId, dataPrevista, observacoes } = req.body;

    if (!itemId) {
      throw new AppError('Item é obrigatório', 400);
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
        throw new AppError('Você já possui um empréstimo ativo deste item', 400);
      }
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

