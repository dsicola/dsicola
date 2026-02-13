import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { verificarTrimestreEncerrado, verificarAnoEncerrado } from './encerramentoAcademico.controller.js';
import { validarPermissaoLancarAula } from '../middlewares/role-permissions.middleware.js';
import { buscarPeriodoAcademico, validarPeriodoAtivoParaAulas, validarPeriodoNaoEncerrado, validarPlanoEnsinoAtivo, validarVinculoProfessorDisciplinaTurma } from '../services/validacaoAcademica.service.js';

/**
 * Listar aulas planejadas (vindas do Plano de Ensino)
 * Filtrado por contexto: curso/classe, disciplina, professor, ano letivo, turma
 */
export const getAulasPlanejadas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, classeId, disciplinaId, professorId: professorIdQuery, anoLetivo, turmaId } = req.query;

    if (!disciplinaId || !anoLetivo) {
      throw new AppError('Disciplina e Ano Letivo são obrigatórios', 400);
    }

    const filter = addInstitutionFilter(req);
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const professorIdToken = req.professor?.id;

    // Determinar professorId: ADMIN/SECRETARIA enviam no query; PROFESSOR usa req.professor.id
    let professorId: string;
    if (isProfessor && professorIdToken) {
      if (professorIdQuery && String(professorIdQuery) !== professorIdToken) {
        throw new AppError('Acesso negado: você só pode visualizar seus próprios planos de ensino', 403);
      }
      professorId = professorIdToken;
    } else {
      if (!professorIdQuery || String(professorIdQuery).trim() === '') {
        throw new AppError('Professor é obrigatório', 400);
      }
      professorId = String(professorIdQuery);
    }

    // Buscar plano de ensino pelo contexto
    // IMPORTANTE: turmaId é opcional
    // - Se fornecido: buscar apenas planos com essa turma específica
    // - Se não fornecido: buscar planos que correspondam ao contexto (com ou sem turmaId)
    const baseWhere: any = {
      disciplinaId: String(disciplinaId),
      professorId: String(professorId),
      anoLetivo: Number(anoLetivo),
      ...filter,
    };

    // Adicionar cursoId ou classeId apenas se fornecido (não forçar null)
    if (cursoId) {
      baseWhere.cursoId = String(cursoId);
    }
    if (classeId) {
      baseWhere.classeId = String(classeId);
    }

    // REGRA ARQUITETURAL SIGA/SIGAE: Plano de Ensino SEMPRE aparece no painel do professor
    // Estado controla AÇÃO, NÃO visibilidade
    // RASCUNHO / EM_REVISAO aparecem (bloqueados)
    // APROVADO aparece (ativo)
    // ENCERRADO aparece (somente leitura)
    // NUNCA filtrar planos por estado na query - todos os planos são visíveis
    // Removido filtro de estado - professores veem TODOS os seus planos

    // Tentar buscar o plano de forma flexível
    // Primeiro, tentar com os parâmetros exatos fornecidos
    let where: any = { ...baseWhere };
    
    // Se turmaId for fornecido, buscar apenas planos com essa turma específica
    // Se não for fornecido, não filtrar por turmaId (buscar planos com ou sem turmaId)
    if (turmaId && String(turmaId).trim() !== '' && String(turmaId) !== 'none') {
      where.turmaId = String(turmaId);
    }
    // Se turmaId não for fornecido, não adicionar ao where - busca planos com qualquer turmaId (incluindo null)

    // Log de debug para diagnóstico
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getAulasPlanejadas] Buscando plano com where:', JSON.stringify(where, null, 2));
    }

    let plano = await prisma.planoEnsino.findFirst({
      where,
      include: {
        aulas: {
          orderBy: { ordem: 'asc' },
          include: {
            aulasLancadas: {
              orderBy: { data: 'desc' },
            },
            distribuicoes: {
              orderBy: { data: 'asc' },
            },
          },
        },
      },
    });

    // Se não encontrou e turmaId foi fornecido, tentar buscar sem turmaId (plano pode ter sido criado sem turma específica)
    if (!plano && turmaId && String(turmaId).trim() !== '' && String(turmaId) !== 'none') {
      const whereSemTurma = { ...baseWhere };
      // Não adicionar turmaId - busca planos com qualquer turmaId (incluindo null)
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[getAulasPlanejadas] Tentando buscar plano sem turmaId:', JSON.stringify(whereSemTurma, null, 2));
      }
      
      plano = await prisma.planoEnsino.findFirst({
        where: whereSemTurma,
        include: {
          aulas: {
            orderBy: { ordem: 'asc' },
            include: {
              aulasLancadas: {
                orderBy: { data: 'desc' },
              },
              distribuicoes: {
                orderBy: { data: 'asc' },
              },
            },
          },
        },
      });
    }
    // Se não encontrou e turmaId não foi fornecido, tentar buscar com turmaId null explicitamente
    else if (!plano && (!turmaId || String(turmaId).trim() === '' || String(turmaId) === 'none')) {
      const whereComTurmaNull = { ...baseWhere, turmaId: null };
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('[getAulasPlanejadas] Tentando buscar plano com turmaId null:', JSON.stringify(whereComTurmaNull, null, 2));
      }
      
      plano = await prisma.planoEnsino.findFirst({
        where: whereComTurmaNull,
        include: {
          aulas: {
            orderBy: { ordem: 'asc' },
            include: {
              aulasLancadas: {
                orderBy: { data: 'desc' },
              },
              distribuicoes: {
                orderBy: { data: 'asc' },
              },
            },
          },
        },
      });
    }

    if (!plano) {
      // Log de debug para diagnóstico
      if (process.env.NODE_ENV !== 'production') {
        console.log('[getAulasPlanejadas] Plano não encontrado após todas as tentativas. Filtros base:', JSON.stringify(baseWhere, null, 2));
      }
      return res.json([]);
    }

    // Log de debug: verificar se plano tem aulas
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getAulasPlanejadas] Plano encontrado:', {
        id: plano.id,
        totalAulas: plano.aulas.length,
        aulasIds: plano.aulas.map(a => a.id),
      });
    }

    // Se plano não tem aulas, retornar array vazio com mensagem informativa
    if (!plano.aulas || plano.aulas.length === 0) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[getAulasPlanejadas] Plano encontrado mas sem aulas distribuídas');
      }
      return res.json([]);
    }

    // Formatar aulas planejadas com informações de lançamentos e distribuições
    const aulasFormatadas = plano.aulas.map((aula) => {
      const lancamentos = aula.aulasLancadas || [];
      const distribuicoes = aula.distribuicoes || [];
      const totalLancado = lancamentos.length;
      const totalDistribuido = distribuicoes.length;
      const status = totalLancado > 0 ? 'MINISTRADA' : aula.status;

      return {
        id: aula.id,
        ordem: aula.ordem,
        titulo: aula.titulo,
        descricao: aula.descricao,
        tipo: aula.tipo,
        trimestre: aula.trimestre,
        quantidadeAulas: aula.quantidadeAulas,
        status: status,
        dataMinistrada: aula.dataMinistrada,
        totalLancado,
        totalDistribuido, // Adicionar contador de distribuições
        lancamentos: lancamentos.map((l) => ({
          id: l.id,
          data: l.data,
          observacoes: l.observacoes,
        })),
        datasDistribuidas: distribuicoes.map((d) => {
          const date = new Date(d.data);
          date.setHours(0, 0, 0, 0);
          return date.toISOString().split('T')[0];
        }), // Adicionar datas distribuídas
      };
    });

    res.json(aulasFormatadas);
  } catch (error) {
    next(error);
  }
};

/**
 * Criar lançamento de aula
 */
export const createAulaLancada = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoAulaId, data, horaInicio, horaFim, observacoes, cargaHoraria, conteudoMinistrado } = req.body;
    const userId = req.user?.userId;

    if (!planoAulaId || !data) {
      throw new AppError('PlanoAulaId e Data são obrigatórios', 400);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode lançar aula
    await validarPermissaoLancarAula(req, planoAulaId);

    const instituicaoId = requireTenantScope(req);

    // Verificar se a aula existe e pertence à instituição
    const aula = await prisma.planoAula.findUnique({
      where: { id: planoAulaId },
      include: {
        planoEnsino: true,
        aulasLancadas: true,
      },
    });

    if (!aula) {
      throw new AppError('Aula planejada não encontrada', 404);
    }

    // Verificar se o plano pertence à instituição
    // IMPORTANTE: Incluir todos os campos necessários para validação
    const filter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId, ...filter },
      select: {
        id: true,
        estado: true,
        bloqueado: true,
        disciplinaId: true,
        professorId: true,
        turmaId: true,
        anoLetivoId: true,
        instituicaoId: true,
      },
    });

    if (!plano) {
      throw new AppError('Acesso negado: plano não pertence à sua instituição', 403);
    }

    // REGRA SIGA/SIGAE (OPÇÃO B): Usar req.professor.id (professores.id) - middleware resolveProfessor aplicado
    if (!req.professor?.id) {
      throw new AppError('Professor não identificado. Middleware resolveProfessor deve ser aplicado.', 500);
    }
    const professorId = req.professor.id; // professores.id (NÃO users.id)

    // Log de diagnóstico para debug
    if (process.env.NODE_ENV !== 'production') {
      console.log('[createAulaLancada] Plano encontrado:', {
        planoId: plano.id,
        estado: plano.estado,
        bloqueado: plano.bloqueado,
        disciplinaId: plano.disciplinaId,
        professorIdPlano: plano.professorId,
        professorIdToken: professorId,
        turmaId: plano.turmaId,
        instituicaoId: plano.instituicaoId,
      });
    }

    // REGRA MESTRA SIGA/SIGAE: Validar que Plano de Ensino está ATIVO (APROVADO)
    // NADA acadêmico pode existir sem um PLANO DE ENSINO válido e ATIVO
    await validarPlanoEnsinoAtivo(instituicaoId, plano.id, 'lançar aula');

    // REGRA MESTRA SIGA/SIGAE: Validar vínculo Professor-Disciplina-Turma via Plano de Ensino ATIVO
    // IMPORTANTE: O plano já foi validado como ativo acima, mas precisamos garantir que:
    // 1. O professor do token corresponde ao professor do plano
    // 2. O plano tem turma vinculada (bloqueia disciplinas sem turma)
    // Validar que o professor do token corresponde ao professor do plano
    if (plano.professorId !== professorId) {
      throw new AppError(
        'Acesso negado: você não é o professor responsável por esta aula. Apenas o professor vinculado ao Plano de Ensino pode lançar aulas.',
        403
      );
    }

    // Validar que o plano tem turma vinculada (obrigatório para ações pedagógicas)
    if (!plano.turmaId) {
      throw new AppError(
        'Não é possível lançar aula. O Plano de Ensino não possui turma vinculada. Ações pedagógicas (aulas, presenças, avaliações, notas) só podem ser executadas quando a disciplina está vinculada a uma turma. Contacte a coordenação para vincular a disciplina a uma turma.',
        403
      );
    }

    // REGRA: Validar vínculo usando o plano já encontrado
    // Em vez de fazer uma nova busca, validar diretamente os dados do plano encontrado
    // Isso evita problemas de inconsistência entre buscas
    // A função validarVinculoProfessorDisciplinaTurma faz uma nova busca, mas podemos pular isso
    // já que validamos tudo acima. Porém, mantemos a chamada para garantir consistência.
    await validarVinculoProfessorDisciplinaTurma(
      instituicaoId,
      professorId,
      plano.disciplinaId,
      plano.turmaId,
      'lançar aula'
    );

    // REGRA MESTRA: Ano Letivo é contexto, não bloqueio.
    let anoLetivoNumero: number | null = null;
    if (plano.anoLetivoId) {
      const anoLetivoStatus = await prisma.anoLetivo.findUnique({
        where: { id: plano.anoLetivoId },
        select: { status: true, ano: true },
      });
      if (anoLetivoStatus) {
        anoLetivoNumero = anoLetivoStatus.ano;
        if (anoLetivoStatus.status !== 'ATIVO') {
          console.warn(`[createAulaLancada] Ano Letivo ${plano.anoLetivoId} do plano de ensino ${plano.id} não está ATIVO. Status: ${anoLetivoStatus.status}. Operação de lançamento de aula permitida, mas com aviso.`);
        }
      }
    } else {
      console.warn(`[createAulaLancada] Plano de ensino ${plano.id} não possui ano letivo vinculado. Operação de lançamento de aula permitida, mas com aviso.`);
    }

    // VALIDAÇÃO DE BLOQUEIO: Verificar se a aula tem distribuição de datas
    // Por enquanto, verificamos se o plano tem aulas (distribuição implícita)
    const planoComAulas = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId },
      include: {
        aulas: {
          include: {
            aulasLancadas: true,
          },
        },
      },
    });

    if (!planoComAulas || planoComAulas.aulas.length === 0) {
      throw new AppError('É necessário distribuir as aulas antes de realizar lançamentos. Acesse o módulo de Distribuição de Aulas primeiro.', 400);
    }

    // VALIDAÇÃO DE BLOQUEIO: Verificar se a aula tem datas distribuídas
    // Por enquanto, verificamos se já existem aulas lançadas (distribuição realizada)
    // No futuro, pode verificar uma tabela específica de distribuição
    const aulaTemDistribuicao = planoComAulas.aulas.some((aula) => 
      aula.id === planoAulaId && aula.aulasLancadas.length >= 0
    );

    // Permitir lançamento mesmo sem distribuição prévia (flexibilidade)
    // Mas registramos que não havia distribuição automática

    // VALIDAÇÃO DE BLOQUEIO: Verificar tipo acadêmico e período
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true },
    });

    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    // Fallback para instituicao?.tipoAcademico apenas se não estiver no JWT (compatibilidade)
    const tipoAcademico = req.user?.tipoAcademico || instituicao?.tipoAcademico || null;

    if (!tipoAcademico) {
      throw new AppError('Tipo acadêmico da instituição não identificado. Configure o tipo acadêmico da instituição (ENSINO_SUPERIOR ou ENSINO_SECUNDARIO) antes de lançar aulas.', 400);
    }

    // Buscar período acadêmico (semestre ou trimestre)
    if (!anoLetivoNumero) {
      throw new AppError('Ano letivo não identificado para buscar período acadêmico', 400);
    }
    const periodo = await buscarPeriodoAcademico(
      instituicaoId,
      anoLetivoNumero,
      tipoAcademico,
      new Date(data)
    );

    // Validar se período está ATIVO e data está dentro do período
    validarPeriodoAtivoParaAulas(periodo, new Date(data));

    // Validar se período não está encerrado
    validarPeriodoNaoEncerrado(periodo, 'lançar aula');

    // Verificar se não existe lançamento duplicado para a mesma data
    const lancamentoExistente = await prisma.aulaLancada.findFirst({
      where: {
        planoAulaId,
        data: new Date(data),
        instituicaoId,
      },
    });

    if (lancamentoExistente) {
      throw new AppError('Já existe um lançamento para esta aula nesta data', 400);
    }

    // Validar que planoEnsinoId existe e pertence à instituição
    if (!plano.id) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // Obter IDs de semestre/trimestre baseado no período acadêmico
    let semestreId: string | null = null;
    let trimestreId: string | null = null;
    
    if (periodo) {
      if (tipoAcademico === 'SUPERIOR') {
        // Buscar semestre pelo ID retornado
        const semestre = await prisma.semestre.findUnique({
          where: { id: periodo.id },
          select: { id: true },
        });
        if (semestre) {
          semestreId = semestre.id;
        }
      } else if (tipoAcademico === 'SECUNDARIO') {
        // Buscar trimestre pelo ID retornado
        const trimestre = await prisma.trimestre.findUnique({
          where: { id: periodo.id },
          select: { id: true },
        });
        if (trimestre) {
          trimestreId = trimestre.id;
        }
      }
    }

    // Criar lançamento com ligação direta ao Plano de Ensino
    const lancamento = await prisma.aulaLancada.create({
      data: {
        planoAulaId,
        planoEnsinoId: plano.id, // OBRIGATÓRIO: Ligação direta ao Plano de Ensino
        data: new Date(data),
        horaInicio: horaInicio || null, // Hora de início (formato HH:mm)
        horaFim: horaFim || null, // Hora de fim (formato HH:mm)
        cargaHoraria: cargaHoraria || aula.quantidadeAulas || 1, // Usar carga horária fornecida ou do plano
        conteudoMinistrado: conteudoMinistrado || observacoes || null, // Conteúdo ministrado
        observacoes: observacoes || null,
        criadoPor: userId || null, // ID do usuário que criou (PROFESSOR)
        semestreId, // FK para Semestre (SUPERIOR)
        trimestreId, // FK para Trimestre (SECUNDARIO)
        instituicaoId, // OBRIGATÓRIO: Multi-tenant
      },
      include: {
        planoAula: {
          include: {
            planoEnsino: {
              select: {
                disciplina: { select: { nome: true } },
                professor: { select: { user: { select: { nomeCompleto: true } } } },
              },
            },
          },
        },
      },
    });

    // Atualizar status da aula planejada para MINISTRADA se ainda não estiver
    if (aula.status !== 'MINISTRADA') {
      await prisma.planoAula.update({
        where: { id: planoAulaId },
        data: {
          status: 'MINISTRADA',
          dataMinistrada: new Date(data),
        },
      });
    }

    // Auditoria: Log CREATE (lançamento de aula)
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.LANCAMENTO_AULAS,
      entidade: EntidadeAuditoria.AULA_LANCADA,
      entidadeId: lancamento.id,
      dadosNovos: lancamento,
      observacao: `Aula marcada como ministrada em ${data}`,
    });

    res.status(201).json(lancamento);
  } catch (error) {
    next(error);
  }
};

/**
 * Listar aulas lançadas
 */
export const getAulasLancadas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      planoAulaId,
      cursoId,
      classeId,
      disciplinaId,
      professorId,
      anoLetivo,
      turmaId,
      dataInicio,
      dataFim,
    } = req.query;

    const filter = addInstitutionFilter(req);
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const isAluno = req.user?.roles?.includes('ALUNO');
    const userId = req.user?.userId;
    
    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Se for professor, usar req.professor.id
    // Se middleware não foi aplicado, professorId será undefined (não é erro para consulta)
    const professorIdToken = req.professor?.id;

    // Se for professor, verificar se está acessando seus próprios planos
    if (isProfessor && professorIdToken) {
      // professorId do query deve ser professores.id (não users.id)
      // Validar que o professorId do query corresponde ao professor do token
      if (professorId && String(professorId) !== professorIdToken) {
        throw new AppError('Acesso negado: você só pode visualizar seus próprios planos de ensino', 403);
      }
    }

    // Se for aluno, filtrar apenas aulas das suas turmas/disciplinas
    let alunoPlanoIds: string[] = [];
    if (isAluno && userId) {
      // Buscar matrículas do aluno em turmas
      const matriculas = await prisma.matricula.findMany({
        where: {
          alunoId: userId,
          status: 'Ativa',
          ...filter,
        },
        include: {
          turma: {
            select: { id: true },
          },
        },
      });

      const turmaIds = matriculas.map((m) => m.turmaId || m.turma?.id).filter(Boolean);
      
      // Buscar matrículas em disciplinas (AlunoDisciplina)
      const matriculasDisciplinas = await prisma.alunoDisciplina.findMany({
        where: {
          alunoId: userId,
          status: { in: ['Matriculado', 'Cursando'] },
          ...filter,
        },
        select: {
          disciplinaId: true,
          ano: true,
          turmaId: true,
        },
      });

      const disciplinaIds = [...new Set(matriculasDisciplinas.map((md: any) => md.disciplinaId).filter(Boolean))];
      const anosLetivos = [...new Set(matriculasDisciplinas.map((md: any) => md.ano).filter(Boolean))];
      const turmaIdsDisciplinas = [...new Set(matriculasDisciplinas.map((md: any) => md.turmaId).filter(Boolean))];
      
      // Combinar todas as turmas (de matrículas e de disciplinas)
      const todasTurmaIds = [...new Set([...turmaIds, ...turmaIdsDisciplinas])];
      
      // Se não há turmas ou disciplinas, retornar vazio
      if (todasTurmaIds.length === 0 && disciplinaIds.length === 0) {
        return res.json([]);
      }

      // Buscar planos de ensino que correspondem às turmas/disciplinas do aluno
      const planoWhere: any = {
        ...filter,
        estado: { in: ['APROVADO', 'ENCERRADO'] }, // Apenas planos aprovados ou encerrados
      };

      // Se há turmas do aluno, filtrar por turmas
      if (todasTurmaIds.length > 0) {
        planoWhere.turmaId = { in: todasTurmaIds };
      }

      // Se há disciplinas do aluno, filtrar por disciplinas
      if (disciplinaIds.length > 0) {
        planoWhere.disciplinaId = { in: disciplinaIds };
      }

      // Se há anos letivos do aluno e não foi especificado anoLetivo, filtrar por anos
      if (anosLetivos.length > 0) {
        if (anoLetivo) {
          // Se foi especificado anoLetivo, verificar se está na lista do aluno
          if (!anosLetivos.includes(Number(anoLetivo))) {
            return res.json([]);
          }
          planoWhere.anoLetivo = Number(anoLetivo);
        } else {
          // Se não foi especificado, filtrar pelos anos do aluno
          planoWhere.anoLetivo = { in: anosLetivos };
        }
      }

      // Buscar planos de ensino que correspondem ao aluno
      const planosAluno = await prisma.planoEnsino.findMany({
        where: planoWhere,
        select: { id: true },
      });

      alunoPlanoIds = planosAluno.map((p) => p.id);

      // Se não há planos para o aluno, retornar vazio
      if (alunoPlanoIds.length === 0) {
        return res.json([]);
      }
    }

    let where: any = {
      ...filter,
    };

    // Se for aluno, aplicar filtro de planos do aluno
    if (isAluno && alunoPlanoIds.length > 0) {
      // Buscar aulas (PlanoAula) dos planos do aluno
      const aulasAluno = await prisma.planoAula.findMany({
        where: { planoEnsinoId: { in: alunoPlanoIds } },
        select: { id: true },
      });

      const aulaIdsAluno = aulasAluno.map((a) => a.id);

      if (aulaIdsAluno.length === 0) {
        return res.json([]);
      }

      // Aplicar filtro de planoAulaId apenas para aulas do aluno
      if (planoAulaId) {
        // Verificar se o planoAulaId pertence a um plano do aluno
        if (!aulaIdsAluno.includes(String(planoAulaId))) {
          return res.json([]);
        }
        where.planoAulaId = String(planoAulaId);
      } else {
        where.planoAulaId = { in: aulaIdsAluno };
      }
    } else if (planoAulaId) {
      // Se não for aluno, aplicar filtro normal de planoAulaId
      where.planoAulaId = String(planoAulaId);
    }

    if (dataInicio || dataFim) {
      where.data = {};
      if (dataInicio) {
        where.data.gte = new Date(String(dataInicio));
      }
      if (dataFim) {
        where.data.lte = new Date(String(dataFim));
      }
    }

    // Se há filtros de contexto E não é aluno (aluno já foi filtrado acima), buscar apenas lançamentos de aulas que correspondem
    if (!isAluno && (disciplinaId || professorId || anoLetivo)) {
      const planoWhere: any = {
        ...filter,
      };

      if (cursoId) planoWhere.cursoId = String(cursoId);
      if (classeId) planoWhere.classeId = String(classeId);
      if (disciplinaId) planoWhere.disciplinaId = String(disciplinaId);
      if (professorId) planoWhere.professorId = String(professorId);
      // REGRA SIGAE: Professor SEMPRE filtra por req.professor.id - nunca ver aulas de outros professores
      if (isProfessor && professorIdToken) {
        planoWhere.professorId = professorIdToken;
      }
      if (anoLetivo) planoWhere.anoLetivo = Number(anoLetivo);
      if (turmaId) planoWhere.turmaId = String(turmaId);

      const planos = await prisma.planoEnsino.findMany({
        where: planoWhere,
        select: { id: true },
      });

      const planoIds = planos.map((p) => p.id);

      const aulas = await prisma.planoAula.findMany({
        where: { planoEnsinoId: { in: planoIds } },
        select: { id: true },
      });

      const aulaIds = aulas.map((a) => a.id);
      
      // Combinar com filtro existente de planoAulaId se houver
      if (where.planoAulaId) {
        const existingIds = Array.isArray(where.planoAulaId.in) 
          ? where.planoAulaId.in 
          : [where.planoAulaId];
        where.planoAulaId = { in: aulaIds.filter(id => existingIds.includes(id)) };
      } else {
        where.planoAulaId = { in: aulaIds };
      }
    }

    const lancamentos = await prisma.aulaLancada.findMany({
      where,
      include: {
        planoAula: {
          include: {
            planoEnsino: {
              include: {
                curso: { select: { id: true, nome: true } },
                classe: { select: { id: true, nome: true } },
                disciplina: { select: { id: true, nome: true } },
                professor: { select: { id: true, user: { select: { nomeCompleto: true } } } },
                turma: { select: { id: true, nome: true } },
              },
            },
          },
        },
      },
      orderBy: { data: 'desc' },
    });

    res.json(lancamentos);
  } catch (error) {
    next(error);
  }
};

/**
 * Remover lançamento de aula
 */
export const deleteAulaLancada = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lancamentoId } = req.params;

    const filter = addInstitutionFilter(req);

    // Verificar se lançamento existe e pertence à instituição
    const whereClause: any = { id: lancamentoId };
    if (filter.instituicaoId) {
      whereClause.instituicaoId = filter.instituicaoId;
    }
    
    const lancamento = await prisma.aulaLancada.findFirst({
      where: whereClause,
      include: {
        planoEnsino: {
          select: {
            id: true,
            professorId: true,
          },
        },
      },
    });

    if (!lancamento) {
      throw new AppError('Lançamento não encontrado', 404);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode deletar aula
    await validarPermissaoLancarAula(req, undefined, lancamento.planoEnsino.id);

    // Auditoria: Log DELETE (antes de deletar)
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.LANCAMENTO_AULAS,
      entidade: EntidadeAuditoria.AULA_LANCADA,
      entidadeId: lancamentoId,
      dadosAnteriores: lancamento,
      observacao: `Lançamento removido: Aula ${lancamentoId}`,
    });

    // Remover lançamento
    await prisma.aulaLancada.delete({
      where: { id: lancamentoId },
    });

    // Verificar se ainda há outros lançamentos para esta aula
    const outrosLancamentos = await prisma.aulaLancada.findFirst({
      where: { planoAulaId: lancamento.planoAulaId },
    });

    // Se não há mais lançamentos, atualizar status da aula para PLANEJADA
    if (!outrosLancamentos) {
      await prisma.planoAula.update({
        where: { id: lancamento.planoAulaId },
        data: {
          status: 'PLANEJADA',
          dataMinistrada: null,
        },
      });
    }

    res.json({ message: 'Lançamento removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

