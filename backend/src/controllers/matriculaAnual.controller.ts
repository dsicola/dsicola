import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AppError } from '../middlewares/errorHandler.js';
import { addInstitutionFilter, getInstituicaoIdFromFilter, requireTenantScope } from '../middlewares/auth.js';
import { validarAnoLetivoIdAtivo, validarAnoLetivoAtivo, buscarAnoLetivoAtivo } from '../services/validacaoAcademica.service.js';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId, anoLetivo, status } = req.query;
    
    const where: any = {
      ...(alunoId && { alunoId: alunoId as string }),
      ...(anoLetivo && { anoLetivo: parseInt(anoLetivo as string) }),
      ...(status && { status: status as string }),
    };

    // Aplicar filtro de instituição
    if (filter.instituicaoId) {
      where.instituicaoId = filter.instituicaoId;
    }
    
    const matriculasAnuais = await prisma.matriculaAnual.findMany({
      where,
      include: { 
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          }
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        },
        _count: {
          select: {
            disciplinas: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(matriculasAnuais);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    
    const matriculaAnual = await prisma.matriculaAnual.findUnique({
      where: { id },
      include: { 
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
            numeroIdentificacaoPublica: true,
          }
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        },
        disciplinas: {
          include: {
            disciplina: {
              include: {
                curso: true,
              }
            }
          }
        }
      },
    });

    if (!matriculaAnual) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }

    // Verificar acesso à instituição
    if (filter.instituicaoId && matriculaAnual.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta matrícula', 403);
    }
    
    res.json(matriculaAnual);
  } catch (error) {
    next(error);
  }
};

export const getByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId } = req.params;
    
    const where: any = {
      alunoId,
    };

    // Aplicar filtro de instituição
    if (filter.instituicaoId) {
      where.instituicaoId = filter.instituicaoId;
    }
    
    const matriculasAnuais = await prisma.matriculaAnual.findMany({
      where,
      include: { 
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        },
        _count: {
          select: {
            disciplinas: true,
          }
        }
      },
      orderBy: { anoLetivo: 'desc' },
    });
    
    res.json(matriculasAnuais);
  } catch (error) {
    next(error);
  }
};

/**
 * Sugestão de classe para nova matrícula anual (baseado no status do ano anterior)
 * GET /matriculas-anuais/sugestao/:alunoId?anoLetivo=2026
 */
export const getSugestaoClasse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const { alunoId } = req.params;
    const { anoLetivo } = req.query;

    if (!alunoId) {
      throw new AppError('alunoId é obrigatório', 400);
    }

    const anoLetivoNovo = anoLetivo ? parseInt(anoLetivo as string) : new Date().getFullYear();

    const { obterSugestaoClasse } = await import('../services/progressaoAcademica.service.js');
    const sugestao = await obterSugestaoClasse(alunoId, instituicaoId, anoLetivoNovo);

    if (!sugestao) {
      return res.json({
        sugestao: null,
        mensagem: 'Aluno sem matrícula anterior. Selecione a classe/ano manualmente.',
      });
    }

    res.json({ sugestao });
  } catch (error) {
    next(error);
  }
};

export const getAtivaByAluno = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { alunoId } = req.params;
    
    const where: any = {
      alunoId,
      status: 'ATIVA',
    };

    // Aplicar filtro de instituição
    if (filter.instituicaoId) {
      where.instituicaoId = filter.instituicaoId;
    }
    
    const matriculaAnual = await prisma.matriculaAnual.findFirst({
      where,
      include: { 
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        },
        _count: {
          select: {
            disciplinas: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(matriculaAnual);
  } catch (error) {
    next(error);
  }
};

/**
 * Buscar todos os anos letivos do aluno (para organização por ano)
 * ALUNO: Pode consultar seus próprios anos letivos
 */
export const getMeusAnosLetivos = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const alunoId = req.user?.userId;
    const filter = addInstitutionFilter(req);

    if (!alunoId) {
      throw new AppError('Usuário não autenticado', 401);
    }

    // Buscar aluno para obter instituicaoId se não vier do token
    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      select: { instituicaoId: true },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    const instituicaoIdFinal = getInstituicaoIdFromFilter(filter) || aluno.instituicaoId;

    const where: any = {
      alunoId,
    };

    // Aplicar filtro de instituição (se disponível)
    if (instituicaoIdFinal) {
      where.instituicaoId = instituicaoIdFinal;
    }

    // Buscar matrículas anuais (incluindo todas, não apenas ATIVAS)
    // Isso permite que o aluno veja seu histórico completo
    const matriculasAnuais = await prisma.matriculaAnual.findMany({
      where,
      include: {
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        classe: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        anoLetivoRef: {
          select: {
            id: true,
            ano: true,
            status: true,
          }
        },
        _count: {
          select: {
            disciplinas: true,
          }
        }
      },
      orderBy: [
        { anoLetivo: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    // Log de diagnóstico (apenas em desenvolvimento)
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getMeusAnosLetivos] Matrículas encontradas:', {
        total: matriculasAnuais.length,
        alunoId,
        instituicaoIdFinal,
        matriculas: matriculasAnuais.map((ma) => ({
          id: ma.id,
          anoLetivo: ma.anoLetivo,
          anoLetivoId: ma.anoLetivoId,
          anoLetivoRefAno: ma.anoLetivoRef?.ano,
          status: ma.status,
        })),
      });
    }

    // Agrupar por ano letivo (usar anoLetivo da matrícula ou do anoLetivoRef)
    // IMPORTANTE: Se anoLetivo estiver null, usar anoLetivoRef.ano
    // Se ambos estiverem null, ainda assim incluir a matrícula (pode ter sido criada sem ano letivo)
    const anosLetivos = matriculasAnuais.map((ma) => {
      const anoLetivo = ma.anoLetivo || ma.anoLetivoRef?.ano;
      const anoLetivoId = ma.anoLetivoId || ma.anoLetivoRef?.id;
      
      return {
        anoLetivo: anoLetivo,
        anoLetivoId: anoLetivoId,
        status: ma.status,
        curso: ma.curso,
        classe: ma.classe,
        classeOuAnoCurso: ma.classeOuAnoCurso,
        totalDisciplinas: ma._count.disciplinas,
        createdAt: ma.createdAt,
        anoLetivoStatus: ma.anoLetivoRef?.status || null,
        matriculaAnualId: ma.id, // Adicionar ID da matrícula para referência
      };
    }).filter((a) => a.anoLetivo !== null && a.anoLetivo !== undefined); // Remover apenas se realmente não tiver ano letivo

    // Log de resultado
    if (process.env.NODE_ENV !== 'production') {
      console.log('[getMeusAnosLetivos] Anos letivos processados:', {
        total: anosLetivos.length,
        anosLetivos: anosLetivos.map((a) => ({
          anoLetivo: a.anoLetivo,
          status: a.status,
          matriculaAnualId: a.matriculaAnualId,
        })),
      });
    }

    res.json(anosLetivos);
  } catch (error) {
    next(error);
  }
};

export const create = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Verificação de segurança: garantir que prisma está definido
    if (!prisma) {
      throw new AppError('Erro interno: Prisma Client não inicializado', 500);
    }

    const filter = addInstitutionFilter(req);
    const instituicaoId = requireTenantScope(req);
    const { alunoId, anoLetivo, anoLetivoId, nivelEnsino, classeOuAnoCurso, cursoId, overrideReprovado } = req.body;

    if (!alunoId || !nivelEnsino || !classeOuAnoCurso) {
      throw new AppError('alunoId, nivelEnsino e classeOuAnoCurso são obrigatórios', 400);
    }

    // REGRA: Ano Letivo é CONTEXTO, não dependência técnica
    // Se fornecido, validar; se não, permitir criar matrícula sem ano letivo
    let anoLetivoFinal: number | null = null;
    let anoLetivoIdFinal: string | null = null;

    if (anoLetivoId) {
      // Se recebeu anoLetivoId, tentar validar (mas não bloquear se não estiver ativo)
      try {
        const anoLetivoValidado = await validarAnoLetivoIdAtivo(instituicaoId, anoLetivoId, 'criar matrícula anual');
        anoLetivoFinal = anoLetivoValidado.ano;
        anoLetivoIdFinal = anoLetivoValidado.id;
      } catch (error: any) {
        // Se não estiver ativo, ainda permitir criar (apenas avisar)
        const anoLetivoRecord = await prisma.anoLetivo.findFirst({
          where: { id: anoLetivoId, instituicaoId },
        });
        if (anoLetivoRecord) {
          anoLetivoFinal = anoLetivoRecord.ano;
          anoLetivoIdFinal = anoLetivoRecord.id;
          // Não bloquear - ano letivo é contexto, não dependência
        } else {
          throw new AppError('Ano letivo não encontrado', 404);
        }
      }
    } else if (anoLetivo) {
      // Se recebeu apenas o número do ano, buscar o ano letivo
      const anoLetivoRecord = await prisma.anoLetivo.findFirst({
        where: { instituicaoId, ano: anoLetivo },
      });
      if (anoLetivoRecord) {
        anoLetivoFinal = anoLetivo;
        anoLetivoIdFinal = anoLetivoRecord.id;
      } else {
        // Se não encontrou, usar apenas o número do ano (sem FK)
        anoLetivoFinal = anoLetivo;
        anoLetivoIdFinal = null;
      }
    } else {
      // Se não recebeu nenhum, tentar buscar o ano letivo ativo (mas não bloquear)
      try {
        const anoAtivo = await buscarAnoLetivoAtivo(instituicaoId);
        if (anoAtivo) {
          anoLetivoFinal = anoAtivo.ano;
          anoLetivoIdFinal = anoAtivo.id;
        }
        // Se não houver ano ativo, permitir criar matrícula sem ano letivo (anoLetivoFinal = null)
      } catch (error) {
        // Não bloquear - permitir criar matrícula sem ano letivo
        anoLetivoFinal = null;
        anoLetivoIdFinal = null;
      }
    }

    // 1. Verificar se o aluno existe e pertence à instituição
    const aluno = await prisma.user.findUnique({
      where: { id: alunoId },
      include: {
        roles: { select: { role: true } },
        instituicao: { 
          select: { 
            id: true,
            tipoAcademico: true,
          } 
        },
      },
    });

    if (!aluno) {
      throw new AppError('Aluno não encontrado', 404);
    }

    // Verificar se tem role ALUNO
    const temRoleAluno = aluno.roles.some(r => r.role === 'ALUNO');
    if (!temRoleAluno) {
      throw new AppError('Usuário não é um aluno', 400);
    }

    // Determinar instituiçãoId
    const instituicaoIdFinal = getInstituicaoIdFromFilter(filter) || aluno.instituicaoId;
    if (!instituicaoIdFinal) {
      throw new AppError('Instituição não identificada', 400);
    }

    // Verificar se a instituição do aluno corresponde ao filtro
    if (filter.instituicaoId && aluno.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a este aluno', 403);
    }

    // 2. REGRA CRÍTICA SIGA/SIGAE: Bloquear novas matrículas após conclusão do curso
    // Verificar se aluno já concluiu o curso/classe antes de permitir nova matrícula
    const { verificarAlunoConcluido } = await import('../services/conclusaoCurso.service.js');
    const verificacaoConclusao = await verificarAlunoConcluido(
      alunoId,
      cursoId || null,
      null, // classeId será verificado depois se necessário
      instituicaoIdFinal
    );

    if (verificacaoConclusao.concluido) {
      throw new AppError(
        `Aluno já concluiu o ${verificacaoConclusao.conclusao?.curso?.nome || verificacaoConclusao.conclusao?.classe?.nome || 'curso/classe'}. Não é permitido criar novas matrículas após conclusão. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE.`,
        403
      );
    }

    // 3. VALIDAÇÃO PADRÃO SIGA/SIGAE: Regras por tipo de instituição
    // Obter tipoAcademico do JWT (req.user.tipoAcademico) - não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || aluno.instituicao?.tipoAcademico || null;
    
    // REGRA POR TIPO DE INSTITUIÇÃO:
    // ENSINO SUPERIOR: Curso obrigatório, Semestre obrigatório, Sem matrícula/nota sem curso
    // ENSINO SECUNDÁRIO: Classe obrigatória, Curso opcional, Sem semestre
    
    if (tipoAcademico === 'SUPERIOR') {
      // ENSINO SUPERIOR: cursoId é OBRIGATÓRIO - NUNCA permitir null ou vazio
      if (!cursoId || cursoId.trim() === '') {
        throw new AppError(
          'Curso é obrigatório para matrícula anual no Ensino Superior. Selecione um curso antes de continuar.',
          400
        );
      }
    } else if (tipoAcademico === 'SECUNDARIO') {
      // ENSINO SECUNDÁRIO: classeId é OBRIGATÓRIO (vem de classeOuAnoCurso)
      // A validação da classe será feita mais abaixo quando validarmos classeOuAnoCurso
      // Mas precisamos garantir que classeId seja extraído e salvo
    }
    
    // Verificar se o curso existe e pertence à instituição (se fornecido ou obrigatório)
    if (cursoId) {
      const curso = await prisma.curso.findUnique({
        where: { id: cursoId },
        include: {
          instituicao: {
            select: { id: true },
          }
        }
      });

      if (!curso) {
        throw new AppError('Curso não encontrado', 404);
      }

      if (curso.instituicaoId !== instituicaoIdFinal) {
        throw new AppError('O curso não pertence à instituição do aluno', 400);
      }
    }

    // 4. Verificar se já existe matrícula anual ativa para o mesmo ano letivo (se fornecido)
    // Se não houver ano letivo, verificar apenas por aluno e instituição
    const whereMatriculaExistente: any = {
      alunoId,
      instituicaoId: instituicaoIdFinal,
      status: 'ATIVA',
    };
    
    if (anoLetivoFinal !== null) {
      whereMatriculaExistente.anoLetivo = anoLetivoFinal;
    }
    
    const matriculaExistente = await prisma.matriculaAnual.findFirst({
      where: whereMatriculaExistente,
    });

    if (matriculaExistente) {
      throw new AppError('Já existe uma matrícula anual ativa para este aluno neste ano letivo', 409);
    }

    // 4. Obter tipo acadêmico da instituição se não fornecido
    const tipoAcademicoInstituicao = aluno.instituicao?.tipoAcademico;
    if (!tipoAcademicoInstituicao) {
      throw new AppError('Tipo acadêmico da instituição não identificado', 400);
    }

    // Validar que o nivelEnsino corresponde ao tipoAcademico da instituição
    if (nivelEnsino !== tipoAcademicoInstituicao) {
      throw new AppError(`O nível de ensino fornecido (${nivelEnsino}) não corresponde ao tipo acadêmico da instituição (${tipoAcademicoInstituicao})`, 400);
    }

    // 5. VALIDAÇÃO PADRÃO SIGA/SIGAE: Validar classeOuAnoCurso conforme tipo de instituição
    // ENSINO_SUPERIOR: deve ser "1º Ano", "2º Ano", "3º Ano", "4º Ano", "5º Ano" ou "6º Ano"
    // ENSINO_SECUNDARIO: deve ser uma classe cadastrada no banco
    if (tipoAcademicoInstituicao === 'SUPERIOR') {
      const anosValidos = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano'];
      if (!anosValidos.includes(classeOuAnoCurso)) {
        throw new AppError(`Para Ensino Superior, o ano do curso deve ser: ${anosValidos.join(', ')}`, 400);
      }
    } else if (tipoAcademicoInstituicao === 'SECUNDARIO') {
      // ENSINO SECUNDÁRIO: Classe é OBRIGATÓRIA
      // Verificar se a classe existe no banco de dados
      let classeEncontrada = await prisma.classe.findFirst({
        where: {
          instituicaoId: instituicaoIdFinal,
          nome: classeOuAnoCurso,
        },
      });

      if (!classeEncontrada) {
        // Tentar buscar por ID também (caso o frontend envie ID)
        classeEncontrada = await prisma.classe.findFirst({
          where: {
            id: classeOuAnoCurso,
            instituicaoId: instituicaoIdFinal,
          },
        });

        if (!classeEncontrada) {
          throw new AppError(`Classe "${classeOuAnoCurso}" não encontrada no cadastro. Classe é obrigatória para Ensino Secundário. Cadastre a classe antes de criar a matrícula.`, 400);
        }
      }
      
      // Garantir que classeId seja salvo na matrícula (será usado abaixo)
      // A classe encontrada será usada ao criar a matrícula
    }

    // 5.5. VALIDAÇÕES BASEADAS EM CONFIGURAÇÕES AVANÇADAS (ParametrosSistema)
    // Buscar parâmetros do sistema da instituição
    // Verificação de segurança: garantir que prisma.parametrosSistema existe
    let parametrosSistema = null;
    try {
      // Usar findFirst em vez de findUnique para maior compatibilidade
      if (prisma && prisma.parametrosSistema) {
        parametrosSistema = await prisma.parametrosSistema.findFirst({
          where: { instituicaoId: instituicaoIdFinal },
        });
      }
    } catch (error: any) {
      // Se houver erro ao buscar parâmetros, usar valores padrão
      console.warn('Erro ao buscar parâmetros do sistema, usando valores padrão:', error?.message);
      parametrosSistema = null;
    }

    // Usar valores padrão se não houver configuração
    const bloquearMatriculaDivida = parametrosSistema?.bloquearMatriculaDivida ?? true;
    const permitirMatriculaForaPeriodo = parametrosSistema?.permitirMatriculaForaPeriodo ?? false;

    // 5.5.1. VALIDAÇÃO: Bloquear matrícula se houver dívida financeira (se configurado)
    if (bloquearMatriculaDivida) {
      const mensalidadesAtrasadas = await prisma.mensalidade.findMany({
        where: {
          alunoId,
          status: { in: ['Atrasado', 'Pendente'] },
          OR: [
            { status: 'Atrasado' },
            {
              status: 'Pendente',
              dataVencimento: { lt: new Date() },
            },
          ],
        },
        select: {
          id: true,
          valor: true,
          valorMulta: true,
          mesReferencia: true,
          anoReferencia: true,
          dataVencimento: true,
        },
      });

      if (mensalidadesAtrasadas.length > 0) {
        const totalDivida = mensalidadesAtrasadas.reduce((acc, m) => {
          const valor = Number(m.valor) || 0;
          const multa = Number(m.valorMulta) || 0;
          return acc + valor + multa;
        }, 0);

        const mensalidadesStr = mensalidadesAtrasadas
          .map(m => `${m.mesReferencia}/${m.anoReferencia}`)
          .join(', ');

        throw new AppError(
          `Não é possível criar a matrícula anual. O aluno possui ${mensalidadesAtrasadas.length} mensalidade(s) em atraso/pendente(s) (${mensalidadesStr}). ` +
          `Total da dívida: ${totalDivida.toFixed(2)}. ` +
          `Regularize as pendências financeiras antes de prosseguir com a matrícula.`,
          400
        );
      }
    }

    // 5.5.2. VALIDAÇÃO: Bloquear matrícula fora do período letivo (se configurado)
    if (!permitirMatriculaForaPeriodo && anoLetivoIdFinal) {
      const anoLetivoRef = await prisma.anoLetivo.findFirst({
        where: { 
          id: anoLetivoIdFinal,
          instituicaoId: instituicaoIdFinal, // CRÍTICO: Filtro multi-tenant
        },
        select: {
          id: true,
          ano: true,
          dataInicio: true,
          dataFim: true,
          status: true,
        },
      });

      if (anoLetivoRef && anoLetivoRef.dataInicio && anoLetivoRef.dataFim) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);

        const dataInicio = new Date(anoLetivoRef.dataInicio);
        dataInicio.setHours(0, 0, 0, 0);

        const dataFim = new Date(anoLetivoRef.dataFim);
        dataFim.setHours(23, 59, 59, 999);

        if (hoje < dataInicio || hoje > dataFim) {
          throw new AppError(
            `Não é possível criar a matrícula anual fora do período letivo. ` +
            `Período letivo do ano ${anoLetivoRef.ano}: ${dataInicio.toLocaleDateString('pt-BR')} a ${dataFim.toLocaleDateString('pt-BR')}. ` +
            `Data atual: ${hoje.toLocaleDateString('pt-BR')}. ` +
            `Entre em contato com a secretaria acadêmica para casos excepcionais.`,
            400
          );
        }
      }
    }

    // 6. Extrair classeId se for Ensino Secundário (classe é obrigatória)
    let classeIdFinal: string | null = null;
    if (tipoAcademicoInstituicao === 'SECUNDARIO') {
      // Buscar classe novamente para garantir que temos o ID
      const classeParaMatricula = await prisma.classe.findFirst({
        where: {
          instituicaoId: instituicaoIdFinal,
          OR: [
            { nome: classeOuAnoCurso },
            { id: classeOuAnoCurso },
          ],
        },
      });
      
      if (!classeParaMatricula) {
        throw new AppError('Classe não encontrada. Classe é obrigatória para Ensino Secundário.', 400);
      }
      
      classeIdFinal = classeParaMatricula.id;
    }

    // 6.5. VALIDAÇÃO PROGRESSÃO: Bloquear matrícula na classe seguinte se aluno reprovado (exceto ADMIN com override)
    const { validarMatriculaClasse } = await import('../services/progressaoAcademica.service.js');
    const userRoles = (req.user?.roles || []).map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name));
    const classeParaValidar = tipoAcademicoInstituicao === 'SECUNDARIO' ? (classeIdFinal || classeOuAnoCurso) : classeOuAnoCurso;
    const validacaoProgressao = await validarMatriculaClasse(
      alunoId,
      classeParaValidar,
      cursoId || null,
      instituicaoIdFinal,
      userRoles,
      overrideReprovado === true
    );
    if (!validacaoProgressao.permitido) {
      throw new AppError(validacaoProgressao.motivoBloqueio || 'Matrícula bloqueada por regra de progressão.', 403);
    }
    
    // 7. Criar a matrícula anual
    // REGRA POR TIPO DE INSTITUIÇÃO:
    // - ENSINO SUPERIOR: cursoId obrigatório (já validado), classeId null
    // - ENSINO SECUNDÁRIO: classeId obrigatório (já validado), cursoId opcional
    const matriculaData: any = {
      alunoId,
      instituicaoId: instituicaoIdFinal,
      nivelEnsino,
      classeOuAnoCurso,
      cursoId: tipoAcademicoInstituicao === 'SUPERIOR' ? cursoId : (cursoId || null), // Ensino Superior exige curso, Secundário permite null
      classeId: tipoAcademicoInstituicao === 'SECUNDARIO' ? classeIdFinal : null, // Ensino Secundário exige classe, Superior permite null
      status: 'ATIVA',
    };

    // Ano Letivo é contexto opcional
    if (anoLetivoFinal !== null) {
      matriculaData.anoLetivo = anoLetivoFinal;
    }
    if (anoLetivoIdFinal !== null) {
      matriculaData.anoLetivoId = anoLetivoIdFinal;
    }

    const matriculaAnual = await prisma.matriculaAnual.create({
      data: matriculaData,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          }
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        }
      },
    });

    res.status(201).json(matriculaAnual);
  } catch (error) {
    next(error);
  }
};

export const update = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;
    const { status, classeOuAnoCurso, cursoId, overrideReprovado } = req.body;

    // Verificar se existe e pertence à instituição
    const existing = await prisma.matriculaAnual.findUnique({
      where: { id },
      include: {
        instituicao: {
          select: { id: true },
        }
      },
    });

    if (!existing) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }

    // Verificar acesso à instituição
    if (filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta matrícula', 403);
    }

    // REGRA CRÍTICA SIGA/SIGAE: Bloquear edição de matrícula após conclusão
    if (existing.status === 'CONCLUIDA') {
      throw new AppError(
        'Matrícula não pode ser editada após conclusão do curso. O histórico acadêmico é imutável conforme padrão SIGA/SIGAE.',
        403
      );
    }

    // Verificar se aluno tem curso concluído (bloqueio adicional)
    const { verificarAlunoConcluido } = await import('../services/conclusaoCurso.service.js');
    const verificacao = await verificarAlunoConcluido(
      existing.alunoId,
      existing.cursoId || null,
      existing.classeId || null,
      existing.instituicaoId
    );

    if (verificacao.concluido) {
      throw new AppError(
        `Aluno já concluiu o ${verificacao.conclusao?.curso?.nome || verificacao.conclusao?.classe?.nome || 'curso/classe'}. Matrícula não pode ser editada após conclusão.`,
        403
      );
    }

    // VALIDAÇÃO PADRÃO SIGA/SIGAE: Curso é OBRIGATÓRIO no Ensino Superior
    // Obter tipoAcademico do JWT (req.user.tipoAcademico) - não buscar no banco
    const tipoAcademico = req.user?.tipoAcademico || null;
    
    // Buscar tipo acadêmico da instituição se não vier do JWT
    let tipoAcademicoInstituicao = tipoAcademico;
    if (!tipoAcademicoInstituicao) {
      const instituicao = await prisma.instituicao.findUnique({
        where: { id: existing.instituicaoId },
        select: { tipoAcademico: true },
      });
      tipoAcademicoInstituicao = instituicao?.tipoAcademico || null;
    }
    
    if (tipoAcademicoInstituicao === 'SUPERIOR') {
      // ENSINO SUPERIOR: cursoId é OBRIGATÓRIO e NÃO pode ser removido
      const cursoIdFinal = cursoId !== undefined ? (cursoId || null) : existing.cursoId;
      
      // VALIDAÇÃO CRÍTICA: Não permitir cursoId null ou vazio no Ensino Superior
      if (!cursoIdFinal || cursoIdFinal.trim() === '') {
        throw new AppError(
          'Curso é obrigatório para matrícula anual no Ensino Superior. Não é permitido remover ou deixar o curso vazio em uma matrícula existente.',
          400
        );
      }
      
      // Se cursoId foi fornecido (mesmo que seja o mesmo), validar que existe e pertence à instituição
      if (cursoId && cursoId !== existing.cursoId) {
        const curso = await prisma.curso.findUnique({
          where: { id: cursoId },
          include: {
            instituicao: {
              select: { id: true },
            }
          }
        });

        if (!curso) {
          throw new AppError('Curso não encontrado', 404);
        }

        if (curso.instituicaoId !== existing.instituicaoId) {
          throw new AppError('O curso não pertence à instituição da matrícula', 400);
        }
      }
    } else {
      // ENSINO SECUNDÁRIO: cursoId é opcional (pode ser null)
      // Validar curso apenas se fornecido
      if (cursoId) {
        const curso = await prisma.curso.findUnique({
          where: { id: cursoId },
          include: {
            instituicao: {
              select: { id: true },
            }
          }
        });

        if (!curso) {
          throw new AppError('Curso não encontrado', 404);
        }

        if (curso.instituicaoId !== existing.instituicaoId) {
          throw new AppError('O curso não pertence à instituição da matrícula', 400);
        }
      }
    }

    // Validar classeOuAnoCurso se fornecido (validação PADRÃO SIGA/SIGAE)
    if (classeOuAnoCurso !== undefined) {
      // Usar tipoAcademicoInstituicao já obtido anteriormente
      
      if (tipoAcademicoInstituicao === 'SUPERIOR') {
        const anosValidos = ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano', '6º Ano'];
        if (!anosValidos.includes(classeOuAnoCurso)) {
          throw new AppError(`Para Ensino Superior, o ano do curso deve ser: ${anosValidos.join(', ')}`, 400);
        }
      } else if (tipoAcademicoInstituicao === 'SECUNDARIO') {
        // Verificar se a classe existe no banco de dados
        const classe = await prisma.classe.findFirst({
          where: {
            instituicaoId: existing.instituicaoId,
            nome: classeOuAnoCurso,
          },
        });

        if (!classe) {
          // Tentar buscar por ID também (caso o frontend envie ID)
          const classeById = await prisma.classe.findFirst({
            where: {
              id: classeOuAnoCurso,
              instituicaoId: existing.instituicaoId,
            },
          });

          if (!classeById) {
            throw new AppError(`Classe "${classeOuAnoCurso}" não encontrada no cadastro. Cadastre a classe antes de atualizar a matrícula.`, 400);
          }
        }
      }

      // 6.5. VALIDAÇÃO PROGRESSÃO: Bloquear alteração para classe seguinte se aluno reprovado (exceto ADMIN com override)
      const { validarMatriculaClasse } = await import('../services/progressaoAcademica.service.js');
      const userRoles = (req.user?.roles || []).map((r: any) => (typeof r === 'string' ? r : r?.role || r?.name));
      const classeParaValidar = classeOuAnoCurso;
      const validacaoProgressao = await validarMatriculaClasse(
        existing.alunoId,
        classeParaValidar,
        existing.cursoId || cursoId || null,
        existing.instituicaoId,
        userRoles,
        overrideReprovado === true,
        existing.anoLetivo ?? undefined
      );
      if (!validacaoProgressao.permitido) {
        throw new AppError(validacaoProgressao.motivoBloqueio || 'Alteração bloqueada por regra de progressão.', 403);
      }
    }

    // Preparar dados de atualização
    const updateData: any = {};
    if (status !== undefined) {
      updateData.status = status;
    }
    if (classeOuAnoCurso !== undefined) {
      updateData.classeOuAnoCurso = classeOuAnoCurso;
    }
    if (cursoId !== undefined) {
      // VALIDAÇÃO: No Ensino Superior, não permitir definir cursoId como null
      if (tipoAcademicoInstituicao === 'SUPERIOR' && (!cursoId || cursoId.trim() === '')) {
        throw new AppError(
          'Curso é obrigatório para matrícula anual no Ensino Superior. Não é permitido remover o curso.',
          400
        );
      }
      updateData.cursoId = cursoId || null;
    }

    if (Object.keys(updateData).length === 0) {
      throw new AppError('Nenhum campo válido para atualizar', 400);
    }

    const matriculaAnual = await prisma.matriculaAnual.update({
      where: { id },
      data: updateData,
      include: {
        aluno: {
          select: {
            id: true,
            nomeCompleto: true,
            email: true,
          }
        },
        curso: {
          select: {
            id: true,
            nome: true,
            codigo: true,
          }
        },
        instituicao: {
          select: {
            id: true,
            nome: true,
            tipoAcademico: true,
          }
        }
      },
    });

    res.json(matriculaAnual);
  } catch (error) {
    next(error);
  }
};

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = addInstitutionFilter(req);
    const { id } = req.params;

    // Verificar se existe e pertence à instituição
    const existing = await prisma.matriculaAnual.findUnique({
      where: { id },
      include: {
        instituicao: {
          select: { id: true },
        },
        _count: {
          select: {
            disciplinas: true,
          }
        }
      },
    });

    if (!existing) {
      throw new AppError('Matrícula anual não encontrada', 404);
    }

    // Verificar acesso à instituição
    if (filter.instituicaoId && existing.instituicaoId !== filter.instituicaoId) {
      throw new AppError('Acesso negado a esta matrícula', 403);
    }

    // Verificar se há disciplinas matriculadas
    if (existing._count.disciplinas > 0) {
      throw new AppError('Não é possível excluir uma matrícula anual que possui disciplinas matriculadas. Cancele ou conclua a matrícula primeiro.', 400);
    }

    await prisma.matriculaAnual.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

