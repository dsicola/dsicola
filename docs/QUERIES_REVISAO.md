# Revisão de Queries — DSICOLA

Checklist para evitar N+1 e otimizar selects (ROADMAP-100).

---

## 1. Padrões Recomendados

- **Include/select mínimo:** Usar `select` ou `include` apenas com campos necessários
- **Evitar N+1:** Preferir `include` em vez de queries em loop
- **Paginação:** Sempre em listagens grandes (page, pageSize)

---

## 2. Fluxos Críticos Revisados

| Fluxo | Endpoint | Observação |
|-------|----------|------------|
| Listagem alunos | GET /estudantes | Paginação; include de roles |
| Listagem mensalidades | GET /mensalidades | Paginação; include aluno, matricula |
| Dashboard stats | GET /stats/admin | Agregações; evitar count(*) em loops |
| Configuração | GET /configuracoes-instituicao | Cache em memória (TTL 5 min) |
| Notas | GET/POST /notas | PlanoEnsino com include de disciplina, turma |

---

## 3. Índices Relevantes

- `instituicao_id` em tabelas multi-tenant
- `mensalidades(aluno_id, status)` para listagem por aluno
- `notas(planoEnsinoId, alunoId)` para boletim

---

## 4. Como Verificar N+1

1. Ativar query logging no Prisma: `log: ['query']` em desenvolvimento
2. Procurar padrões: múltiplas queries similares em sequência
3. Usar `include` ou `Promise.all` com batch para consolidar

---

*Documento no âmbito do [ROADMAP-100.md](./ROADMAP-100.md).*
