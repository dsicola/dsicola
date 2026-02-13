import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { requireTenantScope } from '../middlewares/auth.js';

export const getAlunoEstatisticas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    
    // Get enrollments
    const matriculas = await prisma.matricula.count({
      where: { alunoId },
    });
    
    // Get grades
    const notas = await prisma.nota.findMany({
      where: { alunoId },
      select: { valor: true },
    });
    
    const mediaGeral = notas.length > 0
      ? notas.reduce((acc, n) => acc + Number(n.valor), 0) / notas.length
      : 0;
    
    // Get attendance
    const frequencias = await prisma.frequencia.findMany({
      where: { alunoId },
      select: { presente: true },
    });
    
    const totalAulas = frequencias.length;
    const presencas = frequencias.filter(f => f.presente).length;
    const percentualFrequencia = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;
    
    // Get pending payments
    const mensalidadesPendentes = await prisma.mensalidade.count({
      where: {
        alunoId,
        status: { in: ['Pendente', 'Atrasado'] },
      },
    });
    
    res.json({
      matriculas,
      mediaGeral: Math.round(mediaGeral * 100) / 100,
      percentualFrequencia: Math.round(percentualFrequencia * 100) / 100,
      totalAulas,
      presencas,
      mensalidadesPendentes,
    });
  } catch (error) {
    next(error);
  }
};

export const getInstituicaoEstatisticas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT (req.user.instituicaoId)
    // NUNCA ler de req.params, req.query ou req.body
    const instituicaoId = requireTenantScope(req);
    
    // Count students
    const alunosCount = await prisma.userRole_.count({
      where: {
        role: 'ALUNO',
        instituicaoId,
      },
    });
    
    // Count professors
    const professoresCount = await prisma.userRole_.count({
      where: {
        role: 'PROFESSOR',
        instituicaoId,
      },
    });
    
    // Count courses
    const cursosCount = await prisma.curso.count({
      where: { instituicaoId },
    });
    
    // Count classes
    const turmasCount = await prisma.turma.count({
      where: { instituicaoId },
    });
    
    // Count employees
    const funcionariosCount = await prisma.funcionario.count({
      where: { instituicaoId },
    });
    
    // Get aluno IDs for this institution
    const alunoRoles = await prisma.userRole_.findMany({
      where: {
        role: 'ALUNO',
        instituicaoId,
      },
      select: { userId: true },
    });
    const alunoIds = alunoRoles.map(r => r.userId);

    // Financial stats
    const mensalidadesPagas = await prisma.mensalidade.aggregate({
      where: {
        alunoId: { in: alunoIds },
        status: 'Pago',
      },
      _sum: { valor: true },
    });
    
    const mensalidadesPendentes = await prisma.mensalidade.aggregate({
      where: {
        alunoId: { in: alunoIds },
        status: { in: ['Pendente', 'Atrasado'] },
      },
      _sum: { valor: true },
    });
    
    res.json({
      alunos: alunosCount,
      professores: professoresCount,
      cursos: cursosCount,
      turmas: turmasCount,
      funcionarios: funcionariosCount,
      financeiro: {
        recebido: Number(mensalidadesPagas._sum.valor) || 0,
        pendente: Number(mensalidadesPendentes._sum.valor) || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};
