# Implementação: Tipo Acadêmico Automático e Arquitetura Multi-País

## ✅ Implementado

### 1. Schema Prisma
- ✅ Adicionado enum `TipoAcademico` (SECUNDARIO, SUPERIOR)
- ✅ Adicionado campo `tipoAcademico` em `Instituicao` e `ConfiguracaoInstituicao`
- ✅ Campo é opcional e não editável manualmente

### 2. Detecção Automática
- ✅ Serviço `identificarTipoAcademico()` que detecta automaticamente:
  - **SUPERIOR**: cursos com grau superior, disciplinas com semestres numéricos
  - **SECUNDARIO**: disciplinas com trimestres, turmas com classes/anos escolares
- ✅ Função `atualizarTipoAcademico()` que atualiza o campo automaticamente
- ✅ Integrado em `obterTipoInstituicao()` para atualização automática

### 3. Backend Controllers
- ✅ `instituicao.controller.ts`: retorna `tipoAcademico` em todas as respostas
- ✅ `configuracaoInstituicao.controller.ts`: 
  - Remove `tipoAcademico` de updates (read-only)
  - Retorna `tipoAcademico` nas respostas
  - Atualiza automaticamente após mudanças

### 4. Frontend
- ✅ `ConfiguracoesInstituicao.tsx`: exibe `tipoAcademico` (read-only) com ícone e descrição
- ✅ `InstituicaoContext.tsx`: inclui `tipoAcademico`, `isSuperior`, `isSecundario`
- ✅ Interface atualizada para incluir `tipoAcademico`

### 5. Dados Fiscais
- ✅ Estrutura já existe em `ConfiguracaoInstituicao`:
  - `emailFiscal` (obrigatório para SAFT)
  - `paisFiscal`, `cidadeFiscal`, `provinciaFiscal`
  - Campos genéricos: `nif`, `cnpj`, `identificacaoFiscalGenerica`
- ✅ Validação de email fiscal no controller

## 🔄 Próximos Passos

### 1. Migração do Banco de Dados
Execute a migração do Prisma:
```bash
cd backend
npx prisma migrate dev --name add_tipo_academico
npx prisma generate
```

### 2. Permissões por Role + Tipo Acadêmico

Criar utilitário de permissões (`frontend/src/utils/permissions.ts`):
```typescript
import { UserRole } from '@/types/auth';
import { useInstituicao } from '@/contexts/InstituicaoContext';

export const canAccessFeature = (
  role: UserRole,
  feature: string,
  tipoAcademico: 'SECUNDARIO' | 'SUPERIOR' | null
): boolean => {
  // ADMIN e SUPER_ADMIN sempre têm acesso
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;

  switch (feature) {
    case 'classes':
      // Professor em ensino secundário vê classes
      return role === 'PROFESSOR' && tipoAcademico === 'SECUNDARIO';
    
    case 'cursos':
      // Professor em ensino superior vê cursos
      return role === 'PROFESSOR' && tipoAcademico === 'SUPERIOR';
    
    case 'disciplinas':
      // Professor vê disciplinas em ambos
      return role === 'PROFESSOR';
    
    case 'pagamentos':
      // POS vê apenas pagamentos
      return role === 'POS';
    
    case 'dados_pessoais':
      // Aluno vê apenas seus dados
      return role === 'ALUNO';
    
    default:
      return false;
  }
};
```

Aplicar em:
- `TurmasTab.tsx`: mostrar "Classe" vs "Curso" baseado em `tipoAcademico`
- `ProfessorDashboard.tsx`: filtrar turmas/cursos conforme tipo
- `SecretariaDashboard.tsx`: ajustar fluxos conforme tipo

### 3. Relatórios

Atualizar relatórios para usar estrutura correta:

**`frontend/src/pages/secretaria/SecretariaDashboard.tsx`**:
```typescript
const { tipoAcademico } = useInstituicao();

// No relatório, usar:
const colunaEstrutura = tipoAcademico === 'SUPERIOR' 
  ? 'Curso/Semestre' 
  : 'Classe/Ano';

const dadosEstrutura = tipoAcademico === 'SUPERIOR'
  ? `${mensalidade.curso_nome} - ${mensalidade.semestre}º Semestre`
  : `${mensalidade.turma_nome} - ${mensalidade.ano_letivo}º Ano`;
```

**`frontend/src/utils/pdfGenerator.ts`**: ajustar headers e dados conforme tipo

### 4. SAFT

**`frontend/src/pages/admin/ExportarSAFT.tsx`**:

1. **Validação de dados fiscais obrigatórios**:
```typescript
const validarDadosFiscais = (config: any) => {
  const erros: string[] = [];
  
  if (!config.emailFiscal) {
    erros.push('Email Fiscal é obrigatório para gerar SAFT');
  }
  
  if (!config.nomeFiscal) {
    erros.push('Nome Fiscal é obrigatório');
  }
  
  // Validar identificação fiscal conforme país
  const pais = config.paisFiscal || config.pais || 'AO';
  if (pais === 'AO' || pais === 'PT') {
    if (!config.nif) {
      erros.push('NIF é obrigatório para Angola/Portugal');
    }
  } else if (pais === 'BR') {
    if (!config.cnpj) {
      erros.push('CNPJ é obrigatório para Brasil');
    }
  } else {
    if (!config.identificacaoFiscalGenerica) {
      erros.push('Identificação Fiscal é obrigatória');
    }
  }
  
  return erros;
};
```

2. **Estrutura por tipo acadêmico**:
```typescript
const { tipoAcademico } = useInstituicao();

// No XML do SAFT, usar:
const estruturaAcademica = tipoAcademico === 'SUPERIOR'
  ? `<Curso>${curso.nome}</Curso><Semestre>${semestre}</Semestre>`
  : `<Classe>${turma.nome}</Classe><Ano>${ano}</Ano>`;
```

### 5. Hooks e Utilitários

Criar hook `useAcademicPermissions.ts`:
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useInstituicao } from '@/contexts/InstituicaoContext';

export const useAcademicPermissions = () => {
  const { role } = useAuth();
  const { tipoAcademico, isSuperior, isSecundario } = useInstituicao();

  return {
    canViewClasses: role === 'PROFESSOR' && isSecundario,
    canViewCourses: role === 'PROFESSOR' && isSuperior,
    canViewDisciplines: role === 'PROFESSOR',
    canViewPayments: role === 'POS',
    canViewOwnData: role === 'ALUNO',
  };
};
```

## 📋 Checklist de Implementação

- [x] Schema Prisma atualizado
- [x] Detecção automática implementada
- [x] Backend controllers atualizados
- [x] Frontend Configurações atualizado
- [x] Context atualizado
- [ ] Migração executada
- [ ] Permissões ajustadas por tipo acadêmico
- [ ] Relatórios ajustados
- [ ] SAFT validado e ajustado
- [ ] Testes realizados

## 🔍 Pontos de Atenção

1. **Multi-tenant**: Todas as mudanças respeitam o isolamento por instituição
2. **Backward compatibility**: Campos antigos ainda funcionam, `tipoAcademico` é opcional
3. **Performance**: Detecção automática é executada apenas quando necessário
4. **Validação**: Email fiscal é obrigatório antes de gerar SAFT

## 🚀 Como Testar

1. Execute a migração do banco
2. Crie uma instituição e adicione:
   - Para SUPERIOR: cursos com grau "Licenciatura" e disciplinas com semestre
   - Para SECUNDARIO: turmas com nomes "10ª Classe" e disciplinas com trimestres
3. Verifique se `tipoAcademico` é detectado automaticamente
4. Teste permissões de diferentes roles
5. Gere relatórios e SAFT verificando a estrutura correta

