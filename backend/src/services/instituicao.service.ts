import prisma from '../lib/prisma.js';
import { TipoInstituicao, TipoAcademico } from '@prisma/client';
import { getDefaultColorsByTipoAcademico } from '../utils/defaultColors.js';

/**
 * Identifica automaticamente o tipo de instituição com base na estrutura acadêmica existente.
 * 
 * Lógica de identificação:
 * - Ensino Superior: cursos com grau (Licenciatura, Mestrado, etc.) OU uso de semestres numéricos
 * - Ensino Secundário: disciplinas com trimestresOferecidos OU turmas com nomes que indicam classes (10ª, 11ª, 12ª)
 * - Mista: possui características de ambos
 * - Em Configuração: não possui dados suficientes para identificar
 */
export async function identificarTipoInstituicao(instituicaoId: string): Promise<TipoInstituicao> {
  // Buscar dados acadêmicos da instituição
  // REGRA SIGA/SIGAE: Disciplina NÃO possui campo semestre
  // O semestre pertence ao PlanoEnsino, não à Disciplina
  const [cursos, disciplinas, turmas, planosEnsino] = await Promise.all([
    prisma.curso.findMany({
      where: { instituicaoId },
      select: { grau: true, tipo: true, nome: true }
    }),
    prisma.disciplina.findMany({
      where: { instituicaoId },
      select: { 
        trimestresOferecidos: true,
        curso: {
          select: { grau: true }
        }
      }
    }),
    prisma.turma.findMany({
      where: { instituicaoId },
      select: { nome: true, semestre: true }
    }),
    prisma.planoEnsino.findMany({
      where: { instituicaoId },
      select: { semestre: true, semestreId: true }
    })
  ]);

  // Se não há dados, está em configuração
  if (cursos.length === 0 && disciplinas.length === 0 && turmas.length === 0) {
    return TipoInstituicao.EM_CONFIGURACAO;
  }

  // Indicadores de Ensino Superior
  let indicadoresSuperior = 0;
  const grausSuperiores = ['licenciatura', 'mestrado', 'doutoramento', 'bacharelato', 'pós-graduação', 'graduação'];
  
  // Verificar cursos com grau superior
  const cursosComGrauSuperior = cursos.filter(curso => 
    curso.grau && grausSuperiores.some(grau => 
      curso.grau!.toLowerCase().includes(grau)
    )
  );
  if (cursosComGrauSuperior.length > 0) {
    indicadoresSuperior += 2; // Peso maior para cursos superiores
  }

  // Verificar uso de semestres numéricos (1, 2, 3, etc.) - comum no ensino superior
  // REGRA SIGA/SIGAE: Semestre pertence ao PlanoEnsino, não à Disciplina
  // Verificar se há planos de ensino com semestre definido
  const planosComSemestre = planosEnsino.filter(p => p.semestre && p.semestre > 0);
  if (planosComSemestre.length > 0) {
    indicadoresSuperior += 1;
  }

  // Verificar se há semestres nas turmas (formato numérico)
  const turmasComSemestre = turmas.filter(t => 
    t.semestre && /^\d+$/.test(t.semestre.toString())
  );
  if (turmasComSemestre.length > 0) {
    indicadoresSuperior += 1;
  }

  // Indicadores de Ensino Secundário
  let indicadoresSecundario = 0;
  
  // Verificar disciplinas com trimestres (característico do ensino médio)
  const disciplinasComTrimestres = disciplinas.filter(d => 
    d.trimestresOferecidos && d.trimestresOferecidos.length > 0
  );
  if (disciplinasComTrimestres.length > 0) {
    indicadoresSecundario += 2; // Peso maior para trimestres
  }

  // Verificar nomes de turmas que indicam classes (10ª, 11ª, 12ª, etc.)
  const padraoClasse = /(\d{1,2})ª?\s*(classe|ano|série)?/i;
  const turmasComClasse = turmas.filter(t => 
    padraoClasse.test(t.nome)
  );
  if (turmasComClasse.length > 0) {
    indicadoresSecundario += 2; // Peso maior para classes
  }

  // Verificar se há cursos sem grau definido (mais comum no ensino médio)
  const cursosSemGrauSuperior = cursos.filter(curso => 
    !curso.grau || !grausSuperiores.some(grau => 
      curso.grau!.toLowerCase().includes(grau)
    )
  );
  if (cursosSemGrauSuperior.length > cursosComGrauSuperior.length && cursos.length > 0) {
    indicadoresSecundario += 1;
  }

  // Decisão baseada nos indicadores
  const temSuperior = indicadoresSuperior > 0;
  const temSecundario = indicadoresSecundario > 0;

  if (temSuperior && temSecundario) {
    return TipoInstituicao.MISTA;
  } else if (temSuperior) {
    return TipoInstituicao.UNIVERSIDADE;
  } else if (temSecundario) {
    return TipoInstituicao.ENSINO_MEDIO;
  } else {
    // Se não há indicadores claros, mas há dados, considerar em configuração
    return TipoInstituicao.EM_CONFIGURACAO;
  }
}

/**
 * Identifica automaticamente o tipo acadêmico (SECUNDARIO ou SUPERIOR) baseado na estrutura.
 * 
 * Lógica:
 * - SUPERIOR: cursos com semestres/créditos, disciplinas com semestres numéricos
 * - SECUNDARIO: turmas/classes com anos escolares, disciplinas com trimestres
 */
export async function identificarTipoAcademico(instituicaoId: string): Promise<TipoAcademico | null> {
  // REGRA SIGA/SIGAE: Disciplina NÃO possui campo semestre
  // O semestre pertence ao PlanoEnsino, não à Disciplina
  const [cursos, disciplinas, turmas, planosEnsino, cursoDisciplinas] = await Promise.all([
    prisma.curso.findMany({
      where: { instituicaoId },
      select: { 
        grau: true, 
        tipo: true
      }
    }),
    prisma.disciplina.findMany({
      where: { instituicaoId },
      select: { 
        trimestresOferecidos: true,
        curso: {
          select: { grau: true }
        }
      }
    }),
    prisma.turma.findMany({
      where: { instituicaoId },
      select: { nome: true, semestre: true, ano: true }
    }),
    prisma.planoEnsino.findMany({
      where: { instituicaoId },
      select: { semestre: true, semestreId: true }
    }),
    prisma.cursoDisciplina.findMany({
      where: {
        curso: { instituicaoId }
      },
      select: { semestre: true }
    })
  ]);

  // Se não há dados, retornar null
  if (cursos.length === 0 && disciplinas.length === 0 && turmas.length === 0) {
    return null;
  }

  // Indicadores de Ensino Superior
  let indicadoresSuperior = 0;
  
  // Cursos com grau superior (Licenciatura, Mestrado, etc.)
  const grausSuperiores = ['licenciatura', 'mestrado', 'doutoramento', 'bacharelato', 'pós-graduação', 'graduação'];
  const cursosComGrauSuperior = cursos.filter(curso => 
    curso.grau && grausSuperiores.some(grau => 
      curso.grau!.toLowerCase().includes(grau)
    )
  );
  if (cursosComGrauSuperior.length > 0) {
    indicadoresSuperior += 3; // Peso alto
  }

  // Planos de Ensino com semestres numéricos (1, 2, 3, etc.) - característico do ensino superior
  // REGRA SIGA/SIGAE: Semestre pertence ao PlanoEnsino, não à Disciplina
  const planosComSemestre = planosEnsino.filter(p => p.semestre && p.semestre > 0);
  const cursoDisciplinasComSemestre = cursoDisciplinas.filter(cd => cd.semestre && cd.semestre > 0);
  // Considerar ambos: PlanoEnsino (fonte de verdade) e CursoDisciplina (estrutura curricular)
  const totalComSemestre = planosComSemestre.length + cursoDisciplinasComSemestre.length;
  const totalEstrutura = planosEnsino.length + cursoDisciplinas.length;
  if (totalComSemestre > 0 && totalEstrutura > 0 && totalComSemestre / totalEstrutura > 0.5) {
    indicadoresSuperior += 2; // Maioria da estrutura tem semestre
  }

  // Indicadores de Ensino Secundário
  let indicadoresSecundario = 0;
  
  // Disciplinas com trimestres (característico do ensino médio)
  const disciplinasComTrimestres = disciplinas.filter(d => 
    d.trimestresOferecidos && d.trimestresOferecidos.length > 0
  );
  if (disciplinasComTrimestres.length > 0) {
    indicadoresSecundario += 3; // Peso alto
  }

  // Turmas com nomes que indicam classes/anos escolares (10ª, 11ª, 12ª, etc.)
  const padraoClasse = /(\d{1,2})ª?\s*(classe|ano|série)?/i;
  const turmasComClasse = turmas.filter(t => 
    padraoClasse.test(t.nome)
  );
  if (turmasComClasse.length > 0) {
    indicadoresSecundario += 2;
  }

  // Turmas sem semestre definido mas com ano (característico do ensino secundário)
  const turmasSemSemestreComAno = turmas.filter(t => 
    !t.semestre && t.ano && t.ano > 0
  );
  if (turmasSemSemestreComAno.length > turmas.length * 0.5) {
    indicadoresSecundario += 1;
  }

  // Decisão baseada nos indicadores
  if (indicadoresSuperior > indicadoresSecundario && indicadoresSuperior > 0) {
    return TipoAcademico.SUPERIOR;
  } else if (indicadoresSecundario > indicadoresSuperior && indicadoresSecundario > 0) {
    return TipoAcademico.SECUNDARIO;
  } else {
    // Se há dados mas não há indicadores claros, retornar null (será definido depois)
    return null;
  }
}

/**
 * Atualiza o tipo acadêmico da instituição automaticamente.
 * Se o tipoAcademico já foi definido manualmente e não há dados acadêmicos suficientes,
 * mantém o valor manual. Caso contrário, identifica automaticamente.
 */
export async function atualizarTipoAcademico(instituicaoId: string, forceUpdate: boolean = false): Promise<TipoAcademico | null> {
  try {
    // Buscar tipoAcademico atual da instituição
    const instituicao = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true }
    });

    if (!instituicao) {
      // Instituição não encontrada - retornar null sem erro
      return null;
    }

    // Identificar tipo acadêmico baseado na estrutura (com tratamento de erro)
    let tipoAcademicoIdentificado: TipoAcademico | null = null;
    try {
      tipoAcademicoIdentificado = await identificarTipoAcademico(instituicaoId);
    } catch (error) {
      // Se houver erro ao identificar, usar tipo atual do banco
      console.error(`[atualizarTipoAcademico] Erro ao identificar tipo acadêmico para ${instituicaoId}:`, error);
      return instituicao.tipoAcademico;
    }
    
    // Se não há tipo identificado e já existe um tipo definido manualmente, manter o manual
    // A menos que forceUpdate seja true (usado nas configurações de nota fiscal)
    if (!forceUpdate && !tipoAcademicoIdentificado && instituicao?.tipoAcademico) {
      return instituicao.tipoAcademico;
    }

    // Se há tipo identificado ou forceUpdate é true, usar o identificado
    const tipoAcademicoFinal = tipoAcademicoIdentificado || instituicao?.tipoAcademico || null;
    
    if (tipoAcademicoFinal) {
      try {
        await prisma.instituicao.update({
          where: { id: instituicaoId },
          data: { tipoAcademico: tipoAcademicoFinal }
        });
      } catch (error) {
        // Se houver erro ao atualizar, retornar tipo atual sem falhar
        console.error(`[atualizarTipoAcademico] Erro ao atualizar tipo acadêmico para ${instituicaoId}:`, error);
        return instituicao.tipoAcademico;
      }

      // Buscar configuração atual para verificar se há cores personalizadas
      const configuracaoAtual = await prisma.configuracaoInstituicao.findFirst({
        where: { instituicaoId },
        select: { corPrimaria: true, corSecundaria: true, corTerciaria: true }
      });
      
      // Verificar se há cores personalizadas (todas as três cores definidas)
      const coresPersonalizadas = configuracaoAtual?.corPrimaria && 
                                  configuracaoAtual?.corSecundaria && 
                                  configuracaoAtual?.corTerciaria;
      
      // Se não há cores personalizadas, aplicar cores padrão do novo tipo
      const defaultColors = getDefaultColorsByTipoAcademico(tipoAcademicoFinal);
      
      // Também atualizar na ConfiguracaoInstituicao se existir ou criar se não existir
      const configuracaoExiste = await prisma.configuracaoInstituicao.findFirst({
        where: { instituicaoId }
      });
      
      try {
        if (configuracaoExiste) {
          // Atualizar configuração existente
          await prisma.configuracaoInstituicao.updateMany({
            where: { instituicaoId },
            data: { 
              tipoAcademico: tipoAcademicoFinal,
              // Aplicar cores padrão apenas se não há cores personalizadas
              ...(coresPersonalizadas ? {} : {
                corPrimaria: defaultColors.corPrimaria,
                corSecundaria: defaultColors.corSecundaria,
                corTerciaria: defaultColors.corTerciaria,
              })
            }
          });
        } else {
          // Criar configuração se não existir, aplicando cores padrão
          await prisma.configuracaoInstituicao.create({
            data: {
              instituicaoId,
              tipoAcademico: tipoAcademicoFinal,
              corPrimaria: defaultColors.corPrimaria,
              corSecundaria: defaultColors.corSecundaria,
              corTerciaria: defaultColors.corTerciaria,
            }
          });
        }
      } catch (error) {
        // Se houver erro ao atualizar configuração, apenas logar (não crítico)
        console.error(`[atualizarTipoAcademico] Erro ao atualizar configuração para ${instituicaoId}:`, error);
      }
      
      return tipoAcademicoFinal;
    }
  } catch (error) {
    // Se houver erro geral, retornar tipo atual do banco sem falhar
    console.error(`[atualizarTipoAcademico] Erro geral para ${instituicaoId}:`, error);
    const instituicaoAtual = await prisma.instituicao.findUnique({
      where: { id: instituicaoId },
      select: { tipoAcademico: true }
    });
    return instituicaoAtual?.tipoAcademico || null;
  }

  // Se não há tipo identificado e não foi atualizado, buscar tipo atual
  const instituicaoAtual = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoAcademico: true }
  });
  return instituicaoAtual?.tipoAcademico || null;
}

/**
 * Obtém o tipo de instituição identificado automaticamente.
 * Retorna o tipo atual do banco se existir, caso contrário identifica automaticamente.
 */
export async function obterTipoInstituicao(instituicaoId: string): Promise<TipoInstituicao> {
  const instituicao = await prisma.instituicao.findUnique({
    where: { id: instituicaoId },
    select: { tipoInstituicao: true }
  });

  if (!instituicao) {
    throw new Error('Instituição não encontrada');
  }

  // Sempre recalcular o tipo baseado na estrutura atual
  const tipoIdentificado = await identificarTipoInstituicao(instituicaoId);
  
  // Atualizar tipo acadêmico automaticamente
  await atualizarTipoAcademico(instituicaoId);
  
  return tipoIdentificado;
}

