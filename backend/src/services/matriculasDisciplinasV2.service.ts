import prisma from '../lib/prisma.js';
import { JwtPayload } from '../middlewares/auth.js';
import { gerarNumeroIdentificacaoPublica } from './user.service.js';

export interface MatriculasDisciplinasV2Filters {
  instituicao_id?: string;
  ano_letivo?: number;
  aluno_id?: string;
  turma_id?: string;
  curso_id?: string;
  status?: string;
}

/**
 * Service para buscar matrículas em disciplinas (v2)
 * Implementação robusta e simples
 * Retorna matrículas individuais (formato compatível com frontend)
 */
export class MatriculasDisciplinasV2Service {
  /**
   * Busca todas as matrículas em disciplinas com filtros opcionais
   * Retorna array de matrículas individuais (não agrupadas)
   */
  static async getAll(
    user: JwtPayload | undefined,
    filters: MatriculasDisciplinasV2Filters = {}
  ): Promise<any[]> {
    // Determinar instituicaoId (multi-tenant)
    // MULTI-TENANT: instituicaoId vem EXCLUSIVAMENTE do token (user.instituicaoId)
    // SUPER_ADMIN pode filtrar por instituicao_id via query, mas só se autenticado
    let instituicaoIdFilter: string | null = null;
    
    if (!user) {
      // SEM AUTENTICAÇÃO: retornar vazio (segurança)
      return [];
    }
    
    // Se for SUPER_ADMIN, pode filtrar por instituicao_id opcional (já validado no controller)
    if (user.roles?.includes('SUPER_ADMIN')) {
      instituicaoIdFilter = filters.instituicao_id || null;
    } else {
      // Outros usuários DEVEM usar sua própria instituição do token
      // NUNCA aceitar instituicao_id do filtro para usuários normais
      if (filters.instituicao_id) {
        // Tentativa de burlar multi-tenant - ignorar o filtro e usar do token
        console.warn('[MatriculasDisciplinasV2Service] Tentativa de passar instituicao_id ignorada - usando do token');
      }
      instituicaoIdFilter = user.instituicaoId || null;
      
      // Se usuário não tem instituição, não pode acessar dados
      if (!instituicaoIdFilter) {
        return [];
      }
    }

    // Construir where clause
    const where: any = {};

    // Filtrar por instituição através dos alunos
    if (instituicaoIdFilter) {
      // Buscar IDs dos alunos da instituição
      const alunosDaInstituicao = await prisma.user.findMany({
        where: {
          instituicaoId: instituicaoIdFilter,
          roles: {
            some: {
              role: 'ALUNO'
            }
          }
        },
        select: { id: true },
      });
      
      const alunoIds = alunosDaInstituicao.map(a => a.id);
      
      if (alunoIds.length === 0) {
        // Não há alunos na instituição
        return [];
      }
      
      // Se aluno_id foi fornecido, verificar se pertence à instituição
      if (filters.aluno_id) {
        if (!alunoIds.includes(filters.aluno_id)) {
          return [];
        }
        where.alunoId = filters.aluno_id;
      } else {
        where.alunoId = { in: alunoIds };
      }
    } else if (filters.aluno_id) {
      // Se não há filtro de instituição mas há filtro de aluno
      where.alunoId = filters.aluno_id;
    }

    // Aplicar outros filtros
    if (filters.ano_letivo) {
      where.ano = filters.ano_letivo;
    }

    if (filters.turma_id) {
      where.turmaId = filters.turma_id;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    // Filtrar por curso através de CursoDisciplina (NOVO MODELO)
    // REMOVIDO: disciplina.cursoId (legacy) - usar CursoDisciplina
    if (filters.curso_id) {
      // Buscar disciplinas vinculadas ao curso via CursoDisciplina
      const cursoDisciplinas = await prisma.cursoDisciplina.findMany({
        where: { cursoId: filters.curso_id },
        select: { disciplinaId: true },
      });
      const disciplinaIds = cursoDisciplinas.map(cd => cd.disciplinaId);
      
      if (disciplinaIds.length > 0) {
        where.disciplinaId = { in: disciplinaIds };
      } else {
        // Se não há disciplinas vinculadas ao curso, retornar array vazio
        return [];
      }
    }

    // Buscar todas as matrículas em disciplinas
    const alunoDisciplinas = await prisma.alunoDisciplina.findMany({
      where,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
            instituicaoId: true,
          }
        },
        disciplina: {
          include: {
            curso: {
              select: {
                id: true,
                nome: true,
                valorMensalidade: true,
                taxaMatricula: true,
                instituicao: {
                  select: {
                    nome: true,
                    logoUrl: true,
                    emailContato: true,
                    telefone: true,
                    endereco: true,
                    configuracao: {
                      select: {
                        nomeInstituicao: true,
                        logoUrl: true,
                        email: true,
                        telefone: true,
                        endereco: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        turma: {
          include: {
            turno: { select: { id: true, nome: true } },
            curso: {
              select: {
                id: true,
                nome: true,
                valorMensalidade: true,
                taxaMatricula: true,
              }
            },
            classe: {
              select: {
                id: true,
                nome: true,
                valorMensalidade: true,
                taxaMatricula: true,
              }
            },
            instituicao: {
              select: {
                nome: true,
                logoUrl: true,
                emailContato: true,
                telefone: true,
                endereco: true,
                configuracao: {
                  select: {
                    nomeInstituicao: true,
                    logoUrl: true,
                    email: true,
                    telefone: true,
                    endereco: true,
                  },
                },
              },
            },
          }
        },
        matriculaAnual: {
          select: {
            id: true,
            anoLetivo: true,
            classeOuAnoCurso: true,
            curso: {
              select: {
                id: true,
                nome: true,
              }
            },
            classe: {
              select: {
                id: true,
                nome: true,
              }
            }
          }
        }
      },
      orderBy: [
        { ano: 'desc' },
        { aluno: { nomeCompleto: 'asc' } }
      ]
    });

    // Backfill numeroIdentificacaoPublica para alunos sem Nº (recibos)
    const alunosSemNumero = new Set<string>();
    for (const ad of alunoDisciplinas) {
      const aluno = ad.aluno as { numeroIdentificacaoPublica?: string | null; instituicaoId?: string | null; id: string } | null;
      if (aluno && !aluno.numeroIdentificacaoPublica && !alunosSemNumero.has(aluno.id)) {
        alunosSemNumero.add(aluno.id);
        try {
          const num = await gerarNumeroIdentificacaoPublica('ALUNO', aluno.instituicaoId ?? instituicaoIdFilter ?? undefined);
          await prisma.user.update({
            where: { id: aluno.id },
            data: { numeroIdentificacaoPublica: num },
          });
          (ad.aluno as { numeroIdentificacaoPublica?: string }).numeroIdentificacaoPublica = num;
        } catch {
          // Ignorar falhas
        }
      }
    }

    // Retornar matrículas individuais (formato compatível com frontend)
    return alunoDisciplinas;
  }
}

