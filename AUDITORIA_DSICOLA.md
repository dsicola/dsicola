# AUDITORIA DSICOLA - Alinhamento institucional

**Data:** 2025-01-XX
**Objetivo:** Auditoria completa de UX, RBAC, Fluxos e Estabilidade para conformidade institucional

---

## 📋 ESTRUTURA ATUAL IDENTIFICADA

### ✅ PONTOS FORTES

1. **RBAC Backend:**
   - Middlewares de autorização bem estruturados (`authorize`, `authorizeModule`)
   - Bloqueio correto de SUPER_ADMIN em módulos acadêmicos
   - Verificação de contexto para PROFESSOR/COORDENADOR

2. **RBAC Frontend:**
   - `ProtectedRoute` funcional com verificação de roles
   - Menus dinâmicos por role no `DashboardLayout`
   - Redirecionamento correto para dashboards apropriados

3. **Separação Financeiro/Acadêmico:**
   - POS Dashboard separado
   - Secretaria Dashboard com foco financeiro
   - Menus organizados por área

---

## 🔍 ÁREAS DE ATENÇÃO IDENTIFICADAS

### 1. RBAC - PERFIS E PERMISSÕES

#### SUPER_ADMIN
- ✅ Bloqueado de módulos acadêmicos (correto)
- ⚠️ Menu muito limitado (apenas 3 itens)
- ✅ Rotas protegidas corretamente

#### ADMIN
- ✅ Acesso amplo a módulos acadêmicos (correto)
- ⚠️ Menu muito extenso (precisa organização melhor)
- ⚠️ "Configuração de Ensinos" bloqueado para PROFESSOR/SUPER_ADMIN (correto)
- ✅ Fluxo: Curso → Disciplina → Plano de Ensino → Turma → Matrícula

#### SECRETARIA
- ✅ Foco em financeiro e documentos (correto)
- ⚠️ Menu tem acesso a "Consultar Presenças" e "Consultar Notas" (verificar se correto)
- ✅ Sem acesso a criação de cursos/disciplinas (correto)

#### PROFESSOR
- ✅ Menu focado: Turmas, Plano de Ensino, Notas, Frequência
- ✅ Sem acesso a financeiro (correto)
- ⚠️ Verificar se pode acessar todas as suas turmas/disciplinas

#### ALUNO
- ✅ Menu focado: Dashboard, Histórico, Mensalidades, Documentos
- ✅ Sem acesso a edição (correto)
- ✅ Linguagem simples

#### POS
- ✅ Menu único: Ponto de Venda
- ✅ Separado de acadêmico (correto)

---

### 2. FINANCEIRO

#### POS (Ponto de Venda)
- ✅ Dashboard separado
- ✅ Interface focada em pagamentos
- ✅ Sem acesso a acadêmico
- ⚠️ Verificar se está totalmente isolado de módulos acadêmicos

#### PROPINA / MENSALIDADE
- ✅ Associada a Curso/Classe (verificar schema)
- ⚠️ Verificar se nunca está diretamente ao aluno

#### BOLSAS
- ✅ Tela de gestão existente (`BolsasDescontos`)
- ⚠️ Verificar regras de elegibilidade e aplicação

#### MULTAS
- ✅ Tela de configuração existente (`ConfiguracaoMultas`)
- ⚠️ Verificar se nunca automáticas sem regra explícita

#### PAGAMENTOS
- ✅ Associados à matrícula (verificar schema)
- ⚠️ Verificar histórico imutável e estorno vs delete

---

### 3. UX - CAMPOS CONDICIONAIS

#### ENSINO SUPERIOR
- ✅ Exibe "Semestre"
- ⚠️ Verificar se oculta "Classe" corretamente

#### ENSINO SECUNDÁRIO
- ✅ Exibe "Classe"
- ⚠️ Verificar se oculta "Semestre" corretamente

#### TRIMESTRE
- ✅ Apenas em avaliações (Secundário)
- ⚠️ Verificar se não aparece em outros contextos incorretamente

---

### 4. ESTABILIDADE UI (PORTALS/MODALS)

#### HOOKS SEGUROS
- ✅ `useSafeDialog` implementado
- ✅ `useSafeMutation` implementado
- ⚠️ Verificar se TODOS os modais usam esses hooks

#### PORTALS
- ⚠️ Verificar se não há múltiplos containers
- ⚠️ Verificar cleanup em todos os modais
- ⚠️ Verificar se modais não fecham em erro de API

---

### 5. ROTAS PROTEGIDAS

#### BACKEND
- ✅ Rotas principais protegidas com `authorize`
- ✅ Módulos protegidos com `authorizeModule`
- ⚠️ Verificar se todas as rotas críticas estão protegidas

#### FRONTEND
- ✅ Rotas principais protegidas com `ProtectedRoute`
- ⚠️ Verificar se todas as rotas críticas têm `allowedRoles`
- ⚠️ Verificar consistência entre backend e frontend

---

## 🎯 PRIORIDADES DE CORREÇÃO

### CRÍTICO (P0)
1. Verificar e corrigir permissões inconsistentes entre frontend/backend
2. Garantir que TODOS os modais usam `useSafeDialog`
3. Garantir que TODAS as mutations usam `useSafeMutation`
4. Verificar separação POS/Acadêmico está completa

### ALTO (P1)
1. Organizar menu ADMIN (muito extenso)
2. Verificar campos condicionais em TODOS os formulários
3. Verificar fluxo financeiro (bolsas, multas, pagamentos)
4. Adicionar verificações de permissão em ações críticas

### MÉDIO (P2)
1. Melhorar mensagens de erro/acesso negado
2. Verificar consistência de labels por tipo de instituição
3. Verificar se há campos visíveis que não deveriam estar
4. Melhorar feedback visual de ações

---

## 📝 PRÓXIMOS PASSOS

1. **Auditoria Detalhada de Modais/Portals**
   - Listar TODOS os componentes com Dialog/Modal
   - Verificar uso de `useSafeDialog`
   - Verificar cleanup adequado

2. **Auditoria de Rotas Backend**
   - Listar TODAS as rotas e suas proteções
   - Verificar se todas críticas estão protegidas
   - Verificar consistência com frontend

3. **Auditoria de Campos Condicionais**
   - Listar TODOS os formulários
   - Verificar exibição de Semestre/Classe/Trimestre
   - Garantir que campos corretos aparecem

4. **Auditoria Financeira**
   - Verificar schema de Propina/Mensalidade
   - Verificar regras de Bolsas/Multas
   - Verificar isolamento POS

---

**NOTA:** Esta auditoria é incremental. Correções serão aplicadas mantendo funcionalidades existentes.

