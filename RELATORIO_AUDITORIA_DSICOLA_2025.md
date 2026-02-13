# RELATÓRIO DE AUDITORIA TOTAL - DSICOLA

**Data:** 10/02/2025  
**Escopo:** Frontend + Backend + Prisma + Rotas (padrão SIGA/SIGAE)  
**Objetivo:** Verificar consistência multi-tenant, fluxos ponta-a-ponta e regras absolutas

---

## A) RELATÓRIO - O QUE ESTÁ OK

### 1. Auth/JWT/req.user ✅
- **auth.ts**: `instituicaoId` e `tipoAcademico` vêm exclusivamente do JWT (linhas 171-176)
- **auth.service.ts**: Login injeta `tipoAcademico` da instituição no token (linhas 537-550, 633-643)
- **refreshToken**: Mantém `tipoAcademico` no token renovado (linhas 768-783)
- **getInstituicaoIdFromAuth**: Não-SUPER_ADMIN usa apenas JWT; SUPER_ADMIN pode usar query param
- **requireTenantScope**: Valida UUID e lança erro se sem instituição
- **addInstitutionFilter**: Retorna filtro correto por role

### 2. instituicaoId SEMPRE do JWT ✅
- **auth.ts**: Validação rigorosa; token sem `instituicaoId` é rejeitado (linhas 91-102)
- **Controllers que REJEITAM body.instituicaoId**: planoEnsino, avaliacao, matricula, disciplina, turma, curso, mensalidade, equivalencia, backup, frequencia, bolsa, turno, dispositivoBiometrico, notificacao, saftExport, contratoFuncionario, horario, mensagemResponsavel, classe
- **Exceção controlada**: user.controller e professorDisciplina permitem body.instituicaoId APENAS para SUPER_ADMIN (com `isSuperAdmin &&`)

### 3. PlanoEnsino.professorId = professores.id ✅
- **schema.prisma**: `PlanoEnsino.professorId` → `Professor` (linha 2669-2701)
- **resolveProfessor.middleware**: Resolve `userId` → `professores.id` via `professorResolver`
- **professorResolver**: Busca `professores` por `userId` + `instituicaoId`; NUNCA retorna `users.id`
- **planoEnsino.controller**: Usa `req.professor.id` ou valida `professorIdBody` com `validateProfessorId`

### 4. Rotas ADMIN vs PROFESSOR ✅
- **Plano de Ensino**: POST/create → ADMIN/COORDENADOR (sem resolveProfessor); GET → resolveProfessorOptional para professores
- **Avaliação, Nota, Exame, Presença, AulasLancadas**: `resolveProfessor` nas rotas de professor
- **Turmas professor**: `GET /turmas/professor` usa `resolveProfessor`
- **Relatórios/Pautas**: `resolveProfessor` obrigatório para PROFESSOR

### 5. Dashboards ✅
- **Professor**: `getTurmasByProfessor` usa `req.professor.id` e `buscarTurmasEDisciplinasProfessorComPlanoAtivo` (1 chamada)
- **Aluno**: `getNotasByAluno`, `getBoletimAluno` filtram por instituição; aluno verificado antes
- **POS**: Usa mesmas rotas de pagamento com `requireTenantScope`

### 6. Financeiro/Propinas/Bloqueio ✅
- **pagamento.controller**: `requireTenantScope` e filtro `aluno: { instituicaoId }` na mensalidade
- **bloqueioAcademico.service**: Recebe `instituicaoId` como parâmetro; chamadores usam do JWT
- **mensalidade.controller**: Rejeita body.instituicaoId; usa `addInstitutionFilter`

### 7. Relatórios/Logs ✅
- **pautaFinal.service**: `requireTenantScope` e filtro `instituicaoId` em turma
- **relatoriosOficiais.service**: Usa `requireTenantScope`
- **audit.service**: Registra ações com contexto do request

### 8. Frontend ✅
- **api.ts**: Remove `instituicaoId` dos params em diversos endpoints; comentários explícitos
- **useTenantFilter**: Usa `instituicaoId` apenas para cache/query keys, não envia no body
- **Professor**: Não envia `professorId`/`instituicaoId`; backend extrai do JWT

---

## B) RELATÓRIO - O QUE ESTÁ QUEBRADO / COM RISCOS

### P1 - Defense in depth (queries sem filtro explícito)

| Arquivo | Linha | Causa | Risco |
|---------|-------|-------|-------|
| `pauta.controller.ts` | 209-224 | `matriculas.findMany({ where: { alunoId } })` e `notas.findMany` sem filtro por `turma.instituicaoId` | Em cenário de dados inconsistentes, possibilidade de retornar matrículas de outra instituição |
| `pauta.controller.ts` | 216-224 | `frequencias.findMany({ where: { alunoId } })` | Mesmo cenário |

**Causa raiz:** Aluno já é verificado com `instituicaoId`, mas as queries de matrícula/nota/frequência não reforçam o filtro por instituição na turma.

### P2 - Melhorias e limpeza

| Item | Local | Observação |
|------|-------|------------|
| console.log em produção | `planoEnsino.controller.ts` linhas 91-100 | Log de payload em toda requisição |
| termoLegal.middleware | linha 30 | `requireTenantScope(req)` pode lançar se SUPER_ADMIN sem instituição; ordem de fallback está correta |
| professorDisciplina getAll | linhas 12-41 | Variável `where` construída mas não usada (código morto) |

---

## C) PLANO DE CORREÇÃO (P0/P1/P2)

### P0 - Nenhuma correção crítica identificada
Não há itens que impeçam o sistema de funcionar. O fluxo de auth, multi-tenant e regras arquiteturais está consistente.

### P1 - Prioridade alta (defense in depth)
1. **pauta.controller.ts** – Adicionar filtro `turma: { instituicaoId }` (ou equivalente) nas queries de matrícula, nota e frequência em `getBoletim`.

### P2 - Prioridade média
1. Remover ou condicionar `console.log` em `planoEnsino.controller.ts` a `NODE_ENV !== 'production'`
2. Remover código morto em `professorDisciplina.controller.ts` (variável `where` não utilizada)

---

## D) EVIDÊNCIAS NO CÓDIGO

### instituicaoId do JWT (auth.ts)
```typescript
// Linhas 171-176
req.user = {
  userId: userId,
  email: decoded.email,
  instituicaoId: validatedInstituicaoId,  // SEMPRE do token
  roles: roles,
  tipoAcademico: decoded.tipoAcademico || null  // Do token
};
```

### Rejeição de body.instituicaoId (planoEnsino.controller.ts)
```typescript
// Linhas 84-86
if (req.body.instituicaoId !== undefined || req.body.instituicao_id !== undefined) {
  throw new AppError('Não é permitido alterar a instituição...', 400);
}
```

### professorId = professores.id (professorResolver.ts)
```typescript
// Linhas 74-88 - Busca na tabela professores
const professor = await prisma.professor.findFirst({
  where: { userId, instituicaoId },
  ...
});
return professor;  // professores.id
```

### resolveProfessor nas rotas de professor
- `avaliacao.routes.ts`: resolveProfessor em POST/PUT
- `nota.routes.ts`: resolveProfessor em create/update
- `turma.routes.ts`: resolveProfessor em GET /professor
- `aulasLancadas.routes.ts`: resolveProfessor
- `presenca.routes.ts`: resolveProfessor

---

## CONCLUSÃO

O sistema DSICOLA está **alinhado com as regras absolutas** definidas:
- `instituicaoId` e `tipoAcademico` vêm do JWT
- Queries usam filtro por instituição na maior parte dos fluxos
- `PlanoEnsino.professorId` referencia `professores.id`
- Rotas ADMIN/SECRETARIA/POS estão separadas das rotas PROFESSOR (com `resolveProfessor` apenas nas do professor)

**Recomendação:** Aplicar correção P1 em `pauta.controller.ts` para reforçar o multi-tenant no boletim.
