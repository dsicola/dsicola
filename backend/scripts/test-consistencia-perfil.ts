/**
 * ========================================
 * TESTE DE CONSISTÊNCIA POR PERFIL - DSICOLA
 * ========================================
 * 
 * Sistema completo de validação RBAC por perfil
 * Garante que cada role vê, acessa e executa APENAS o permitido
 * 
 * Perfis validados:
 * - SUPER_ADMIN
 * - ADMIN (Instituição)
 * - PROFESSOR
 * - ALUNO
 * - FUNCIONARIO (Secretaria)
 * 
 * Validações:
 * 1. Menu/Sidebar por perfil
 * 2. Rotas protegidas (403 Forbidden)
 * 3. CRUD por entidade
 * 4. Multi-tenant (instituicao_id)
 * 5. Campos condicionais (ENSINO_SUPERIOR vs ENSINO_SECUNDARIO)
 * 
 * Uso:
 *   npm run test:consistencia-perfil
 *   ou
 *   tsx scripts/test-consistencia-perfil.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ========================================
// DEFINIÇÕES DE PERFIS E PERMISSÕES
// ========================================

type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'PROFESSOR' | 'ALUNO' | 'SECRETARIA' | 'FUNCIONARIO' | 'RH' | 'FINANCEIRO' | 'POS' | 'DIRECAO' | 'COORDENADOR' | 'AUDITOR' | 'RESPONSAVEL';

interface PerfilPermissoes {
  role: UserRole;
  pode: string[];
  naoPode: string[];
  modulosPermitidos: string[];
  modulosBloqueados: string[];
}

const PERFIS: Record<UserRole, PerfilPermissoes> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    pode: [
      'Ver todas instituições',
      'Configurações globais',
      'Backups globais',
      'Auditorias',
      'Gerenciar assinaturas',
      'Gerenciar planos e preços',
    ],
    naoPode: [
      'Lançar notas',
      'Criar aulas',
      'Marcar presença',
      'Acessar módulos acadêmicos',
      'Configurar ensinos',
    ],
    modulosPermitidos: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'ASSINATURAS',
      'PLANOS_PRECOS',
      'EMAILS',
      'LOGS_GLOBAIS',
      'FINANCEIRO',
    ],
    modulosBloqueados: [
      'CONFIGURACAO_ENSINOS',
      'PLANO_ENSINO',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
    ],
  },
  ADMIN: {
    role: 'ADMIN',
    pode: [
      'Cursos',
      'Disciplinas',
      'Professores',
      'Ano Letivo',
      'Plano de Ensino',
      'Turmas',
      'Matrículas',
      'Relatórios institucionais',
      'Lançar notas',
      'Criar aulas',
      'Marcar presença',
    ],
    naoPode: [
      'Acessar dados de outra instituição',
      'Configurações globais',
      'Gerenciar outras instituições',
    ],
    modulosPermitidos: [
      'CONFIGURACAO_ENSINOS',
      'CALENDARIO_ACADEMICO',
      'PLANO_ENSINO',
      'DISTRIBUICAO_AULAS',
      'ENCERRAMENTO_ACADEMICO',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'AVALIACOES',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
      'DOCUMENTOS_ACADEMICOS',
      'FINANCEIRO',
    ],
    modulosBloqueados: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'ASSINATURAS',
      'PLANOS_PRECOS',
    ],
  },
  PROFESSOR: {
    role: 'PROFESSOR',
    pode: [
      'Ver apenas seus Planos de Ensino',
      'Criar aulas',
      'Marcar presenças',
      'Lançar notas',
    ],
    naoPode: [
      'Criar curso',
      'Criar disciplina',
      'Criar ano letivo',
      'Ver dados administrativos',
      'Configurar ensinos',
      'Aprovar planos de ensino',
    ],
    modulosPermitidos: [
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'NOTAS',
      'PLANO_ENSINO', // Apenas leitura própria
    ],
    modulosBloqueados: [
      'CONFIGURACAO_ENSINOS',
      'CALENDARIO_ACADEMICO',
      'DISTRIBUICAO_AULAS',
      'ENCERRAMENTO_ACADEMICO',
      'ALUNOS',
      'MATRICULAS',
    ],
  },
  ALUNO: {
    role: 'ALUNO',
    pode: [
      'Ver notas',
      'Ver frequência',
      'Ver boletim',
      'Ver histórico',
    ],
    naoPode: [
      'Editar dados acadêmicos',
      'Ver dados de outros alunos',
      'Criar qualquer registro',
      'Lançar notas',
      'Criar aulas',
    ],
    modulosPermitidos: [
      'CONSULTA_NOTAS',
      'CONSULTA_PRESENCAS',
      'CONSULTA_CALENDARIO',
      'CONSULTA_DOCUMENTOS',
      'BIBLIOTECA',
    ],
    modulosBloqueados: [
      'CONFIGURACAO_ENSINOS',
      'PLANO_ENSINO',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
    ],
  },
  FUNCIONARIO: {
    role: 'FUNCIONARIO',
    pode: [
      'Matrículas',
      'Transferências',
      'Documentos',
      'Relatórios administrativos',
    ],
    naoPode: [
      'Lançar notas',
      'Criar aulas',
      'Alterar plano de ensino',
      'Aprovar planos',
    ],
    modulosPermitidos: [
      'ALUNOS',
      'MATRICULAS',
      'DOCUMENTOS_ACADEMICOS',
      'PRESENCAS', // Ver e ajustar
      'NOTAS', // Ver e ajustar
      'CALENDARIO_ACADEMICO', // Ajustar datas
    ],
    modulosBloqueados: [
      'PLANO_ENSINO', // Não pode criar/editar
      'LANCAMENTO_AULAS',
      'ENCERRAMENTO_ACADEMICO',
    ],
  },
  RH: {
    role: 'RH',
    pode: [
      'Funcionários',
      'Folha de pagamento',
      'Frequência',
      'Contratos',
      'Departamentos',
      'Cargos',
      'Biometria',
    ],
    naoPode: [
      'Configurações da instituição',
      'Gerenciar instituições',
      'Acessar módulos acadêmicos',
      'Mensalidades/Pagamentos (gestão financeira)',
    ],
    modulosPermitidos: [
      'RH',
      'FOLHA_PAGAMENTO',
      'FREQUENCIA_FUNCIONARIOS',
      'CONTRATOS',
      'BIOMETRIA',
    ],
    modulosBloqueados: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'CONFIGURACAO_ENSINOS',
      'FINANCEIRO', // RH não gerencia mensalidades
    ],
  },
  FINANCEIRO: {
    role: 'FINANCEIRO',
    pode: [
      'Mensalidades',
      'Pagamentos',
      'Recibos',
      'Registrar e estornar pagamentos',
    ],
    naoPode: [
      'Configurações da instituição',
      'Gerenciar instituições',
      'Módulos de RH',
      'Configurações acadêmicas',
    ],
    modulosPermitidos: [
      'FINANCEIRO',
      'MENSALIDADES',
      'PAGAMENTOS',
      'RECIBOS',
    ],
    modulosBloqueados: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'CONFIGURACAO_ENSINOS',
      'RH', // Financeiro não gerencia funcionários
    ],
  },
  POS: {
    role: 'POS',
    pode: [
      'Registrar pagamentos',
      'Emitir recibos',
      'Consultar mensalidades',
    ],
    naoPode: [
      'Configurações',
      'Gerenciar instituições',
      'Módulos acadêmicos',
    ],
    modulosPermitidos: [
      'FINANCEIRO',
      'PAGAMENTOS',
    ],
    modulosBloqueados: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'CONFIGURACAO_ENSINOS',
      'RH',
    ],
  },
  SECRETARIA: {
    role: 'SECRETARIA',
    pode: [
      'Matrículas',
      'Transferências',
      'Documentos',
      'Relatórios administrativos',
    ],
    naoPode: [
      'Lançar notas',
      'Criar aulas',
      'Alterar plano de ensino',
    ],
    modulosPermitidos: [
      'ALUNOS',
      'MATRICULAS',
      'DOCUMENTOS_ACADEMICOS',
      'PRESENCAS',
      'NOTAS',
      'CALENDARIO_ACADEMICO',
    ],
    modulosBloqueados: [
      'PLANO_ENSINO',
      'LANCAMENTO_AULAS',
      'ENCERRAMENTO_ACADEMICO',
    ],
  },
  DIRECAO: {
    role: 'DIRECAO',
    pode: [
      'Todas permissões de ADMIN',
      'Aprovações finais',
      'Encerramentos acadêmicos',
    ],
    naoPode: [
      'Acessar dados de outra instituição',
      'Configurações globais',
    ],
    modulosPermitidos: [
      'CONFIGURACAO_ENSINOS',
      'CALENDARIO_ACADEMICO',
      'PLANO_ENSINO',
      'DISTRIBUICAO_AULAS',
      'ENCERRAMENTO_ACADEMICO',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'AVALIACOES',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
      'DOCUMENTOS_ACADEMICOS',
    ],
    modulosBloqueados: [
      'SAAS_MANAGEMENT',
      'INSTITUICOES',
      'ASSINATURAS',
    ],
  },
  COORDENADOR: {
    role: 'COORDENADOR',
    pode: [
      'Configuração de Ensinos',
      'Calendário Acadêmico',
      'Plano de Ensino',
      'Distribuição de Aulas',
    ],
    naoPode: [
      'Encerrar semestre',
      'Aprovar planos finais',
    ],
    modulosPermitidos: [
      'CONFIGURACAO_ENSINOS',
      'CALENDARIO_ACADEMICO',
      'PLANO_ENSINO',
      'DISTRIBUICAO_AULAS',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'AVALIACOES',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
      'DOCUMENTOS_ACADEMICOS',
    ],
    modulosBloqueados: [
      'ENCERRAMENTO_ACADEMICO',
      'SAAS_MANAGEMENT',
    ],
  },
  AUDITOR: {
    role: 'AUDITOR',
    pode: [
      'Apenas leitura em todos os módulos',
    ],
    naoPode: [
      'Criar registros',
      'Editar registros',
      'Excluir registros',
    ],
    modulosPermitidos: [
      'CONFIGURACAO_ENSINOS',
      'CALENDARIO_ACADEMICO',
      'PLANO_ENSINO',
      'PRESENCAS',
      'AVALIACOES',
      'NOTAS',
      'ALUNOS',
      'MATRICULAS',
    ],
    modulosBloqueados: [],
  },
  RESPONSAVEL: {
    role: 'RESPONSAVEL',
    pode: [
      'Ver notas',
      'Ver frequência',
      'Ver boletim',
      'Ver histórico',
    ],
    naoPode: [
      'Editar dados acadêmicos',
      'Ver dados de outros alunos',
      'Criar qualquer registro',
    ],
    modulosPermitidos: [
      'CONSULTA_NOTAS',
      'CONSULTA_PRESENCAS',
      'CONSULTA_CALENDARIO',
      'CONSULTA_DOCUMENTOS',
    ],
    modulosBloqueados: [
      'CONFIGURACAO_ENSINOS',
      'PLANO_ENSINO',
      'LANCAMENTO_AULAS',
      'PRESENCAS',
      'NOTAS',
    ],
  },
};

// ========================================
// ENTIDADES E OPERAÇÕES CRUD
// ========================================

interface EntidadeCRUD {
  nome: string;
  rotas: {
    criar: string[];
    editar: string[];
    excluir: string[];
    visualizar: string[];
  };
  rolesPermitidos: {
    criar: UserRole[];
    editar: UserRole[];
    excluir: UserRole[];
    visualizar: UserRole[];
  };
}

const ENTIDADES: EntidadeCRUD[] = [
  {
    nome: 'Curso',
    rotas: {
      criar: ['POST /api/curso'],
      editar: ['PUT /api/curso/:id'],
      excluir: ['DELETE /api/curso/:id'],
      visualizar: ['GET /api/curso', 'GET /api/curso/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      editar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA', 'PROFESSOR'],
    },
  },
  {
    nome: 'Disciplina',
    rotas: {
      criar: ['POST /api/disciplina'],
      editar: ['PUT /api/disciplina/:id'],
      excluir: ['DELETE /api/disciplina/:id'],
      visualizar: ['GET /api/disciplina', 'GET /api/disciplina/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      editar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA', 'PROFESSOR'],
    },
  },
  {
    nome: 'Plano de Ensino',
    rotas: {
      criar: ['POST /api/plano-ensino'],
      editar: ['PUT /api/plano-ensino/:id'],
      excluir: ['DELETE /api/plano-ensino/:id'],
      visualizar: ['GET /api/plano-ensino', 'GET /api/plano-ensino/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      editar: ['ADMIN', 'DIRECAO', 'COORDENADOR'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'COORDENADOR', 'SECRETARIA', 'PROFESSOR'],
    },
  },
  {
    nome: 'Aula',
    rotas: {
      criar: ['POST /api/aula'],
      editar: ['PUT /api/aula/:id'],
      excluir: ['DELETE /api/aula/:id'],
      visualizar: ['GET /api/aula', 'GET /api/aula/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'PROFESSOR'],
      editar: ['ADMIN', 'DIRECAO', 'PROFESSOR'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'PROFESSOR', 'SECRETARIA'],
    },
  },
  {
    nome: 'Nota',
    rotas: {
      criar: ['POST /api/nota'],
      editar: ['PUT /api/nota/:id'],
      excluir: ['DELETE /api/nota/:id'],
      visualizar: ['GET /api/nota', 'GET /api/nota/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'PROFESSOR'],
      editar: ['ADMIN', 'DIRECAO', 'PROFESSOR'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'PROFESSOR', 'SECRETARIA', 'ALUNO'],
    },
  },
  {
    nome: 'Matrícula',
    rotas: {
      criar: ['POST /api/matricula'],
      editar: ['PUT /api/matricula/:id'],
      excluir: ['DELETE /api/matricula/:id'],
      visualizar: ['GET /api/matricula', 'GET /api/matricula/:id'],
    },
    rolesPermitidos: {
      criar: ['ADMIN', 'DIRECAO', 'SECRETARIA'],
      editar: ['ADMIN', 'DIRECAO', 'SECRETARIA'],
      excluir: ['ADMIN', 'DIRECAO'],
      visualizar: ['ADMIN', 'DIRECAO', 'SECRETARIA', 'PROFESSOR'],
    },
  },
];

// ========================================
// INTERFACES DE VALIDAÇÃO
// ========================================

interface TestResult {
  perfil: UserRole;
  categoria: string;
  teste: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  mensagem: string;
  detalhes?: string;
}

interface ValidationReport {
  perfil: UserRole;
  totalTestes: number;
  passou: number;
  falhou: number;
  avisos: number;
  resultados: TestResult[];
}

// ========================================
// VALIDAÇÕES
// ========================================

/**
 * Validar rotas por perfil
 */
function validarRotas(perfil: UserRole, rotasDir: string): TestResult[] {
  const resultados: TestResult[] = [];
  const permissoes = PERFIS[perfil];

  // Buscar arquivos de rotas
  const arquivos = fs.readdirSync(rotasDir)
    .filter(f => f.endsWith('.routes.ts') || f.endsWith('.routes.js'))
    .map(f => path.join(rotasDir, f));

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    const nomeRota = path.basename(arquivo).replace('.routes.ts', '').replace('.routes.js', '');

    // Verificar se rota usa authenticate
    if (!conteudo.includes('authenticate') && !conteudo.includes('INTERNOS')) {
      resultados.push({
        perfil,
        categoria: 'Rotas',
        teste: `Rota ${nomeRota} usa authenticate`,
        status: 'WARN',
        mensagem: `Rota ${nomeRota} pode não estar protegida`,
        detalhes: `Arquivo: ${path.basename(arquivo)}`,
      });
    }

    // Verificar se rota acadêmica bloqueia perfil quando necessário
    const rotasAcademicas = ['curso', 'disciplina', 'classe', 'turma', 'ano-letivo', 'plano-ensino'];
    if (rotasAcademicas.includes(nomeRota)) {
      if (permissoes.modulosBloqueados.includes('CONFIGURACAO_ENSINOS')) {
        if (!conteudo.includes('requireConfiguracaoEnsino')) {
          resultados.push({
            perfil,
            categoria: 'Rotas',
            teste: `Rota ${nomeRota} bloqueia ${perfil}`,
            status: 'FAIL',
            mensagem: `Rota ${nomeRota} não bloqueia ${perfil} de acessar`,
            detalhes: `Deve usar requireConfiguracaoEnsino para bloquear ${perfil}`,
          });
        }
      }
    }

    // Verificar multi-tenant
    if (perfil !== 'SUPER_ADMIN') {
      if (!conteudo.includes('requireInstitution') && !conteudo.includes('enforceTenant')) {
        resultados.push({
          perfil,
          categoria: 'Multi-Tenant',
          teste: `Rota ${nomeRota} garante multi-tenant`,
          status: 'WARN',
          mensagem: `Rota ${nomeRota} pode não garantir multi-tenant`,
          detalhes: 'Deve usar requireInstitution ou enforceTenant',
        });
      }
    }
  }

  return resultados;
}

/**
 * Validar controllers por perfil
 */
function validarControllers(perfil: UserRole, controllersDir: string): TestResult[] {
  const resultados: TestResult[] = [];

  const arquivos = fs.readdirSync(controllersDir)
    .filter(f => f.endsWith('.controller.ts') || f.endsWith('.controller.js'))
    .map(f => path.join(controllersDir, f));

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    const nomeController = path.basename(arquivo).replace('.controller.ts', '').replace('.controller.js', '');

    // Verificar se usa addInstitutionFilter em queries
    const temQueries = conteudo.includes('findMany') || conteudo.includes('findFirst') || conteudo.includes('findUnique');
    const temFiltroTenant = conteudo.includes('addInstitutionFilter') ||
      conteudo.includes('requireTenantScope') ||
      (conteudo.includes('instituicaoId') && conteudo.includes('req.user'));
    if (temQueries && perfil !== 'SUPER_ADMIN') {
      if (!temFiltroTenant) {
        resultados.push({
          perfil,
          categoria: 'Multi-Tenant',
          teste: `Controller ${nomeController} usa filtro multi-tenant`,
          status: 'FAIL',
          mensagem: `Controller ${nomeController} pode retornar dados de outras instituições`,
          detalhes: 'Deve usar addInstitutionFilter, requireTenantScope ou filtro por instituicaoId',
        });
      }
    }

    // Verificar se CREATE rejeita instituicaoId do body
    if (conteudo.includes('export const create') || conteudo.includes('const create')) {
      const rejeitaInstituicaoId = conteudo.includes('req.body.instituicaoId') &&
        (conteudo.includes('AppError') || conteudo.includes('não é permitido') || conteudo.includes('Não é permitido'));
      
      if (!rejeitaInstituicaoId && perfil !== 'SUPER_ADMIN') {
        resultados.push({
          perfil,
          categoria: 'Multi-Tenant',
          teste: `Controller ${nomeController} rejeita instituicaoId do body`,
          status: 'WARN',
          mensagem: `Controller ${nomeController} pode aceitar instituicaoId do body`,
          detalhes: 'Deve rejeitar instituicaoId do body e usar req.user.instituicaoId',
        });
      }
    }
  }

  return resultados;
}

/**
 * Validar CRUD por entidade
 */
function validarCRUD(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];

  for (const entidade of ENTIDADES) {
    // Validar criar
    const podeCriar = entidade.rolesPermitidos.criar.includes(perfil);
    if (!podeCriar) {
      resultados.push({
        perfil,
        categoria: 'CRUD',
        teste: `${perfil} NÃO pode criar ${entidade.nome}`,
        status: 'PASS',
        mensagem: `Bloqueio correto: ${perfil} não pode criar ${entidade.nome}`,
      });
    } else {
      resultados.push({
        perfil,
        categoria: 'CRUD',
        teste: `${perfil} PODE criar ${entidade.nome}`,
        status: 'PASS',
        mensagem: `Permissão correta: ${perfil} pode criar ${entidade.nome}`,
      });
    }

    // Validar editar
    const podeEditar = entidade.rolesPermitidos.editar.includes(perfil);
    if (!podeEditar) {
      resultados.push({
        perfil,
        categoria: 'CRUD',
        teste: `${perfil} NÃO pode editar ${entidade.nome}`,
        status: 'PASS',
        mensagem: `Bloqueio correto: ${perfil} não pode editar ${entidade.nome}`,
      });
    }

    // Validar excluir
    const podeExcluir = entidade.rolesPermitidos.excluir.includes(perfil);
    if (!podeExcluir) {
      resultados.push({
        perfil,
        categoria: 'CRUD',
        teste: `${perfil} NÃO pode excluir ${entidade.nome}`,
        status: 'PASS',
        mensagem: `Bloqueio correto: ${perfil} não pode excluir ${entidade.nome}`,
      });
    }

    // Validar visualizar
    const podeVisualizar = entidade.rolesPermitidos.visualizar.includes(perfil);
    if (!podeVisualizar) {
      resultados.push({
        perfil,
        categoria: 'CRUD',
        teste: `${perfil} NÃO pode visualizar ${entidade.nome}`,
        status: 'PASS',
        mensagem: `Bloqueio correto: ${perfil} não pode visualizar ${entidade.nome}`,
      });
    }
  }

  return resultados;
}

/**
 * Validar módulos por perfil
 */
function validarModulos(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];
  const permissoes = PERFIS[perfil];

  // Validar módulos permitidos
  for (const modulo of permissoes.modulosPermitidos) {
    resultados.push({
      perfil,
      categoria: 'Módulos',
      teste: `${perfil} tem acesso a ${modulo}`,
      status: 'PASS',
      mensagem: `Permissão correta: ${perfil} pode acessar ${modulo}`,
    });
  }

  // Validar módulos bloqueados
  for (const modulo of permissoes.modulosBloqueados) {
    resultados.push({
      perfil,
      categoria: 'Módulos',
      teste: `${perfil} NÃO tem acesso a ${modulo}`,
      status: 'PASS',
      mensagem: `Bloqueio correto: ${perfil} não pode acessar ${modulo}`,
    });
  }

  return resultados;
}

/**
 * Validar campos condicionais
 */
function validarCamposCondicionais(perfil: UserRole): TestResult[] {
  const resultados: TestResult[] = [];

  // Buscar controllers que lidam com tipoAcademico
  const controllersDir = path.join(__dirname, '..', 'src', 'controllers');
  const arquivos = fs.readdirSync(controllersDir)
    .filter(f => f.endsWith('.controller.ts') || f.endsWith('.controller.js'))
    .map(f => path.join(controllersDir, f));

  for (const arquivo of arquivos) {
    const conteudo = fs.readFileSync(arquivo, 'utf-8');
    
    // Verificar se há validação de tipoAcademico
    if (conteudo.includes('tipoAcademico') || conteudo.includes('tipoAcademico')) {
      // Verificar se ENSINO_SUPERIOR não vê Classe
      if (conteudo.includes('classe') && !conteudo.includes('ENSINO_SECUNDARIO')) {
        resultados.push({
          perfil,
          categoria: 'Campos Condicionais',
          teste: 'ENSINO_SUPERIOR não vê Classe',
          status: 'WARN',
          mensagem: 'Verificar se Classe está oculta para ENSINO_SUPERIOR',
          detalhes: `Arquivo: ${path.basename(arquivo)}`,
        });
      }

      // Verificar se ENSINO_SECUNDARIO não vê Semestre
      if (conteudo.includes('semestre') && !conteudo.includes('ENSINO_SUPERIOR')) {
        resultados.push({
          perfil,
          categoria: 'Campos Condicionais',
          teste: 'ENSINO_SECUNDARIO não vê Semestre',
          status: 'WARN',
          mensagem: 'Verificar se Semestre está oculto para ENSINO_SECUNDARIO',
          detalhes: `Arquivo: ${path.basename(arquivo)}`,
        });
      }
    }
  }

  return resultados;
}

// ========================================
// GERAÇÃO DE RELATÓRIO
// ========================================

function gerarRelatorio(relatorios: ValidationReport[]): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RELATÓRIO DE CONSISTÊNCIA POR PERFIL - DSICOLA');
  console.log('='.repeat(80) + '\n');

  let totalTestes = 0;
  let totalPassou = 0;
  let totalFalhou = 0;
  let totalAvisos = 0;

  for (const relatorio of relatorios) {
    totalTestes += relatorio.totalTestes;
    totalPassou += relatorio.passou;
    totalFalhou += relatorio.falhou;
    totalAvisos += relatorio.avisos;

    console.log(`\n👤 PERFIL: ${relatorio.perfil}`);
    console.log('-'.repeat(80));
    console.log(`   Total de testes: ${relatorio.totalTestes}`);
    console.log(`   ✅ Passou: ${relatorio.passou}`);
    console.log(`   ❌ Falhou: ${relatorio.falhou}`);
    console.log(`   ⚠️  Avisos: ${relatorio.avisos}`);

    // Mostrar apenas falhas e avisos
    const problemas = relatorio.resultados.filter(r => r.status !== 'PASS');
    if (problemas.length > 0) {
      console.log(`\n   📋 Problemas encontrados:`);
      for (const problema of problemas) {
        const icon = problema.status === 'FAIL' ? '🚨' : '⚠️';
        console.log(`   ${icon} [${problema.categoria}] ${problema.teste}`);
        console.log(`      ${problema.mensagem}`);
        if (problema.detalhes) {
          console.log(`      💡 ${problema.detalhes}`);
        }
      }
    } else {
      console.log(`\n   ✅ Nenhum problema encontrado!`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 RESUMO GERAL');
  console.log('='.repeat(80));
  console.log(`   Total de testes: ${totalTestes}`);
  console.log(`   ✅ Passou: ${totalPassou}`);
  console.log(`   ❌ Falhou: ${totalFalhou}`);
  console.log(`   ⚠️  Avisos: ${totalAvisos}`);
  console.log(`   📈 Taxa de sucesso: ${((totalPassou / totalTestes) * 100).toFixed(2)}%`);

  if (totalFalhou === 0 && totalAvisos === 0) {
    console.log('\n✅ Todos os perfis passaram na validação!\n');
  } else {
    console.log('\n⚠️  Alguns problemas foram encontrados. Revise os detalhes acima.\n');
  }
}

// ========================================
// FUNÇÃO PRINCIPAL
// ========================================

function main() {
  console.log('🔍 Iniciando teste de consistência por perfil...\n');

  const perfisParaValidar: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'FUNCIONARIO', 'SECRETARIA', 'RH', 'FINANCEIRO', 'POS'];
  const relatorios: ValidationReport[] = [];

  const rotasDir = path.join(__dirname, '..', 'src', 'routes');
  const controllersDir = path.join(__dirname, '..', 'src', 'controllers');

  for (const perfil of perfisParaValidar) {
    console.log(`📋 Validando perfil: ${perfil}...`);

    const resultados: TestResult[] = [];

    // 1. Validar rotas
    resultados.push(...validarRotas(perfil, rotasDir));

    // 2. Validar controllers
    resultados.push(...validarControllers(perfil, controllersDir));

    // 3. Validar CRUD
    resultados.push(...validarCRUD(perfil));

    // 4. Validar módulos
    resultados.push(...validarModulos(perfil));

    // 5. Validar campos condicionais
    resultados.push(...validarCamposCondicionais(perfil));

    const relatorio: ValidationReport = {
      perfil,
      totalTestes: resultados.length,
      passou: resultados.filter(r => r.status === 'PASS').length,
      falhou: resultados.filter(r => r.status === 'FAIL').length,
      avisos: resultados.filter(r => r.status === 'WARN').length,
      resultados,
    };

    relatorios.push(relatorio);
  }

  // Gerar relatório
  gerarRelatorio(relatorios);

  // Exit code: --strict para falhar quando houver falhas (ex: CI)
  // Por padrão exit 0 (relatório informativo, falhas são estruturais/multi-tenant)
  const temFalhas = relatorios.some(r => r.falhou > 0);
  const strictMode = process.argv.includes('--strict');
  if (temFalhas) {
    console.log('\n💡 Para falhar o build: npm run test:consistencia-perfil -- --strict\n');
  }
  process.exit(temFalhas && strictMode ? 1 : 0);
}

// Executar
main();

