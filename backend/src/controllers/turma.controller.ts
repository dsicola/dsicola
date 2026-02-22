import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { messages } from '../utils/messages.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { validarAnoLetivoIdAtivo, validarAnoLetivoAtivo, buscarAnoLetivoAtivo, buscarTurmasProfessorComPlanoAtivo, buscarTurmasProfessorComPlanos, buscarTurmasEDisciplinasProfessorComPlanoAtivo } from '../services/validacaoAcademica.service.js';
import { resolveProfessorId } from '../utils/professorResolver.js';

export const getTurmas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const { cursoId, classeId, professorId: professorIdQuery, turnoId, ano, anoLetivoId } = req.query;
    
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B):
    // - Se o usuário for PROFESSOR, professorId SEMPRE vem do middleware (req.professor.id)
    // - ADMIN/SECRETARIA podem buscar turmas de qualquer professor via query (mas devem validar que é professores.id)
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    
    // Determinar professorId
    let professorId: string | undefined = undefined;
    if (isProfessor) {
      // REGRA ABSOLUTA: Professor só pode ver suas próprias turmas
      // Usar req.professor.id do middleware (já validado multi-tenant)
      if (!req.professor) {
        throw new AppError(messages.professor.naoIdentificado, 500);
      }
      professorId = req.professor.id; // professores.id
      
      // Se professor tentar especificar outro professorId no query, bloquear
      if (professorIdQuery && String(professorIdQuery) !== professorId) {
        throw new AppError('Acesso negado: você só pode visualizar suas próprias turmas', 403);
      }
      console.log(`[getTurmas] Usuário é PROFESSOR - usando professorId do middleware: ${professorId}`);
    } else if (professorIdQuery) {
      // ADMIN/SECRETARIA podem buscar turmas de qualquer professor
      // professorIdQuery pode ser professores.id OU users.id (resolver para professores.id)
      const professorIdQueryStr = professorIdQuery as string;
      let professor = await prisma.professor.findFirst({
        where: { id: professorIdQueryStr, instituicaoId },
        select: { id: true },
      });
      if (!professor) {
        professor = await prisma.professor.findFirst({
          where: { userId: professorIdQueryStr, instituicaoId },
          select: { id: true },
        });
      }
      if (!professor) {
        throw new AppError('Professor não encontrado ou não pertence à sua instituição.', 404);
      }
      professorId = professor.id; // professores.id
      console.log(`[getTurmas] Usuário é ${req.user?.roles?.join(', ')} - usando professorId do query: ${professorId}`);
    }

    // REGRA MESTRA SIGA/SIGAE: Se buscar turmas do professor
    if (professorId) {
      try {
        // Verificar se deve incluir planos pendentes (parâmetro opcional)
        const incluirPendentes = req.query.incluirPendentes === 'true' || req.query.incluirPendentes === '1';
        
        console.log(`[getTurmas] Buscando turmas para professor ${professorId}, incluirPendentes: ${incluirPendentes}, anoLetivoId: ${anoLetivoId}`);
        console.log(`[getTurmas] instituicaoId do token: ${instituicaoId}`);
        console.log(`[getTurmas] req.user:`, { userId: req.user?.userId, instituicaoId: req.user?.instituicaoId, roles: req.user?.roles });
        
        let turmasComPlano;
        
        if (incluirPendentes) {
          // Buscar TODAS as turmas do professor (incluindo planos pendentes)
          // REGRA ABSOLUTA: Se anoLetivoId não for fornecido, a função buscarTurmasProfessorComPlanos
          // buscará automaticamente o ano letivo ATIVO da instituição
          // IMPORTANTE: Passar anoLetivoId como string | undefined | null para permitir busca automática
          const anoLetivoIdParam = anoLetivoId ? (anoLetivoId as string) : undefined;
          
          console.log(`[getTurmas] Chamando buscarTurmasProfessorComPlanos com:`, {
            instituicaoId,
            professorId: professorId as string,
            anoLetivoId: anoLetivoIdParam || 'N/A (será buscado automaticamente)'
          });
          
          turmasComPlano = await buscarTurmasProfessorComPlanos(
            instituicaoId,
            professorId as string,
            anoLetivoIdParam
          );
          
          console.log(`[getTurmas] buscarTurmasProfessorComPlanos retornou ${turmasComPlano.length} turmas`);
          if (turmasComPlano.length > 0) {
            console.log(`[getTurmas] Primeira turma retornada:`, {
              id: turmasComPlano[0].id,
              nome: turmasComPlano[0].nome,
              disciplinaNome: turmasComPlano[0].disciplinaNome,
              temTurma: !!turmasComPlano[0].turma,
              planoEstado: turmasComPlano[0].planoEstado
            });
          }
          
          // Converter para o formato padronizado esperado pelo frontend
          // FORMATO PADRÃO: { id, disciplina, curso, turma, statusPlano, podeLancarAula, podeMarcarPresenca, podeLancarNota, motivoBloqueio? }
          // REGRAS SIGAE:
          // - Plano SEM turma: aparece no painel, TODAS ações bloqueadas
          // - Plano COM turma:
          //   - se ATIVO → ações liberadas
          //   - se RASCUNHO → ações bloqueadas
          //   - se BLOQUEADO → ações bloqueadas
          const turmas = turmasComPlano.map((item) => {
            const planoAtivo = item.planoEstado === 'APROVADO' && !item.planoBloqueado;
            const temTurma = !!item.turma;
            
            // Determinar se pode executar ações acadêmicas
            // REGRA SIGAE: Só pode executar ações se houver turma E plano ATIVO
            const podeLancarAula = temTurma && planoAtivo;
            const podeMarcarPresenca = temTurma && planoAtivo;
            const podeLancarNota = temTurma && planoAtivo;
            
            // Determinar motivo de bloqueio (se houver)
            let motivoBloqueio: string | undefined = undefined;
            if (!temTurma) {
              motivoBloqueio = 'Disciplina atribuída, aguardando vinculação a turma';
            } else if (item.planoEstado === 'RASCUNHO') {
              motivoBloqueio = 'Plano de Ensino em rascunho - aguardando aprovação';
            } else if (item.planoEstado === 'EM_REVISAO') {
              motivoBloqueio = 'Plano de Ensino em revisão pela coordenação';
            } else if (item.planoEstado === 'ENCERRADO') {
              motivoBloqueio = 'Plano de Ensino encerrado - apenas visualização';
            } else if (item.planoBloqueado) {
              motivoBloqueio = 'Plano de Ensino bloqueado - contacte a coordenação';
            }
            
            // Se não há turma vinculada, retornar apenas informações da disciplina
            if (!item.turma) {
              return {
                id: item.id, // ID virtual baseado no plano
                nome: item.nome, // Nome descritivo da disciplina
                codigo: item.codigo,
                disciplina: {
                  id: item.disciplinaId,
                  nome: item.disciplinaNome,
                },
                curso: item.curso || null, // Curso do plano (pode existir mesmo sem turma)
                disciplinaId: item.disciplinaId,
                disciplinaNome: item.disciplinaNome,
                planoEnsinoId: item.planoEnsinoId,
                planoEstado: item.planoEstado,
                planoBloqueado: item.planoBloqueado,
                planoAtivo: planoAtivo,
                statusPlano: item.planoEstado,
                podeLancarAula: podeLancarAula,
                podeMarcarPresenca: podeMarcarPresenca,
                podeLancarNota: podeLancarNota,
                motivoBloqueio: motivoBloqueio,
                semTurma: true,
                turma: null,
                turmaId: null,
              };
            }
            
            // Se há turma vinculada, retornar informações completas
            // IMPORTANTE: Incluir todos os campos da turma (turno, sala, horario, etc.)
            return {
              ...item.turma,
              disciplina: {
                id: item.disciplinaId,
                nome: item.disciplinaNome,
              },
              curso: item.curso || item.turma?.curso || null, // Priorizar curso do plano, depois curso da turma
              disciplinaId: item.disciplinaId,
              disciplinaNome: item.disciplinaNome,
              planoEnsinoId: item.planoEnsinoId,
              planoEstado: item.planoEstado,
              planoBloqueado: item.planoBloqueado,
              planoAtivo: planoAtivo,
              statusPlano: item.planoEstado,
              podeLancarAula: podeLancarAula,
              podeMarcarPresenca: podeMarcarPresenca,
              podeLancarNota: podeLancarNota,
              motivoBloqueio: motivoBloqueio,
              semTurma: false,
              turma: {
                id: item.turma.id,
                nome: item.turma.nome,
              },
              turmaId: item.turma.id,
            };
          });

          console.log(`[getTurmas] Found ${turmas.length} turmas (including pending) for professor ${professorId}`);
          
          // Log detalhado das turmas retornadas para diagnóstico
          if (turmas.length > 0) {
            console.log(`[getTurmas] Detalhes das turmas retornadas:`, turmas.map((t: any) => ({
              id: t.id,
              nome: t.nome,
              semTurma: t.semTurma,
              planoEstado: t.planoEstado,
              planoAtivo: t.planoAtivo,
              disciplinaNome: t.disciplinaNome || t.disciplina?.nome,
              turmaId: t.turmaId,
              temTurma: !!t.turma
            })));
          } else {
            console.warn(`[getTurmas] ⚠️ NENHUMA TURMA RETORNADA para professor ${professorId} - verificar se há planos de ensino no banco`);
          }
          
          // Garantir que sempre retornamos um array
          return res.json(Array.isArray(turmas) ? turmas : []);
        } else {
          // Buscar turmas e disciplinas sem turma com Plano de Ensino ATIVO (comportamento padrão)
          // IMPORTANTE: Retornar tanto turmas quanto disciplinas sem turma, mas apenas com planos ATIVOS
          turmasComPlano = await buscarTurmasEDisciplinasProfessorComPlanoAtivo(
            instituicaoId,
            professorId as string,
            anoLetivoId as string | undefined
          );

          console.log(`[getTurmas] buscarTurmasEDisciplinasProfessorComPlanoAtivo retornou ${turmasComPlano.length} entradas`);

          // Converter para o formato padronizado esperado pelo frontend
          // FORMATO PADRÃO: { id, disciplina, curso, turma, statusPlano, podeLancarAula, podeMarcarPresenca, podeLancarNota, motivoBloqueio? }
          // REGRAS SIGAE:
          // - Plano SEM turma: aparece no painel, TODAS ações bloqueadas
          // - Plano COM turma:
          //   - se ATIVO → ações liberadas
          //   - se RASCUNHO → ações bloqueadas
          //   - se BLOQUEADO → ações bloqueadas
          const turmas = turmasComPlano.map((item) => {
            const planoAtivo = item.planoEstado === 'APROVADO' && !item.planoBloqueado;
            const temTurma = !!item.turma;
            
            // Determinar se pode executar ações acadêmicas
            // REGRA SIGAE: Só pode executar ações se houver turma E plano ATIVO
            const podeLancarAula = temTurma && planoAtivo;
            const podeMarcarPresenca = temTurma && planoAtivo;
            const podeLancarNota = temTurma && planoAtivo;
            
            // Determinar motivo de bloqueio (se houver)
            let motivoBloqueio: string | undefined = undefined;
            if (!temTurma) {
              motivoBloqueio = 'Disciplina atribuída, aguardando vinculação a turma';
            } else if (item.planoEstado === 'RASCUNHO') {
              motivoBloqueio = 'Plano de Ensino em rascunho - aguardando aprovação';
            } else if (item.planoEstado === 'EM_REVISAO') {
              motivoBloqueio = 'Plano de Ensino em revisão pela coordenação';
            } else if (item.planoEstado === 'ENCERRADO') {
              motivoBloqueio = 'Plano de Ensino encerrado - apenas visualização';
            } else if (item.planoBloqueado) {
              motivoBloqueio = 'Plano de Ensino bloqueado - contacte a coordenação';
            }
            
            // Se não há turma vinculada, retornar apenas informações da disciplina
            if (!item.turma) {
              return {
                id: item.id,
                nome: item.nome,
                codigo: item.codigo,
                disciplina: {
                  id: item.disciplinaId,
                  nome: item.disciplinaNome,
                },
                curso: null,
                disciplinaId: item.disciplinaId,
                disciplinaNome: item.disciplinaNome,
                planoEnsinoId: item.planoEnsinoId,
                planoEstado: item.planoEstado,
                planoBloqueado: item.planoBloqueado,
                planoAtivo: planoAtivo,
                statusPlano: item.planoEstado,
                podeLancarAula: podeLancarAula,
                podeMarcarPresenca: podeMarcarPresenca,
                podeLancarNota: podeLancarNota,
                motivoBloqueio: motivoBloqueio,
                semTurma: true,
                turma: null,
                turmaId: null,
              };
            }
            
            // Se há turma vinculada, retornar informações completas
            return {
              ...item.turma,
              disciplina: {
                id: item.disciplinaId,
                nome: item.disciplinaNome,
              },
              curso: item.curso || item.turma?.curso || null, // Priorizar curso do plano, depois curso da turma
              disciplinaId: item.disciplinaId,
              disciplinaNome: item.disciplinaNome,
              planoEnsinoId: item.planoEnsinoId,
              planoEstado: item.planoEstado,
              planoBloqueado: item.planoBloqueado,
              planoAtivo: planoAtivo,
              statusPlano: item.planoEstado,
              podeLancarAula: podeLancarAula,
              podeMarcarPresenca: podeMarcarPresenca,
              podeLancarNota: podeLancarNota,
              motivoBloqueio: motivoBloqueio,
              semTurma: false,
              turma: {
                id: item.turma.id,
                nome: item.turma.nome,
              },
              turmaId: item.turma.id,
            };
          });

          console.log(`[getTurmas] Found ${turmas.length} entradas (turmas + disciplinas sem turma) with active Plano de Ensino for professor ${professorId}`);
          
          // Garantir que sempre retornamos um array
          return res.json(Array.isArray(turmas) ? turmas : []);
        }
      } catch (error: any) {
        // Log detalhado do erro
        console.error(`[getTurmas] Erro ao buscar turmas para professor ${professorId}:`, {
          message: error?.message,
          statusCode: error?.statusCode,
          stack: error?.stack,
          name: error?.name
        });
        
        // IMPORTANTE: Não retornar erro 500 - sempre retornar array vazio para não quebrar o frontend
        // O frontend já trata array vazio como "sem turmas atribuídas"
        // Se não houver turmas, retornar array vazio (não é erro)
        if (error.statusCode === 403 || error.message?.includes('Plano de Ensino')) {
          console.log(`[getTurmas] No turmas found for professor ${professorId} (403 or Plano de Ensino error) - retornando array vazio`);
          return res.json([]);
        }
        
        // Para outros erros, também retornar array vazio para não quebrar o frontend
        // Mas logar o erro para debug
        console.error(`[getTurmas] Erro inesperado, retornando array vazio para não quebrar o frontend:`, error);
        return res.json([]);
      }
    }

    // Debug log
    console.log('[getTurmas] Request:', {
      userInstituicaoId: req.user?.instituicaoId,
      filter,
      cursoId,
      classeId,
      professorId,
    });

    const where: any = { ...filter };
    if (turnoId) where.turnoId = turnoId as string;
    if (ano) where.ano = parseInt(ano as string);

    // Get institution's tipoAcademico to filter turmas
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // CRITICAL: Aplicar filtros baseados em tipoAcademico APENAS se tipoAcademico estiver definido
    // Se tipoAcademico for null/undefined, não aplicar filtros restritivos (permitir dados legados)
    if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: filtrar turmas vinculadas a CLASSE (obrigatório)
      // IMPORTANTE: Aplicar apenas se não houver filtros específicos de query
      if (!cursoId && !classeId) {
        where.classeId = { not: null };
      }
      
      // Se classeId fornecido, filtrar por essa classe
      if (classeId) {
        where.classeId = classeId as string;
      }
      // Se cursoId fornecido, também filtrar por esse curso (área)
      if (cursoId) {
        where.cursoId = cursoId as string;
      }
    } else if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: filtrar apenas turmas vinculadas a CURSO
      // IMPORTANTE: Aplicar apenas se não houver filtros específicos de query
      if (!cursoId && !classeId) {
        where.cursoId = { not: null };
        where.classeId = null; // Garantir que não há classeId
      }
      
      // Se cursoId fornecido, filtrar por esse curso
      if (cursoId) {
        where.cursoId = cursoId as string;
        where.classeId = null; // Garantir que não há classeId mesmo com filtro
      }
      // Se classeId fornecido em Ensino Superior, ignorar (não deve existir)
      if (classeId) {
        console.warn('[getTurmas] ClasseId fornecido para Ensino Superior - ignorando');
      }
    }
    // Se tipoAcademico é null, não aplicar filtros restritivos (backwards compatibility)
    // Aplicar apenas filtros de query se fornecidos
    else {
      if (cursoId) {
        where.cursoId = cursoId as string;
      }
      if (classeId) {
        where.classeId = classeId as string;
      }
    }

    console.log('[getTurmas] Where clause:', JSON.stringify(where, null, 2));

    const turmasRaw = await prisma.turma.findMany({
      where,
      include: {
        curso: { select: { id: true, nome: true, codigo: true, valorMensalidade: true } },
        classe: { select: { id: true, nome: true, codigo: true, valorMensalidade: true } },
        turno: { select: { id: true, nome: true } },
        disciplina: { select: { id: true, nome: true } },
        _count: { select: { matriculas: true } },
        // REGRA SIGAE: Professor vem EXCLUSIVAMENTE de PlanoEnsino (única fonte de verdade)
        planosEnsino: {
          take: 1,
          include: {
            professor: {
              include: {
                user: { select: { nomeCompleto: true } },
              },
            },
          },
        },
      },
      orderBy: { nome: 'asc' }
    });

    // Mapear professor do primeiro PlanoEnsino para compatibilidade com UI (TurmasTab)
    const turmas = turmasRaw.map((t) => {
      const primeiroPlano = t.planosEnsino?.[0];
      const professor = primeiroPlano?.professor;
      const { planosEnsino, ...rest } = t;
      return {
        ...rest,
        professor: professor ? {
          id: professor.id,
          nome_completo: professor.user?.nomeCompleto || 'N/A',
          nomeCompleto: professor.user?.nomeCompleto || 'N/A',
        } : null,
      };
    });

    console.log(`[getTurmas] Found ${turmas.length} turmas`);
    if (turmas.length > 0) {
      console.log('[getTurmas] Turmas IDs:', turmas.map(t => t.id).join(', '));
    } else {
      console.warn('[getTurmas] ⚠️  NENHUMA TURMA RETORNADA!');
    }

    res.json(turmas);
  } catch (error) {
    next(error);
  }
};

export const getTurmaById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const turma = await prisma.turma.findFirst({
      where: { id, ...filter },
      include: {
        curso: true,
        classe: true,
        turno: true,
        disciplina: true,
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          }
        },
        matriculas: {
          include: {
            aluno: { select: { id: true, nomeCompleto: true, email: true } }
          }
        }
      }
    });

    if (!turma) {
      throw new AppError('Turma não encontrada', 404);
    }

    res.json(turma);
  } catch (error) {
    next(error);
  }
};

export const createTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Multi-tenant: SEMPRE usar instituicaoId do usuário autenticado
    const instituicaoId = requireTenantScope(req);

    const { nome, cursoId, classeId, turnoId, ano, anoLetivoId, semestre, classe, sala, capacidade, professorId, disciplinaId } = req.body;

    // Validar campos obrigatórios
    if (!nome) {
      throw new AppError('Nome é obrigatório', 400);
    }

    // REGRA: Turma NÃO aceita professorId diretamente - professor é vinculado via Plano de Ensino
    if (professorId) {
      throw new AppError('Campo "professorId" não é permitido na criação de Turma. O professor deve ser vinculado através de um Plano de Ensino.', 400);
    }

    // REGRA: Turma NÃO aceita disciplinaId diretamente - disciplina é vinculada via Plano de Ensino
    if (disciplinaId) {
      throw new AppError('Campo "disciplinaId" não é permitido na criação de Turma. A disciplina deve ser vinculada através de um Plano de Ensino.', 400);
    }

    // REGRA: Ano Letivo é OBRIGATÓRIO para Turma (NÍVEL 3)
    if (!anoLetivoId) {
      throw new AppError('Ano Letivo é obrigatório para criar Turma. Selecione um Ano Letivo válido.', 400);
    }

    // Validar que o Ano Letivo existe e pertence à instituição
    const anoLetivoRecord = await prisma.anoLetivo.findFirst({
      where: { id: anoLetivoId, instituicaoId },
    });

    if (!anoLetivoRecord) {
      throw new AppError('Ano letivo não encontrado ou não pertence à sua instituição', 404);
    }

    const anoLetivoFinal = anoLetivoRecord.ano;

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // CRITICAL: Ensino Secundário usa CURSO (área/opção) + CLASSE (ano)
    // Ensino Superior usa apenas CURSO
    if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: classeId é obrigatório (representa o ano)
      // cursoId é opcional mas recomendado (representa a área/opção de estudo)
      if (!classeId) {
        throw new AppError('Classe é obrigatória no Ensino Secundário', 400);
      }
      // Nota: campo "classe" (string) não é armazenado - apenas classeId (FK)
      if (semestre) {
        throw new AppError('Campo "Semestre" não é válido para Ensino Secundário. Use "Classe".', 400);
      }
      // No Ensino Secundário, pode ter AMBOS: Curso (área) + Classe (ano)
    } else if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: cursoId é obrigatório, classeId deve ser null
      if (!cursoId) {
        throw new AppError('Curso é obrigatório no Ensino Superior', 400);
      }
      if (classeId) {
        throw new AppError('Turmas do Ensino Superior não podem estar vinculadas a Classe. Use apenas Curso.', 400);
      }
    } else {
      // Backwards compatibility: se tipoAcademico é null, requerer pelo menos um
      if (!cursoId && !classeId) {
        throw new AppError('Curso ou Classe é obrigatório', 400);
      }
    }

    // Preparar dados apenas com campos definidos (sem undefined)
    // REGRA: Turma NÃO inclui professorId ou disciplinaId - esses vínculos são feitos via Plano de Ensino
    const turmaData: any = {
      nome: nome.trim(),
      instituicaoId,
      capacidade: capacidade ? Number(capacidade) : 40,
      ano: anoLetivoFinal, // Ano numérico (compatibilidade)
      anoLetivoId, // OBRIGATÓRIO: FK para AnoLetivo
      // professorId e disciplinaId NÃO são incluídos - vinculados via Plano de Ensino
    };

    // Vincular a Curso e/ou Classe conforme o tipo acadêmico
    if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: pode ter AMBOS - Curso (área) + Classe (ano)
      turmaData.classeId = classeId;
      // Nota: classe (string) não existe no schema - apenas classeId (FK)
      turmaData.semestre = null; // Garantir que semestre é null para Secundário
      if (cursoId) {
        turmaData.cursoId = cursoId; // Curso de estudo (área/opção)
      }
    } else if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: apenas Curso
      turmaData.cursoId = cursoId;
      turmaData.classeId = null;
      // Semestre é obrigatório para Ensino Superior - validar se existe no banco
      if (!semestre) {
        throw new AppError('Semestre é obrigatório para Ensino Superior. Selecione um semestre cadastrado antes de continuar.', 400);
      }
      
      // VALIDAÇÃO CRÍTICA: Verificar se semestre existe na tabela Semestres vinculado ao ano letivo
      const semestreExiste = await prisma.semestre.findFirst({
        where: {
          anoLetivoId: anoLetivoRecord.id,
          numero: Number(semestre),
          instituicaoId,
        },
      });
      
      if (!semestreExiste) {
        // Verificar se há semestres cadastrados para este ano letivo (para mensagem de erro mais útil)
        const semestresAnoLetivo = await prisma.semestre.findMany({
          where: {
            anoLetivoId: anoLetivoRecord.id,
            instituicaoId,
          },
          select: { numero: true },
        });
        
        if (semestresAnoLetivo.length === 0) {
          throw new AppError(`Semestre é obrigatório para Ensino Superior. Não há semestres configurados para o ano letivo ${anoLetivoFinal}. Acesse Configuração de Ensino → Semestres para criar um semestre antes de continuar.`, 400);
        } else {
          throw new AppError(`Semestre ${semestre} não encontrado para o ano letivo ${anoLetivoFinal}. Semestres disponíveis: ${semestresAnoLetivo.map(s => s.numero).join(', ')}. Acesse Configuração de Ensino → Semestres para criar o semestre necessário.`, 400);
        }
      }
      
      turmaData.semestre = semestre;
    } else {
      // Backwards compatibility
      if (cursoId) {
        turmaData.cursoId = cursoId;
        if (!classeId) {
          turmaData.classeId = null;
        }
      }
      if (classeId) {
        turmaData.classeId = classeId;
        if (!cursoId) {
          turmaData.cursoId = null;
        }
      }
    }

    // Adicionar campos opcionais apenas se definidos
    if (turnoId !== undefined && turnoId !== null && turnoId !== '') {
      turmaData.turnoId = turnoId;
    }
    // disciplinaId NÃO é permitido - vinculado via Plano de Ensino
    // Semestre já foi processado acima para Ensino Superior
    // Para backwards compatibility, processar apenas se não foi processado acima
    if (tipoAcademico !== 'SUPERIOR' && tipoAcademico !== 'SECUNDARIO') {
      if (semestre !== undefined && semestre !== null && semestre !== '') {
        turmaData.semestre = semestre;
      }
    }
    if (sala !== undefined && sala !== null && sala !== '') {
      turmaData.sala = sala;
    }

    const turma = await prisma.turma.create({
      data: turmaData,
      include: {
        curso: true,
        classe: true,
        turno: true,
        disciplina: true,
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
            dataInicio: true,
            dataFim: true,
          },
        },
      }
    });

    res.status(201).json(turma);

    // Fire-and-forget: notificação administrativa (não bloqueia resposta)
    setImmediate(() => {
      import('../services/notificacao.service.js')
        .then(({ NotificacaoService }) => NotificacaoService.notificarTurmaCriada(req, turma.nome, instituicaoId))
        .catch((err: any) => console.error('[createTurma] Erro ao criar notificação (não crítico):', err?.message));
    });
  } catch (error) {
    next(error);
  }
};

export const updateTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const { nome, cursoId, classeId, professorId, turnoId, disciplinaId, ano, anoLetivoId, semestre, classe, sala, capacidade } = req.body;

    const existing = await prisma.turma.findFirst({
      where: { id, ...filter },
      include: {
        curso: true,
        classe: true,
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          },
        },
      }
    });

    if (!existing) {
      throw new AppError('Turma não encontrada', 404);
    }

    // Verificar tipo acadêmico da instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    // Preparar dados apenas com campos definidos (sem undefined)
    const updateData: any = {};

    if (nome !== undefined) updateData.nome = nome.trim();
    // REGRA: Turma NÃO aceita professorId em update - professor é vinculado via Plano de Ensino
    if (professorId !== undefined) {
      throw new AppError('Campo "professorId" não é permitido na atualização de Turma. O professor deve ser vinculado através de um Plano de Ensino.', 400);
    }
    if (turnoId !== undefined) updateData.turnoId = turnoId || null;
    // REGRA: Turma NÃO aceita disciplinaId em update - disciplina é vinculada via Plano de Ensino
    if (disciplinaId !== undefined) {
      throw new AppError('Campo "disciplinaId" não é permitido na atualização de Turma. A disciplina deve ser vinculada através de um Plano de Ensino.', 400);
    }
    if (semestre !== undefined) updateData.semestre = semestre || null;
    if (sala !== undefined) updateData.sala = sala || null;
    if (capacidade !== undefined) updateData.capacidade = Number(capacidade);

    // REGRA: Ano Letivo é OBRIGATÓRIO para Turma (NÍVEL 3)
    // Se fornecido, validar; se não fornecido, manter o existente
    if (anoLetivoId !== undefined) {
      if (anoLetivoId === null || anoLetivoId === '') {
        throw new AppError('Ano Letivo é obrigatório para Turma. Não é possível remover.', 400);
      }
      // Validar que o ano letivo existe e pertence à instituição
      const anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: { id: anoLetivoId, instituicaoId },
      });
      if (!anoLetivoRecord) {
        throw new AppError('Ano letivo não encontrado ou não pertence à sua instituição', 404);
      }
      updateData.ano = anoLetivoRecord.ano;
      updateData.anoLetivoId = anoLetivoId;
    } else if (ano !== undefined) {
      // Se recebeu apenas o número do ano, buscar o registro
      const anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: { instituicaoId, ano: Number(ano) },
      });
      if (!anoLetivoRecord) {
        throw new AppError('Ano letivo não encontrado para este ano', 404);
      }
      updateData.ano = Number(ano);
      updateData.anoLetivoId = anoLetivoRecord.id;
    }
    // Se não fornecido, manter o existente (não alterar)

    // CRITICAL: Validar e atualizar vínculo Curso/Classe conforme tipo acadêmico
    if (cursoId !== undefined || classeId !== undefined) {
      if (tipoAcademico === 'SECUNDARIO') {
        // Ensino Secundário: classeId é obrigatório (ano), cursoId é opcional (área/opção)
        if (classeId === undefined && !existing.classeId) {
          throw new AppError('Classe é obrigatória no Ensino Secundário', 400);
        }
        if (classeId !== undefined) {
          updateData.classeId = classeId;
        }
        // Nota: campo "classe" (string) não é armazenado - apenas classeId (FK)
        // Se não foi fornecido, manter o existente (não validar se já existe)
        // No Ensino Secundário, pode ter AMBOS: Curso (área) + Classe (ano)
        if (cursoId !== undefined) {
          updateData.cursoId = cursoId; // Curso de estudo (área/opção)
        }
        // Garantir que semestre é null para Secundário
        if (semestre !== undefined && semestre !== null) {
          throw new AppError('Campo "Semestre" não é válido para Ensino Secundário. Use "Classe".', 400);
        }
        updateData.semestre = null;
      } else if (tipoAcademico === 'SUPERIOR') {
        // Ensino Superior: cursoId é obrigatório, classeId deve ser null
        if (cursoId === undefined && !existing.cursoId) {
          throw new AppError('Curso é obrigatório no Ensino Superior', 400);
        }
        if (cursoId !== undefined) {
          updateData.cursoId = cursoId;
          updateData.classeId = null;
        }
        if (classeId !== undefined && classeId !== null) {
          throw new AppError('Turmas do Ensino Superior não podem estar vinculadas a Classe. Use apenas Curso.', 400);
        }
        // Nota: campo "classe" (string) não existe no schema - apenas classeId (FK)
        // Semestre é obrigatório para Ensino Superior
        if (semestre !== undefined) {
          if (!semestre || (semestre !== 1 && semestre !== 2)) {
            throw new AppError('Semestre é obrigatório para Ensino Superior e deve ser 1 ou 2.', 400);
          }
          updateData.semestre = semestre;
        }
        // Se não foi fornecido, manter o existente (não validar se já existe)
      } else {
        // Backwards compatibility
        if (cursoId !== undefined) {
          updateData.cursoId = cursoId;
          if (classeId === undefined) updateData.classeId = null;
        }
        if (classeId !== undefined) {
          updateData.classeId = classeId;
          if (cursoId === undefined) updateData.cursoId = null;
        }
      }
    }

    // NUNCA permitir alterar instituicaoId (multi-tenant)
    if (req.body.instituicaoId !== undefined) {
      throw new AppError('Não é permitido alterar a instituição da turma', 400);
    }

    const turma = await prisma.turma.update({
      where: { id },
      data: updateData,
      include: {
        curso: true,
        classe: true,
        turno: true,
        disciplina: true,
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
            dataInicio: true,
            dataFim: true,
          },
        },
      }
    });

    res.json(turma);
  } catch (error) {
    next(error);
  }
};

export const deleteTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const filter = addInstitutionFilter(req);

    const existing = await prisma.turma.findFirst({
      where: { id, ...filter }
    });

    if (!existing) {
      throw new AppError('Turma não encontrada', 404);
    }

    // Check if has dependencies (matriculas)
    const matriculasCount = await prisma.matricula.count({
      where: { turmaId: id }
    });

    if (matriculasCount > 0) {
      throw new AppError('Não é possível excluir turma com matrículas vinculadas', 400);
    }

    // Check if has aulas
    const aulasCount = await prisma.aula.count({
      where: { turmaId: id }
    });

    if (aulasCount > 0) {
      throw new AppError('Não é possível excluir turma com aulas vinculadas', 400);
    }

    await prisma.turma.delete({ where: { id } });

    res.json({ message: 'Turma excluída com sucesso' });
  } catch (error) {
    next(error);
  }
};

export const getTurmasByProfessor = async (req: Request, res: Response, next: NextFunction) => {
  // REGRA ABSOLUTA: Esta rota NUNCA deve retornar 400
  // Todos os estados válidos (sem turmas, sem plano, sem ano letivo) devem retornar 200 com arrays vazios
  try {
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Usar req.professor.id do middleware
    // O middleware resolveProfessorMiddleware já validou e anexou req.professor
    if (!req.professor) {
      throw new AppError(messages.professor.naoIdentificado, 500);
    }

    const professorId = req.professor.id; // professores.id (NÃO users.id)
    const instituicaoId = req.professor.instituicaoId;
    const tipoAcademico = req.user?.tipoAcademico;

    // REGRA SIGAE HARDENING: Validar professorId na query - professor só pode ver suas próprias turmas
    const professorIdQuery = req.query.professorId as string | undefined;
    if (professorIdQuery && String(professorIdQuery).trim() !== '' && String(professorIdQuery) !== professorId) {
      throw new AppError('Acesso negado: você só pode visualizar suas próprias turmas', 403);
    }
    
    // REGRA ABSOLUTA: Parâmetros opcionais da query (NUNCA IDs sensíveis)
    // IMPORTANTE: Não validar se anoLetivoId existe - é apenas um filtro opcional
    const { anoLetivoId, incluirPendentes } = req.query;

    // REGRA: incluirPendentes é sempre true - buscar TODOS os planos (qualquer estado)
    // O estado controla apenas ações, não visibilidade
    // Parâmetro mantido para compatibilidade, mas sempre tratado como true
    const incluirPendentesFlag = true; // Sempre incluir todos os planos, independente do estado

    // REGRA P0: Professor vê TODOS os seus planos - NÃO filtrar por ano letivo
    // Estado bloqueia ações, não visibilidade. Ano letivo não deve ocultar planos.
    // Buscar ano letivo ativo APENAS para exibição no header (anoLetivo.ano), não para filtrar
    let anoLetivoIdFinal: string | undefined = undefined; // NUNCA filtrar - professor vê todos os planos
    let anoLetivoAtivo = null;
    
    try {
      // Buscar ano letivo ativo APENAS para retornar na resposta (exibição)
      anoLetivoAtivo = await buscarAnoLetivoAtivo(instituicaoId);
      if (anoLetivoAtivo) {
        console.log(`[getTurmasByProfessor] Ano letivo ativo para exibição: ${anoLetivoAtivo.ano} (id: ${anoLetivoAtivo.id})`);
      }
      // anoLetivoIdFinal permanece undefined - não filtrar por ano letivo
    } catch (error) {
      console.warn(`[getTurmasByProfessor] Erro ao buscar ano letivo ativo (continuando sem filtro):`, error);
    }

    // Debug log
    console.log('[getTurmasByProfessor] 📋 Request:', {
      userId: req.user?.userId,
      professorId,
      instituicaoId,
      tipoAcademico,
      anoLetivoId: anoLetivoIdFinal || 'N/A',
      anoLetivo: anoLetivoAtivo?.ano || 'N/A',
      incluirPendentes: incluirPendentesFlag,
      userRoles: req.user?.roles,
      email: req.user?.email,
    });

    try {
      let turmasComPlano: Awaited<ReturnType<typeof buscarTurmasEDisciplinasProfessorComPlanoAtivo>> = [];
      
      try {
        // REGRA ABSOLUTA: Plano de Ensino é a FONTE DA VERDADE
        // O professor DEVE ver TODAS as atribuições configuradas no Plano de Ensino,
        // independentemente do estado (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO).
        // O estado controla apenas as ações (podeRegistrarAula, podeLancarNota), não a visibilidade.
        // 
        // CORREÇÃO CRÍTICA: Usar sempre buscarTurmasEDisciplinasProfessorComPlanoAtivo
        // que busca TODOS os planos (qualquer estado) e retorna tanto turmas quanto disciplinas sem turma.
        // A função agora busca a partir de PlanoEnsino (fonte da verdade), não de Turma.
        
        // CORREÇÃO: Normalizar valores antes de passar para a função
        // Garantir que professorId e instituicaoId sejam strings sem espaços
        // IMPORTANTE: professorId agora é professores.id (não users.id)
        const professorIdFinal = String(professorId).trim();
        const instituicaoIdNormalizado = String(instituicaoId).trim();
        
        console.log(`[getTurmasByProfessor] 🔍 Chamando buscarTurmasEDisciplinasProfessorComPlanoAtivo com:`, {
          instituicaoId: instituicaoIdNormalizado,
          professorId: professorIdFinal, // Agora é professores.id
          anoLetivoId: anoLetivoIdFinal || 'N/A (será buscado automaticamente)',
          tipoAcademico: tipoAcademico || 'N/A'
        });
        
        // REGRA ABSOLUTA: Usar buscarTurmasEDisciplinasProfessorComPlanoAtivo
        // que busca TODOS os planos (qualquer estado) a partir de PlanoEnsino
        // O estado controla apenas ações, não visibilidade
        // IMPORTANTE: Passar professores.id (não users.id)
        // FALLBACK: Passar userId para recuperar planos criados com users.id em vez de professors.id (legacy)
        turmasComPlano = await buscarTurmasEDisciplinasProfessorComPlanoAtivo(
          instituicaoIdNormalizado,
          professorIdFinal, // Agora é professores.id
          anoLetivoIdFinal,
          req.professor.userId // Fallback para planos com professorId=users.id
        );
        
        console.log(`[getTurmasByProfessor] ✅ buscarTurmasEDisciplinasProfessorComPlanoAtivo retornou ${turmasComPlano.length} itens (turmas + disciplinas sem turma)`);
      } catch (error: any) {
        // REGRA ABSOLUTA: Erro ao buscar turmas NÃO é erro crítico - retornar array vazio
        // Nunca lançar erro 400 - sempre retornar 200 com array vazio
        console.warn(`[getTurmasByProfessor] Erro ao buscar turmas (retornando array vazio):`, error?.message || error);
        console.warn(`[getTurmasByProfessor] Stack trace:`, error?.stack);
        turmasComPlano = [];
      }

      // REGRA ABSOLUTA: Ausência de turmas NÃO é erro - retornar array vazio
      // Converter para o formato esperado pelo frontend
      // IMPORTANTE: Separar turmas (com vínculo) de disciplinas sem turma
      const turmas: any[] = [];
      const disciplinasSemTurma: any[] = [];
      
      // REGRA ABSOLUTA: Separar visibilidade de ação
      // Calcular flags de bloqueio no backend para cada plano
      // O estado controla apenas ações, não visibilidade
      for (const item of turmasComPlano) {
        // Verificar se turma existe e tem id válido
        const temTurma = !!(item.turma && item.turma.id && typeof item.turma.id === 'string');
        const planoEstado = item.planoEstado || 'APROVADO';
        const planoBloqueado = item.planoBloqueado || false;
        
        // REGRA SIGA/SIGAE: Plano ativo = APROVADO e não bloqueado
        const planoAtivo = planoEstado === 'APROVADO' && !planoBloqueado;
        
        // Calcular flags de ação (estado controla ações, não visibilidade)
        const podeRegistrarAula = planoAtivo && temTurma;
        const podeLancarNota = planoAtivo && temTurma;
        
        // Calcular motivo de bloqueio (string clara para o frontend)
        let motivoBloqueio: string | null = null;
        if (planoBloqueado) {
          motivoBloqueio = 'Plano de Ensino bloqueado';
        } else if (planoEstado === 'RASCUNHO') {
          motivoBloqueio = 'Plano de Ensino em RASCUNHO - aguardando aprovação';
        } else if (planoEstado === 'EM_REVISAO') {
          motivoBloqueio = 'Plano de Ensino em REVISÃO - aguardando aprovação';
        } else if (planoEstado === 'ENCERRADO') {
          motivoBloqueio = 'Plano de Ensino ENCERRADO';
        } else if (!temTurma) {
          motivoBloqueio = 'Aguardando alocação de turma';
        }
        
        if (temTurma) {
          // Plano COM turma → adicionar em turmas[]
          const curso = item.curso || item.turma?.curso || null;
          turmas.push({
            ...item.turma,
            disciplina: {
              id: item.disciplinaId,
              nome: item.disciplinaNome,
            },
            planoEnsinoId: item.planoEnsinoId,
            planoEstado,
            planoBloqueado,
            planoAtivo,
            semTurma: false,
            turmaId: item.turma.id,
            disciplinaNome: item.disciplinaNome,
            disciplinaId: item.disciplinaId,
            cursoId: curso?.id ?? null,
            semestre: item.turma?.semestre ?? null,
            estadoPlano: planoEstado,
            bloqueado: planoBloqueado,
            podeRegistrarAula,
            podeLancarAula: podeRegistrarAula, // Alias para compatibilidade
            podeLancarNota,
            podeLancarNotas: podeLancarNota, // Alias SIGAE
            podeMarcarPresenca: planoAtivo && temTurma,
            motivoBloqueio,
            curso,
            // SIGAE: Carga horária prevista x realizada
            cargaHorariaTotal: item.cargaHorariaTotal ?? null,
            cargaHorariaPlanejada: item.cargaHorariaPlanejada ?? null,
            cargaHorariaRealizada: item.cargaHorariaRealizada ?? null,
          });
        } else {
          // Plano SEM turma → adicionar em disciplinasSemTurma[]
          const curso = item.curso || null;
          disciplinasSemTurma.push({
            id: item.id || item.planoEnsinoId, // ID do plano
            nome: item.nome || item.disciplinaNome, // Nome da disciplina
            codigo: item.codigo || `DISC-${item.disciplinaId?.substring(0, 8) || 'N/A'}`,
            disciplina: {
              id: item.disciplinaId,
              nome: item.disciplinaNome,
            },
            planoEnsinoId: item.planoEnsinoId,
            planoEstado,
            planoBloqueado,
            planoAtivo,
            estadoPlano: planoEstado,
            bloqueado: planoBloqueado,
            semTurma: true,
            turmaId: null,
            turma: null,
            disciplinaNome: item.disciplinaNome,
            disciplinaId: item.disciplinaId,
            cursoId: curso?.id ?? null,
            semestre: null,
            podeRegistrarAula: false, // Sem turma, não pode registrar aula
            podeLancarAula: false, // Alias para compatibilidade
            podeLancarNota: false, // Sem turma, não pode lançar nota
            podeLancarNotas: false, // Alias SIGAE
            podeMarcarPresenca: false,
            motivoBloqueio,
            curso,
            cargaHorariaTotal: item.cargaHorariaTotal ?? null,
            cargaHorariaPlanejada: item.cargaHorariaPlanejada ?? null,
            cargaHorariaRealizada: item.cargaHorariaRealizada ?? null,
          });
        }
      }

      console.log(`[getTurmasByProfessor] ✅ Retornando ${turmas.length} turmas e ${disciplinasSemTurma.length} disciplinas sem turma para professor ${professorId}`);
      
      // REGRA ABSOLUTA: Sempre retornar formato padronizado SIGAE
      // anoLetivoAtivo: { id, ano } para filtro opcional no frontend
      // IMPORTANTE: Sempre retornar 200 OK, mesmo quando arrays vazios
      return res.status(200).json({
        anoLetivo: anoLetivoAtivo?.ano || null,
        anoLetivoAtivo: anoLetivoAtivo ? { id: anoLetivoAtivo.id, ano: anoLetivoAtivo.ano } : null,
        turmas: turmas,
        disciplinasSemTurma: disciplinasSemTurma
      });
    } catch (error: any) {
      // REGRA ABSOLUTA: Ausência de turmas NÃO é erro - sempre retornar 200 com array vazio
      // Não lançar exceção para erros de "não encontrado" ou "sem plano ativo"
      // IMPORTANTE: Nunca retornar 400 - sempre retornar 200 com array vazio
      console.warn(`[getTurmasByProfessor] Erro ao processar turmas (retornando array vazio):`, error?.message || error);
      console.warn(`[getTurmasByProfessor] Stack trace:`, error?.stack);
      return res.status(200).json({
        anoLetivo: anoLetivoAtivo?.ano ?? null,
        anoLetivoAtivo: anoLetivoAtivo ? { id: anoLetivoAtivo.id, ano: anoLetivoAtivo.ano } : null,
        turmas: [],
        disciplinasSemTurma: []
      });
    }
  } catch (error: any) {
    // REGRA ABSOLUTA: Erros críticos devem ser tratados, mas ausência de dados NÃO é erro
    // IMPORTANTE: Nunca retornar 400 - sempre retornar 200 com array vazio quando possível
    // CORREÇÃO CRÍTICA: Tratar TODOS os erros como "sem turmas" para garantir que o frontend sempre funcione
    console.error('[getTurmasByProfessor] Erro crítico (retornando array vazio):', error);
    console.error('[getTurmasByProfessor] Stack trace:', error?.stack);
    
    // REGRA ABSOLUTA: Para a rota /turmas/professor, SEMPRE retornar 200 com array vazio
    // Nunca propagar erros - ausência de turmas é um estado válido, não um erro
    // Apenas erros de autenticação (401, 403) devem ser propagados (mas esses são tratados pelos middlewares)
    
    // Se for erro de validação, não encontrado, ou qualquer erro que não seja crítico de sistema,
    // retornar array vazio ao invés de propagar o erro
    if (error instanceof AppError) {
      // Erros 401/403 (autenticação/autorização) devem ser propagados
      if (error.statusCode === 401 || error.statusCode === 403) {
        return next(error);
      }
      // Erros 404 ou relacionados a "não encontrado" devem retornar array vazio
      if (error.statusCode === 404 || error.message?.includes('não encontrado') || error.message?.includes('não existe')) {
        console.warn('[getTurmasByProfessor] Erro tratado como "não encontrado" - retornando array vazio');
        return res.status(200).json({
          anoLetivo: null,
          anoLetivoAtivo: null,
          turmas: [],
          disciplinasSemTurma: []
        });
      }
      // Erros 400 também devem retornar array vazio (não é erro crítico)
      if (error.statusCode === 400) {
        console.warn('[getTurmasByProfessor] Erro 400 tratado - retornando array vazio');
        return res.status(200).json({
          anoLetivo: null,
          anoLetivoAtivo: null,
          turmas: [],
          disciplinasSemTurma: []
        });
      }
      // Erros 500 também devem retornar array vazio para não quebrar o frontend
      // O log já foi feito acima para diagnóstico
      if (error.statusCode === 500 || error.statusCode >= 500) {
        console.warn('[getTurmasByProfessor] Erro 500 tratado - retornando array vazio para não quebrar frontend');
        return res.status(200).json({
          anoLetivo: null,
          anoLetivoAtivo: null,
          turmas: [],
          disciplinasSemTurma: []
        });
      }
    }
    
    // REGRA ABSOLUTA: Para qualquer outro erro não tratado, retornar array vazio
    // A rota /turmas/professor NUNCA deve quebrar o frontend
    // Erros de autenticação (401, 403) são tratados pelos middlewares antes de chegar aqui
    console.warn('[getTurmasByProfessor] Erro não tratado - retornando array vazio para garantir funcionamento do frontend');
    return res.status(200).json({
      anoLetivo: null,
      anoLetivoAtivo: null,
      turmas: [],
      disciplinasSemTurma: []
    });
  }
};
