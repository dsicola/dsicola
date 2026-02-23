# Verificação: Horários 100% Multi-Tenant e Dois Tipos de Instituição

## Resumo

O módulo de **Horários** (e sugestões) está **100% multi-tenant** e suporta corretamente os dois tipos de instituição: **SECUNDARIO** (45 min hora-aula) e **SUPERIOR** (60 min hora-relógio).

---

## 1. Backend – Multi-Tenant

### 1.1 Escopo por instituição

- Todas as rotas de horários usam **`authenticate`** e, quando aplicável, **`authorize`**.
- Em todos os controllers é usado **`requireTenantScope(req)`**, que obtém `instituicaoId` do **JWT** (nunca do body ou query).
- O backend **rejeita** `req.body.instituicaoId` em create e update (400).

| Endpoint | Controller | Uso de instituicaoId |
|----------|------------|------------------------|
| GET /horarios | getAll | listarHorarios(instituicaoId, filters) |
| GET /horarios/:id | getById | findFirst({ id, instituicaoId }) |
| POST /horarios | create | criarHorario(instituicaoId, input) |
| PUT /horarios/:id | update | atualizarHorario(id, instituicaoId, input) |
| PATCH /horarios/:id/aprovar | aprovar | aprovarHorario(id, instituicaoId) |
| DELETE /horarios/:id | remove | excluirHorario(id, instituicaoId) |
| GET /horarios/sugestoes/:turmaId | getSugestoes | obterSugestoesHorarios(turmaId, instituicaoId, opts) |
| POST /horarios/bulk | criarBulk | criarHorario(instituicaoId, …) por item |
| GET /horarios/grade/turma/:turmaId | gradeTurma | obterGradePorTurma(turmaId, instituicaoId) |
| GET /horarios/grade/professor/:professorId | gradeProfessor | obterGradePorProfessor(professorId, instituicaoId) |
| Imprimir (turma/professor/:id) | horarioPrint | gerarPDF…(id, instituicaoId) |

### 1.2 Validações de tenant no service

- **obterPlanoEnsinoParaHorario(planoEnsinoId, instituicaoId)** – plano deve ser da instituição.
- **obterSugestoesHorarios** – turma com `where: { id: turmaId, instituicaoId }`; planos com `instituicaoId`; horários com `instituicaoId`.
- **validarConflitos** – todos os `where` incluem `instituicaoId`.
- **listarHorarios** – `where.instituicaoId`.
- **obterGradePorTurma / obterGradePorProfessor** – turma/professor e horários filtrados por `instituicaoId`.

Nenhum recurso de horário é acessado ou criado fora do tenant do token.

---

## 2. Backend – Dois tipos de instituição (SECUNDARIO / SUPERIOR)

### 2.1 Duração da hora-aula

- **duracaoHoraAula.ts**: `getDuracaoHoraAulaMinutos(instituicaoId, tipoAcademico)`.
  - Opção: `ParametrosSistema.duracaoHoraAulaMinutos` por instituição (45, 50 ou 60).
  - Fallback: **SECUNDARIO → 45 min**, **SUPERIOR → 60 min**.

### 2.2 Validação de bloco (secundário)

- **validarBlocoPorTipoInstituicao** (em horario.service):
  - Só valida duração fixa quando **tipoAcademico === 'SECUNDARIO'**.
  - **SUPERIOR**: não exige bloco fixo (blocos livres).
- Mensagem de erro de bloco inválido referencia 45 min no secundário.

### 2.3 Sugestões

- **obterSugestoesHorarios** usa `getDuracaoHoraAulaMinutos(instituicaoId, turma.instituicao?.tipoAcademico)` e `gerarBlocosPadrao(duracaoMin, turno)`.
- Blocos gerados respeitam 45 min (secundário) ou 60 min (superior) conforme a instituição da turma.

### 2.4 Impressão

- **horarioPrint.service** usa `instituicaoId` para turma/professor e horários; dados são sempre do tenant correto.

---

## 3. Frontend – Multi-Tenant

### 3.1 Contexto e listagens

- **useTenantFilter()**: fornece `instituicaoId` (e.g. do contexto/ token) para queries.
- **Turmas**: `turmasApi.getAll({ … })` – backend ignora `instituicaoId` do frontend e usa o do JWT; listagem é por tenant.
- **Horários**: `horariosApi.getAll({ turmaId, … })` – token define o tenant; resposta já filtrada.
- **Sugestões**: `horariosApi.getSugestoes(turmaId, turno)` – turmaId é da turma já listada no tenant; backend valida turma com `instituicaoId` do token.

### 3.2 Criação e alteração

- **horariosApi.create** e **horariosApi.createBulk** não enviam `instituicaoId` no body (removido explicitamente no frontend como boa prática).
- Backend usa apenas o tenant do JWT para criar/atualizar.

### 3.3 Parametros e tipo de instituição

- **parametrosSistemaApi.get()** – backend usa `requireTenantScope(req)`; parâmetros são por instituição (incluindo `duracaoHoraAulaMinutos`).
- **useInstituicao()**: expõe **isSecundario** / **isSuperior** (e tipo acadêmico) da instituição atual (token/config), alinhado ao backend.

---

## 4. Frontend – Dois tipos de instituição (UI)

### 4.1 Labels e blocos

- **HorariosTab** usa **isSecundario** (useInstituicao):
  - Rótulo: “Classe” vs “Turma”.
  - Display da turma: ano vs semestre/ano.
  - **Blocos fixos**: quando `isSecundario && blocosSecundario.length > 0`, o formulário de “Adicionar horário” mostra select de blocos de **duracaoMin** (45 min por defeito; ou valor de parametros).
- **duracaoMin**: `parametros?.duracaoHoraAulaMinutos ?? (isSecundario ? 45 : 60)` – alinhado ao backend.

### 4.2 Sugestões

- Modal “Gerar Sugestões” mostra “Blocos de {duracaoMin} min” – mesmo valor usado no backend para a instituição.
- Turnos (manhã/tarde/noite) e payload de createBulk estão alinhados com o backend.

---

## 5. Conclusão

| Aspecto | Estado |
|--------|--------|
| Escopo por instituição (tenant) no backend | ✅ Todas as operações usam `requireTenantScope` e `instituicaoId` do JWT |
| Recurso (turma, plano, horário) sempre do tenant | ✅ Queries e creates com `instituicaoId` |
| Frontend não envia instituicaoId para horários | ✅ create/createBulk sem instituicaoId no body |
| Listagens e sugestões por tenant | ✅ Turmas, horários e sugestões filtrados pelo token |
| SECUNDARIO: 45 min, blocos fixos | ✅ duracaoHoraAula + validarBloco + UI com blocos |
| SUPERIOR: 60 min, blocos livres | ✅ duracaoHoraAula + sem validação de bloco fixo |
| UI adaptada ao tipo (Classe/Turma, blocos) | ✅ useInstituicao + parametros + duracaoMin |

O módulo de horários e sugestões está **100% multi-tenant** e **correto para os dois tipos de instituição** (secundário e superior).
