# Correções Notas/Boletim (SIGAE) – Onde se aplicam

Resumo de onde as correções de **notas por disciplina** e **ordem para o estudante** estão implementadas: backend vs frontend, dois tipos de instituição e multi-tenant.

---

## 1. Onde as correções estão feitas

| Correção | Backend | Frontend |
|----------|---------|----------|
| Professor vê só notas da **sua disciplina** | ✅ Sim | ❌ Não alterado (consome API) |
| Estudante vê disciplinas e avaliações **em ordem correta** | ✅ Sim | ❌ Não alterado (consome API) |

- **Backend:** Toda a lógica foi alterada nos controllers e no serviço de relatórios. O frontend apenas chama os endpoints e exibe o que a API devolve.
- **Frontend:** Não foi necessário alterar. As páginas **Gestão de Notas** (professor), **Painel do Aluno** e **Meu Boletim** já usam os endpoints corrigidos e mostram os dados na ordem/filtro que o backend envia.

---

## 2. Endpoints alterados (backend)

| Endpoint | Alteração | Ficheiro |
|----------|-----------|----------|
| `GET /notas?turmaId=...` | Filtro por `planoEnsinoId` do professor (só sua disciplina) | `nota.controller.ts` (getNotas) |
| `GET /notas` (professor, sem turmaId) | Filtro por `planoEnsinoId` do professor | `nota.controller.ts` (getNotas) |
| `GET /notas/turma/alunos?turmaId=...` | Filtro por `planoEnsinoId` do professor; notas por tipo (exame + avaliação) | `nota.controller.ts` (getAlunosNotasByTurma) |
| `GET /relatorios/boletim/:alunoId` | Ordenação: disciplinas por `disciplina.nome` (A–Z) | `relatorios.controller.ts` (getBoletimAluno) |
| `GET /notas/boletim/aluno/:alunoId` | Ordenação: planos por `disciplina.nome`; avaliações já por trimestre/data | `nota.controller.ts` (getBoletimAluno) |
| Boletim oficial (PDF/relatório) | Ordenação: planos por `disciplina.nome`; avaliações com `ordenarAvaliacoesParaPauta(tipoAcademico)` | `relatoriosOficiais.service.ts` (gerarBoletimAluno) |

---

## 3. Dois tipos de instituição (SECUNDARIO / SUPERIOR)

| Aspecto | SECUNDARIO | SUPERIOR |
|---------|------------|----------|
| Filtro professor (só sua disciplina) | ✅ Igual (por `planoEnsinoId`) | ✅ Igual |
| Ordem das disciplinas no boletim | ✅ Por nome | ✅ Por nome |
| Ordem das avaliações no boletim oficial | ✅ 1º → 2º → 3º trimestre, depois data | ✅ P1, P2, P3 (por data), Trabalho, Recuperação, Prova Final |

O `tipoAcademico` é usado em:
- `relatorios.controller.ts`: passado a `calcularMedia` (cálculo de média).
- `relatoriosOficiais.service.ts`: passado a `ordenarAvaliacoesParaPauta` para ordenar avaliações no boletim oficial.

---

## 4. Multi-tenant

- Todos os endpoints continuam a usar **filtro por instituição**: `addInstitutionFilter(req)`, `requireTenantScope(req)` ou `instituicaoId` nas queries.
- O filtro do professor é por **planos de ensino do professor** (que já estão associados à instituição do tenant). Nenhum filtro de tenant foi removido.

---

## 5. Resposta direta à pergunta

- **Backend e frontend?**  
  As correções estão **só no backend**. O frontend já usa esses endpoints e não precisou de alterações.

- **Dois tipos de instituição?**  
  **Sim.** O filtro do professor é igual; a ordem das avaliações no boletim oficial depende de `tipoAcademico` (SECUNDARIO vs SUPERIOR).

- **Multi-tenant?**  
  **Sim.** O isolamento por instituição mantém-se em todos os fluxos alterados.
