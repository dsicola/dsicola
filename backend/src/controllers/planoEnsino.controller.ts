import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, requireTenantScope } from '../middlewares/auth.js';
import { AuditService, ModuloAuditoria, EntidadeAuditoria } from '../services/audit.service.js';
import { validarEstadoParaEdicao } from '../middlewares/estado.middleware.js';
import { validarPermissaoPlanoEnsino, validarPermissaoAprovarPlanoEnsino } from '../middlewares/role-permissions.middleware.js';
import { buscarAnoLetivoAtivo } from '../services/validacaoAcademica.service.js';

/**
 * Função centralizada para recalcular e atualizar cargaHorariaPlanejada
 * REGRA SIGA/SIGAE: cargaHorariaPlanejada = soma(aulas.quantidadeAulas)
 * Esta função deve ser chamada sempre que aulas forem criadas/editadas/deletadas
 * IMPORTANTE: Valida multi-tenant antes de calcular
 */
async function recalcularCargaHorariaPlanejada(planoEnsinoId: string, instituicaoId: string): Promise<void> {
  // VALIDAÇÃO MULTI-TENANT: Verificar se plano pertence à instituição antes de buscar aulas
  const plano = await prisma.planoEnsino.findFirst({
    where: { 
      id: planoEnsinoId,
      instituicaoId // CRÍTICO: Garantir multi-tenant
    },
    select: { id: true }
  });
  
  if (!plano) {
    throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
  }
  
  // Buscar todas as aulas do plano (já validado multi-tenant acima)
  const aulas = await prisma.planoAula.findMany({
    where: { planoEnsinoId },
    select: { quantidadeAulas: true }
  });
  
  // Calcular soma das aulas
  const cargaHorariaPlanejada = aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0);
  
  // Atualizar no banco
  await prisma.planoEnsino.update({
    where: { id: planoEnsinoId },
    data: { cargaHorariaPlanejada }
  });
}

/**
 * Função centralizada para obter cargaHorariaExigida da Disciplina
 * REGRA SIGA/SIGAE: cargaHorariaExigida SEMPRE vem da Disciplina
 * IMPORTANTE: Valida multi-tenant antes de buscar
 */
async function getCargaHorariaExigida(planoEnsinoId: string, instituicaoId: string): Promise<number> {
  // VALIDAÇÃO MULTI-TENANT: Verificar se plano pertence à instituição
  const plano = await prisma.planoEnsino.findFirst({
    where: { 
      id: planoEnsinoId,
      instituicaoId // CRÍTICO: Garantir multi-tenant
    },
    include: {
      disciplina: { select: { cargaHoraria: true } }
    }
  });
  
  if (!plano) {
    throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
  }
  
  return plano.disciplina.cargaHoraria || 0;
}

/**
 * Criar ou buscar plano de ensino
 */
export const createOrGetPlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode criar/editar plano
    await validarPermissaoPlanoEnsino(req);

    // CORREÇÃO CRÍTICA: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    // NUNCA aceitar instituicaoId do body - ignorar completamente
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // CORREÇÃO CRÍTICA: instituicaoId SEMPRE vem do JWT (nunca do body)
    // REGRA ARQUITETURAL: Frontend NÃO envia instituicaoId - sempre do JWT
    if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
      throw new AppError('Não é permitido alterar a instituição. O sistema usa a instituição do usuário autenticado.', 400);
    }
    
    const { cursoId, classeId, disciplinaId, anoLetivo, anoLetivoId, turmaId, semestre, classeOuAno, metodologia, objetivos, conteudoProgramatico, criteriosAvaliacao, professorId: professorIdBody } = req.body;
    
    // LOG CRÍTICO: Logar payload recebido para debug
    console.log(`[createOrGetPlanoEnsino] 📥 Payload recebido:`, {
      professorIdBody: professorIdBody,
      professorIdBodyTipo: typeof professorIdBody,
      disciplinaId,
      anoLetivoId,
      cursoId,
      turmaId,
      temReqProfessor: !!req.professor,
      reqProfessorId: req.professor?.id,
      instituicaoId: instituicaoId,
    });
    
    // REGRA SIGA/SIGAE: Não aceitar cargaHorariaTotal ou cargaHorariaPlanejada do body
    // cargaHorariaTotal vem sempre da Disciplina
    // cargaHorariaPlanejada é calculada automaticamente (soma das aulas)
    if (req.body.cargaHorariaTotal !== undefined) {
      throw new AppError('Carga horária total não pode ser definida no Plano de Ensino. Ela é definida na Disciplina.', 400);
    }
    if (req.body.cargaHorariaPlanejada !== undefined) {
      throw new AppError('Carga horária planejada não pode ser definida manualmente. Ela é calculada automaticamente pela soma das aulas planejadas.', 400);
    }

    // Validar campos obrigatórios básicos SIGA/SIGAE
    if (!disciplinaId) {
      throw new AppError('Disciplina é obrigatória para criar Plano de Ensino. Selecione uma disciplina antes de continuar.', 400);
    }

    // REGRA ARQUITETURAL FINAL (IMUTÁVEL): 
    // - User = apenas autenticação/autorização
    // - Professor = entidade acadêmica (tabela professores)
    // - NENHUMA lógica híbrida ou legacy é permitida
    // - professorId SEMPRE é professores.id (NUNCA users.id)
    
    let professorIdFinal: string;
    
    if (req.professor?.id) {
      // Middleware resolveProfessor aplicado - usar req.professor.id (professores.id)
      professorIdFinal = req.professor.id;
      
      // Se professorId foi fornecido no body, validar que corresponde ao professor autenticado
      // ADMIN pode criar plano para outro professor especificando professorId no body
      if (professorIdBody) {
        const professorIdString = String(professorIdBody).trim();
        
        // REGRA ABSOLUTA: Aceitar APENAS professores.id (NUNCA users.id)
        const { validateProfessorId } = await import('../utils/professorResolver.js');
        const isValidProfessorId = await validateProfessorId(professorIdString, instituicaoId);
        
        if (!isValidProfessorId) {
          throw new AppError(
            'Professor não cadastrado na instituição (professores). Use o campo "id" retornado por GET /professores.',
            400
          );
        }
        
        // Se professorId do body é diferente do professor autenticado, usar o do body (ADMIN criando para outro)
        if (professorIdString !== professorIdFinal) {
          // Verificar se usuário tem permissão para criar plano para outro professor (ADMIN/SUPER_ADMIN)
          const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SUPER_ADMIN');
          if (!isAdmin) {
            throw new AppError('Você só pode criar planos de ensino para si mesmo. Apenas administradores podem criar planos para outros professores.', 403);
          }
          professorIdFinal = professorIdString;
        }
      }
    } else if (professorIdBody) {
      // Middleware não aplicado mas professorId fornecido no body (ADMIN criando para outro professor)
      const { validateProfessorId } = await import('../utils/professorResolver.js');
      const professorIdString = String(professorIdBody).trim();
      
      // REGRA ABSOLUTA: Aceitar APENAS professores.id (NUNCA users.id)
      const isValidProfessorId = await validateProfessorId(professorIdString, instituicaoId);
      
      if (!isValidProfessorId) {
        throw new AppError(
          'Professor não cadastrado na instituição (professores). Use o campo "id" retornado por GET /professores.',
          400
        );
      }
      
      professorIdFinal = professorIdString;
    } else {
      // Nenhum professor identificado
      // Se for ADMIN, pode especificar professorId no body
      const isAdmin = req.user?.roles?.includes('ADMIN') || req.user?.roles?.includes('SUPER_ADMIN');
      if (isAdmin) {
        throw new AppError('Professor é obrigatório para criar Plano de Ensino. Especifique o professorId (professores.id) no body da requisição.', 400);
      } else {
        throw new AppError('Professor é obrigatório para criar Plano de Ensino. O professor deve ser identificado automaticamente pelo token de autenticação.', 400);
      }
    }

    // REGRA MESTRA SIGA/SIGAE: Ano Letivo é OBRIGATÓRIO no Plano de Ensino (ÚNICO lugar onde é obrigatório)
    // Curso, Disciplina e Professor NÃO dependem de Ano Letivo - apenas Plano de Ensino depende
    if (!anoLetivoId) {
      throw new AppError('Ano Letivo é obrigatório para criar Plano de Ensino. Selecione um Ano Letivo válido antes de continuar.', 400);
    }
    
    // Buscar e validar Ano Letivo com filtro multi-tenant
    const anoLetivoFound = await prisma.anoLetivo.findFirst({
      where: {
        id: anoLetivoId,
        instituicaoId,
      },
    });

    if (!anoLetivoFound) {
      throw new AppError('Ano Letivo não encontrado ou não pertence à sua instituição. Verifique se o ano letivo está cadastrado corretamente.', 404);
    }

    // VALIDAÇÃO SIGA/SIGAE: Ano Letivo deve estar ATIVO para criar Plano de Ensino
    if (anoLetivoFound.status !== 'ATIVO') {
      throw new AppError(`Ano Letivo deve estar ATIVO para criar Plano de Ensino. O ano letivo selecionado está com status "${anoLetivoFound.status}". Ative um Ano Letivo antes de continuar.`, 400);
    }

    const anoLetivoFinal = anoLetivoFound.ano;

    // VALIDAÇÃO CONDICIONAL SIGA/SIGAE: Validar campos obrigatórios conforme tipo de instituição
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    if (!tipoAcademico) {
      throw new AppError('Tipo de instituição não identificado. Configure o tipo acadêmico da instituição (ENSINO_SUPERIOR ou ENSINO_SECUNDARIO) antes de criar Plano de Ensino.', 400);
    }
    
    // Variável para armazenar semestreId quando for Ensino Superior
    let semestreIdValor: string | null = null;
    
    if (tipoAcademico === 'SUPERIOR') {
      // ENSINO SUPERIOR - Regras SIGA/SIGAE:
      // - cursoId obrigatório
      // - semestre_id obrigatório (validado via número e tabela Semestres vinculado ao anoLetivoId)
      // - classeId deve ser null
      
      if (!cursoId) {
        throw new AppError('Curso é obrigatório para Ensino Superior. Selecione um curso antes de criar o Plano de Ensino.', 400);
      }
      
      // VALIDAÇÃO MULTI-TENANT: Verificar se curso pertence à instituição
      const curso = await prisma.curso.findFirst({
        where: {
          id: cursoId,
          ...filter
        },
        select: { id: true, nome: true }
      });

      if (!curso) {
        throw new AppError('Curso não encontrado ou não pertence à sua instituição. Verifique se o curso está cadastrado corretamente.', 404);
      }

      if (classeId) {
        throw new AppError('Planos de Ensino do Ensino Superior não podem estar vinculados a Classe. Use Curso ao invés de Classe.', 400);
      }
      
      // Semestre é obrigatório para Ensino Superior
      if (!semestre) {
        throw new AppError('Semestre é obrigatório para Ensino Superior. Selecione um semestre cadastrado antes de continuar.', 400);
      }
      
      // VALIDAÇÃO CRÍTICA SIGA/SIGAE: Verificar se semestre existe na tabela Semestres vinculado ao ano letivo
      const semestreExiste = await prisma.semestre.findFirst({
        where: {
          anoLetivoId: anoLetivoId,
          numero: semestre,
          instituicaoId,
        },
      });
      
      if (!semestreExiste) {
        // Verificar se há semestres cadastrados para este ano letivo (para mensagem de erro mais útil)
        const semestresAnoLetivo = await prisma.semestre.findMany({
          where: {
            anoLetivoId: anoLetivoId,
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
      
      // Armazenar semestreId para vincular FK corretamente
      semestreIdValor = semestreExiste.id;
      
      // ClasseOuAno não deve ser enviado para Ensino Superior
      if (classeOuAno) {
        throw new AppError('Campo "Classe/Ano" não é válido para Ensino Superior. Use o campo "Semestre" (1 ou 2).', 400);
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // ENSINO SECUNDÁRIO - Regras SIGA/SIGAE:
      // - classeId obrigatório
      // - classeOuAno obrigatório
      // - semestre não deve ser enviado (NÃO é usado no Ensino Secundário)
      
      if (!classeId) {
        throw new AppError('Classe é obrigatória para Ensino Secundário. Selecione uma classe antes de criar o Plano de Ensino.', 400);
      }

      // VALIDAÇÃO MULTI-TENANT: Verificar se classe pertence à instituição
      const classe = await prisma.classe.findFirst({
        where: {
          id: classeId,
          ...filter
        },
        select: { id: true, nome: true }
      });

      if (!classe) {
        throw new AppError('Classe não encontrada ou não pertence à sua instituição. Verifique se a classe está cadastrada corretamente.', 404);
      }

      // ClasseOuAno é obrigatório para Ensino Secundário
      if (!classeOuAno || classeOuAno.trim() === '') {
        throw new AppError('Classe/Ano é obrigatório para Ensino Secundário (ex: "10ª Classe", "1º Ano"). Informe o campo Classe/Ano antes de continuar.', 400);
      }
      
      // Semestre não deve ser enviado para Ensino Secundário
      if (semestre) {
        throw new AppError('Campo "Semestre" não é válido para Ensino Secundário. Use o campo "Classe/Ano" ao invés de Semestre.', 400);
      }

      // VALIDAÇÃO MULTI-TENANT: Verificar se curso existe e pertence à instituição (quando fornecido - opcional)
      if (cursoId) {
        const cursoSecundario = await prisma.curso.findFirst({
          where: {
            id: cursoId,
            ...filter
          },
          select: { id: true, nome: true }
        });

        if (!cursoSecundario) {
          throw new AppError('Curso não encontrado ou não pertence à sua instituição. Verifique se o curso está cadastrado corretamente.', 404);
        }
      }
    } else {
      // Para outros tipos acadêmicos ou quando tipo não está definido, validar campos opcionais se fornecidos
      // VALIDAÇÃO MULTI-TENANT: Verificar se curso existe e pertence à instituição (quando fornecido)
      if (cursoId) {
        const cursoOpcional = await prisma.curso.findFirst({
          where: {
            id: cursoId,
            ...filter
          },
          select: { id: true, nome: true }
        });

        if (!cursoOpcional) {
          throw new AppError('Curso não encontrado ou não pertence à sua instituição. Verifique se o curso está cadastrado corretamente.', 404);
        }
      }

      // VALIDAÇÃO MULTI-TENANT: Verificar se classe existe e pertence à instituição (quando fornecido)
      if (classeId) {
        const classeOpcional = await prisma.classe.findFirst({
          where: {
            id: classeId,
            ...filter
          },
          select: { id: true, nome: true }
        });

        if (!classeOpcional) {
          throw new AppError('Classe não encontrada ou não pertence à sua instituição. Verifique se a classe está cadastrada corretamente.', 404);
        }
      }
    }

    // Verificar se já existe um plano com a mesma chave (professor, disciplina, ano, turma)
    // Nova regra: um professor pode ter múltiplos planos para a mesma disciplina em turmas diferentes
    const existingByConstraint = await prisma.planoEnsino.findFirst({
      where: {
        instituicaoId,
        professorId: professorIdFinal,
        disciplinaId,
        anoLetivoId,
        turmaId: turmaId || null,
      },
    });

    if (existingByConstraint) {
      // Plano já existe para este professor+disciplina+ano+turma - retornar
      let avisoDiferenca: string | null = null;
      
      if (tipoAcademico === 'SUPERIOR') {
        if (semestre !== undefined && semestre !== null && existingByConstraint.semestre !== null && existingByConstraint.semestre !== semestre) {
          throw new AppError(
            `Já existe um plano para esta disciplina/ano no semestre ${existingByConstraint.semestre}. Use o plano existente ou crie para o semestre ${semestre}.`,
            409
          );
        }
        if (cursoId && existingByConstraint.cursoId && existingByConstraint.cursoId !== cursoId) {
          const cursoExistente = await prisma.curso.findFirst({
            where: { id: existingByConstraint.cursoId },
            select: { nome: true }
          });
          avisoDiferenca = `Plano vinculado ao curso "${cursoExistente?.nome || 'outro'}". Pode atualizar se necessário.`;
        }
      } else if (tipoAcademico === 'SECUNDARIO') {
        if (classeOuAno && existingByConstraint.classeOuAno && existingByConstraint.classeOuAno !== classeOuAno) {
          throw new AppError(
            `Já existe um plano para "${existingByConstraint.classeOuAno}". Use o plano existente ou crie para "${classeOuAno}".`,
            409
          );
        }
        if (classeId && existingByConstraint.classeId && existingByConstraint.classeId !== classeId) {
          const classeExistente = await prisma.classe.findFirst({
            where: { id: existingByConstraint.classeId },
            select: { nome: true }
          });
          avisoDiferenca = `Plano vinculado à classe "${classeExistente?.nome || 'outra'}". Pode atualizar se necessário.`;
        }
      }

      const plano = await prisma.planoEnsino.findFirst({
        where: { id: existingByConstraint.id, ...filter },
        include: {
          curso: { select: { id: true, nome: true, codigo: true } },
          classe: { select: { id: true, nome: true, codigo: true } },
          disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
          professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
          turma: { select: { id: true, nome: true } },
          aulas: { orderBy: { ordem: 'asc' } },
          bibliografias: true,
        },
      });
      
      if (!plano) {
        throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
      }
      
      const planoComAviso = plano as any;
      if (avisoDiferenca) planoComAviso._avisoDiferenca = avisoDiferenca;
      return res.json(planoComAviso);
    }

    // Buscar e validar disciplina (com filtro multi-tenant)
    // IMPORTANTE: Sempre aplicar filter para garantir multi-tenant
    // Filtrar apenas se instituicaoId não for null (Prisma não aceita null em StringFilter)
    const disciplinaWhere: any = { id: disciplinaId };
    if (filter.instituicaoId) {
      disciplinaWhere.instituicaoId = filter.instituicaoId;
    }
    const disciplina = await prisma.disciplina.findFirst({
      where: disciplinaWhere,
      select: { 
        cargaHoraria: true,
        nome: true,
      },
    });

    if (!disciplina) {
      throw new AppError('Disciplina não encontrada ou não pertence à sua instituição.', 404);
    }

    // VALIDAÇÃO SIGA/SIGAE: Verificar se disciplina está vinculada ao curso através de CursoDisciplina
    // REGRA MESTRA: Disciplina é institucional e pode pertencer a vários cursos via CursoDisciplina
    // ENSINO SUPERIOR: cursoId é OBRIGATÓRIO e disciplina DEVE estar vinculada ao curso
    if (tipoAcademico === 'SUPERIOR') {
      // Para Ensino Superior, cursoId é obrigatório (já validado acima)
      // Validar que disciplina está vinculada ao curso via CursoDisciplina
      if (cursoId) {
        const cursoDisciplina = await prisma.cursoDisciplina.findFirst({
          where: {
            cursoId,
            disciplinaId,
          },
        });

        if (!cursoDisciplina) {
          throw new AppError(
            `A disciplina "${disciplina.nome}" não está vinculada ao curso selecionado. ` +
            `Para criar um Plano de Ensino no Ensino Superior, a disciplina deve estar vinculada ao curso através de CursoDisciplina. ` +
            `Acesse o cadastro do curso e vincule a disciplina antes de continuar.`,
            400
          );
        }
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // ENSINO SECUNDÁRIO - Regras SIGA/SIGAE:
      // - classeId é OBRIGATÓRIO (já validado acima)
      // - cursoId é OPCIONAL (pode ser fornecido ou não)
      // - DISCIPLINA é ESTRUTURAL: não possui classeId nem semestre
      // - classeId pertence ao PlanoEnsino, não à Disciplina
      // - Validar vínculo via CursoDisciplina APENAS se cursoId for fornecido (opcional)
      if (cursoId) {
        const cursoDisciplina = await prisma.cursoDisciplina.findFirst({
          where: {
            cursoId,
            disciplinaId,
          },
        });

        if (!cursoDisciplina) {
          throw new AppError(
            `A disciplina "${disciplina.nome}" não está vinculada ao curso selecionado. ` +
            `Para criar um Plano de Ensino com curso no Ensino Secundário, a disciplina deve estar vinculada ao curso através de CursoDisciplina. ` +
            `Acesse o cadastro do curso e vincule a disciplina antes de continuar, ou remova o curso do plano.`,
            400
          );
        }
      }
      
      // DISCIPLINA é ESTRUTURAL: não possui classeId
      // classeId é informado no PlanoEnsino via classeId do body (já validado acima)
      // NÃO validar disciplina.classeId pois Disciplina não possui este campo
    }

    // VALIDAÇÃO MULTI-TENANT: Verificar se turma existe e pertence à instituição (quando fornecida)
    if (turmaId) {
      const turma = await prisma.turma.findFirst({
        where: {
          id: turmaId,
          ...filter
        },
        select: { id: true, nome: true }
      });

      if (!turma) {
        throw new AppError('Turma não encontrada ou não pertence à sua instituição. Verifique se a turma está cadastrada corretamente.', 404);
      }
    }

    // ============================================================
    // VALIDAÇÃO FINAL OBRIGATÓRIA: Garantir integridade referencial
    // ============================================================
    // Esta validação é CRÍTICA e DEVE ser executada SEMPRE antes de criar o plano
    // Ela garante que a constraint plano_ensino_professor_id_fkey não falhe
    // IMPORTANTE: Validar explicitamente usando findFirst com filtro multi-tenant
    // ============================================================
    
    console.log(`[createOrGetPlanoEnsino] 🔍 VALIDAÇÃO FINAL: Verificando professor antes de criar plano:`, {
      professorId: professorIdFinal,
      instituicaoId: instituicaoId,
      professorIdTipo: typeof professorIdFinal,
      professorIdLength: professorIdFinal?.length,
      origem: req.professor?.id ? 'middleware' : 'body',
    });

    // 1. Validar que professorIdFinal não está vazio
    if (!professorIdFinal || typeof professorIdFinal !== 'string' || professorIdFinal.trim() === '') {
      throw new AppError(
        `Professor inválido: O ID do professor não foi fornecido ou está vazio. ` +
        `Verifique se o professor foi selecionado corretamente no formulário.`,
        400
      );
    }

    // 2. Validar formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(professorIdFinal.trim())) {
      throw new AppError(
        `Professor inválido: O ID do professor não está no formato UUID válido. ` +
        `ID recebido: "${professorIdFinal.substring(0, 20)}...". ` +
        `Verifique se está usando professores.id (não users.id) no formulário. ` +
        `O frontend deve usar o campo "id" retornado pelo endpoint GET /professores (tabela professores).`,
        400
      );
    }

    // 3. Buscar professor na tabela professores com validação multi-tenant
    const professorFinalCheck = await prisma.professor.findFirst({
      where: {
        id: professorIdFinal.trim(),
        instituicaoId: instituicaoId, // CRÍTICO: Validar multi-tenant
      },
      select: { 
        id: true, 
        instituicaoId: true,
        userId: true,
      }
    });

    // 4. Validar que professor existe
    if (!professorFinalCheck) {
      // Log detalhado para debug
      console.error(`[createOrGetPlanoEnsino] ❌ ERRO DE INTEGRIDADE REFERENCIAL:`, {
        professorId: professorIdFinal,
        instituicaoId: instituicaoId,
        professorIdTipo: typeof professorIdFinal,
        professorIdLength: professorIdFinal.length,
        professorIdTrimmed: professorIdFinal.trim(),
      });

      // Verificar se professor existe em outra instituição (para mensagem mais útil)
      const professorOutraInstituicao = await prisma.professor.findUnique({
        where: { id: professorIdFinal.trim() },
        select: { id: true, instituicaoId: true }
      });

      if (professorOutraInstituicao) {
        throw new AppError(
          `Professor não pertence à sua instituição. ` +
          `O professor especificado (${professorIdFinal.substring(0, 8)}...) pertence a outra instituição. ` +
          `Verifique se está usando o professor correto da sua instituição.`,
          403
        );
      }

      // Verificar se é um users.id (para mensagem mais útil)
      const userCheck = await prisma.user.findUnique({
        where: { id: professorIdFinal.trim() },
        select: { id: true, email: true, nomeCompleto: true }
      });

      if (userCheck) {
        throw new AppError(
          `Erro de integridade referencial: O ID fornecido (${professorIdFinal.substring(0, 8)}...) é um users.id, não um professores.id. ` +
          `O frontend deve usar o campo "id" retornado pelo endpoint GET /professores (tabela professores). ` +
          `Verifique se o professor está cadastrado na tabela professores. Se não estiver, cadastre o professor antes de criar o Plano de Ensino.`,
          400
        );
      }

      throw new AppError(
        `Professor não encontrado: O professor especificado (${professorIdFinal.substring(0, 8)}...) não existe na tabela professores. ` +
        `Verifique se o professor está cadastrado corretamente e se está usando professores.id (não users.id) no formulário. ` +
        `O frontend deve usar o campo "id" retornado pelo endpoint GET /professores (tabela professores). ` +
        `Cadastre o professor antes de criar o Plano de Ensino.`,
        404
      );
    }

    // 5. Validação multi-tenant final (dupla verificação)
    if (professorFinalCheck.instituicaoId !== instituicaoId) {
      throw new AppError(
        `Falha ao criar Plano de Ensino: O professor não pertence à sua instituição. ` +
        `Professor pertence à instituição ${professorFinalCheck.instituicaoId}, mas você está autenticado na instituição ${instituicaoId}. ` +
        `Verifique se o professor está cadastrado corretamente na instituição atual.`,
        403
      );
    }

    console.log(`[createOrGetPlanoEnsino] ✅ VALIDAÇÃO FINAL APROVADA: Professor validado com sucesso:`, {
      professorId: professorFinalCheck.id,
      instituicaoId: professorFinalCheck.instituicaoId,
      userId: professorFinalCheck.userId,
    });

    // CORREÇÃO CRÍTICA: Usar o ID do professorFinalCheck validado (garantir consistência)
    // Isso garante que estamos usando exatamente o ID que foi validado no banco
    // IMPORTANTE: Normalizar o ID (trim e garantir que é string válida)
    const professorIdValidado = String(professorFinalCheck.id).trim();

    // DEBUG: Log final antes de criar o plano (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[createOrGetPlanoEnsino] Validação final antes de criar plano:', {
        professorIdFinal,
        professorIdValidado,
        saoIguais: professorIdFinal === professorIdValidado,
        professorIdFinalLength: professorIdFinal?.length,
        professorIdValidadoLength: professorIdValidado?.length,
        instituicaoId,
        professorFinalCheck: {
          id: professorFinalCheck.id,
          instituicaoId: professorFinalCheck.instituicaoId
        }
      });
    }

    // VERIFICAÇÃO FINAL ANTES DE CRIAR: Garantir que professor ainda existe (proteção contra race condition)
    const professorUltimaVerificacao = await prisma.professor.findUnique({
      where: { id: professorIdValidado },
      select: { id: true, instituicaoId: true }
    });

    if (!professorUltimaVerificacao) {
      throw new AppError(
        'Professor não encontrado no momento da criação do plano. O professor pode ter sido removido. Tente novamente.',
        404
      );
    }

    if (professorUltimaVerificacao.instituicaoId !== instituicaoId) {
      throw new AppError(
        'Professor não pertence à sua instituição. Verifique se o professor está cadastrado corretamente.',
        403
      );
    }

    // Criar novo plano
    // REGRA SIGA/SIGAE: cargaHorariaTotal sempre vem da Disciplina (sincronizado)
    // REGRA SIGA/SIGAE: cargaHorariaPlanejada inicia em 0 (será calculada automaticamente pela soma das aulas)
    // REGRA SIGA/SIGAE (OFICIAL): ADMIN cria e atribui Plano de Ensino
    // CORREÇÃO CRÍTICA: Usar professorIdValidado (do professorFinalCheck) para garantir integridade referencial
    const plano = await prisma.planoEnsino.create({
      data: {
        cursoId: cursoId || null,
        classeId: classeId || null,
        disciplinaId,
        professorId: professorUltimaVerificacao.id, // CORREÇÃO CRÍTICA: Usar ID da última verificação (garantir consistência FK)
        anoLetivo: anoLetivoFinal,
        anoLetivoId, // OBRIGATÓRIO
        turmaId: turmaId || null,
        cargaHorariaTotal: disciplina.cargaHoraria || 0, // SEMPRE da Disciplina (para compatibilidade com banco)
        cargaHorariaPlanejada: 0, // Inicia em 0, será calculada automaticamente pela soma das aulas
        semestre: tipoAcademico === 'SUPERIOR' ? semestre : null,
        ...(semestreIdValor && { semestreId: semestreIdValor }), // FK para Semestre (apenas Ensino Superior)
        classeOuAno: tipoAcademico === 'SECUNDARIO' ? classeOuAno : null,
        metodologia: metodologia || null,
        objetivos: objetivos || null,
        conteudoProgramatico: conteudoProgramatico || null,
        criteriosAvaliacao: criteriosAvaliacao || null,
        instituicaoId: instituicaoId,
      },
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
        professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
        turma: { select: { id: true, nome: true } },
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    // Auditoria: Log CREATE
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: plano.id,
      dadosNovos: plano,
    });

    // Enviar e-mail de atribuição de plano de ensino ao professor (não abortar se falhar)
    const planoComRelacoes = plano as any; // Type assertion para incluir relações do include
    const professorEmail = planoComRelacoes.professor?.user?.email;
    if (professorEmail) {
      try {
        const { EmailService } = await import('../services/email.service.js');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
        await EmailService.sendEmail(
          req,
          professorEmail,
          'PLANO_ENSINO_ATRIBUIDO',
          {
            nomeProfessor: planoComRelacoes.professor?.user?.nomeCompleto || 'Professor',
            disciplina: planoComRelacoes.disciplina?.nome || 'N/A',
            turma: planoComRelacoes.turma?.nome || 'N/A',
            curso: planoComRelacoes.curso?.nome || planoComRelacoes.classe?.nome || 'N/A',
            anoLetivo: planoComRelacoes.anoLetivo?.toString() || 'N/A',
            linkPlanoEnsino: `${frontendUrl}/plano-ensino/${planoComRelacoes.id}`,
          },
          {
            destinatarioNome: planoComRelacoes.professor?.user?.nomeCompleto || undefined,
            instituicaoId: instituicaoId || undefined,
          }
        );
      } catch (emailError: any) {
        // Log do erro mas não abortar criação de plano
        console.error('[createOrGetPlanoEnsino] Erro ao enviar e-mail (não crítico):', emailError.message);
      }
    }

    // Notificação interna: Professor atribuído a Plano de Ensino
    if (plano.professorId) {
      try {
        const { NotificacaoService } = await import('../services/notificacao.service.js');
        await NotificacaoService.notificarProfessorAtribuido(
          req,
          plano.professorId,
          planoComRelacoes.disciplina?.nome || 'N/A',
          planoComRelacoes.turma?.nome || 'N/A',
          instituicaoId
        );
      } catch (notifError: any) {
        // Não bloquear se notificação falhar
        console.error('[createOrGetPlanoEnsino] Erro ao criar notificação (não crítico):', notifError.message);
      }
    }

    res.status(201).json(plano);
  } catch (error: any) {
    // Tratar erros de constraint do Prisma especificamente
    // Erros de foreign key constraint geralmente vêm com código P2003
    if (error?.code === 'P2003' || error?.code === '23503') {
      // Erro de foreign key constraint
      const fieldName = error?.meta?.field_name || error?.meta?.target?.[0] || 'campo';
      
      // Verificar se é erro relacionado a professor_id
      if (fieldName.includes('professor') || fieldName.includes('professor_id')) {
        throw new AppError(
          'Falha ao criar/atualizar registro. O campo "professor_id" referencia um registro que não existe ou não pertence à sua instituição. ' +
          'Verifique se o professor está cadastrado corretamente e possui role PROFESSOR. ' +
          'Se o problema persistir, contacte o administrador do sistema.',
          400
        );
      }
      
      // Erro genérico de foreign key
      throw new AppError(
        `Falha ao criar/atualizar registro. O campo "${fieldName}" referencia um registro que não existe ou não pertence à sua instituição. ` +
        'Verifique se todos os dados relacionados (curso, classe, disciplina, professor, turma, ano letivo) estão cadastrados corretamente.',
        400
      );
    }
    
    // Se já é AppError, propagar
    if (error instanceof AppError) {
      return next(error);
    }
    
    // Outros erros
    next(error);
  }
};

/**
 * Buscar contexto para criação de Plano de Ensino
 * Retorna: Cursos, Disciplinas, Professores, Anos Letivos ativos, Semestres OU Classes
 * REGRA SIGA/SIGAE: 
 * - ENSINO_SUPERIOR: retorna Cursos e Semestres
 * - ENSINO_SECUNDARIO: retorna Classes
 * - Disciplinas e Professores: retornados sempre (não dependem de Ano Letivo)
 */
export const getContextoPlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId || 'unknown';
    const role = req.user?.roles?.[0] || 'unknown';
    
    // Log de diagnóstico
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getContextoPlanoEnsino]', {
        instituicaoId,
        userId,
        role,
        route: `${req.method} ${req.path}`,
      });
    }
    
    const filter = addInstitutionFilter(req);
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;

    if (!tipoAcademico) {
      throw new AppError('Tipo de instituição não identificado. Configure o tipo acadêmico da instituição (ENSINO_SUPERIOR ou ENSINO_SECUNDARIO) antes de continuar.', 400);
    }

    // Buscar cursos (apenas Ensino Superior)
    const cursos = tipoAcademico === 'SUPERIOR' 
      ? await prisma.curso.findMany({
          where: {
            ...filter,
            OR: [
              { tipo: { not: 'classe' } },
              { tipo: null }
            ]
          },
          select: { id: true, nome: true, codigo: true },
          orderBy: { nome: 'asc' }
        })
      : [];

    // Buscar classes (apenas Ensino Secundário)
    const classes = tipoAcademico === 'SECUNDARIO'
      ? await prisma.classe.findMany({
          where: filter,
          select: { id: true, nome: true, codigo: true },
          orderBy: { nome: 'asc' }
        })
      : [];

    // Buscar disciplinas (filtradas por tipoInstituicao)
    // REGRA MESTRA SIGA/SIGAE: Disciplina NÃO depende de Ano Letivo, retornar todas as disciplinas válidas
    // NOVO MODELO: Disciplina é institucional e pode pertencer a vários cursos via CursoDisciplina
    let disciplinas: any[] = [];
    
    // NOVO MODELO: Sempre buscar disciplinas via CursoDisciplina (removida lógica legacy)
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: buscar disciplinas que estão vinculadas a cursos via CursoDisciplina
      const disciplinasVinculadas = await (prisma as any).cursoDisciplina.findMany({
        where: {
          curso: {
            ...filter,
            OR: [
              { tipo: { not: 'classe' } },
              { tipo: null }
            ]
          }
        },
        include: {
          disciplina: {
            select: { id: true, nome: true, cargaHoraria: true }
            // cursoId removido: Disciplina é estrutural, não possui cursoId direto
          }
        },
        distinct: ['disciplinaId']
      });
      
      disciplinas = disciplinasVinculadas.map((v: any) => v.disciplina);
    } else if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: buscar disciplinas vinculadas a cursos via CursoDisciplina
      const disciplinasVinculadas = await (prisma as any).cursoDisciplina.findMany({
        where: {
          curso: filter
        },
        include: {
          disciplina: {
            select: { id: true, nome: true, cargaHoraria: true }
            // cursoId removido: Disciplina é estrutural, não possui cursoId direto
          }
        },
        distinct: ['disciplinaId']
      });
      
      disciplinas = disciplinasVinculadas.map((v: any) => v.disciplina);
    } else {
      // Fallback: buscar todas as disciplinas da instituição (sem filtro de curso)
      const whereFilter: any = {};
      if (filter.instituicaoId && typeof filter.instituicaoId === 'string') {
        whereFilter.instituicaoId = filter.instituicaoId;
      }
      disciplinas = await prisma.disciplina.findMany({
        where: whereFilter,
        select: { id: true, nome: true, cargaHoraria: true }
        // cursoId removido: Disciplina é estrutural, não possui cursoId direto
      });
    }
    
    // Ordenar e remover duplicatas
    disciplinas = disciplinas
      .filter((d: any, index: number, self: any[]) => index === self.findIndex((t: any) => t.id === d.id))
      .sort((a: any, b: any) => a.nome.localeCompare(b.nome));

    // Buscar professores ativos
    // REGRA MESTRA SIGA/SIGAE: Professor NÃO depende de Ano Letivo, retornar todos os professores ativos
    // CORREÇÃO CRÍTICA: Buscar da tabela professores (entidade acadêmica), não de users
    // Professor é entidade acadêmica institucional, não apenas role de usuário
    const instituicaoIdParaProfessores = filter.instituicaoId || instituicaoId;
    
    if (!instituicaoIdParaProfessores) {
      throw new AppError('Instituição não identificada', 400);
    }
    
    // NÃO filtrar por user.roles (role PROFESSOR) - presença na tabela professores é a fonte da verdade
    const professores = await prisma.professor.findMany({
      where: {
        instituicaoId: instituicaoIdParaProfessores,
        user: {
          OR: [
            { statusAluno: null },
            { statusAluno: 'Ativo' },
            { statusAluno: { notIn: ['Inativo', 'Inativo por inadimplência'] } }
          ]
        }
      },
      include: {
        user: {
          select: { 
            id: true, 
            nomeCompleto: true, 
            email: true 
          }
        }
      },
      orderBy: {
        user: {
          nomeCompleto: 'asc'
        }
      }
    });

    // Mapear para formato esperado (professor.id e dados do user)
    const professoresFormatados = professores.map(p => ({
      id: p.id, // professores.id (entidade acadêmica)
      userId: p.userId, // users.id (referência)
      nomeCompleto: p.user.nomeCompleto,
      email: p.user.email
    }));

    // Buscar anos letivos ativos
    // REGRA MESTRA: Ano Letivo é OBRIGATÓRIO para Plano de Ensino
    const anosLetivos = await prisma.anoLetivo.findMany({
      where: {
        ...filter,
        status: 'ATIVO'
      },
      select: { 
        id: true, 
        ano: true, 
        dataInicio: true, 
        dataFim: true 
      },
      orderBy: { ano: 'desc' }
    });

    // Buscar semestres (APENAS Ensino Superior) - dos anos letivos ativos
    // CRÍTICO: NUNCA retornar semestres para Ensino Secundário
    const semestres = tipoAcademico === 'SUPERIOR' && anosLetivos.length > 0
      ? await prisma.semestre.findMany({
          where: {
            ...filter,
            anoLetivoId: { in: anosLetivos.map(al => al.id) }
          },
          select: { 
            id: true, 
            numero: true, 
            anoLetivoId: true, 
            dataInicio: true, 
            dataFim: true,
            status: true
          },
          orderBy: [
            { anoLetivoId: 'asc' },
            { numero: 'asc' }
          ]
        })
      : [];

    // Buscar trimestres (APENAS Ensino Secundário) - dos anos letivos ativos
    // CRÍTICO: NUNCA retornar trimestres para Ensino Superior
    const trimestres = tipoAcademico === 'SECUNDARIO' && anosLetivos.length > 0
      ? await prisma.trimestre.findMany({
          where: {
            ...filter,
            anoLetivoId: { in: anosLetivos.map(al => al.id) }
          },
          select: { 
            id: true, 
            numero: true, 
            anoLetivoId: true, 
            dataInicio: true, 
            dataFim: true,
            status: true
          },
          orderBy: [
            { anoLetivoId: 'asc' },
            { numero: 'asc' }
          ]
        })
      : [];

    // CRÍTICO: Garantir que apenas o período correto seja retornado baseado no tipo de instituição
    const response = {
      tipoInstituicao: tipoAcademico,
      cursos,
      classes,
      disciplinas,
      professores: professoresFormatados, // Usar professores formatados (da tabela professores)
      anosLetivos,
      // ENSINO_SUPERIOR: retorna apenas semestres (trimestres = [])
      // ENSINO_SECUNDARIO: retorna apenas trimestres (semestres = [])
      semestres: tipoAcademico === 'SUPERIOR' ? semestres : [],
      trimestres: tipoAcademico === 'SECUNDARIO' ? trimestres : []
    };
    
    // Log de sucesso
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getContextoPlanoEnsino] Sucesso', {
        instituicaoId,
        userId,
        tipoInstituicao: tipoAcademico,
        cursosCount: cursos.length,
        classesCount: classes.length,
        disciplinasCount: disciplinas.length,
        professoresCount: professoresFormatados.length,
        anosLetivosCount: anosLetivos.length,
        // CRÍTICO: Log apenas do período correto baseado no tipo de instituição
        semestresCount: tipoAcademico === 'SUPERIOR' ? response.semestres.length : 0,
        trimestresCount: tipoAcademico === 'SECUNDARIO' ? response.trimestres.length : 0,
      });
    }
    
    res.json(response);
  } catch (error) {
    // Log de erro
    if (process.env.NODE_ENV !== 'production') {
      console.error('[getContextoPlanoEnsino] Erro', {
        instituicaoId: req.user?.instituicaoId || 'unknown',
        userId: req.user?.userId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        route: `${req.method} ${req.path}`,
      });
    }
    next(error);
  }
};

/**
 * Buscar plano de ensino por contexto
 */
export const getPlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { cursoId, classeId, disciplinaId, professorId, anoLetivo, anoLetivoId, turmaId, semestre, classeOuAno } = req.query;

    // REGRA: Permite buscar por turmaId diretamente (novo padrão)
    // Se turmaId for fornecido, buscar planos de ensino daquela turma
    if (turmaId && !disciplinaId && !professorId && !anoLetivoId && !anoLetivo) {
      const filter = addInstitutionFilter(req);
      const planos = await prisma.planoEnsino.findMany({
        where: {
          turmaId: String(turmaId),
          ...filter,
        },
        include: {
          curso: { select: { id: true, nome: true, codigo: true } },
          classe: { select: { id: true, nome: true, codigo: true } },
          disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
          professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
          turma: { select: { id: true, nome: true } },
          aulas: { orderBy: { ordem: 'asc' } },
          bibliografias: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      return res.json(planos.length === 1 ? planos[0] : planos);
    }

    // Obter informações do usuário ANTES das validações (necessário para verificar permissões)
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const isProfessor = req.user?.roles?.includes('PROFESSOR');
    const isAluno = req.user?.roles?.includes('ALUNO');
    const userId = req.user?.userId;

    // REGRA ARQUITETURAL SIGA/SIGAE (OPÇÃO B): Se for professor, usar req.professor.id do middleware
    // REGRA ABSOLUTA: professorId no banco é professores.id, não users.id
    let professorIdFinal: string | undefined = undefined;
    
    if (isProfessor) {
      // REGRA ABSOLUTA: Professor só pode ver seus próprios planos
      // Usar req.professor.id do middleware (já validado multi-tenant)
      if (!req.professor) {
        // Se professor não foi encontrado na tabela professores, retornar array vazio
        // Isso pode acontecer se o professor ainda não foi cadastrado na tabela professores
        console.warn('[getPlanoEnsino] Professor com role PROFESSOR mas não encontrado na tabela professores. Retornando array vazio.');
        return res.json([]);
      }
      professorIdFinal = req.professor.id; // professores.id
      
      // Se professor tentar especificar outro professorId no query, bloquear
      if (professorId && String(professorId) !== professorIdFinal) {
        throw new AppError('Acesso negado: você só pode visualizar seus próprios planos de ensino', 403);
      }
    } else if (professorId) {
      // Admin ou outro usuário buscando planos de um professor específico
      // REGRA ARQUITETURAL FINAL: Aceitar APENAS professores.id (NUNCA users.id)
      try {
        const { validateProfessorId } = await import('../utils/professorResolver.js');
        const professorIdString = String(professorId).trim();
        
        // Validar que professorId é um professores.id válido
        const isValidProfessorId = await validateProfessorId(professorIdString, instituicaoId);
        
        if (!isValidProfessorId) {
          throw new AppError(
            'Professor não cadastrado na instituição (professores). Use o campo "id" retornado por GET /professores.',
            400
          );
        }
        
        professorIdFinal = professorIdString;
      } catch (error: any) {
        // Se erro na importação ou validação, propagar erro apropriado
        if (error instanceof AppError) {
          throw error;
        }
        console.error('[getPlanoEnsino] Erro ao validar professorId:', error);
        throw new AppError('Erro ao validar professor. Tente novamente.', 500);
      }
    }

    // Validar: precisa de professorId OU anoLetivoId (para listar todos os planos de um ano letivo)
    // EXCEÇÃO: Se for professor buscando seus próprios planos, permitir buscar apenas por professorId
    if (!professorIdFinal && !anoLetivoId && !turmaId) {
      throw new AppError('Professor, Ano Letivo ou Turma é obrigatório', 400);
    }

    // Validar: precisa de anoLetivo OU anoLetivoId (pelo menos um) - exceto se buscar por turmaId
    // EXCEÇÃO: Se for professor buscando seus próprios planos (apenas professorId), não exigir anoLetivo
    // Isso permite que o professor veja todos os seus planos independente do ano letivo
    if (!anoLetivo && !anoLetivoId && !turmaId && !(isProfessor && professorIdFinal)) {
      throw new AppError('Ano Letivo é obrigatório (informe anoLetivo ou anoLetivoId)', 400);
    }

    // Se recebeu anoLetivoId, buscar o ano letivo para obter o número do ano
    let anoLetivoFinal: number | undefined;
    let anoLetivoIdFinal: string | undefined;

    if (anoLetivoId) {
      const anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: {
          id: anoLetivoId as string,
          ...filter,
        },
      });

      if (!anoLetivoRecord) {
        throw new AppError('Ano letivo não encontrado', 404);
      }

      anoLetivoFinal = anoLetivoRecord.ano;
      anoLetivoIdFinal = anoLetivoRecord.id;
    } else if (anoLetivo) {
      anoLetivoFinal = Number(anoLetivo);
      // Buscar anoLetivoId pelo número do ano
      const anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: {
          ano: Number(anoLetivo),
          ...filter,
        },
      });
      if (anoLetivoRecord) {
        anoLetivoIdFinal = anoLetivoRecord.id;
      }
    }

    // Se for aluno, verificar se está matriculado na disciplina/turma (apenas se disciplinaId for fornecido)
    if (isAluno && userId && anoLetivoFinal && disciplinaId) {
      // Verificar se aluno está matriculado na disciplina
      const alunoDisciplina = await prisma.alunoDisciplina.findFirst({
        where: {
          alunoId: userId,
          disciplinaId: String(disciplinaId),
          ano: anoLetivoFinal,
          status: { in: ['MATRICULADO', 'CURSANDO'] },
        },
      });

      if (!alunoDisciplina) {
        throw new AppError('Acesso negado: você não está matriculado nesta disciplina', 403);
      }
    }

    const where: any = {
      ...(professorIdFinal && { professorId: professorIdFinal }),
      ...(anoLetivoFinal !== undefined && { anoLetivo: anoLetivoFinal }),
      ...(anoLetivoIdFinal && { anoLetivoId: anoLetivoIdFinal }),
      ...filter,
    };

    // Adicionar filtros opcionais apenas se fornecidos
    // IMPORTANTE: Para busca específica (disciplinaId + professorId), ser mais flexível com cursoId/classeId
    // pois podem ser null no banco e não devem impedir a busca
    if (disciplinaId) {
      where.disciplinaId = String(disciplinaId);
    }
    
    // cursoId: filtrar apenas se fornecido explicitamente
    // Se não fornecido, não filtrar (permite encontrar planos com cursoId null ou qualquer cursoId)
    if (cursoId !== undefined && cursoId !== null && cursoId !== '') {
      where.cursoId = String(cursoId);
    }
    
    // classeId: filtrar apenas se fornecido explicitamente
    // Se não fornecido, não filtrar (permite encontrar planos com classeId null ou qualquer classeId)
    if (classeId !== undefined && classeId !== null && classeId !== '') {
      where.classeId = String(classeId);
    }
    
    // turmaId: filtrar apenas se fornecido explicitamente
    // Se não fornecido, não filtrar (permite encontrar planos com turmaId null ou qualquer turmaId)
    if (turmaId !== undefined && turmaId !== null && turmaId !== '') {
      where.turmaId = String(turmaId);
    }
    
    // Adicionar filtro por semestre (Ensino Superior) - importante para distinguir planos do mesmo contexto
    if (semestre !== undefined && semestre !== null && semestre !== '') {
      where.semestre = Number(semestre);
    }
    
    // Adicionar filtro por classeOuAno (Ensino Secundário) - importante para distinguir planos do mesmo contexto
    if (classeOuAno !== undefined && classeOuAno !== null && classeOuAno !== '') {
      where.classeOuAno = String(classeOuAno);
    }

    // REGRA ARQUITETURAL SIGA/SIGAE: Plano de Ensino SEMPRE aparece no painel do professor
    // Estado controla AÇÃO, NÃO visibilidade
    // RASCUNHO / EM_REVISAO aparecem (bloqueados)
    // APROVADO aparece (ativo)
    // ENCERRADO aparece (somente leitura)
    // NUNCA filtrar planos por estado na query - todos os planos são visíveis
    // ALUNO: pode ver apenas planos APROVADOS (regra específica para alunos)
    if (isAluno) {
      // Alunos só veem planos aprovados
      where.estado = 'APROVADO';
      where.bloqueado = false;
    }
    // PROFESSOR: vê TODOS os seus planos (qualquer estado)

    // Se disciplinaId E professorId foram fornecidos, retornar um único plano (compatibilidade com código existente)
    if (disciplinaId && professorIdFinal) {
      // Primeiro, tentar buscar com todos os filtros (incluindo cursoId/classeId se fornecidos)
      let plano = await prisma.planoEnsino.findFirst({
        where,
        include: {
          curso: { select: { id: true, nome: true, codigo: true } },
          classe: { select: { id: true, nome: true, codigo: true } },
          disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
          professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
          turma: { select: { id: true, nome: true } },
          aulas: { orderBy: { ordem: 'asc' } },
          bibliografias: true,
        },
      });

      // Se não encontrou, tentar buscar sem cursoId/classeId (NUNCA turmaId)
      // REGRA MULTI-TURMA: Quando turmaId é fornecido e não há plano para essa turma, retornar null
      // (permitir criar novo plano para a turma selecionada). Não buscar plano de outra turma.
      if (!plano && (cursoId || classeId) && !(turmaId && turmaId !== '')) {
        const whereFlexivel: any = {
          ...(professorIdFinal && { professorId: professorIdFinal }),
          ...(anoLetivoFinal !== undefined && { anoLetivo: anoLetivoFinal }),
          ...(anoLetivoIdFinal && { anoLetivoId: anoLetivoIdFinal }),
          disciplinaId: String(disciplinaId),
          ...filter,
        };
        
        // Manter filtros de semestre e classeOuAno (são importantes para distinguir planos)
        if (semestre !== undefined && semestre !== null && semestre !== '') {
          whereFlexivel.semestre = Number(semestre);
        }
        if (classeOuAno !== undefined && classeOuAno !== null && classeOuAno !== '') {
          whereFlexivel.classeOuAno = String(classeOuAno);
        }
        
        // REGRA ABSOLUTA: Plano de Ensino SEMPRE aparece no painel do professor
        // Estado controla AÇÃO, NÃO visibilidade
        // RASCUNHO / EM_REVISAO aparecem (bloqueados)
        // APROVADO aparece (ativo)
        // ENCERRADO aparece (somente leitura)
        // NUNCA filtrar planos por estado na query para professores
        // ALUNO: pode ver apenas planos APROVADOS (regra específica para alunos)
        if (isAluno) {
          // Alunos só veem planos aprovados
          whereFlexivel.estado = 'APROVADO';
          whereFlexivel.bloqueado = false;
        }
        // PROFESSOR: vê TODOS os seus planos (qualquer estado) - NÃO aplicar filtro de estado
        
        plano = await prisma.planoEnsino.findFirst({
          where: whereFlexivel,
          include: {
            curso: { select: { id: true, nome: true, codigo: true } },
            classe: { select: { id: true, nome: true, codigo: true } },
            disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
            professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
            turma: { select: { id: true, nome: true } },
            aulas: { orderBy: { ordem: 'asc' } },
            bibliografias: true,
          },
        });
        
        // Se encontrou um plano com cursoId/classeId/turmaId diferente, adicionar aviso
        if (plano) {
          const planoComAviso = plano as any;
          if (cursoId && plano.cursoId && plano.cursoId !== cursoId) {
            planoComAviso._avisoDiferenca = `Este plano está vinculado ao curso "${plano.curso?.nome || 'outro curso'}". ` +
              `Você pode usar este plano existente ou atualizar o curso se necessário.`;
          } else if (classeId && plano.classeId && plano.classeId !== classeId) {
            planoComAviso._avisoDiferenca = `Este plano está vinculado à classe "${plano.classe?.nome || 'outra classe'}". ` +
              `Você pode usar este plano existente ou atualizar a classe se necessário.`;
          } else if (turmaId && plano.turmaId && plano.turmaId !== turmaId) {
            planoComAviso._avisoDiferenca = `Este plano está vinculado à turma "${plano.turma?.nome || 'outra turma'}". ` +
              `Você pode usar este plano existente ou atualizar a turma se necessário.`;
          }
          return res.json(planoComAviso);
        }
      }

      if (!plano) {
        return res.json(null);
      }

      return res.json(plano);
    }

    // Se disciplinaId não foi fornecido, retornar lista de planos
    const planos = await prisma.planoEnsino.findMany({
      where,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
        professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
        turma: { select: { id: true, nome: true } },
      },
      orderBy: [
        { disciplina: { nome: 'asc' } },
        { semestre: 'asc' },
      ],
    });

    res.json(planos);
  } catch (error) {
    next(error);
  }
};

/**
 * Calcular estatísticas de carga horária
 * REGRA SIGA/SIGAE: cargaHorariaExigida SEMPRE vem da Disciplina
 * REGRA SIGA/SIGAE: cargaHorariaPlanejada = soma(aulas.quantidadeAulas)
 * 
 * Esta função é a FONTE DA VERDADE para cálculos de carga horária.
 * Backend é sempre a fonte da verdade - frontend apenas exibe.
 */
export const getCargaHorariaStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        disciplina: { select: { cargaHoraria: true } },
        instituicao: { select: { tipoAcademico: true } },
        aulas: true,
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // REGRA SIGA/SIGAE: Carga horária exigida SEMPRE vem da Disciplina (FONTE DA VERDADE)
    const totalExigido = plano.disciplina.cargaHoraria || 0;
    
    // REGRA SIGA/SIGAE: Carga horária planejada = soma das durações das aulas
    // IMPORTANTE: Recalcular sempre para garantir sincronização
    const totalPlanejado = plano.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0);
    
    // Sincronizar cargaHorariaPlanejada no banco (caso esteja desatualizada)
    if (plano.cargaHorariaPlanejada !== totalPlanejado) {
      await prisma.planoEnsino.update({
        where: { id: planoEnsinoId },
        data: { cargaHorariaPlanejada: totalPlanejado }
      });
    }
    
    // Total ministrado = soma das aulas já ministradas
    const totalMinistrado = plano.aulas
      .filter((aula) => aula.status === 'MINISTRADA')
      .reduce((sum, aula) => sum + aula.quantidadeAulas, 0);
    
    const diferenca = totalExigido - totalPlanejado;

    // Duração da hora-aula: 45 min (Secundário) | 60 min (Superior)
    const { getDuracaoHoraAulaMinutos, formatarUnidadeHoraAula } = await import('../utils/duracaoHoraAula.js');
    const tipoAcademico = (plano as any).instituicao?.tipoAcademico || null;
    const duracaoHoraAulaMinutos = await getDuracaoHoraAulaMinutos(instituicaoId, tipoAcademico);
    const unidadeHoraAula = formatarUnidadeHoraAula(duracaoHoraAulaMinutos);

    res.json({
      cargaHorariaExigida: totalExigido, // Alias para compatibilidade
      totalExigido, // Mantido para compatibilidade
      cargaHorariaPlanejada: totalPlanejado, // Alias para compatibilidade
      totalPlanejado, // Mantido para compatibilidade
      totalMinistrado,
      diferenca,
      status: diferenca === 0 ? 'ok' : diferenca > 0 ? 'faltando' : 'excedente',
      // Profissional: unidade da hora-aula conforme tipo de ensino
      duracaoHoraAulaMinutos,
      unidadeHoraAula,
      tipoAcademico,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Obter carga horária detalhada do plano de ensino
 * REGRA SIGA/SIGAE: cargaHorariaExigida SEMPRE vem da Disciplina
 * REGRA SIGA/SIGAE: cargaHorariaPlanejada = soma(aulas.quantidadeAulas)
 * REGRA SIGA/SIGAE: cargaHorariaExecutada = soma(aulasLancadas.duracaoMinutos) convertida para horas
 * 
 * Retorna informações detalhadas sobre carga horária para exibição no frontend
 */
export const getCargaHoraria = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId || 'unknown';
    const role = req.user?.roles?.[0] || 'unknown';

    // Log de diagnóstico
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getCargaHoraria] Request', {
        planoEnsinoId,
        instituicaoId,
        userId,
        role,
        route: `${req.method} ${req.path}`,
      });
    }

    const filter = addInstitutionFilter(req);

    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        disciplina: { select: { cargaHoraria: true } },
        instituicao: { select: { tipoAcademico: true } },
        aulas: {
          include: {
            aulasLancadas: {
              select: {
                cargaHoraria: true,
              },
            },
          },
        },
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // Type assertion para garantir tipos corretos
    const planoComAulas = plano as any;

    // REGRA SIGA/SIGAE: Carga horária exigida SEMPRE vem da Disciplina (FONTE DA VERDADE)
    const exigida = planoComAulas.disciplina?.cargaHoraria || 0;
    
    // REGRA SIGA/SIGAE: Carga horária planejada = soma das quantidades de aulas planejadas
    const planejada = (planoComAulas.aulas || []).reduce((sum: number, aula: any) => sum + (aula.quantidadeAulas || 0), 0);
    
    // REGRA SIGA/SIGAE: Carga horária executada = soma das cargas horárias das aulas lançadas
    const executada = (planoComAulas.aulas || []).reduce((sum: number, aula: any) => {
      const horasAulasLancadas = (aula.aulasLancadas || []).reduce((sumLancada: number, aulaLancada: any) => {
        return sumLancada + (aulaLancada.cargaHoraria || 0);
      }, 0);
      return sum + horasAulasLancadas;
    }, 0);
    
    // Sincronizar cargaHorariaPlanejada no banco (caso esteja desatualizada)
    if (plano.cargaHorariaPlanejada !== planejada) {
      await prisma.planoEnsino.update({
        where: { id: planoEnsinoId },
        data: { cargaHorariaPlanejada: planejada }
      });
    }
    
    const diferencaExigidaPlanejada = exigida - planejada;
    const diferencaExigidaExecutada = exigida - executada;
    
    // Determinar status
    let status: 'INCOMPLETO' | 'OK' | 'EXCEDENTE';
    if (executada < exigida) {
      status = 'INCOMPLETO';
    } else if (executada === exigida) {
      status = 'OK';
    } else {
      status = 'EXCEDENTE';
    }

    const { getDuracaoHoraAulaMinutos, formatarUnidadeHoraAula } = await import('../utils/duracaoHoraAula.js');
    const tipoAcademico = (plano as any).instituicao?.tipoAcademico || null;
    const duracaoHoraAulaMinutos = await getDuracaoHoraAulaMinutos(instituicaoId, tipoAcademico);

    const response = {
      exigida,
      planejada,
      executada,
      diferencaExigidaPlanejada,
      diferencaExigidaExecutada,
      status,
      duracaoHoraAulaMinutos,
      unidadeHoraAula: formatarUnidadeHoraAula(duracaoHoraAulaMinutos),
      tipoAcademico,
    };

    // Log de sucesso
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getCargaHoraria] Sucesso', {
        planoEnsinoId,
        instituicaoId,
        userId,
        ...response,
      });
    }

    res.json(response);
  } catch (error) {
    // Log de erro
    if (process.env.NODE_ENV !== 'production') {
      console.error('[getCargaHoraria] Erro', {
        planoEnsinoId: req.params.planoEnsinoId,
        instituicaoId: req.user?.instituicaoId || 'unknown',
        userId: req.user?.userId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        route: `${req.method} ${req.path}`,
      });
    }
    next(error);
  }
};

/**
 * Criar aula planejada
 */
export const createAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    // REGRA SIGA/SIGAE: trimestre/semestre NÃO vem do body - é herdado do Plano de Ensino
    const { titulo, descricao, tipo, quantidadeAulas, trimestre, semestre } = req.body;
    const instituicaoId = requireTenantScope(req);
    const userId = req.user?.userId || 'unknown';
    const role = req.user?.roles?.[0] || 'unknown';

    // REGRA SIGA/SIGAE: Rejeitar explicitamente se trimestre/semestre for enviado no body
    if (trimestre !== undefined || semestre !== undefined) {
      throw new AppError('Período acadêmico (semestre/trimestre) não deve ser enviado. Ele é herdado automaticamente do Plano de Ensino.', 400);
    }

    // Log de diagnóstico
    if (process.env.NODE_ENV !== 'production') {
      console.log('[createAula] Request', {
        planoEnsinoId,
        instituicaoId,
        userId,
        role,
        titulo,
        quantidadeAulas,
        route: `${req.method} ${req.path}`,
      });
    }

    // REGRA SIGA/SIGAE: Validar apenas título e quantidade - período é herdado do plano
    if (!titulo || !titulo.trim()) {
      throw new AppError('Título é obrigatório', 400);
    }
    if (!quantidadeAulas || Number(quantidadeAulas) <= 0) {
      throw new AppError('Quantidade de Aulas é obrigatória e deve ser maior que zero', 400);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar plano
    await validarPermissaoPlanoEnsino(req, planoEnsinoId);

    const filter = addInstitutionFilter(req);

    // Verificar se plano existe e não está bloqueado
    // IMPORTANTE: Buscar plano com semestre/classeOuAno para herdar período
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        instituicao: {
          select: { tipoAcademico: true }
        }
      }
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado ou não pertence à sua instituição', 404);
    }

    // REGRA SIGA/SIGAE: Aula herda período (semestre/trimestre) automaticamente do Plano de Ensino
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), com fallback para plano.instituicao
    const tipoAcademico = req.user?.tipoAcademico || plano.instituicao?.tipoAcademico || null;
    let periodoNumero: number | null = null;
    
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: herdar semestre do plano
      if (plano.semestre !== null && plano.semestre !== undefined) {
        periodoNumero = Number(plano.semestre);
        
        // VALIDAÇÃO: Verificar se semestre existe no banco (validação de integridade)
        if (plano.anoLetivoId) {
          const semestreExiste = await prisma.semestre.findFirst({
            where: {
              anoLetivoId: plano.anoLetivoId,
              numero: periodoNumero,
              instituicaoId,
            },
          });
          
          if (!semestreExiste) {
            throw new AppError(`O plano de ensino está vinculado ao semestre ${periodoNumero}, mas este semestre não existe no banco de dados. Acesse Configuração de Ensino → Semestres para criar o semestre necessário.`, 400);
          }
        }
      } else {
        throw new AppError('Plano de ensino não possui semestre definido. Configure o semestre no plano de ensino antes de criar aulas.', 400);
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // Ensino Secundário: buscar primeiro trimestre ativo do ano letivo
      // REGRA SIGA/SIGAE: Aula herda trimestre do contexto do ano letivo
      if (plano.anoLetivoId) {
        const primeiroTrimestre = await prisma.trimestre.findFirst({
          where: {
            anoLetivoId: plano.anoLetivoId,
            instituicaoId,
            status: 'ATIVO', // Buscar trimestre ativo
          },
          orderBy: { numero: 'asc' }, // Ordenar por número (1, 2, 3)
        });
        
        if (primeiroTrimestre) {
          periodoNumero = primeiroTrimestre.numero;
        } else {
          // Se não houver trimestre ativo, buscar qualquer trimestre do ano letivo
          const qualquerTrimestre = await prisma.trimestre.findFirst({
            where: {
              anoLetivoId: plano.anoLetivoId,
              instituicaoId,
            },
            orderBy: { numero: 'asc' },
          });
          
          if (qualquerTrimestre) {
            periodoNumero = qualquerTrimestre.numero;
          } else {
            // Se não houver trimestres cadastrados, usar padrão 1
            periodoNumero = 1;
          }
        }
      } else {
        // Se não houver anoLetivoId, usar padrão 1
        periodoNumero = 1;
      }
    } else {
      throw new AppError('Tipo de instituição não identificado. Configure o tipo acadêmico da instituição antes de criar aulas.', 400);
    }
    
    if (periodoNumero === null || periodoNumero <= 0) {
      throw new AppError('Não foi possível determinar o período acadêmico do plano de ensino. Verifique se o plano está configurado corretamente.', 400);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir criar aula se estado = ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', planoEnsinoId, filter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    // Buscar maior ordem atual
    const ultimaAula = await prisma.planoAula.findFirst({
      where: { planoEnsinoId },
      orderBy: { ordem: 'desc' },
    });

    const novaOrdem = ultimaAula ? ultimaAula.ordem + 1 : 1;

    // REGRA SIGA/SIGAE: Aula herda período (semestre/trimestre) automaticamente do Plano de Ensino
    const aula = await prisma.planoAula.create({
      data: {
        planoEnsinoId,
        ordem: novaOrdem,
        titulo,
        descricao: descricao || null,
        tipo: tipo || 'TEORICA',
        trimestre: periodoNumero, // Herdado do plano (semestre para Superior, trimestre para Secundário)
        quantidadeAulas: Number(quantidadeAulas),
        status: 'PLANEJADA',
      },
    });

    // REGRA SIGA/SIGAE: Recalcular cargaHorariaPlanejada automaticamente
    await recalcularCargaHorariaPlanejada(planoEnsinoId, instituicaoId);

    // Auditoria: Log CREATE (aula do plano)
    await AuditService.logCreate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_AULA,
      entidadeId: aula.id,
      dadosNovos: { aula, planoEnsinoId },
      observacao: `Aula criada: ${titulo}`,
    });

    // Log de sucesso
    if (process.env.NODE_ENV !== 'production') {
      console.log('[createAula] Sucesso', {
        planoEnsinoId,
        aulaId: aula.id,
        instituicaoId,
        userId,
        titulo,
      });
    }

    res.status(201).json(aula);
  } catch (error) {
    // Log de erro
    if (process.env.NODE_ENV !== 'production') {
      console.error('[createAula] Erro', {
        planoEnsinoId: req.params.planoEnsinoId,
        instituicaoId: req.user?.instituicaoId || 'unknown',
        userId: req.user?.userId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
        route: `${req.method} ${req.path}`,
      });
    }
    next(error);
  }
};

/**
 * Atualizar aula planejada
 */
export const updateAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId } = req.params;
    // REGRA SIGA/SIGAE: trimestre/semestre NÃO vem do body - é herdado do Plano de Ensino
    const { titulo, descricao, tipo, quantidadeAulas, trimestre, semestre } = req.body;
    
    // REGRA SIGA/SIGAE: Rejeitar explicitamente se trimestre/semestre for enviado no body
    if (trimestre !== undefined || semestre !== undefined) {
      throw new AppError('Período acadêmico (semestre/trimestre) não deve ser enviado. Ele é herdado automaticamente do Plano de Ensino.', 400);
    }

    // VALIDAÇÃO MULTI-TENANT: Verificar se aula pertence ao plano que pertence à instituição
    const instituicaoId = requireTenantScope(req);

    // Verificar se aula existe
    const aula = await prisma.planoAula.findUnique({
      where: { id: aulaId },
      include: {
        planoEnsino: true,
      },
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }
    
    // Verificar se plano pertence à instituição ANTES de validar permissão
    const planoFilter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId, ...planoFilter },
      include: {
        instituicao: {
          select: { tipoAcademico: true }
        }
      }
    });

    if (!plano) {
      throw new AppError('Aula não encontrada ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar plano (após validar multi-tenant)
    await validarPermissaoPlanoEnsino(req, aula.planoEnsinoId);

    // REGRA SIGA/SIGAE: Período (semestre/trimestre) é SEMPRE herdado do plano de ensino
    // NÃO aceitar trimestre/semestre no body - sempre herdar do plano
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), com fallback para plano.instituicao
    const tipoAcademico = req.user?.tipoAcademico || plano.instituicao?.tipoAcademico || null;
    let periodoNumero: number | null = null;
    
    if (tipoAcademico === 'SUPERIOR') {
      // Ensino Superior: herdar semestre do plano
      if (plano.semestre !== null && plano.semestre !== undefined) {
        periodoNumero = Number(plano.semestre);
        
        // VALIDAÇÃO: Verificar se semestre existe no banco (validação de integridade)
        if (plano.anoLetivoId) {
          const semestreExiste = await prisma.semestre.findFirst({
            where: {
              anoLetivoId: plano.anoLetivoId,
              numero: periodoNumero,
              instituicaoId: plano.instituicaoId,
            },
          });
          
          if (!semestreExiste) {
            throw new AppError(`O plano de ensino está vinculado ao semestre ${periodoNumero}, mas este semestre não existe no banco de dados. Acesse Configuração de Ensino → Semestres para criar o semestre necessário.`, 400);
          }
        }
      } else {
        throw new AppError('Plano de ensino não possui semestre definido. Configure o semestre no plano de ensino antes de atualizar aulas.', 400);
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // REGRA SIGA/SIGAE: Para Ensino Secundário, buscar primeiro trimestre ativo do ano letivo
      // Se não houver trimestre ativo, buscar qualquer trimestre do ano letivo
      if (plano.anoLetivoId) {
        const primeiroTrimestre = await prisma.trimestre.findFirst({
          where: {
            anoLetivoId: plano.anoLetivoId,
            instituicaoId: plano.instituicaoId,
            status: 'ATIVO',
          },
          orderBy: { numero: 'asc' },
        });
        
        if (primeiroTrimestre) {
          periodoNumero = primeiroTrimestre.numero;
        } else {
          // Se não houver trimestre ativo, buscar qualquer trimestre do ano letivo
          const qualquerTrimestre = await prisma.trimestre.findFirst({
            where: {
              anoLetivoId: plano.anoLetivoId,
              instituicaoId: plano.instituicaoId,
            },
            orderBy: { numero: 'asc' },
          });
            
          if (qualquerTrimestre) {
            periodoNumero = qualquerTrimestre.numero;
          } else {
            // Se não houver trimestres cadastrados, usar padrão 1
            periodoNumero = 1;
          }
        }
      } else {
        // Se não houver anoLetivoId, usar padrão 1
        periodoNumero = 1;
      }
    } else {
      throw new AppError('Tipo de instituição não identificado. Configure o tipo acadêmico da instituição antes de atualizar aulas.', 400);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir editar se estado = ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', plano.id, planoFilter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    // Validar que período foi determinado
    if (periodoNumero === null || periodoNumero <= 0) {
      throw new AppError('Não foi possível determinar o período acadêmico do plano de ensino. Verifique se o plano está configurado corretamente.', 400);
    }

    const updateData: any = {};
    if (titulo !== undefined) updateData.titulo = titulo;
    if (descricao !== undefined) updateData.descricao = descricao || null;
    if (tipo !== undefined) updateData.tipo = tipo;
    // REGRA SIGA/SIGAE: Período é SEMPRE herdado do plano de ensino
    updateData.trimestre = periodoNumero;
    if (quantidadeAulas !== undefined) updateData.quantidadeAulas = Number(quantidadeAulas);

    const aulaAtualizada = await prisma.planoAula.update({
      where: { id: aulaId },
      data: updateData,
    });

    // REGRA SIGA/SIGAE: Recalcular cargaHorariaPlanejada automaticamente
    await recalcularCargaHorariaPlanejada(aula.planoEnsinoId, instituicaoId);

    // Auditoria: Log UPDATE (aula do plano)
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_AULA,
      entidadeId: aula.id,
      dadosAnteriores: aula,
      dadosNovos: aulaAtualizada,
      observacao: `Aula atualizada: ${aula.titulo}`,
    });

    res.json(aulaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar aula planejada
 */
export const deleteAula = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId } = req.params;

    // VALIDAÇÃO MULTI-TENANT: Verificar se aula pertence ao plano que pertence à instituição
    const instituicaoId = requireTenantScope(req);

    // Verificar se aula existe
    const aula = await prisma.planoAula.findUnique({
      where: { id: aulaId },
      include: {
        planoEnsino: true,
      },
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }
    
    // Verificar se plano pertence à instituição ANTES de validar permissão
    const planoFilter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId, ...planoFilter },
    });

    if (!plano) {
      throw new AppError('Aula não encontrada ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar plano (após validar multi-tenant)
    await validarPermissaoPlanoEnsino(req, aula.planoEnsinoId);

    // VALIDAÇÃO DE ESTADO: Não permitir deletar se estado = ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', plano.id, planoFilter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    // Auditoria: Log DELETE (antes de deletar)
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_AULA,
      entidadeId: aula.id,
      dadosAnteriores: aula,
      observacao: `Aula deletada: ${aula.titulo}`,
    });

    await prisma.planoAula.delete({
      where: { id: aulaId },
    });

    // Reordenar aulas restantes (já validado multi-tenant acima)
    const aulasRestantes = await prisma.planoAula.findMany({
      where: { planoEnsinoId: aula.planoEnsinoId },
      orderBy: { ordem: 'asc' },
    });

    await Promise.all(
      aulasRestantes.map((a, index) =>
        prisma.planoAula.update({
          where: { id: a.id },
          data: { ordem: index + 1 },
        })
      )
    );

    // REGRA SIGA/SIGAE: Recalcular cargaHorariaPlanejada automaticamente
    await recalcularCargaHorariaPlanejada(aula.planoEnsinoId, instituicaoId);

    res.json({ message: 'Aula excluída com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Reordenar aulas
 */
export const reordenarAulas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const { ordemAulas } = req.body; // Array de IDs na nova ordem

    if (!Array.isArray(ordemAulas)) {
      throw new AppError('ordemAulas deve ser um array de IDs', 400);
    }

    const filter = addInstitutionFilter(req);

    // Verificar se plano existe e não está bloqueado
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    // VALIDAÇÃO MULTI-TENANT: Verificar se todas as aulas pertencem ao plano antes de atualizar
    const aulasExistentes = await prisma.planoAula.findMany({
      where: {
        id: { in: ordemAulas },
        planoEnsinoId: planoEnsinoId, // CRÍTICO: Garantir que aulas pertencem ao plano
      },
      select: { id: true }
    });

    if (aulasExistentes.length !== ordemAulas.length) {
      throw new AppError('Uma ou mais aulas não pertencem a este plano de ensino', 403);
    }

    // Atualizar ordem de cada aula (já validado multi-tenant acima)
    await Promise.all(
      ordemAulas.map((aulaId: string, index: number) =>
        prisma.planoAula.update({
          where: { id: aulaId },
          data: { ordem: index + 1 },
        })
      )
    );

    // REGRA SIGA/SIGAE: Recalcular cargaHorariaPlanejada (embora reordenação não altere a soma)
    const instituicaoId = requireTenantScope(req);
    await recalcularCargaHorariaPlanejada(planoEnsinoId, instituicaoId);

    res.json({ message: 'Aulas reordenadas com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Marcar aula como ministrada
 */
export const marcarAulaMinistrada = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId } = req.params;
    const { dataMinistrada } = req.body;

    // VALIDAÇÃO MULTI-TENANT: Verificar se aula pertence ao plano que pertence à instituição
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se aula existe
    const aula = await prisma.planoAula.findUnique({
      where: { id: aulaId },
      include: {
        planoEnsino: true,
      },
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }

    // Verificar se plano pertence à instituição (VALIDAÇÃO MULTI-TENANT CRÍTICA)
    const planoFilter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId, ...planoFilter },
    });

    if (!plano) {
      throw new AppError('Aula não encontrada ou não pertence à sua instituição', 404);
    }

    const aulaAtualizada = await prisma.planoAula.update({
      where: { id: aulaId },
      data: {
        status: 'MINISTRADA',
        dataMinistrada: dataMinistrada ? new Date(dataMinistrada) : new Date(),
      },
    });

    res.json(aulaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Desmarcar aula como ministrada
 */
export const desmarcarAulaMinistrada = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { aulaId } = req.params;

    // VALIDAÇÃO MULTI-TENANT: Verificar se aula pertence ao plano que pertence à instituição
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Verificar se aula existe
    const aula = await prisma.planoAula.findUnique({
      where: { id: aulaId },
      include: {
        planoEnsino: true,
      },
    });

    if (!aula) {
      throw new AppError('Aula não encontrada', 404);
    }

    // Verificar se plano pertence à instituição (VALIDAÇÃO MULTI-TENANT CRÍTICA)
    const planoFilter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: aula.planoEnsinoId, ...planoFilter },
    });

    if (!plano) {
      throw new AppError('Aula não encontrada ou não pertence à sua instituição', 404);
    }

    const aulaAtualizada = await prisma.planoAula.update({
      where: { id: aulaId },
      data: {
        status: 'PLANEJADA',
        dataMinistrada: null,
      },
    });

    res.json(aulaAtualizada);
  } catch (error) {
    next(error);
  }
};

/**
 * Adicionar bibliografia
 */
export const addBibliografia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const { titulo, autor, editora, ano, isbn, tipo, observacoes } = req.body;

    if (!titulo) {
      throw new AppError('Título é obrigatório', 400);
    }

    const filter = addInstitutionFilter(req);

    // Verificar se plano existe e não está bloqueado
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir adicionar bibliografia se estado = APROVADO ou ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', planoEnsinoId, filter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    const bibliografia = await prisma.bibliografiaPlano.create({
      data: {
        planoEnsinoId,
        titulo,
        autor: autor || null,
        editora: editora || null,
        ano: ano ? Number(ano) : null,
        isbn: isbn || null,
        tipo: tipo || 'BIBLIOGRAFIA_BASICA',
        observacoes: observacoes || null,
      },
    });

    res.status(201).json(bibliografia);
  } catch (error) {
    next(error);
  }
};

/**
 * Remover bibliografia
 */
export const removeBibliografia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bibliografiaId } = req.params;

    // VALIDAÇÃO MULTI-TENANT: Verificar se bibliografia pertence ao plano que pertence à instituição
    const instituicaoId = requireTenantScope(req);
    
    // Verificar se bibliografia existe
    const bibliografia = await prisma.bibliografiaPlano.findUnique({
      where: { id: bibliografiaId },
      include: {
        planoEnsino: true,
      },
    });

    if (!bibliografia) {
      throw new AppError('Bibliografia não encontrada', 404);
    }

    // Verificar se plano pertence à instituição (VALIDAÇÃO MULTI-TENANT CRÍTICA)
    const planoFilter = addInstitutionFilter(req);
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: bibliografia.planoEnsinoId, ...planoFilter },
    });

    if (!plano) {
      throw new AppError('Bibliografia não encontrada ou não pertence à sua instituição', 404);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir remover bibliografia se estado = APROVADO ou ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', bibliografia.planoEnsinoId, planoFilter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    await prisma.bibliografiaPlano.delete({
      where: { id: bibliografiaId },
    });

    res.json({ message: 'Bibliografia removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

/**
 * Bloquear plano de ensino
 * Apenas ADMIN pode bloquear/encerrar
 */
export const bloquearPlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    // VALIDAÇÃO DE PERMISSÃO: Apenas ADMIN pode bloquear/encerrar
    await validarPermissaoAprovarPlanoEnsino(req);

    const filter = addInstitutionFilter(req);

    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    if (!req.user?.userId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    const planoBloqueado = await prisma.planoEnsino.update({
      where: { id: planoEnsinoId },
      data: {
        bloqueado: true,
        dataBloqueio: new Date(),
        bloqueadoPor: req.user.userId,
      },
    });

    // Auditoria: Log BLOCK
    await AuditService.logBlock(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: planoEnsinoId,
      dadosAnteriores: plano,
      dadosNovos: planoBloqueado,
      observacao: 'Plano de ensino bloqueado',
    });

    res.json(planoBloqueado);
  } catch (error) {
    next(error);
  }
};

/**
 * Desbloquear plano de ensino
 */
export const desbloquearPlano = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    const filter = addInstitutionFilter(req);

    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    const planoDesbloqueado = await prisma.planoEnsino.update({
      where: { id: planoEnsinoId },
      data: {
        bloqueado: false,
        dataBloqueio: null,
        bloqueadoPor: null,
      },
    });

    // Auditoria: Log UPDATE (desbloqueio)
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: planoEnsinoId,
      dadosAnteriores: plano,
      dadosNovos: planoDesbloqueado,
      observacao: 'Plano de ensino desbloqueado',
    });

    res.json(planoDesbloqueado);
  } catch (error) {
    next(error);
  }
};

/**
 * Atualizar dados gerais do plano de ensino (Apresentação)
 */
export const updatePlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar plano
    await validarPermissaoPlanoEnsino(req, planoEnsinoId);

    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);

    // Verificar se plano existe e não está bloqueado
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir editar se estado = ENCERRADO
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', planoEnsinoId, filter);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    const { ementa, objetivos, metodologia, criteriosAvaliacao, conteudoProgramatico, semestre, classeOuAno, turmaId } = req.body;
    
    // REGRA SIGA/SIGAE: Campos estruturais NÃO podem ser editados após criação
    // cursoId, classeId, disciplinaId, professorId, anoLetivoId são estruturais
    if (req.body.cursoId !== undefined || req.body.curso_id !== undefined) {
      throw new AppError('Curso não pode ser alterado após a criação do Plano de Ensino. Crie um novo plano de ensino para vincular a outro curso.', 400);
    }
    if (req.body.classeId !== undefined || req.body.classe_id !== undefined) {
      throw new AppError('Classe não pode ser alterada após a criação do Plano de Ensino. Crie um novo plano de ensino para vincular a outra classe.', 400);
    }
    if (req.body.disciplinaId !== undefined || req.body.disciplina_id !== undefined) {
      throw new AppError('Disciplina não pode ser alterada após a criação do Plano de Ensino. Crie um novo plano de ensino para vincular a outra disciplina.', 400);
    }
    if (req.body.professorId !== undefined || req.body.professor_id !== undefined) {
      throw new AppError('Professor não pode ser alterado após a criação do Plano de Ensino. Crie um novo plano de ensino para vincular a outro professor.', 400);
    }
    if (req.body.anoLetivoId !== undefined || req.body.ano_letivo_id !== undefined) {
      throw new AppError('Ano Letivo não pode ser alterado após a criação do Plano de Ensino. Crie um novo plano de ensino para vincular a outro ano letivo.', 400);
    }
    
    // REGRA SIGA/SIGAE: cargaHorariaTotal NÃO pode ser editada - sempre vem da Disciplina
    // REGRA SIGA/SIGAE: cargaHorariaPlanejada NÃO pode ser editada - é calculada automaticamente (soma das aulas)
    if (req.body.cargaHorariaTotal !== undefined) {
      throw new AppError('Carga horária total não pode ser editada. Ela é definida na Disciplina e não pode ser alterada no Plano de Ensino.', 400);
    }
    if (req.body.cargaHorariaPlanejada !== undefined) {
      throw new AppError('Carga horária planejada não pode ser editada manualmente. Ela é calculada automaticamente pela soma das aulas planejadas.', 400);
    }
    
    // Validar campos condicionais SIGA/SIGAE se fornecidos
    // CRÍTICO: tipoAcademico vem do JWT (req.user.tipoAcademico), não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    if (!tipoAcademico) {
      throw new AppError('Tipo de instituição não identificado. Não é possível atualizar o Plano de Ensino.', 400);
    }
    
    const updateData: any = {};
    
    // Permitir atualizar turmaId (vincular/desvincular turma)
    if (turmaId !== undefined) {
      if (turmaId === null || turmaId === '') {
        // Desvincular turma (permitir null)
        updateData.turmaId = null;
      } else {
        // Vincular turma - validar se turma existe e pertence à instituição
        const turma = await prisma.turma.findFirst({
          where: {
            id: turmaId,
            ...filter,
          },
          select: { id: true },
        });
        
        if (!turma) {
          throw new AppError('Turma não encontrada ou não pertence à sua instituição', 404);
        }
        
        updateData.turmaId = turma.id;
      }
    }
    
    if (tipoAcademico === 'SUPERIOR' && semestre !== undefined) {
      // VALIDAÇÃO CRÍTICA SIGA/SIGAE: Verificar se semestre existe na tabela Semestres vinculado ao ano letivo
      if (plano.anoLetivoId) {
        const semestreExiste = await prisma.semestre.findFirst({
          where: {
            anoLetivoId: plano.anoLetivoId,
            numero: semestre,
            instituicaoId,
          },
        });
        if (!semestreExiste) {
          // Buscar semestres disponíveis para mensagem mais útil
          const semestresDisponiveis = await prisma.semestre.findMany({
            where: {
              anoLetivoId: plano.anoLetivoId,
              instituicaoId,
            },
            select: { numero: true },
          });
          
          if (semestresDisponiveis.length === 0) {
            throw new AppError('Semestre não configurado para este ano letivo. Acesse Configuração de Ensino → Semestres para criar um semestre antes de continuar.', 400);
          } else {
            throw new AppError(`Semestre ${semestre} não encontrado para este ano letivo. Semestres disponíveis: ${semestresDisponiveis.map(s => s.numero).join(', ')}. Acesse Configuração de Ensino → Semestres para criar o semestre necessário.`, 400);
          }
        }
        // Armazenar semestreId para vincular FK corretamente
        updateData.semestreId = semestreExiste.id;
      }
      if (classeOuAno !== undefined) {
        throw new AppError('Campo "Classe/Ano" não é válido para Ensino Superior. Use o campo "Semestre" (1 ou 2).', 400);
      }
    } else if (tipoAcademico === 'SECUNDARIO' && classeOuAno !== undefined) {
      if (!classeOuAno || classeOuAno.trim() === '') {
        throw new AppError('Classe/Ano não pode ser vazio para Ensino Secundário. Informe um valor válido (ex: "10ª Classe", "1º Ano").', 400);
      }
      if (semestre !== undefined) {
        throw new AppError('Campo "Semestre" não é válido para Ensino Secundário. Use o campo "Classe/Ano" ao invés de Semestre.', 400);
      }
    }
    if (ementa !== undefined) updateData.ementa = ementa || null;
    if (objetivos !== undefined) updateData.objetivos = objetivos || null;
    if (metodologia !== undefined) updateData.metodologia = metodologia || null;
    if (criteriosAvaliacao !== undefined) updateData.criteriosAvaliacao = criteriosAvaliacao || null;
    if (conteudoProgramatico !== undefined) updateData.conteudoProgramatico = conteudoProgramatico || null;
    if (semestre !== undefined) {
      updateData.semestre = tipoAcademico === 'SUPERIOR' ? semestre : null;
      // semestreId já foi definido acima se semestre existe e é válido
      if (tipoAcademico !== 'SUPERIOR') {
        updateData.semestreId = null; // Limpar semestreId se não for Ensino Superior
      }
    }
    if (classeOuAno !== undefined) {
      updateData.classeOuAno = tipoAcademico === 'SECUNDARIO' ? classeOuAno : null;
    }

    const planoAtualizado = await prisma.planoEnsino.update({
      where: { id: planoEnsinoId },
      data: updateData,
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
        professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
        turma: { select: { id: true, nome: true } },
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    // Auditoria: Log UPDATE
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: planoEnsinoId,
      dadosAnteriores: plano,
      dadosNovos: planoAtualizado,
      observacao: 'Dados de apresentação do plano atualizados',
    });

    res.json(planoAtualizado);
  } catch (error) {
    next(error);
  }
};

/**
 * Ajustar automaticamente a carga horária do plano
 * Ajusta a quantidade de aulas para corresponder à carga horária exigida
 */
export const ajustarCargaHorariaAutomatico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode editar plano
    await validarPermissaoPlanoEnsino(req, planoEnsinoId);

    const filter = addInstitutionFilter(req);

    // Buscar plano com aulas
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: { orderBy: { ordem: 'asc' } },
        disciplina: { select: { cargaHoraria: true } },
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    if (plano.bloqueado) {
      throw new AppError('Plano de ensino está bloqueado e não pode ser editado', 400);
    }

    // REGRA SIGA/SIGAE: cargaHorariaExigida SEMPRE vem da Disciplina
    const totalExigido = plano.disciplina.cargaHoraria || 0;
    const totalPlanejado = plano.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0);
    const diferenca = totalExigido - totalPlanejado;

    if (diferenca === 0) {
      return res.json({
        message: 'Carga horária já está correta',
        totalExigido,
        totalPlanejado,
        diferenca: 0,
      });
    }

    // Se faltam horas, adicionar aulas ou aumentar quantidade
    if (diferenca > 0) {
      // Tentar distribuir as horas faltantes entre as aulas existentes
      const aulas = [...plano.aulas];
      let horasRestantes = diferenca;
      let index = 0;

      // Distribuir horas adicionais entre as aulas existentes
      while (horasRestantes > 0 && index < aulas.length) {
        const aula = aulas[index];
        const incremento = Math.min(horasRestantes, 1); // Adicionar 1 hora por vez
        
        await prisma.planoAula.update({
          where: { id: aula.id },
          data: { quantidadeAulas: aula.quantidadeAulas + incremento },
        });

        horasRestantes -= incremento;
        index++;
      }

      // Se ainda faltam horas, criar uma nova aula
      if (horasRestantes > 0) {
        const ultimaAula = aulas[aulas.length - 1];
        await prisma.planoAula.create({
          data: {
            planoEnsinoId: plano.id,
            titulo: `Aula ${aulas.length + 1}`,
            descricao: 'Aula adicionada automaticamente para completar carga horária',
            tipo: 'TEORICA',
            trimestre: ultimaAula?.trimestre || 1,
            quantidadeAulas: horasRestantes,
            ordem: (ultimaAula?.ordem || 0) + 1,
          },
        });
      }
    } else {
      // Se excedem horas, reduzir quantidade de aulas
      const horasExcedentes = Math.abs(diferenca);
      const aulas = [...plano.aulas].sort((a, b) => b.quantidadeAulas - a.quantidadeAulas); // Ordenar por quantidade (maior primeiro)
      
      let horasRemover = horasExcedentes;
      let index = 0;

      // Reduzir horas das aulas com maior quantidade
      while (horasRemover > 0 && index < aulas.length) {
        const aula = aulas[index];
        const reducao = Math.min(horasRemover, aula.quantidadeAulas - 1); // Manter pelo menos 1 aula
        
        if (aula.quantidadeAulas - reducao > 0) {
          await prisma.planoAula.update({
            where: { id: aula.id },
            data: { quantidadeAulas: aula.quantidadeAulas - reducao },
          });
          horasRemover -= reducao;
        }
        
        index++;
      }

      // Se ainda há excesso, remover aulas completas (começando pelas menores)
      if (horasRemover > 0) {
        const aulasOrdenadas = [...plano.aulas].sort((a, b) => a.quantidadeAulas - b.quantidadeAulas);
        
        for (const aula of aulasOrdenadas) {
          if (horasRemover <= 0) break;
          
          if (aula.quantidadeAulas <= horasRemover) {
            await prisma.planoAula.delete({ where: { id: aula.id } });
            horasRemover -= aula.quantidadeAulas;
          }
        }
      }
    }

    // Buscar plano atualizado
    const planoAtualizado = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: { orderBy: { ordem: 'asc' } },
        disciplina: { select: { cargaHoraria: true } },
      },
    });

    // REGRA SIGA/SIGAE: Recalcular cargaHorariaPlanejada após ajustes
    const instituicaoId = requireTenantScope(req);
    await recalcularCargaHorariaPlanejada(planoEnsinoId, instituicaoId);

    // Buscar plano novamente para obter cargaHorariaPlanejada atualizada
    const planoFinal = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: { orderBy: { ordem: 'asc' } },
        disciplina: { select: { cargaHoraria: true } },
      },
    });

    const novoTotalPlanejado = planoFinal?.aulas.reduce((sum, aula) => sum + aula.quantidadeAulas, 0) || 0;
    const novaDiferenca = totalExigido - novoTotalPlanejado;

    // Auditoria: Log UPDATE
    await AuditService.logUpdate(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: planoEnsinoId,
      dadosAnteriores: plano,
      dadosNovos: planoFinal,
      observacao: `Ajuste automático de carga horária: ${diferenca > 0 ? 'adicionadas' : 'removidas'} ${Math.abs(diferenca)} horas`,
    });

    res.json({
      message: 'Carga horária ajustada automaticamente',
      totalExigido,
      totalPlanejadoAnterior: totalPlanejado,
      totalPlanejadoNovo: novoTotalPlanejado,
      diferencaAnterior: diferenca,
      diferencaNova: novaDiferenca,
      plano: planoFinal,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Copiar plano de ensino para outra turma (mesmo ano letivo e mesma classe; curso pode ser diferente)
 * Evita duplicar cadastro quando o professor ministra a mesma disciplina em várias turmas ou cursos
 */
export const copiarPlanoParaTurma = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const { novaTurmaId } = req.body;

    if (!novaTurmaId) {
      throw new AppError('Turma de destino é obrigatória', 400);
    }

    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Buscar plano original com aulas e bibliografias
    const planoOriginal = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    if (!planoOriginal) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // Validar turma de destino
    const turmaDestino = await prisma.turma.findFirst({
      where: { id: novaTurmaId, instituicaoId },
    });

    if (!turmaDestino) {
      throw new AppError('Turma de destino não encontrada ou não pertence à sua instituição', 404);
    }

    // Turma deve ser compatível: mesmo ano letivo e mesma classe (no secundário)
    // Curso pode ser diferente: permite reutilizar o mesmo plano em turmas de outros cursos (ex.: mesma disciplina em vários cursos)
    if (turmaDestino.anoLetivoId !== planoOriginal.anoLetivoId) {
      throw new AppError('A turma de destino deve ser do mesmo ano letivo do plano de origem', 400);
    }
    if (turmaDestino.classeId !== planoOriginal.classeId) {
      throw new AppError('A turma de destino deve ser da mesma classe do plano de origem', 400);
    }

    // Não copiar para a mesma turma
    if (planoOriginal.turmaId === novaTurmaId) {
      throw new AppError('O plano já está vinculado a esta turma. Selecione outra turma.', 400);
    }

    // Verificar se já existe plano para o professor+disciplina+ano+ nova turma
    const planoExistente = await prisma.planoEnsino.findFirst({
      where: {
        professorId: planoOriginal.professorId,
        disciplinaId: planoOriginal.disciplinaId,
        anoLetivoId: planoOriginal.anoLetivoId,
        turmaId: novaTurmaId,
        instituicaoId,
      },
    });

    if (planoExistente) {
      throw new AppError('Já existe um plano de ensino para este professor e disciplina nesta turma', 400);
    }

    // Criar novo plano copiando todos os campos pedagógicos (curso/classe da turma de destino)
    const novoPlano = await prisma.planoEnsino.create({
      data: {
        cursoId: turmaDestino.cursoId ?? planoOriginal.cursoId,
        classeId: turmaDestino.classeId ?? planoOriginal.classeId,
        disciplinaId: planoOriginal.disciplinaId,
        professorId: planoOriginal.professorId,
        anoLetivo: planoOriginal.anoLetivo,
        anoLetivoId: planoOriginal.anoLetivoId,
        turmaId: novaTurmaId,
        semestre: planoOriginal.semestre,
        semestreId: planoOriginal.semestreId,
        classeOuAno: planoOriginal.classeOuAno,
        cargaHorariaTotal: planoOriginal.cargaHorariaTotal,
        cargaHorariaPlanejada: planoOriginal.cargaHorariaPlanejada,
        metodologia: planoOriginal.metodologia,
        objetivos: planoOriginal.objetivos,
        conteudoProgramatico: planoOriginal.conteudoProgramatico,
        criteriosAvaliacao: planoOriginal.criteriosAvaliacao,
        ementa: planoOriginal.ementa,
        instituicaoId,
        bloqueado: false,
      },
    });

    // Copiar aulas (resetando status para PLANEJADA)
    await Promise.all(
      planoOriginal.aulas.map((aula, index) =>
        prisma.planoAula.create({
          data: {
            planoEnsinoId: novoPlano.id,
            ordem: index + 1,
            titulo: aula.titulo,
            descricao: aula.descricao,
            tipo: aula.tipo,
            trimestre: aula.trimestre,
            quantidadeAulas: aula.quantidadeAulas,
            status: 'PLANEJADA',
          },
        })
      )
    );

    // Copiar bibliografias
    await Promise.all(
      planoOriginal.bibliografias.map((bib) =>
        prisma.bibliografiaPlano.create({
          data: {
            planoEnsinoId: novoPlano.id,
            titulo: bib.titulo,
            autor: bib.autor,
            editora: bib.editora,
            ano: bib.ano,
            isbn: bib.isbn,
            tipo: bib.tipo,
            observacoes: bib.observacoes,
          },
        })
      )
    );

    const planoCompleto = await prisma.planoEnsino.findUnique({
      where: { id: novoPlano.id },
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
        professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
        turma: { select: { id: true, nome: true } },
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    res.status(201).json(planoCompleto);
  } catch (error) {
    next(error);
  }
};

/**
 * Copiar plano de ensino de ano anterior
 */
export const copiarPlanoAnterior = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;
    const { novoAnoLetivo } = req.body;

    if (!novoAnoLetivo) {
      throw new AppError('Novo Ano Letivo é obrigatório', 400);
    }

    // CORREÇÃO CRÍTICA: instituicaoId SEMPRE vem do JWT (req.user.instituicaoId)
    const instituicaoId = requireTenantScope(req);
    const filter = addInstitutionFilter(req);

    // Buscar plano original
    const planoOriginal = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    if (!planoOriginal) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // VALIDAÇÃO CRÍTICA: Verificar se novo ano letivo existe e pertence à instituição
    const novoAnoLetivoRecord = await prisma.anoLetivo.findFirst({
      where: {
        ano: Number(novoAnoLetivo),
        ...filter,
      },
    });

    if (!novoAnoLetivoRecord) {
      throw new AppError(`Ano letivo ${novoAnoLetivo} não encontrado ou não pertence à sua instituição. É necessário criar o ano letivo primeiro.`, 404);
    }

    // Verificar se já existe plano para o novo ano
    const planoExistente = await prisma.planoEnsino.findFirst({
      where: {
        cursoId: planoOriginal.cursoId,
        classeId: planoOriginal.classeId,
        disciplinaId: planoOriginal.disciplinaId,
        professorId: planoOriginal.professorId,
        anoLetivo: Number(novoAnoLetivo),
        turmaId: planoOriginal.turmaId,
        instituicaoId: planoOriginal.instituicaoId,
      },
    });

    if (planoExistente) {
      throw new AppError('Já existe um plano de ensino para este contexto e ano letivo', 400);
    }

    // Criar novo plano
    const novoPlano = await prisma.planoEnsino.create({
      data: {
        cursoId: planoOriginal.cursoId,
        classeId: planoOriginal.classeId,
        disciplinaId: planoOriginal.disciplinaId,
        professorId: planoOriginal.professorId,
        anoLetivo: Number(novoAnoLetivo),
        anoLetivoId: novoAnoLetivoRecord.id,
        turmaId: planoOriginal.turmaId,
        cargaHorariaTotal: planoOriginal.cargaHorariaTotal,
        instituicaoId: instituicaoId,
        bloqueado: false,
      },
    });

    // Copiar aulas (resetando status para PLANEJADA)
    await Promise.all(
      planoOriginal.aulas.map((aula, index) =>
        prisma.planoAula.create({
          data: {
            planoEnsinoId: novoPlano.id,
            ordem: index + 1,
            titulo: aula.titulo,
            descricao: aula.descricao,
            tipo: aula.tipo,
            trimestre: aula.trimestre,
            quantidadeAulas: aula.quantidadeAulas,
            status: 'PLANEJADA',
          },
        })
      )
    );

    // Copiar bibliografias
    await Promise.all(
      planoOriginal.bibliografias.map((bib) =>
        prisma.bibliografiaPlano.create({
          data: {
            planoEnsinoId: novoPlano.id,
            titulo: bib.titulo,
            autor: bib.autor,
            editora: bib.editora,
            ano: bib.ano,
            isbn: bib.isbn,
            tipo: bib.tipo,
            observacoes: bib.observacoes,
          },
        })
      )
    );

    // Buscar plano completo
    const planoCompleto = await prisma.planoEnsino.findUnique({
      where: { id: novoPlano.id },
      include: {
        curso: { select: { id: true, nome: true, codigo: true } },
        classe: { select: { id: true, nome: true, codigo: true } },
        disciplina: { select: { id: true, nome: true, cargaHoraria: true } },
        professor: { include: { user: { select: { nomeCompleto: true, email: true } } } },
        turma: { select: { id: true, nome: true } },
        aulas: { orderBy: { ordem: 'asc' } },
        bibliografias: true,
      },
    });

    res.status(201).json(planoCompleto);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletar plano de ensino
 * DELETE /plano-ensino/:id
 */
export const deletePlanoEnsino = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { planoEnsinoId } = req.params;

    // VALIDAÇÃO DE PERMISSÃO: Verificar se usuário pode deletar plano
    await validarPermissaoPlanoEnsino(req, planoEnsinoId);

    const filter = addInstitutionFilter(req);

    // Verificar se plano existe
    const plano = await prisma.planoEnsino.findFirst({
      where: { id: planoEnsinoId, ...filter },
      include: {
        aulas: {
          select: { id: true },
        },
        bibliografias: {
          select: { id: true },
        },
      },
    });

    if (!plano) {
      throw new AppError('Plano de ensino não encontrado', 404);
    }

    // VALIDAÇÃO DE ESTADO: Não permitir deletar se estado = APROVADO ou ENCERRADO
    // REGRA SIGA/SIGAE: Planos APROVADOS são imutáveis e não podem ser deletados
    if (plano.estado) {
      await validarEstadoParaEdicao('PlanoEnsino', planoEnsinoId, filter);
    }

    // Verificar se há aulas lançadas vinculadas
    const whereAulasLancadas: any = {
      planoAula: {
        planoEnsinoId: planoEnsinoId,
      },
    };
    if (filter.instituicaoId) {
      whereAulasLancadas.instituicaoId = filter.instituicaoId;
    }
    const aulasLancadas = await prisma.aulaLancada.findFirst({
      where: whereAulasLancadas,
    });

    if (aulasLancadas) {
      throw new AppError('Não é possível deletar um plano de ensino que possui aulas lançadas. Remova as aulas lançadas primeiro.', 400);
    }

    // Auditoria: Log DELETE (antes de deletar)
    await AuditService.logDelete(req, {
      modulo: ModuloAuditoria.PLANO_ENSINO,
      entidade: EntidadeAuditoria.PLANO_ENSINO,
      entidadeId: planoEnsinoId,
      dadosAnteriores: plano,
      observacao: `Plano de ensino deletado: ${plano.disciplinaId}`,
    });

    // Deletar plano (cascata deletará aulas e bibliografias)
    await prisma.planoEnsino.delete({
      where: { id: planoEnsinoId },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

