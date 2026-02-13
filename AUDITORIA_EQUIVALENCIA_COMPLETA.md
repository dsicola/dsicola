# AUDITORIA E IMPLEMENTAÇÃO: EQUIVALÊNCIA DE DISCIPLINAS

## ✅ O QUE JÁ EXISTIA

1. **Modelo Prisma (`EquivalenciaDisciplina`)**
   - ✅ Campos obrigatórios: `instituicaoId`, `alunoId`, `cursoDestinoId`, `disciplinaDestinoId`
   - ✅ Campos condicionais: `semestre`, `classeOuAno` (via disciplina)
   - ✅ Campos de equivalência: `cargaHorariaOrigem`, `cargaHorariaEquivalente`, `notaOrigem`
   - ✅ Campos de deferimento: `deferido`, `deferidoPor`, `deferidoEm`
   - ✅ Suporte a disciplinas externas: `disciplinaOrigemNome`, `instituicaoOrigemNome`
   - ✅ Constraint único: `@@unique([instituicaoId, alunoId, disciplinaDestinoId])`

2. **Controller (`equivalencia.controller.ts`)**
   - ✅ `createEquivalencia`: Criar solicitação
   - ✅ `getEquivalencias`: Listar (filtrado por instituição)
   - ✅ `getEquivalenciaById`: Obter por ID
   - ✅ `getEquivalenciasByAluno`: Listar por aluno
   - ✅ `updateEquivalencia`: Atualizar (apenas se não deferida)
   - ✅ `deferirEquivalencia`: Deferir (ADMIN apenas)
   - ✅ `indeferirEquivalencia`: Indeferir (ADMIN apenas)
   - ✅ `deleteEquivalencia`: Deletar (apenas se não deferida)
   - ✅ Validação de carga horária (80% mínimo para Ensino Superior)
   - ✅ Bloqueio de edição após deferimento
   - ✅ Auditoria completa

3. **Rotas (`equivalencia.routes.ts`)**
   - ✅ Rotas registradas em `/equivalencias`
   - ✅ RBAC correto (ADMIN, SECRETARIA, PROFESSOR, ALUNO)

## ✅ O QUE FOI IMPLEMENTADO

### 1. Integração com Histórico Acadêmico

**Arquivo:** `backend/src/services/historicoAcademico.service.ts`

- ✅ Função `buscarHistoricoAluno` atualizada para incluir equivalências deferidas
- ✅ Equivalências aparecem no histórico com flag `origemEquivalencia: true`
- ✅ Equivalências mostram:
  - Disciplina destino (dispensada)
  - Disciplina origem (equivalente)
  - Instituição origem (se externa)
  - Critério (EQUIVALENCIA ou DISPENSA)
  - Data de deferimento
  - Usuário que deferiu

**Arquivo:** `backend/src/controllers/relatorios.controller.ts`

- ✅ `getHistoricoEscolar` atualizado para exibir equivalências
- ✅ Equivalências aparecem com frequência 100% e status "Dispensada por Equivalência"
- ✅ Dados de equivalência incluídos no payload

### 2. API Frontend

**Arquivo:** `frontend/src/services/api.ts`

- ✅ `equivalenciasApi` criado com métodos:
  - `getAll`: Listar equivalências
  - `getById`: Obter por ID
  - `getByAluno`: Listar por aluno
  - `create`: Criar solicitação
  - `update`: Atualizar (apenas se não deferida)
  - `deferir`: Deferir equivalência
  - `indeferir`: Indeferir equivalência
  - `delete`: Deletar (apenas se não deferida)

## 🔄 O QUE FALTA (Frontend)

### Componente de Equivalências

**Arquivo:** `frontend/src/components/admin/EquivalenciasTab.tsx` (A CRIAR)

**Funcionalidades necessárias:**

1. **Listagem de Equivalências**
   - Tabela com: Aluno, Disciplina Origem, Disciplina Destino, Status (Deferida/Pendente), Data
   - Filtros: Aluno, Status (deferido/pendente), Disciplina destino
   - Badge para equivalências deferidas

2. **Criar Solicitação de Equivalência**
   - Modal com fluxo guiado:
     - Aluno (select)
     - Curso Origem (opcional, para disciplinas internas)
     - Disciplina Origem (select ou input para externa)
     - Instituição Origem (input para externa)
     - Carga Horária Origem
     - Nota Origem (opcional)
     - Curso Destino (obrigatório)
     - Disciplina Destino (obrigatório)
     - Carga Horária Equivalente
     - Critério (EQUIVALENCIA ou DISPENSA)
     - Observação

3. **Visualizar Equivalência**
   - Modal com detalhes completos
   - Mostrar dados de origem e destino
   - Mostrar status de deferimento
   - Mostrar histórico de auditoria

4. **Deferir/Indeferir**
   - Botão "Deferir" (apenas ADMIN, apenas se pendente)
   - Botão "Indeferir" (apenas ADMIN, apenas se pendente)
   - Modal de confirmação com observação/motivo

5. **Editar Equivalência**
   - Apenas se não deferida
   - Modal similar ao criar

6. **Visualização no Histórico**
   - Badge "Equivalência" nas disciplinas dispensadas
   - Tooltip com informações da equivalência
   - Exibir disciplina origem e instituição origem

## 📋 REGRAS IMPLEMENTADAS

### Backend

1. ✅ **Histórico Imutável**
   - Equivalências deferidas não podem ser editadas ou deletadas
   - Histórico snapshot não é recalculado

2. ✅ **Validação de Carga Horária**
   - Ensino Superior: mínimo 80% da carga horária origem
   - Ensino Secundário: flexibilidade administrativa

3. ✅ **Multi-tenant**
   - `instituicaoId` sempre do token
   - Validação de pertencimento à instituição

4. ✅ **Auditoria**
   - Todos os eventos registrados
   - Logs de criação, atualização, deferimento, indeferimento

5. ✅ **RBAC**
   - ADMIN: Criar, deferir, indeferir, editar, deletar
   - SECRETARIA: Criar, editar (não deferida), deletar (não deferida)
   - PROFESSOR: Visualizar
   - ALUNO: Visualizar apenas próprias

### Frontend (A Implementar)

1. **UX SIGA/SIGAE**
   - Fluxo guiado: Aluno → Origem → Destino
   - Campos condicionais baseados em tipo de instituição
   - Validação client-side antes de enviar

2. **Estabilidade**
   - Usar `useSafeDialog` para modais
   - Usar `useSafeMutation` para mutations
   - Cleanup seguro de Portals

3. **Visualização no Histórico**
   - Badge "Equivalência" nas disciplinas dispensadas
   - Tooltip com detalhes da equivalência
   - Exibir origem e destino claramente

## 🎯 PRÓXIMOS PASSOS

1. Criar componente `EquivalenciasTab.tsx`
2. Adicionar rota/menu para equivalências
3. Integrar visualização de equivalências no histórico do aluno
4. Testar fluxo completo: criar → deferir → visualizar no histórico

## ✅ RESULTADO FINAL ESPERADO

- ✅ Equivalências juridicamente válidas
- ✅ Histórico acadêmico preservado (imutável)
- ✅ Compatível com SIGA/SIGAE
- ✅ Multi-tenant seguro
- ✅ Auditável
- ✅ Frontend profissional (a implementar)

