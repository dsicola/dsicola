/**
 * PADRÃO SIGAE — Listagem de Estudantes (alunos)
 * GET /estudantes?page=1&pageSize=20&search=&sortBy=nome&sortOrder=asc&status=ATIVO&...
 *
 * REGRA: instituicaoId SEMPRE do JWT (req.user.instituicaoId), NUNCA do frontend
 */

import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { parseListQuery, listMeta } from '../utils/parseListQuery.js';

export const listarEstudantes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const { page, pageSize, skip, take, search, sortBy, sortOrder, filters } = parseListQuery(req.query as Record<string, string | string[] | undefined>);

    const where: Prisma.UserWhereInput = {
      instituicaoId,
      roles: { some: { role: 'ALUNO' } },
    };

    // Status (statusAluno: Ativo, Inativo, Concluído, Transferido, etc.)
    // UX: Por padrão mostrar apenas ATIVOS; "all"/"todos" remove filtro
    if (filters.status) {
      const s = filters.status.toLowerCase();
      if (s !== 'all' && s !== 'todos') {
        where.statusAluno = filters.status;
      }
    } else {
      where.statusAluno = 'Ativo';
    }

    // Date range (createdAt)
    if (filters.from || filters.to) {
      where.createdAt = {};
      if (filters.from) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(filters.from);
      if (filters.to) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(filters.to + 'T23:59:59.999Z');
    }

    // Search: nome, email, Nº (identidade imutável), BI
    if (search) {
      where.OR = [
        { nomeCompleto: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { numeroIdentificacao: { contains: search, mode: 'insensitive' } },
        { numeroIdentificacaoPublica: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filtros acadêmicos via matrícula
    if (filters.turmaId || filters.anoLetivoId || filters.cursoId || filters.classeId) {
      where.matriculas = {
        some: {
          ...(filters.turmaId && { turmaId: filters.turmaId }),
          ...(filters.anoLetivoId && { anoLetivoId: filters.anoLetivoId }),
          ...(filters.cursoId && { turma: { cursoId: filters.cursoId } }),
          ...(filters.classeId && { turma: { classeId: filters.classeId } }),
        },
      };
    }

    // Ordenação
    const orderField = sortBy === 'email' ? 'email' : sortBy === 'numero' ? 'numeroIdentificacaoPublica' : 'nomeCompleto';
    const orderBy: Prisma.UserOrderByWithRelationInput = { [orderField]: sortOrder };

    const [estudantes, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy,
        select: {
          id: true,
          email: true,
          nomeCompleto: true,
          telefone: true,
          numeroIdentificacao: true,
          numeroIdentificacaoPublica: true,
          dataNascimento: true,
          genero: true,
          avatarUrl: true,
          statusAluno: true,
          instituicaoId: true,
          createdAt: true,
          updatedAt: true,
          matriculas: {
            where: { status: 'Ativa' },
            take: 1,
            orderBy: { dataMatricula: 'desc' },
            select: {
              turma: {
                select: {
                  id: true,
                  nome: true,
                  curso: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const data = estudantes.map((u) => {
      const matriculaAtiva = u.matriculas?.[0];
      return {
        id: u.id,
        email: u.email,
        nomeCompleto: u.nomeCompleto || '',
        nome_completo: u.nomeCompleto || '',
        telefone: u.telefone,
        numero_identificacao: u.numeroIdentificacao,
        numero_identificacao_publica: u.numeroIdentificacaoPublica,
        data_nascimento: u.dataNascimento ? u.dataNascimento.toISOString().split('T')[0] : null,
        genero: u.genero,
        avatar_url: u.avatarUrl,
        status_aluno: u.statusAluno,
        statusAluno: u.statusAluno,
        instituicao_id: u.instituicaoId,
        created_at: u.createdAt,
        updated_at: u.updatedAt,
        nome_pai: null,
        turma: matriculaAtiva?.turma ? { nome: matriculaAtiva.turma.nome, curso: matriculaAtiva.turma.curso } : null,
      };
    });

    res.json({
      data,
      meta: listMeta(page, pageSize, total),
    });
  } catch (error) {
    next(error);
  }
};
