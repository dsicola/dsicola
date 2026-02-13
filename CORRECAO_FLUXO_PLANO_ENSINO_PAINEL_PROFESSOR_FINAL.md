# ✅ CORREÇÃO COMPLETA - FLUXO PLANO DE ENSINO E PAINEL DO PROFESSOR

**Data:** 2025-01-27  
**Status:** ✅ **CORRIGIDO**  
**Padrão:** SIGA/SIGAE  
**Multi-tenant:** ✅ Validado

---

## 📋 RESUMO EXECUTIVO

Corrigido TODO o fluxo entre Plano de Ensino e Painel do Professor no ERP educacional multi-tenant DSICOLA, seguindo rigorosamente o padrão SIGA/SIGAE. O sistema agora:

1. ✅ Mostra TODAS as disciplinas atribuídas ao professor (com e sem turma)
2. ✅ Exibe planos em qualquer estado (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
3. ✅ Bloqueia ações apenas quando necessário (não esconde dados válidos)
4. ✅ Usa formato padronizado de resposta do backend
5. ✅ Garante que `instituicaoId` sempre vem do JWT (nunca do frontend)
6. ✅ Lida corretamente com planos legacy (instituicaoId null)

---

## 🔧 ETAPA 1 — AUDITORIA E CORREÇÃO DO BACKEND

### ✅ Endpoint: `GET /turmas?professorId=...&incluirPendentes=true`

**Arquivo:** `backend/src/controllers/turma.controller.ts`

**Correções implementadas:**

1. **Filtros obrigatórios validados:**
   - ✅ `instituicaoId` sempre do JWT (`requireTenantScope(req)`)
   - ✅ `professorId` do query (User.id, não Professor.id)
   - ✅ `anoLetivoId` opcional (se não fornecido, busca em todos os anos letivos)

2. **Query de planos de ensino:**
   - ✅ Retorna planos COM turma
   - ✅ Retorna planos SEM turma
   - ✅ Retorna planos em QUALQUER estado (quando `incluirPendentes=true`)
   - ✅ Filtra por `instituicaoId` e `professorId` corretamente

### ✅ Função: `buscarTurmasProfessorComPlanos`

**Arquivo:** `backend/src/services/validacaoAcademica.service.ts`

**Correções implementadas:**

1. **Validação prévia do professor:**
   - ✅ Verifica se o professor pertence à instituição antes de buscar planos
   - ✅ Garante segurança multi-tenant mesmo para planos legacy (instituicaoId null)

2. **Query corrigida para planos legacy:**
   ```typescript
   const where: any = {
     AND: [
       {
         OR: [
           { instituicaoId: instituicaoId }, // Planos com instituicaoId correspondente
           { instituicaoId: null }, // Planos legacy (serão validados pelo professor)
         ],
       },
       {
         professorId, // IMPORTANTE: professorId é User.id (userId), não Professor.id
       },
       {
         disciplinaId: { not: null }, // Garantir que plano tem disciplina
       },
     ],
   };
   ```

3. **Processamento de planos:**
   - ✅ Inclui planos COM turma vinculada (quando plano ATIVO ou ENCERRADO)
   - ✅ Inclui planos SEM turma (disciplinas atribuídas)
   - ✅ Aplica regra SIGA/SIGAE: Turmas só expostas para planos ATIVO ou ENCERRADO
   - ✅ Planos em RASCUNHO/EM_REVISAO são mostrados como "disciplina sem turma"

---

## 🔧 ETAPA 2 — NORMALIZAÇÃO DA RESPOSTA DO BACKEND

### ✅ Formato Padronizado

**Arquivo:** `backend/src/controllers/turma.controller.ts` (linhas 37-113)

**Formato de resposta padronizado:**
```typescript
{
  id: string,
  nome: string,
  codigo: string,
  disciplina: {
    id: string,
    nome: string,
  },
  curso: {
    id: string,
    nome: string,
    codigo: string,
  } | null,
  disciplinaId: string,
  disciplinaNome: string,
  planoEnsinoId: string,
  planoEstado: string, // RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO
  planoBloqueado: boolean,
  planoAtivo: boolean, // Calculado: estado === 'APROVADO' && !bloqueado
  statusPlano: string,
  podeLancarAula: boolean, // Calculado: temTurma && planoAtivo
  podeLancarNota: boolean, // Calculado: temTurma && planoAtivo
  motivoBloqueio?: string, // Mensagem explicativa quando ações bloqueadas
  semTurma: boolean, // true se não há turma vinculada
  turma: {
    id: string,
    nome: string,
  } | null,
  turmaId: string | null,
  // ... outros campos da turma (turno, sala, horario, etc.)
}
```

**Campos calculados:**
- ✅ `planoAtivo`: `estado === 'APROVADO' && !bloqueado`
- ✅ `podeLancarAula`: `temTurma && planoAtivo`
- ✅ `podeLancarNota`: `temTurma && planoAtivo`
- ✅ `motivoBloqueio`: Mensagem explicativa baseada no estado do plano

---

## 🔧 ETAPA 3 — CORREÇÃO DO FRONTEND

### ✅ ProfessorDashboard

**Arquivo:** `frontend/src/pages/professor/ProfessorDashboard.tsx`

**Correções implementadas:**

1. **Separação visual:**
   - ✅ Turmas (com vínculo) exibidas em card separado
   - ✅ Disciplinas sem turma exibidas em card separado
   - ✅ Mensagens claras para cada estado

2. **Mensagens informativas:**
   - ✅ "Disciplina atribuída, aguardando vinculação a turma"
   - ✅ "Plano de Ensino em rascunho - aguardando aprovação"
   - ✅ "Plano de Ensino em revisão pela coordenação"
   - ✅ "Plano de Ensino encerrado - apenas visualização"
   - ✅ "Plano de Ensino bloqueado - contacte a coordenação"

3. **Botões e ações:**
   - ✅ Desabilitados quando `podeLancarAula === false` ou `podeLancarNota === false`
   - ✅ Tooltips com motivo do bloqueio
   - ✅ Mensagens claras sobre o que é necessário para habilitar ações

4. **Lógica de filtragem:**
   ```typescript
   // Turmas (com vínculo)
   const turmas = todasAtribuicoes
     .filter((item: any) => !item.semTurma && item.turma && item.turmaId)
     .map((item: any) => ({
       ...item,
       planoAtivo: item.planoAtivo !== undefined 
         ? item.planoAtivo 
         : (item.planoEstado === 'APROVADO' && !item.planoBloqueado),
       podeLancarAula: item.podeLancarAula !== undefined ? item.podeLancarAula : false,
       podeLancarNota: item.podeLancarNota !== undefined ? item.podeLancarNota : false,
       motivoBloqueio: item.motivoBloqueio,
       statusPlano: item.statusPlano || item.planoEstado || item.estado,
     }));

   // Disciplinas sem turma
   const disciplinasSemTurma = todasAtribuicoes
     .filter((item: any) => item.semTurma === true)
     .map((item: any) => ({
       ...item,
       planoAtivo: item.planoAtivo !== undefined 
         ? item.planoAtivo 
         : (item.planoEstado === 'APROVADO' && !item.planoBloqueado),
       podeLancarAula: item.podeLancarAula !== undefined ? item.podeLancarAula : false,
       podeLancarNota: item.podeLancarNota !== undefined ? item.podeLancarNota : false,
       motivoBloqueio: item.motivoBloqueio,
       statusPlano: item.statusPlano || item.planoEstado || item.estado,
     }));
   ```

---

## 🔧 ETAPA 4 — MATRIZ DE TESTES

### ✅ Cenários Validados

1. ✅ **Professor sem plano**
   - Resultado: Array vazio retornado
   - Frontend: Mensagem "Nenhuma atribuição"

2. ✅ **Professor com plano sem turma**
   - Resultado: Disciplina exibida em "Disciplinas Atribuídas"
   - Frontend: Mensagem "Aguardando alocação de turma"
   - Ações: Desabilitadas

3. ✅ **Plano + turma ATIVO**
   - Resultado: Turma exibida em "Minhas Turmas"
   - Frontend: Badge "Ativo" verde
   - Ações: Habilitadas

4. ✅ **Plano + turma RASCUNHO**
   - Resultado: Disciplina exibida em "Disciplinas Atribuídas" (não expõe turma)
   - Frontend: Badge "Rascunho" amarelo
   - Ações: Desabilitadas

5. ✅ **Plano BLOQUEADO**
   - Resultado: Turma/Disciplina exibida com status
   - Frontend: Badge "Bloqueado" amarelo
   - Ações: Desabilitadas

6. ✅ **Ensino Superior**
   - Resultado: Funciona corretamente
   - Validação: Curso obrigatório, sem classe

7. ✅ **Ensino Secundário**
   - Resultado: Funciona corretamente
   - Validação: Classe obrigatória, curso opcional

8. ✅ **Multi-tenant (2 instituições)**
   - Resultado: Professor vê apenas planos da sua instituição
   - Validação: `instituicaoId` sempre do JWT

---

## 🔒 REGRAS ABSOLUTAS IMPLEMENTADAS

1. ✅ `instituicaoId` SEMPRE vem do JWT (`requireTenantScope(req)`)
2. ✅ Nunca confiar em `instituicaoId` do frontend
3. ✅ Não esconder dados válidos - mostrar TODAS as atribuições
4. ✅ Bloquear ações, não visibilidade
5. ✅ Não quebrar Ensino Secundário
6. ✅ Não criar lógica legacy paralela

---

## 📊 RESULTADO FINAL

- ✅ Painel do professor reflete o banco de dados
- ✅ Nenhum dado válido escondido
- ✅ Ações bloqueadas corretamente
- ✅ UX profissional padrão SIGA/SIGAE
- ✅ Código limpo, previsível e auditável
- ✅ Logs detalhados para diagnóstico
- ✅ Tratamento de erros robusto

---

## 🚀 PRÓXIMOS PASSOS

1. Testar em ambiente de produção
2. Validar com usuários reais
3. Monitorar logs para identificar possíveis problemas
4. Documentar para outros desenvolvedores

---

**Desenvolvido seguindo rigorosamente o padrão SIGA/SIGAE**
