import { Router } from 'express';
import { authenticate, authorize, addInstitutionFilter } from '../middlewares/auth.js';
import { buscarAnoLetivoAtivo } from '../services/validacaoAcademica.service.js';
import prisma from '../lib/prisma.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get admin dashboard stats
router.get('/admin', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT (req.user.instituicaoId)
    // SUPER_ADMIN pode usar query param opcional, mas por padrão usa do token
    let instituicaoId: string | null = null;
    
    if (req.user?.roles.includes('SUPER_ADMIN')) {
      // SUPER_ADMIN pode usar query param opcional para ver outra instituição
      const queryInstId = req.query.instituicaoId as string;
      instituicaoId = queryInstId?.trim() || req.user?.instituicaoId || null;
    } else {
      // Outros usuários sempre usam do JWT
      instituicaoId = req.user?.instituicaoId || null;
    }
    
    // Se não há instituicaoId, retornar valores zerados (nunca 400)
    if (!instituicaoId) {
      return res.json({
        alunos: 0,
        professores: 0,
        cursos: 0,
        turmas: 0
      });
    }
    
    // Determine filter
    const filter = { instituicaoId };

    // Count students (users with ALUNO role)
    const alunosCount = await prisma.userRole_.count({
      where: {
        role: 'ALUNO',
        instituicaoId: filter.instituicaoId
      }
    });

    // Count professors (users with PROFESSOR role)
    const professoresCount = await prisma.userRole_.count({
      where: {
        role: 'PROFESSOR',
        instituicaoId: filter.instituicaoId
      }
    });

    // Count courses
    const cursosCount = await prisma.curso.count({
      where: { instituicaoId: filter.instituicaoId }
    });

    // Count classes
    const turmasCount = await prisma.turma.count({
      where: { instituicaoId: filter.instituicaoId }
    });

    res.json({
      alunos: alunosCount,
      professores: professoresCount,
      cursos: cursosCount,
      turmas: turmasCount
    });
  } catch (error) {
    next(error);
  }
});

// Get recent users
router.get('/recent-users', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    const { limit } = req.query;
    // IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT via addInstitutionFilter
    const filter = addInstitutionFilter(req);

    const users = await prisma.user.findMany({
      where: filter.instituicaoId ? { instituicaoId: filter.instituicaoId } : {},
      select: {
        id: true,
        email: true,
        nomeCompleto: true,
        avatarUrl: true,
        createdAt: true,
        roles: {
          select: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) || 5
    });

    // Map to include primary role
    const result = users.map(user => ({
      ...user,
      role: user.roles[0]?.role || 'ALUNO'
    }));

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get today's classes
router.get('/today-classes', authorize('ADMIN', 'SECRETARIA', 'SUPER_ADMIN', 'PROFESSOR'), async (req, res, next) => {
  try {
    // REGRA 1: instituicaoId deve vir APENAS do JWT (req.user.instituicaoId)
    // NÃO validar body, query ou params - GET não deve validar dados do request
    const instituicaoId = req.user?.instituicaoId;
    
    // Se não há instituicaoId (usuário sem instituição), retornar lista vazia (nunca 400)
    if (!instituicaoId) {
      return res.json([]);
    }
    
    // REGRA 2: Buscar ano letivo ativo automaticamente (não exigir como parâmetro)
    const anoLetivoAtivo = await buscarAnoLetivoAtivo(instituicaoId);
    
    // REGRA 3: Se não houver ano letivo ativo, retornar lista vazia (nunca 400)
    if (!anoLetivoAtivo) {
      return res.json([]);
    }
    
    // REGRA 4: Respeitar tipo de instituição (SUPERIOR vs SECUNDARIO)
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Para Ensino Secundário: buscar no modelo Aula (relacionado a Turma)
    // Para Ensino Superior: buscar no modelo AulaLancada (relacionado a PlanoEnsino)
    if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário usa modelo Aula (antigo)
      const aulas = await prisma.aula.findMany({
        where: {
          data: {
            gte: today,
            lt: tomorrow
          },
          turma: {
            instituicaoId: instituicaoId,
            anoLetivoId: anoLetivoAtivo.id // Filtrar por ano letivo ativo
          }
        },
        include: {
          turma: {
            select: {
              id: true,
              nome: true,
              sala: true,
              professorId: true
            }
          }
        },
        take: 10,
        orderBy: { data: 'asc' }
      });

      return res.json(aulas);
    } else if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior usa modelo AulaLancada (novo)
      // REGRA 5: Não exigir turma no Ensino Superior (aulas são por PlanoEnsino)
      const aulasLancadas = await prisma.aulaLancada.findMany({
        where: {
          data: {
            gte: today,
            lt: tomorrow
          },
          instituicaoId: instituicaoId,
          planoEnsino: {
            anoLetivoId: anoLetivoAtivo.id // Filtrar por ano letivo ativo
          }
        },
        include: {
          planoAula: {
            select: {
              id: true,
              titulo: true,
              descricao: true
            }
          },
          planoEnsino: {
            select: {
              id: true,
              disciplina: {
                select: {
                  id: true,
                  nome: true
                }
              },
              turma: {
                select: {
                  id: true,
                  nome: true,
                  sala: true
                }
              },
              professor: {
                select: {
                  id: true,
                  user: {
                    select: { nomeCompleto: true }
                  }
                }
              }
            }
          }
        },
        take: 10,
        orderBy: { data: 'asc' }
      });

      // Transformar AulaLancada para formato compatível com o frontend
      const aulasFormatadas = aulasLancadas.map(aula => ({
        id: aula.id,
        data: aula.data,
        conteudo: aula.conteudoMinistrado,
        observacoes: aula.observacoes,
        turma: aula.planoEnsino?.turma ? {
          id: aula.planoEnsino.turma.id,
          nome: aula.planoEnsino.turma.nome,
          sala: aula.planoEnsino.turma.sala,
          horario: aula.horaInicio && aula.horaFim ? `${aula.horaInicio} - ${aula.horaFim}` : null,
          professorId: aula.planoEnsino.professor?.id || null
        } : null
      }));

      return res.json(aulasFormatadas);
    } else {
      // Tipo não identificado ou em configuração - retornar lista vazia (nunca 400)
      return res.json([]);
    }
  } catch (error) {
    // REGRA 6: Nunca retornar 400 por ausência de dados contextuais
    // Se houver erro, retornar lista vazia ao invés de erro 400
    console.error('[today-classes] Erro ao buscar aulas:', error);
    return res.json([]);
  }
});

// Get student statistics
// CRÍTICO MULTI-TENANT: Validar que aluno pertence à instituição do token
router.get('/aluno/:alunoId', authenticate, async (req, res, next) => {
  try {
    const { alunoId } = req.params;

    // instituicaoId APENAS do JWT - nunca de query/params
    const instituicaoId = req.user?.instituicaoId;
    if (!instituicaoId) {
      return res.status(403).json({ message: 'Acesso negado: usuário sem instituição associada' });
    }

    // Validar que o aluno pertence à instituição do usuário (instituicaoId APENAS do JWT)
    const aluno = await prisma.user.findFirst({
      where: {
        id: alunoId,
        instituicaoId: instituicaoId.trim()
      },
      select: { id: true }
    });
    if (!aluno) {
      return res.status(404).json({ message: 'Aluno não encontrado ou não pertence à sua instituição' });
    }

    // Get enrollments count (matrículas da turma que já filtrou instituição via aluno)
    const matriculasCount = await prisma.matricula.count({
      where: {
        alunoId,
        aluno: { instituicaoId: instituicaoId.trim() }
      }
    });

    // Get grades - filtrar por aluno da instituição
    const notas = await prisma.nota.findMany({
      where: {
        alunoId,
        aluno: { instituicaoId: instituicaoId.trim() }
      },
      select: { valor: true }
    });

    // Calculate average
    const mediaGeral = notas.length > 0
      ? notas.reduce((acc, n) => acc + Number(n.valor), 0) / notas.length
      : 0;

    // Get attendance - filtrar por aluno da instituição
    const frequencias = await prisma.frequencia.findMany({
      where: {
        alunoId,
        aluno: { instituicaoId: instituicaoId.trim() }
      },
      select: { presente: true }
    });

    const totalAulas = frequencias.length;
    const presencas = frequencias.filter(f => f.presente).length;
    const percentualFrequencia = totalAulas > 0 ? (presencas / totalAulas) * 100 : 0;

    res.json({
      matriculas: matriculasCount,
      mediaGeral: Math.round(mediaGeral * 100) / 100,
      percentualFrequencia: Math.round(percentualFrequencia * 100) / 100,
      totalAulas,
      presencas
    });
  } catch (error) {
    next(error);
  }
});

// Get institution usage (for plan limits)
// IMPORTANTE: Multi-tenant - instituicaoId vem APENAS do JWT (req.user.instituicaoId)
router.get('/uso-instituicao', authorize('ADMIN', 'SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Extrair instituicaoId apenas do JWT token
    // NUNCA ler de req.params, req.query ou req.body
    const instituicaoId = req.user?.instituicaoId;
    
    if (!instituicaoId) {
      // Se não há instituicaoId (usuário sem instituição), retornar valores vazios (nunca 400)
      return res.json({
        alunos_atual: 0,
        alunos_limite: null,
        professores_atual: 0,
        professores_limite: null,
        cursos_atual: 0,
        cursos_limite: null,
        plano_nome: 'Sem plano',
        assinatura_status: 'inativa'
      });
    }

    // Get subscription and plan
    const assinatura = await prisma.assinatura.findUnique({
      where: { instituicaoId },
      include: { plano: true }
    });

    if (!assinatura) {
      return res.json({
        alunos_atual: 0,
        alunos_limite: null,
        professores_atual: 0,
        professores_limite: null,
        cursos_atual: 0,
        cursos_limite: null,
        plano_nome: 'Sem plano',
        assinatura_status: 'inativa'
      });
    }

    // Count students
    const alunosCount = await prisma.userRole_.count({
      where: {
        role: 'ALUNO',
        instituicaoId
      }
    });

    // Count professors
    const professoresCount = await prisma.userRole_.count({
      where: {
        role: 'PROFESSOR',
        instituicaoId
      }
    });

    // Count courses
    const cursosCount = await prisma.curso.count({
      where: { instituicaoId }
    });

    res.json({
      alunos_atual: alunosCount,
      alunos_limite: assinatura.plano.limiteAlunos,
      professores_atual: professoresCount,
      professores_limite: assinatura.plano.limiteProfessores,
      cursos_atual: cursosCount,
      cursos_limite: assinatura.plano.limiteCursos,
      plano_nome: assinatura.plano.nome,
      assinatura_status: assinatura.status
    });
  } catch (error) {
    next(error);
  }
});

// Get super admin statistics (global stats across all institutions)
router.get('/super-admin', authorize('SUPER_ADMIN'), async (req, res, next) => {
  try {
    // Get all institutions
    const instituicoes = await prisma.instituicao.findMany({
      select: {
        id: true,
        nome: true,
        subdominio: true,
      }
    });

    // Calculate total students across all institutions
    const totalAlunos = await prisma.userRole_.count({
      where: {
        role: 'ALUNO'
      }
    });

    // Calculate total professors across all institutions
    const totalProfessores = await prisma.userRole_.count({
      where: {
        role: 'PROFESSOR'
      }
    });

    // Calculate total paid license payments
    const pagamentosLicenca = await prisma.pagamentoLicenca.findMany({
      where: {
        status: 'PAID'
      },
      select: {
        valor: true,
        instituicaoId: true
      }
    });

    const totalPagamentos = pagamentosLicenca.length;
    const valorTotalPago = pagamentosLicenca.reduce((sum, p) => sum + Number(p.valor), 0);

    // Calculate stats per institution
    const statsPorInstituicao = await Promise.all(
      instituicoes.map(async (inst) => {
        const alunos = await prisma.userRole_.count({
          where: {
            role: 'ALUNO',
            instituicaoId: inst.id
          }
        });

        const professores = await prisma.userRole_.count({
          where: {
            role: 'PROFESSOR',
            instituicaoId: inst.id
          }
        });

        const pagamentos = await prisma.pagamentoLicenca.count({
          where: {
            instituicaoId: inst.id,
            status: 'PAID'
          }
        });

        return {
          id: inst.id,
          nome: inst.nome,
          subdominio: inst.subdominio,
          totalAlunos: alunos,
          totalProfessores: professores,
          totalPagamentos: pagamentos
        };
      })
    );

    res.json({
      totalAlunos,
      totalProfessores,
      totalPagamentos,
      valorTotalPago,
      instituicoes: statsPorInstituicao
    });
  } catch (error) {
    next(error);
  }
});

export default router;
