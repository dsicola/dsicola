# 🧪 TESTE DE CONSISTÊNCIA POR PERFIL - DSICOLA
## Validação SIGA/SIGAE de RBAC, Multi-Tenant e UX Institucional

**Data de Criação**: 2025-01-27  
**Status**: 🟢 Em Validação  
**Versão**: 1.0.0

---

## 📋 OBJETIVO

Garantir que cada role veja, acesse e execute **APENAS** o que é permitido no padrão SIGA/SIGAE:
- ✅ RBAC consistente (Backend + Frontend)
- ✅ Nenhum acesso indevido
- ✅ UX institucional clara
- ✅ Segurança SIGA/SIGAE
- ✅ Multi-tenant respeitado

---

## 🔒 REGRAS GLOBAIS (NÃO VIOLAR)

1. ❌ **Usuário NUNCA vê o que não pode usar**
2. ❌ **Usuário NUNCA executa ação fora do seu papel**
3. ✅ **Frontend e Backend DEVEM bloquear**
4. ✅ **Erro de permissão deve ser CLARO e institucional**
5. ✅ **Nenhuma ação pode depender apenas do frontend**

---

## 👥 PERFIS A VALIDAR

### SUPER_ADMIN
**Pode:**
- ✅ Ver todas instituições
- ✅ Configurações globais (SaaS)
- ✅ Backups globais
- ✅ Auditorias
- ✅ Gestão de assinaturas

**NÃO pode:**
- ❌ Lançar notas
- ❌ Criar aulas
- ❌ Marcar presença
- ❌ Acessar módulos acadêmicos operacionais
- ❌ Configurar Planos de Ensino

---

### ADMIN (Instituição)
**Pode:**
- ✅ Cursos (CRUD)
- ✅ Disciplinas (CRUD)
- ✅ Professores (CRUD)
- ✅ Ano Letivo (CRUD)
- ✅ Plano de Ensino (CRUD)
- ✅ Turmas (CRUD)
- ✅ Matrículas (CRUD)
- ✅ Relatórios institucionais

**NÃO pode:**
- ❌ Acessar dados de outra instituição
- ❌ Configurações globais SaaS
- ❌ Ver backups de outras instituições

---

### PROFESSOR
**Pode:**
- ✅ Ver apenas seus Planos de Ensino
- ✅ Criar aulas (suas disciplinas)
- ✅ Marcar presenças (suas aulas)
- ✅ Lançar notas (suas avaliações)

**NÃO pode:**
- ❌ Criar curso
- ❌ Criar disciplina
- ❌ Criar ano letivo
- ❌ Ver dados administrativos
- ❌ Ver planos de outros professores
- ❌ Acessar Configuração de Ensinos

---

### ALUNO
**Pode:**
- ✅ Ver notas (próprias)
- ✅ Ver frequência (própria)
- ✅ Ver boletim (próprio)
- ✅ Ver histórico (próprio)

**NÃO pode:**
- ❌ Editar dados acadêmicos
- ❌ Ver dados de outros alunos
- ❌ Criar qualquer registro
- ❌ Acessar módulos administrativos

---

### FUNCIONARIO / SECRETARIA
**Pode:**
- ✅ Matrículas (visualizar/criar)
- ✅ Transferências (processar)
- ✅ Documentos (emitir)
- ✅ Relatórios administrativos

**NÃO pode:**
- ❌ Lançar notas
- ❌ Criar aulas
- ❌ Alterar plano de ensino
- ❌ Aprovar planos de ensino

---

## 🧪 TESTES OBRIGATÓRIOS

### 1️⃣ TESTE DE MENU / SIDEBAR

**Frontend**: `frontend/src/components/layout/sidebar.config.ts`

**Validar:**
- [ ] SUPER_ADMIN não vê menus acadêmicos operacionais
- [ ] ADMIN vê todos os menus acadêmicos
- [ ] PROFESSOR vê apenas: Dashboard, Aulas, Presenças, Notas, Plano de Ensino (leitura)
- [ ] ALUNO vê apenas: Dashboard, Notas, Frequência, Boletim, Histórico
- [ ] SECRETARIA vê: Dashboard, Matrículas, Documentos, Relatórios

**Como testar:**
1. Fazer login com cada perfil
2. Verificar itens do menu renderizados
3. Confirmar que itens não permitidos **não aparecem** (não apenas desabilitados)

**Comando de validação:**
```bash
cd frontend
npm run test:rbac:menu  # (se implementado)
```

---

### 2️⃣ TESTE DE ROTAS

**Validar acesso negado (403 Forbidden) para:**

#### SUPER_ADMIN
- [ ] `POST /api/plano-ensino` → 403
- [ ] `POST /api/aulas` → 403
- [ ] `POST /api/presencas` → 403
- [ ] `POST /api/notas` → 403

#### PROFESSOR
- [ ] `POST /api/cursos` → 403
- [ ] `POST /api/disciplinas` → 403
- [ ] `POST /api/ano-letivo` → 403
- [ ] `GET /api/configuracao-ensinos` → 403

#### ALUNO
- [ ] `POST /api/matriculas` → 403
- [ ] `PUT /api/notas/:id` → 403
- [ ] `GET /api/notas` (de outros alunos) → 403 ou vazio

**Como testar:**
```bash
# Exemplo: Testar acesso negado
curl -X POST http://localhost:3000/api/cursos \
  -H "Authorization: Bearer <TOKEN_PROFESSOR>" \
  -H "Content-Type: application/json" \
  -d '{"nome": "Teste"}' \
  # Esperado: 403 Forbidden
```

---

### 3️⃣ TESTE DE CRUD

**Para cada entidade (Cursos, Disciplinas, Turmas, etc.):**

| Entidade | SUPER_ADMIN | ADMIN | PROFESSOR | ALUNO | SECRETARIA |
|----------|-------------|-------|-----------|-------|------------|
| **Cursos** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Disciplinas** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Ano Letivo** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Plano Ensino** | ❌ | ✅ | 👁️ (leitura própria) | ❌ | ❌ |
| **Turmas** | ❌ | ✅ | ❌ | ❌ | ✅ (visualizar) |
| **Matrículas** | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Aulas** | ❌ | ✅ | ✅ (criar próprias) | ❌ | ❌ |
| **Presenças** | ❌ | ✅ | ✅ (marcar próprias) | ❌ | ✅ (ajustar) |
| **Notas** | ❌ | ✅ | ✅ (lançar próprias) | 👁️ (leitura própria) | ❌ |

**Validar:**
- [ ] CREATE: Quem pode criar cada entidade
- [ ] READ: Quem pode visualizar (incluindo filtros multi-tenant)
- [ ] UPDATE: Quem pode editar
- [ ] DELETE: Quem pode excluir

---

### 4️⃣ TESTE MULTI-TENANT

**CRÍTICO: Usuário NUNCA acessa dados de outra instituição**

#### Validações obrigatórias:

**1. Queries sempre filtram por `instituicaoId` do token:**
```typescript
// ✅ CORRETO
const filter = addInstitutionFilter(req);
const cursos = await prisma.curso.findMany({ where: filter });

// ❌ ERRADO
const cursos = await prisma.curso.findMany(); // SEM FILTRO
```

**2. CREATE sempre usa `instituicaoId` do token:**
```typescript
// ✅ CORRETO
const curso = await prisma.curso.create({
  data: {
    nome: req.body.nome,
    instituicaoId: req.user.instituicaoId // DO TOKEN
  }
});

// ❌ ERRADO
instituicaoId: req.body.instituicaoId // DO BODY - NUNCA!
```

**3. UPDATE/DELETE verifica tenant:**
```typescript
// ✅ CORRETO
const curso = await prisma.curso.findFirst({
  where: { id: cursoId, ...addInstitutionFilter(req) }
});
if (!curso) throw new AppError('Curso não encontrado', 404);
```

**4. Forçar ID manualmente deve falhar:**
```bash
# Tentar acessar recurso de outra instituição
curl -X GET http://localhost:3000/api/cursos/OUTRA_INST_ID \
  -H "Authorization: Bearer <TOKEN_INST_A>" \
  # Esperado: 404 ou 403 (não encontra ou nega acesso)
```

**Checklist Multi-Tenant:**
- [ ] Todas as queries usam `addInstitutionFilter(req)`
- [ ] CREATE nunca aceita `instituicaoId` do body
- [ ] UPDATE/DELETE verifica que recurso pertence à instituição
- [ ] SUPER_ADMIN pode alternar instituição (via query param)
- [ ] Outros perfis nunca acessam outra instituição

---

### 5️⃣ TESTE DE CAMPOS CONDICIONAIS

**Validar campos conforme tipo de instituição:**

#### ENSINO_SUPERIOR
- [ ] ✅ Semestre **visível** e **obrigatório**
- [ ] ❌ Classe **nunca visível**
- [ ] ✅ Trimestre só em Avaliações

#### ENSINO_SECUNDARIO
- [ ] ✅ Classe **visível** e **obrigatória**
- [ ] ❌ Semestre **nunca visível**
- [ ] ✅ Trimestre em diversos contextos

**Como testar:**
1. Criar/editar Plano de Ensino em instituição SUPERIOR → não deve mostrar campo "Classe"
2. Criar/editar Plano de Ensino em instituição SECUNDARIO → não deve mostrar campo "Semestre"

**Arquivo a validar:**
- `frontend/src/components/configuracaoEnsino/PlanoEnsinoTab.tsx`

---

## 🔧 BACKEND (VALIDAÇÕES OBRIGATÓRIAS)

### Middleware de Permissão por Role
**Arquivo**: `backend/src/middlewares/rbac.middleware.ts`

**Validar:**
- [ ] `authorizeModule(ModuloSistema)` aplicado em todas as rotas
- [ ] `requireConfiguracaoEnsino` bloqueia PROFESSOR, ALUNO, SUPER_ADMIN
- [ ] `blockSuperAdminFromAcademic` aplicado em rotas acadêmicas
- [ ] `requireInstitution` garante multi-tenant (exceto SUPER_ADMIN)

### Validação de `instituicaoId` no Token
**Arquivo**: `backend/src/middlewares/auth.ts`

**Validar:**
- [ ] `addInstitutionFilter(req)` sempre usado em queries
- [ ] `requireTenantScope(req)` usado em CREATE/UPDATE
- [ ] Body nunca contém `instituicaoId` (rejeitado)

### Logs de Tentativa de Acesso Inválido
**Validar:**
- [ ] Tentativas de acesso negado são logadas
- [ ] Logs incluem: userId, role, rota, motivo

---

## 🎨 FRONTEND (UX INSTITUCIONAL)

### Ocultar Ações Não Permitidas
**Validar:**
- [ ] Botões de ação não aparecem (não apenas desabilitados)
- [ ] Menus não renderizam itens sem permissão
- [ ] Formulários não mostram campos proibidos

### Mensagens Claras
**Validar:**
- [ ] Erro 403 mostra: "Você não tem permissão para esta ação"
- [ ] Erro multi-tenant mostra: "Recurso não encontrado ou não pertence à sua instituição"
- [ ] Nunca esconde erro crítico silenciosamente

**Exemplo:**
```typescript
// ✅ CORRETO
if (!hasPermission) {
  return <Alert>Acesso negado: você não tem permissão para esta ação.</Alert>;
}

// ❌ ERRADO
if (!hasPermission) {
  return null; // Silencioso - ruim para UX
}
```

---

## 📊 CHECKLIST DE VALIDAÇÃO POR ENTIDADE

### Cursos
- [ ] Backend: `authorizeModule(ModuloSistema.CONFIGURACAO_ENSINOS)`
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível apenas para ADMIN
- [ ] Frontend: Formulário não aceita `instituicaoId`

### Disciplinas
- [ ] Backend: `authorizeModule(ModuloSistema.CONFIGURACAO_ENSINOS)`
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível apenas para ADMIN
- [ ] Frontend: Formulário não aceita `instituicaoId`

### Plano de Ensino
- [ ] Backend: `validarPermissaoPlanoEnsino(req)` verifica se é professor próprio
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: PROFESSOR vê apenas seus planos
- [ ] Frontend: Campos condicionais (Semestre/Classe) conforme tipo

### Aulas
- [ ] Backend: PROFESSOR só cria aulas de suas disciplinas
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível para PROFESSOR e ADMIN
- [ ] Frontend: PROFESSOR só vê suas aulas

### Presenças
- [ ] Backend: PROFESSOR só marca presença de suas aulas
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível para PROFESSOR, ADMIN, SECRETARIA
- [ ] Frontend: PROFESSOR só vê presenças de suas aulas

### Notas
- [ ] Backend: PROFESSOR só lança notas de suas avaliações
- [ ] Backend: ALUNO só vê suas próprias notas
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível para PROFESSOR, ADMIN, ALUNO
- [ ] Frontend: ALUNO só vê suas notas

### Matrículas
- [ ] Backend: `authorizeModule(ModuloSistema.MATRICULAS)`
- [ ] Backend: Multi-tenant em todas queries
- [ ] Frontend: Menu visível para ADMIN, SECRETARIA
- [ ] Frontend: Formulário não aceita `instituicaoId`

---

## 🚀 COMO EXECUTAR OS TESTES

### 1. Teste Manual (Checklist)
1. Fazer login com cada perfil (SUPER_ADMIN, ADMIN, PROFESSOR, ALUNO, SECRETARIA)
2. Navegar pelo sistema e verificar:
   - Menus visíveis
   - Acesso a rotas
   - Permissões de CRUD
   - Multi-tenant
   - Campos condicionais

### 2. Teste Automatizado (Script)
```bash
# Executar script de validação RBAC
cd backend
npm run test:rbac:consistency

# Ou usando Node diretamente
node scripts/validate-rbac-consistency.js
```

### 3. Teste de Integração
```bash
# Testar endpoints com diferentes tokens
npm run test:integration:rbac
```

---

## 📝 RESULTADO ESPERADO

Após execução dos testes:

- ✅ **RBAC consistente**: Cada role tem acesso apenas ao permitido
- ✅ **Nenhum acesso indevido**: 403 retornado corretamente
- ✅ **UX institucional clara**: Mensagens claras e menus corretos
- ✅ **Segurança SIGA/SIGAE**: Padrão institucional respeitado
- ✅ **Multi-tenant respeitado**: Dados isolados por instituição

---

## 🐛 PROBLEMAS COMUNS E SOLUÇÕES

### Problema: PROFESSOR consegue criar curso
**Solução**: Adicionar `authorizeModule(ModuloSistema.CONFIGURACAO_ENSINOS)` na rota

### Problema: Usuário vê dados de outra instituição
**Solução**: Verificar se todas queries usam `addInstitutionFilter(req)`

### Problema: Menu mostra item sem permissão
**Solução**: Verificar `getSidebarItemsForRole()` e filtro de roles

### Problema: Erro 403 não aparece claramente
**Solução**: Verificar tratamento de erro no frontend e mensagem institucional

---

## 📚 REFERÊNCIAS

- **RBAC Middleware**: `backend/src/middlewares/rbac.middleware.ts`
- **Auth Middleware**: `backend/src/middlewares/auth.ts`
- **Sidebar Config**: `frontend/src/components/layout/sidebar.config.ts`
- **Permission Service**: `backend/src/services/permission.service.ts`

---

**Última atualização**: 2025-01-27  
**Responsável**: Sistema de Validação RBAC DSICOLA

