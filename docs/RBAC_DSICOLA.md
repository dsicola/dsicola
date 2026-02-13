# RBAC - Sistema de Controle de Acesso DSICOLA

## Visão Geral

O DSICOLA implementa um sistema de controle de acesso baseado em roles (RBAC) profissional e centralizado, garantindo segurança multi-tenant e separação clara de responsabilidades institucionais.

## Arquitetura

- **Backend**: Middleware RBAC centralizado em `backend/src/middlewares/rbac.middleware.ts`
- **Frontend**: Filtragem de menus e rotas baseada em roles
- **Multi-tenant**: Todas as validações respeitam `instituicaoId` do JWT

## Roles do Sistema

### SUPER_ADMIN
**Responsabilidade**: Dono do SaaS - Gerencia a plataforma

**Pode**:
- Gerenciar instituições
- Gerenciar assinaturas e planos
- Configurar preços
- Enviar e-mails
- Acessar logs globais
- Auditoria do sistema

**NÃO pode**:
- ❌ Acessar módulos acadêmicos (alunos, aulas, presenças, notas)
- ❌ Configurar ensinos
- ❌ Acessar dados acadêmicos de instituições

**Mensagem de Bloqueio**:
> "Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos. Use o painel de administração SaaS."

---

### ADMIN (ADMIN_INSTITUICAO)
**Responsabilidade**: Administração Acadêmica da Instituição

**Pode**:
- ✅ Configuração de Ensinos (cursos, classes, disciplinas, turmas)
- ✅ Calendário Acadêmico
- ✅ Plano de Ensino (criar, editar, aprovar)
- ✅ Distribuição de Aulas
- ✅ Encerramento de Semestre/Ano
- ✅ Lançamento de Aulas
- ✅ Presenças (visualizar e ajustar)
- ✅ Avaliações e Notas
- ✅ Gestão de Alunos
- ✅ Matrículas
- ✅ Documentos Acadêmicos
- ✅ Relatórios

**NÃO pode**:
- ❌ Ações SaaS globais (gerenciar outras instituições)

---

### DIRECAO
**Responsabilidade**: Direção Acadêmica

**Pode**:
- ✅ Todas as permissões de ADMIN
- ✅ Aprovações finais
- ✅ Encerramentos acadêmicos

---

### COORDENADOR
**Responsabilidade**: Coordenação Acadêmica

**Pode**:
- ✅ Configuração de Ensinos
- ✅ Calendário Acadêmico
- ✅ Plano de Ensino
- ✅ Distribuição de Aulas
- ✅ Lançamento de Aulas
- ✅ Presenças
- ✅ Avaliações e Notas
- ✅ Gestão de Alunos
- ✅ Matrículas
- ✅ Documentos Acadêmicos

**NÃO pode**:
- ❌ Encerrar semestre/ano (apenas ADMIN/DIRECAO)

---

### SECRETARIA
**Responsabilidade**: Operações Acadêmicas

**Pode**:
- ✅ Gestão de Alunos
- ✅ Matrículas
- ✅ Documentos Acadêmicos
- ✅ Ver presenças e notas
- ✅ Ajustar datas do calendário
- ✅ Corrigir presenças (com permissão)
- ✅ Corrigir notas (com permissão)

**NÃO pode**:
- ❌ Configurar Ensinos (cursos, classes, disciplinas, turmas)
- ❌ Aprovar plano de ensino
- ❌ Encerrar semestre
- ❌ Alterar notas diretamente (apenas corrigir)

**Mensagem de Bloqueio para Configuração de Ensinos**:
> "Acesso negado: você não tem permissão para acessar Configuração de Ensinos. Acesso restrito à Administração Acadêmica."

---

### PROFESSOR
**Responsabilidade**: Execução e Registro Acadêmico

**Pode**:
- ✅ Ver suas turmas
- ✅ Ver plano de ensino (somente leitura - aprovado)
- ✅ Lançar aulas (suas aulas)
- ✅ Registrar presenças (suas aulas)
- ✅ Lançar notas (suas avaliações)

**NÃO pode**:
- ❌ Configurar Ensinos
- ❌ Calendário Acadêmico
- ❌ Criar/editar plano de ensino
- ❌ Distribuir aulas
- ❌ Encerrar semestre
- ❌ Acessar turmas que não são suas

**Mensagem de Bloqueio para Configuração de Ensinos**:
> "Acesso negado: você não tem permissão para acessar Configuração de Ensinos. Acesso restrito à Administração Acadêmica."

---

### ALUNO
**Responsabilidade**: Consulta

**Pode**:
- ✅ Ver notas
- ✅ Ver presenças
- ✅ Ver calendário
- ✅ Ver documentos

**NÃO pode**:
- ❌ Alterar qualquer dado

---

## Matriz de Permissões

| Módulo | SUPER_ADMIN | ADMIN | DIRECAO | COORDENADOR | SECRETARIA | PROFESSOR | ALUNO |
|--------|-------------|-------|---------|-------------|------------|-----------|-------|
| **SaaS Management** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Configuração de Ensinos** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Calendário Acadêmico** | ❌ | ✅ | ✅ | ✅ | ⚠️ (Ajustar) | ❌ | 👁️ |
| **Plano de Ensino** | ❌ | ✅ | ✅ | ✅ | ❌ | 👁️ (Aprovado) | ❌ |
| **Distribuição de Aulas** | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Lançamento de Aulas** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ (Suas) | ❌ |
| **Presenças** | ❌ | ✅ | ✅ | ✅ | ⚠️ (Ajustar) | ✅ (Suas) | 👁️ |
| **Avaliações** | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ (Suas) | 👁️ |
| **Notas** | ❌ | ✅ | ✅ | ✅ | ⚠️ (Corrigir) | ✅ (Suas) | 👁️ |
| **Alunos** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Matrículas** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Documentos** | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | 👁️ |
| **Encerramento Acadêmico** | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legenda**:
- ✅ = Acesso total
- ⚠️ = Acesso limitado (ver descrição)
- 👁️ = Apenas leitura
- ❌ = Sem acesso

---

## Implementação Técnica

### Backend

#### Middleware RBAC
```typescript
// backend/src/middlewares/rbac.middleware.ts

// Bloquear SUPER_ADMIN e PROFESSOR de Configuração de Ensinos
export const requireConfiguracaoEnsino = (req, res, next) => {
  // Validação de roles permitidos
  // Bloqueio específico para SUPER_ADMIN e PROFESSOR
}

// Bloquear SUPER_ADMIN de rotas acadêmicas
export const blockSuperAdminFromAcademic = (req, res, next) => {
  // Validação específica
}
```

#### Aplicação em Rotas
```typescript
// Exemplo: backend/src/routes/curso.routes.ts
router.use(authenticate);
router.use(validateLicense);
router.use(requireConfiguracaoEnsino); // RBAC
router.use(requireInstitution); // Multi-tenant
```

### Frontend

#### Filtragem de Menus
```typescript
// frontend/src/components/layout/DashboardLayout.tsx
const getAdminNavItems = (tipoAcademico, userRoles) => {
  const isProfessor = userRoles.includes('PROFESSOR');
  const isSuperAdmin = userRoles.includes('SUPER_ADMIN');
  
  // Esconder Configuração de Ensinos para PROFESSOR e SUPER_ADMIN
  ...((!isProfessor && !isSuperAdmin) ? [{
    label: '⚙️ Configuração de Ensinos',
    // ...
  }] : [])
}
```

#### Proteção de Rotas
```typescript
// frontend/src/App.tsx
<Route
  path="/admin-dashboard/configuracao-ensino"
  element={
    <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR']}>
      <ConfiguracaoEnsino />
    </ProtectedRoute>
  }
/>
```

#### Verificação no Componente
```typescript
// frontend/src/pages/admin/ConfiguracaoEnsino.tsx
const rolesPermitidos = ['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR'];
const temPermissao = role && rolesPermitidos.includes(role);

if (!temPermissao) {
  return <Card>Acesso Negado</Card>;
}
```

---

## Mensagens de Bloqueio

### SUPER_ADMIN tentando acessar módulo acadêmico
```
Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos. 
Use o painel de administração SaaS.
```

### PROFESSOR tentando acessar Configuração de Ensinos
```
Acesso negado: você não tem permissão para acessar Configuração de Ensinos. 
Acesso restrito à Administração Acadêmica.
```

### SECRETARIA tentando encerrar semestre
```
Ação não permitida para o seu perfil. 
Apenas administradores podem encerrar semestres.
```

### Acesso geral negado
```
Acesso negado: você não tem permissão para esta ação.
```

---

## Testes Obrigatórios

### ✅ Teste 1: Professor → Configuração de Ensinos
**Ação**: Professor tenta acessar `/admin-dashboard/configuracao-ensino`
**Resultado Esperado**: 
- ❌ Menu não aparece
- ❌ Rota bloqueada (403)
- ❌ Mensagem: "Acesso negado: você não tem permissão para acessar Configuração de Ensinos..."

### ✅ Teste 2: Secretaria → Encerrar Semestre
**Ação**: Secretaria tenta encerrar semestre
**Resultado Esperado**: 
- ❌ Botão não aparece
- ❌ Rota bloqueada (403)
- ❌ Mensagem: "Ação não permitida para o seu perfil..."

### ✅ Teste 3: Super Admin → Lançar Aula
**Ação**: SUPER_ADMIN tenta lançar aula
**Resultado Esperado**: 
- ❌ Menu não aparece
- ❌ Rota bloqueada (403)
- ❌ Mensagem: "Acesso negado: SUPER_ADMIN não pode acessar módulos acadêmicos..."

### ✅ Teste 4: Professor → Lançar Aula (Sua Turma)
**Ação**: Professor lança aula da sua turma
**Resultado Esperado**: 
- ✅ Acesso permitido
- ✅ Apenas suas turmas visíveis

### ✅ Teste 5: Professor → Acessar Outra Turma
**Ação**: Professor tenta acessar turma que não é sua
**Resultado Esperado**: 
- ❌ Rota bloqueada (403)
- ❌ Mensagem: "Acesso negado: você não é o professor responsável..."

---

## Segurança Multi-tenant

Todas as validações RBAC garantem:
1. ✅ `instituicaoId` sempre do JWT (nunca do body)
2. ✅ Filtros automáticos por instituição
3. ✅ SUPER_ADMIN pode ver todas as instituições (apenas SaaS)
4. ✅ Outros roles só veem sua instituição

---

## Manutenção e Extensão

### Adicionar Novo Módulo
1. Adicionar `ModuloSistema` em `rbac.middleware.ts`
2. Atualizar `PERMISSOES_POR_ROLE`
3. Aplicar middleware nas rotas
4. Atualizar frontend (menus e rotas)

### Adicionar Nova Role
1. Adicionar role no Prisma schema
2. Adicionar permissões em `PERMISSOES_POR_ROLE`
3. Atualizar documentação
4. Testar todos os cenários

---

## Conclusão

O sistema RBAC do DSICOLA garante:
- ✅ Segurança profissional
- ✅ Separação clara de responsabilidades
- ✅ Multi-tenant seguro
- ✅ Mensagens claras para usuários
- ✅ Pronto para produção SaaS

**Última atualização**: 2024
**Versão**: 1.0.0

