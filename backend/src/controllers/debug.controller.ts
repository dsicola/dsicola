import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middlewares/auth.js';
import { addInstitutionFilter, getInstituicaoIdFromAuth } from '../middlewares/auth.js';

/**
 * Endpoint de debug para verificar multi-tenant
 * Retorna informações sobre o usuário autenticado e filtros aplicados
 */
export const debugMultiTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userInfo = {
      userId: req.user?.userId,
      email: req.user?.email,
      instituicaoId: req.user?.instituicaoId,
      roles: req.user?.roles,
    };

    const filter = addInstitutionFilter(req);
    const instituicaoIdFromAuth = getInstituicaoIdFromAuth(req);

    // Buscar dados sem filtro (apenas para debug)
    const totalUsers = await prisma.user.count();
    const usersComInst = await prisma.user.count({
      where: { instituicaoId: { not: null } },
    });
    const usersSemInst = await prisma.user.count({
      where: { instituicaoId: null },
    });

    // Buscar dados COM filtro
    const usersFiltrados = await prisma.user.count({
      where: filter,
    });

    // Buscar dados da instituição específica
    let usersInstituicao = 0;
    if (req.user?.instituicaoId) {
      usersInstituicao = await prisma.user.count({
        where: { instituicaoId: req.user.instituicaoId },
      });
    }

    // Buscar cursos
    const totalCursos = await prisma.curso.count();
    const cursosFiltrados = await prisma.curso.count({
      where: filter,
    });

    // Buscar turmas
    const totalTurmas = await prisma.turma.count();
    const turmasFiltradas = await prisma.turma.count({
      where: filter,
    });

    // Buscar disciplinas
    const totalDisciplinas = await prisma.disciplina.count();
    const disciplinasFiltradas = await prisma.disciplina.count({
      where: filter,
    });

    res.json({
      debug: {
        userInfo,
        filter,
        instituicaoIdFromAuth,
        queryParams: req.query,
      },
      counts: {
        users: {
          total: totalUsers,
          comInstituicao: usersComInst,
          semInstituicao: usersSemInst,
          filtrados: usersFiltrados,
          daInstituicao: usersInstituicao,
        },
        cursos: {
          total: totalCursos,
          filtrados: cursosFiltrados,
        },
        turmas: {
          total: totalTurmas,
          filtradas: turmasFiltradas,
        },
        disciplinas: {
          total: totalDisciplinas,
          filtradas: disciplinasFiltradas,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

