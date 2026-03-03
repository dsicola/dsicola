# Solução: "Nenhuma Atribuição" mesmo com dados atribuídos

**Sintoma:** O professor tem disciplinas e turmas atribuídas (admin criou o Plano de Ensino), mas ao acessar o painel vê sempre "Nenhuma Atribuição" — sem turmas, disciplinas ou aulas.

**Regra Institucional (institucional):** Professor sem turma atribuída é um estado válido, não um erro. O sistema retorna 200 OK com arrays vazios.

---

## Soluções implementadas

### 1. Fallback automático para planos com professorId incorreto (users.id)

**Problema:** Planos criados com `professorId = users.id` em vez de `professorId = professors.id` não apareciam.

**Solução:** O backend agora tenta um fallback: se não encontrar planos com `professores.id`, busca com `users.id`. O professor passa a ver as atribuições mesmo com dados legacy incorretos.

**Log no backend:** Quando o fallback é usado, aparece:
```
⚠️ Encontrados N planos com professorId=users.id (LEGACY). Corrija com: UPDATE plano_ensino SET professor_id = '...' WHERE professor_id = '...';
```

**Correção permanente no banco:**
```sql
-- Substituir EMAIL_DO_PROFESSOR pelo email real
UPDATE plano_ensino 
SET professor_id = (SELECT id FROM professores WHERE user_id = (SELECT id FROM users WHERE email = 'EMAIL_DO_PROFESSOR'))
WHERE professor_id = (SELECT id FROM users WHERE email = 'EMAIL_DO_PROFESSOR');
```

---

## Diagnóstico passo a passo

### Passo 1: Executar script de diagnóstico

```bash
cd backend
npx tsx scripts/diagnostico-professor.ts email.do.professor@dominio.com
```

O script verifica:
1. Se o usuário existe
2. Se tem registro na tabela `professores`
3. Planos com professorId correto (professores.id)
4. Planos com professorId errado (users.id)
5. **Novo:** Planos com professorId OK mas instituicaoId diferente

### Passo 2: Verificar logs do backend

Com o backend rodando, faça o professor acessar o painel e confira nos logs:

```
[getTurmasByProfessor] 📋 Request: { userId, professorId, instituicaoId, ... }
[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Encontrados X planos de ensino
```

Se aparecer **"Encontrados 0 planos"** e depois **"tentando fallback com users.id"** e **"Encontrados N planos"** → o fallback funcionou; corrija os dados com o UPDATE acima.

---

## Causas comuns e correções

| Causa | Solução |
|-------|---------|
| **professorId = users.id** | Fallback automático (já implementado). Corrigir permanentemente com UPDATE no banco. |
| **Professor não cadastrado** | Admin → Professores → Criar Professor → Vincular usuário |
| **instituicaoId diferente** | `UPDATE plano_ensino SET instituicao_id = 'ID_DA_INSTITUICAO' WHERE professor_id = '...'` |
| **Admin selecionou outro professor** | Verificar na atribuição; refazer com o professor correto |
| **Sem ano letivo ativo** | Admin → Anos Letivos → Criar/ativar ano letivo |
| **Planos sem instituicaoId** | Schema exige instituicaoId; planos novos já têm. Legacy: migration para preencher. |

---

## Checklist de verificação

- [ ] Professor tem registro em `professores` com `userId` correto?
- [ ] Planos de Ensino usam `professorId` = `professores.id` (não `users.id`)?
- [ ] `instituicaoId` do plano = `instituicaoId` do professor no JWT?
- [ ] Na atribuição, o admin selecionou o professor correto da lista (GET /professores)?
- [ ] Há ano letivo ATIVO na instituição?
- [ ] O professor está logado na instituição correta?

---

## Scripts disponíveis

```bash
cd backend

# Diagnóstico (substituir pelo email do professor)
npx tsx scripts/diagnostico-professor.ts email@professor.com

# Correção automática (professorId errado, instituicaoId)
npx tsx scripts/corrigir-atribuicoes.ts

# Atribuir plano a professor sem atribuições (quando há disciplina livre)
npx tsx scripts/corrigir-atribuicoes.ts --atribuir=email@professor.com

# Listar todos os professores e planos
npx tsx scripts/verificar-planos.ts
```

## Arquivos alterados

- `backend/src/services/validacaoAcademica.service.ts` — Fallback para professorId=users.id
- `backend/src/controllers/turma.controller.ts` — Passa userId para fallback
- `backend/scripts/diagnostico-professor.ts` — Verificação de instituicaoId
- `backend/scripts/corrigir-atribuicoes.ts` — Correção e atribuição automática
- `backend/scripts/verificar-planos.ts` — Listagem de professores e planos

---

## Comportamento após correção

1. **Com fallback:** Professor vê atribuições mesmo com dados incorretos; logs avisam para corrigir.
2. **Após correção no banco:** Professor continua vendo; busca principal funciona sem fallback.
3. **Sem planos:** Mensagem "Nenhuma Atribuição" (estado válido, não erro).
