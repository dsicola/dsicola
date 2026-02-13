# AUDITORIA DETALHADA DSICOLA - Relatório Completo

**Data:** 2025-01-XX
**Metodologia:** Auditoria sistemática de todas as áreas simultaneamente

---

## 🔴 CRÍTICO - MODAIS NÃO USANDO useSafeDialog

### Arquivos que precisam ser corrigidos (PRIORIDADE MÁXIMA):

#### ❌ Biblioteca.tsx
- **Problema:** Usa `useState` direto para 4 dialogs
- **Linhas:** 61-64
- **Dialogs:**
  - `showCadastroDialog`
  - `showEdicaoDialog`
  - `showPreviewDialog`
  - `showEmprestimoDialog`
- **Status:** ❌ CRÍTICO - Pode causar Node.removeChild errors

#### ❌ BolsasDescontos.tsx
- **Problema:** Usa `useState` direto para 3 dialogs
- **Linhas:** 51-53
- **Dialogs:**
  - `showBolsaDialog`
  - `showAplicarDialog`
  - `showDeleteDialog`
- **Status:** ❌ CRÍTICO

#### ❌ AvaliacoesNotas.tsx
- **Problema:** Usa `useState` direto para 3 dialogs
- **Linhas:** 61-63
- **Dialogs:**
  - `showAvaliacaoDialog`
  - `showLancarNotasDialog`
  - `showDeleteDialog`
- **Status:** ❌ CRÍTICO

#### ❌ GestaoFinanceira.tsx
- **Problema:** Usa `useState` direto para 2 dialogs
- **Linhas:** 96-97
- **Dialogs:**
  - `showGerarDialog`
  - `showPagarDialog`
- **Status:** ❌ CRÍTICO

#### ❌ AdminDashboard.tsx
- **Problema:** Usa `useState` direto para 1 dialog
- **Linhas:** 47
- **Dialogs:**
  - `showPermissoesDialog`
- **Status:** ❌ CRÍTICO

#### ❌ PlanejarTab.tsx (PlanoEnsino)
- **Problema:** Usa `useState` direto para 4 dialogs
- **Linhas:** 32, 46-48
- **Dialogs:**
  - `showAulaDialog`
  - `showCopiarDialog`
  - `showBibliografiaDialog`
  - `showAjustarCargaDialog`
- **Status:** ❌ CRÍTICO

#### ❌ FinalizarTab.tsx (PlanoEnsino)
- **Problema:** Usa `useState` direto para 2 dialogs
- **Linhas:** 28-29
- **Dialogs:**
  - `showBloquearDialog`
  - `showDesbloquearDialog`
- **Status:** ❌ CRÍTICO

#### ❌ GerenciarTab.tsx (PlanoEnsino)
- **Problema:** Usa `useState` direto para 1 dialog
- **Linhas:** 40
- **Dialogs:**
  - `showEditDialog`
- **Status:** ❌ CRÍTICO

#### ❌ POSDashboard.tsx
- **Problema:** Usa `useState` direto para 2 dialogs
- **Linhas:** 85, 89
- **Dialogs:**
  - `showPagamentoDialog`
  - `showPrintDialog`
- **Status:** ❌ CRÍTICO - POS é crítico para operação financeira

#### ❌ SecretariaDashboard.tsx
- **Problema:** Usa `useState` direto para 4 dialogs
- **Linhas:** 129-131, 137
- **Dialogs:**
  - `showPagamentoDialog`
  - `showHistoricoDialog`
  - `showGerarDialog`
  - `showPrintDialog`
- **Status:** ❌ CRÍTICO - Secretaria é crítica para operação

#### ❌ MinhasMensalidades.tsx (Aluno)
- **Problema:** Usa `useState` direto para 1 dialog
- **Linhas:** 60
- **Dialogs:**
  - `showPrintDialog`
- **Status:** ⚠️ ALTO - Aluno precisa de estabilidade

---

### ✅ Arquivos que JÁ usam useSafeDialog (CORRETO):

1. ✅ LancamentoAulas.tsx - Usa `useSafeDialog`
2. ✅ FaturasPagamentos.tsx - Usa `useSafeDialog`
3. ✅ GestaoFrequencia.tsx (Professor) - Usa `useSafeDialog`
4. ✅ MinhaLicenca.tsx - Usa `useSafeDialog`

---

## 🔴 CRÍTICO - ROTAS BACKEND - ANÁLISE INICIAL

### Rotas identificadas que precisam verificação:

#### ✅ Rotas com autorização correta:
- `/relatorios/*` - Protegidas com `authorize('ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN')`
- `/presencas/*` - Protegidas adequadamente
- `/plano-ensino/*` - Protegidas adequadamente
- `/profiles/*` - Inclui POS (correto para busca de alunos)

#### ⚠️ Rotas que precisam verificação detalhada:
- Rotas de `/curso/*` - Verificar se ADMIN/SECRETARIA têm permissões corretas
- Rotas de `/disciplina/*` - Verificar se PROFESSOR não pode criar/editar
- Rotas de `/turma/*` - Verificar se PROFESSOR só pode consultar suas turmas
- Rotas de `/matricula/*` - Verificar se ALUNO não pode criar/editar
- Rotas de `/pagamento/*` - Verificar se POS/SECRETARIA têm acesso correto
- Rotas de `/mensalidade/*` - Verificar se ALUNO só pode consultar

---

## 🟡 ALTO - CAMPOS CONDICIONAIS

### Formulários que precisam verificação:

#### Curso (CursosProgramaTab.tsx)
- ✅ Já verificado - Exibe Grau Acadêmico apenas para Ensino Superior
- ✅ Já verificado - Duração do Curso obrigatória
- ✅ Já verificado - Tipo de Instituição read-only

#### Disciplina
- ⚠️ Verificar se campo "Semestre" aparece apenas para Ensino Superior
- ⚠️ Verificar se campo "Classe/Ano" aparece apenas para Ensino Secundário

#### Turma
- ⚠️ Verificar se campo "Semestre" aparece apenas para Ensino Superior
- ⚠️ Verificar se campo "Classe" aparece apenas para Ensino Secundário

#### Plano de Ensino
- ✅ Já verificado - Semestre/ClasseOuAno condicional

#### Avaliação
- ⚠️ Verificar se campo "Trimestre" aparece apenas para Ensino Secundário
- ⚠️ Verificar se campo "Semestre" aparece apenas para Ensino Superior

---

## 🟡 ALTO - RBAC FRONTEND

### Menus por Perfil:

#### SUPER_ADMIN
- ✅ Menu limitado (correto)
- ✅ Sem acesso a módulos acadêmicos (correto)

#### ADMIN
- ⚠️ Menu muito extenso - Precisa organização melhor
- ✅ "Configuração de Ensinos" bloqueado para PROFESSOR/SUPER_ADMIN (correto)

#### SECRETARIA
- ⚠️ Menu tem acesso a "Consultar Presenças" e "Consultar Notas"
  - **Verificar:** SECRETARIA deveria ter acesso apenas consulta (read-only)?
  - **Padrão SIGA:** SECRETARIA geralmente tem acesso consulta a presenças/notas

#### PROFESSOR
- ✅ Menu focado: Turmas, Plano de Ensino, Notas, Frequência
- ✅ Sem acesso a financeiro (correto)

#### ALUNO
- ✅ Menu focado: Dashboard, Histórico, Mensalidades, Documentos
- ✅ Sem acesso a edição (correto)

#### POS
- ✅ Menu único: Ponto de Venda
- ✅ Separado de acadêmico (correto)

---

## 🟡 ALTO - FINANCEIRO

### Schema e Regras:

#### Propina/Mensalidade
- ✅ **CORRETO:** Mensalidade está associada a `alunoId` (obrigatório) + `cursoId`/`classeId` (opcional)
  - **Schema:** `Mensalidade` tem `alunoId` (FK), `cursoId?`, `classeId?`
  - **Padrão SIGA:** ✅ CORRETO - Mensalidade pertence ao aluno, mas herda valor de Curso/Classe
  - **Curso/Classe:** Têm `valorMensalidade` que serve como base para gerar mensalidades
  - **Status:** ✅ CONFORME PADRÃO SIGA

#### Bolsas
- ✅ Tela de gestão existente (`BolsasDescontos`)
- ⚠️ **VERIFICAR:** Regras de elegibilidade estão claras?
- ⚠️ **VERIFICAR:** Aplicação é percentual ou valor fixo?

#### Multas
- ✅ Tela de configuração existente (`ConfiguracaoMultas`)
- ⚠️ **VERIFICAR:** Multas nunca são automáticas sem regra explícita?

#### Pagamentos
- ⚠️ **VERIFICAR:** Pagamentos estão associados à matrícula?
- ⚠️ **VERIFICAR:** Histórico é imutável?
- ⚠️ **VERIFICAR:** Estorno existe (não delete)?

#### POS
- ✅ Dashboard separado
- ⚠️ **VERIFICAR:** POS está totalmente isolado de módulos acadêmicos?

---

## 📋 RESUMO DE PRIORIDADES

### P0 - CRÍTICO (Ação Imediata)
1. **Modais sem useSafeDialog** - 11 arquivos identificados
   - Risco: Node.removeChild errors, instabilidade UI
   - Impacto: Todos os usuários
   - Esforço: Médio (migração sistemática)

2. **Rotas Backend sem proteção adequada**
   - Risco: Acesso não autorizado
   - Impacto: Segurança do sistema
   - Esforço: Alto (auditoria completa necessária)

### P1 - ALTO (Próxima Sprint)
1. **Campos condicionais** - Verificar todos os formulários
2. **RBAC Frontend** - Organizar menu ADMIN, verificar SECRETARIA
3. **Financeiro** - Verificar schema e regras

### P2 - MÉDIO (Backlog)
1. **Mensagens de erro/acesso negado** - Melhorar UX
2. **Labels por tipo de instituição** - Consistência
3. **Feedback visual** - Melhorar ações

---

## 🔄 PRÓXIMAS AÇÕES

1. **Migrar modais para useSafeDialog** (P0)
   - Ordem sugerida:
     1. POSDashboard (crítico financeiro)
     2. SecretariaDashboard (crítico operacional)
     3. AdminDashboard
     4. BolsasDescontos
     5. AvaliacoesNotas
     6. GestaoFinanceira
     7. Biblioteca
     8. PlanejarTab/FinalizarTab/GerenciarTab (PlanoEnsino)
     9. MinhasMensalidades

2. **Auditoria completa de rotas Backend** (P0)
   - Listar TODAS as rotas
   - Verificar proteções
   - Comparar com frontend

3. **Verificar campos condicionais** (P1)
   - Disciplina
   - Turma
   - Avaliação

4. **Auditoria Financeira** (P1)
   - Schema de Propina/Mensalidade
   - Regras de Bolsas/Multas
   - Isolamento POS

---

**NOTA:** Esta auditoria é contínua. Novos problemas serão adicionados conforme identificados.

