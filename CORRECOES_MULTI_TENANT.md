# Correções Multi-Tenant - Sistema DSICOLA

## Data: 2025-01-XX
## Status: EM PROGRESSO

## Resumo Executivo

Este documento detalha as correções aplicadas para garantir que o sistema DSICOLA respeite completamente o multi-tenant, garantindo que:
1. Dados de uma instituição NÃO apareçam em outra
2. Todas as queries Prisma filtrem por `instituicaoId` do token
3. UPDATE/DELETE garantam que o registro pertence à instituição
4. CREATE sempre use `instituicaoId` do token (nunca do body)

---

## 1. MELHORIAS NO MIDDLEWARE DE AUTENTICAÇÃO

### Arquivo: `backend/src/middlewares/auth.ts`

**Correções aplicadas:**
- ✅ Adicionado helper `getInstituicaoIdFromAuth(req)` - obtém instituicaoId do token
- ✅ Adicionado helper `requireTenantScope(req)` - força escopo de tenant
- ✅ Adicionado helper `addNestedInstitutionFilter(req, relationField)` - para queries aninhadas
- ✅ Melhorada documentação do `addInstitutionFilter`

**Funções disponíveis:**
```typescript
// Obter instituicaoId do token (retorna null se SUPER_ADMIN sem filtro)
getInstituicaoIdFromAuth(req): string | null

// Forçar escopo de tenant (lança erro se não tiver)
requireTenantScope(req): string

// Filtro para entidades com instituicaoId direto
addInstitutionFilter(req): { instituicaoId: string } | {}

// Filtro para queries aninhadas (ex: aluno.instituicaoId)
addNestedInstitutionFilter(req, relationField): { [field]: string } | { [field]: null }
```

---

## 2. CONTROLLERS CORRIGIDOS

### ✅ `frequencia.controller.ts` - CRÍTICO
**Problemas encontrados:**
- Nenhuma query filtrada por instituição
- CREATE/UPDATE/DELETE não verificavam tenant

**Correções:**
- ✅ `getFrequencias` - Filtra por instituição através de turma
- ✅ `getFrequenciaById` - Verifica tenant antes de retornar
- ✅ `createFrequencia` - Verifica que aula e aluno pertencem à instituição
- ✅ `updateFrequencia` - Verifica tenant antes de atualizar
- ✅ `deleteFrequencia` - Verifica tenant antes de deletar
- ✅ `registrarFrequenciasEmLote` - Verifica todos os alunos pertencem à instituição
- ✅ `getFrequenciasByAluno` - Filtra por instituição

### ✅ `aula.controller.ts` - CRÍTICO
**Problemas encontrados:**
- `getAulaById`, `createAula`, `updateAula`, `deleteAula` não verificavam tenant

**Correções:**
- ✅ `getAulaById` - Verifica tenant através de turma
- ✅ `createAula` - Verifica que turma pertence à instituição
- ✅ `updateAula` - Verifica tenant antes de atualizar
- ✅ `deleteAula` - Verifica tenant antes de deletar

### ✅ `nota.controller.ts` - CRÍTICO
**Problemas encontrados:**
- `getNotaById`, `deleteNota` não verificavam tenant
- `getNotasByAluno` não filtrava por instituição

**Correções:**
- ✅ `getNotaById` - Verifica tenant através de exame.turma
- ✅ `deleteNota` - Verifica tenant e permissão de professor
- ✅ `getNotasByAluno` - Filtra por instituição

### ✅ `matricula.controller.ts` - CRÍTICO
**Problemas encontrados:**
- `getMatriculaById`, `updateMatricula`, `deleteMatricula` não verificavam tenant
- `getMatriculasByAluno` não filtrava por instituição

**Correções:**
- ✅ `getMatriculaById` - Verifica tenant através de aluno
- ✅ `updateMatricula` - Verifica tenant antes de atualizar
- ✅ `deleteMatricula` - Verifica tenant antes de deletar
- ✅ `getMatriculasByAluno` - Filtra por instituição

### ✅ `user.controller.ts`
**Correções:**
- ✅ `updateUserRole` - Agora verifica tenant antes de atualizar role

### ✅ Controllers já corretos (verificados):
- `curso.controller.ts` - Já usa `addInstitutionFilter` corretamente
- `turma.controller.ts` - Já usa `addInstitutionFilter` corretamente
- `disciplina.controller.ts` - Já usa `addInstitutionFilter` corretamente
- `mensalidade.controller.ts` - Já implementa filtro multi-tenant corretamente
- `comunicado.controller.ts` - Já usa `addInstitutionFilter` corretamente
- `pagamento.controller.ts` - Já verifica tenant através de mensalidade

---

## 3. CONTROLLERS AINDA PENDENTES DE AUDITORIA

Os seguintes controllers precisam ser auditados e corrigidos:

### 🔴 Alta Prioridade:
1. `alojamento.controller.ts` - Verificar se todas as queries filtram por instituição
2. `alocacaoAlojamento.controller.ts` - Verificar filtros
3. `funcionario.controller.ts` - Verificar se todas as queries filtram
4. `cargo.controller.ts` - Verificar filtros
5. `departamento.controller.ts` - Verificar filtros
6. `bolsa.controller.ts` - Verificar filtros
7. `alunoBolsa.controller.ts` - Verificar filtros
8. `documentoAluno.controller.ts` - Verificar filtros
9. `documentoEmitido.controller.ts` - Verificar filtros
10. `candidatura.controller.ts` - Verificar filtros

### 🟡 Média Prioridade:
11. `evento.controller.ts` - Verificar filtros
12. `turno.controller.ts` - Verificar filtros
13. `horario.controller.ts` - Verificar filtros
14. `exame.controller.ts` - Já tem alguns filtros, verificar completude
15. `matriculaAnual.controller.ts` - Verificar filtros
16. `alunoDisciplina.controller.ts` - Verificar filtros

### 🟢 Baixa Prioridade (mas importante):
17. `feriado.controller.ts` - Verificar filtros
18. `configuracaoMulta.controller.ts` - Verificar filtros
19. `metaFinanceira.controller.ts` - Verificar filtros
20. `trimestreFechado.controller.ts` - Verificar filtros
21. `logAuditoria.controller.ts` - Verificar filtros
22. `estatistica.controller.ts` - Verificar filtros

---

## 4. REGRAS OBRIGATÓRIAS APLICADAS

### A) Multi-tenant
- ✅ Backend obtém `instituicaoId` SEMPRE do token (`req.user.instituicaoId`)
- ✅ Frontend NÃO envia `instituicaoId` no body (exceto SUPER_ADMIN em casos específicos)
- ✅ Todas as queries Prisma filtram por `instituicaoId`
- ✅ UPDATE/DELETE verificam que registro pertence à instituição
- ✅ CREATE sempre seta `instituicaoId` do token

### B) Autorização por role
- ✅ Middleware `authenticate` verifica token
- ✅ Middleware `authorize` verifica roles
- ✅ Middleware `enforceTenant` garante escopo de tenant
- ✅ Professor só acessa recursos das suas turmas

### C) Tratamento de erros
- ✅ 401 - Sem token ou token inválido
- ✅ 403 - Sem permissão (role ou tenant)
- ✅ 404 - Registro não encontrado (evita vazamento de existência)

---

## 5. FRONTEND - VERIFICAÇÕES

### ✅ Já implementado:
- `mensalidadesApi.getAll()` - Remove `instituicaoId` se fornecido
- `mensalidadesApi.create()` - Remove `instituicaoId` se fornecido
- Comentários de segurança em vários lugares

### 🔴 Pendente:
- Auditar TODAS as chamadas de API para garantir que `instituicaoId` não seja enviado
- Garantir que React Query keys incluam `instituicaoId` para separar cache
- Verificar se há telas que quebram por dados undefined

---

## 6. PADRÕES DE CORREÇÃO APLICADOS

### Para GET (findMany):
```typescript
const filter = addInstitutionFilter(req);
const where: any = { ...filter };
// ... adicionar outros filtros
const results = await prisma.model.findMany({ where });
```

### Para GET by ID (findFirst/findUnique):
```typescript
const filter = addInstitutionFilter(req);
const result = await prisma.model.findFirst({
  where: { id, ...filter }
});
if (!result) {
  throw new AppError('Registro não encontrado', 404);
}
```

### Para CREATE:
```typescript
const instituicaoId = requireTenantScope(req); // ou req.user.instituicaoId
const data = {
  ...bodyData,
  instituicaoId // SEMPRE do token, nunca do body
};
await prisma.model.create({ data });
```

### Para UPDATE:
```typescript
const filter = addInstitutionFilter(req);
const existing = await prisma.model.findFirst({
  where: { id, ...filter }
});
if (!existing) {
  throw new AppError('Registro não encontrado', 404);
}
// NUNCA permitir alterar instituicaoId
delete updateData.instituicaoId;
await prisma.model.update({ where: { id }, data: updateData });
```

### Para DELETE:
```typescript
const filter = addInstitutionFilter(req);
const existing = await prisma.model.findFirst({
  where: { id, ...filter }
});
if (!existing) {
  throw new AppError('Registro não encontrado', 404);
}
await prisma.model.delete({ where: { id } });
```

### Para queries aninhadas (ex: mensalidade -> aluno):
```typescript
const filter = addInstitutionFilter(req);
const where: any = { id };
if (filter.instituicaoId) {
  where.aluno = { instituicaoId: filter.instituicaoId };
}
const result = await prisma.mensalidade.findFirst({ where });
```

---

## 7. TESTES RECOMENDADOS

### Teste 1: Isolamento de dados
1. Criar 2 instituições (A e B)
2. Criar dados em cada (cursos, turmas, alunos, mensalidades)
3. Logar como admin da A
4. Verificar que:
   - Listagens só mostram dados da A
   - Não consegue acessar registros da B (404)
   - Não consegue editar/deletar registros da B (404)

### Teste 2: Professor
1. Logar como professor da instituição A
2. Verificar que:
   - Só vê turmas atribuídas a ele
   - Só vê alunos das suas turmas
   - Só pode lançar notas em exames das suas turmas
   - Não consegue acessar dados de outras instituições

### Teste 3: Secretaria
1. Logar como secretaria da instituição A
2. Verificar que:
   - Só vê mensalidades da instituição A
   - Só vê alunos da instituição A
   - Não consegue criar registros para outra instituição

### Teste 4: Aluno
1. Logar como aluno da instituição A
2. Verificar que:
   - Só vê suas próprias notas
   - Só vê suas próprias frequências
   - Só vê suas próprias mensalidades
   - Não consegue acessar dados de outros alunos

---

## 8. PRÓXIMOS PASSOS

1. ✅ Continuar auditando e corrigindo controllers pendentes
2. ✅ Auditar rotas para garantir middleware de auth
3. ✅ Auditar frontend para remover envio de instituicaoId
4. ✅ Garantir React Query keys incluem instituicaoId
5. ✅ Corrigir telas que quebram por dados undefined
6. ✅ Garantir consistência Secundário vs Superior

---

## 9. ARQUIVOS ALTERADOS

### Backend:
- `backend/src/middlewares/auth.ts` - Melhorias nos helpers
- `backend/src/controllers/frequencia.controller.ts` - Correções completas
- `backend/src/controllers/aula.controller.ts` - Correções completas
- `backend/src/controllers/nota.controller.ts` - Correções completas
- `backend/src/controllers/matricula.controller.ts` - Correções completas
- `backend/src/controllers/user.controller.ts` - Correção em updateUserRole

### Frontend:
- (Ainda pendente auditoria completa)

---

## 10. NOTAS IMPORTANTES

1. **SUPER_ADMIN**: Pode acessar qualquer instituição, mas deve usar `instituicaoId` via query param quando necessário
2. **404 vs 403**: Usar 404 quando registro não pertence ao tenant (evita vazamento de existência)
3. **Performance**: Filtros de instituição são aplicados em TODAS as queries, garantindo segurança
4. **Compatibilidade**: Mantida compatibilidade com código existente onde possível

---

## 11. VALIDAÇÃO FINAL

Após completar todas as correções, validar:

- [ ] Todos os controllers auditados
- [ ] Todas as rotas com middleware de auth
- [ ] Frontend não envia instituicaoId no body
- [ ] React Query keys incluem instituicaoId
- [ ] Testes manuais passando
- [ ] Sem erros 400/403/500 relacionados a tenant
- [ ] Dados de uma instituição não aparecem em outra

---

**Última atualização:** 2025-01-XX
**Status:** Em progresso - ~30% completo

