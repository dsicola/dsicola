# 🔍 DIAGNÓSTICO - Professor Sem Turmas no Painel

**Data:** 2025-01-27  
**Problema:** Professor "Jose" tem disciplina e turma atribuídas no banco, mas nada aparece no painel

---

## 🔍 PONTOS DE VERIFICAÇÃO

### 1. Verificar Mapeamento do professorId

**Problema Potencial:** O `professorId` no `PlanoEnsino` é uma FK para `User.id` (userId), não para `Professor.id`.

**Verificação:**
```sql
-- Verificar se há planos de ensino para o professor
SELECT pe.id, pe.professor_id, pe.estado, pe.bloqueado, pe.turma_id, pe.disciplina_id
FROM plano_ensino pe
WHERE pe.professor_id = '<userId_do_jose>'
  AND pe.instituicao_id = '<instituicaoId>';

-- Verificar o userId do Jose
SELECT u.id, u.email, u.nome_completo
FROM users u
WHERE u.nome_completo ILIKE '%jose%' OR u.email ILIKE '%jose%';
```

---

### 2. Verificar Estado do Plano de Ensino

**Problema Potencial:** Se o plano está em RASCUNHO ou EM_REVISAO e tem turma, a turma não será exposta (regra institucional).

**Verificação:**
```sql
-- Verificar estado dos planos
SELECT 
  pe.id,
  pe.estado,
  pe.bloqueado,
  pe.turma_id,
  d.nome as disciplina_nome,
  t.nome as turma_nome
FROM plano_ensino pe
LEFT JOIN disciplinas d ON d.id = pe.disciplina_id
LEFT JOIN turmas t ON t.id = pe.turma_id
WHERE pe.professor_id = '<userId_do_jose>'
ORDER BY pe.created_at DESC;
```

**Possíveis Causas:**
- ✅ Plano em RASCUNHO com turma → Turma não aparece (correto conforme institucional)
- ✅ Plano em EM_REVISAO com turma → Turma não aparece (correto conforme institucional)
- ✅ Plano em RASCUNHO sem turma → Deve aparecer como disciplina sem turma
- ✅ Plano ATIVO ou ENCERRADO → Deve aparecer normalmente

---

### 3. Verificar Instituição (Multi-tenant)

**Problema Potencial:** O plano pode estar em uma instituição diferente da do professor.

**Verificação:**
```sql
-- Verificar instituição do professor e dos planos
SELECT 
  u.id as user_id,
  u.instituicao_id as user_instituicao_id,
  pe.id as plano_id,
  pe.instituicao_id as plano_instituicao_id,
  pe.estado
FROM users u
LEFT JOIN plano_ensino pe ON pe.professor_id = u.id
WHERE u.nome_completo ILIKE '%jose%'
  AND u.instituicao_id IS NOT NULL;
```

---

### 4. Verificar Ano Letivo

**Problema Potencial:** O plano pode estar vinculado a um ano letivo diferente do ativo.

**Verificação:**
```sql
-- Verificar ano letivo dos planos
SELECT 
  pe.id,
  pe.ano_letivo_id,
  al.ano,
  al.status as ano_letivo_status
FROM plano_ensino pe
LEFT JOIN ano_letivo al ON al.id = pe.ano_letivo_id
WHERE pe.professor_id = '<userId_do_jose>';
```

---

## 🔧 AJUSTES IMPLEMENTADOS

### 1. Backend - Logs de Debug

Adicionados logs detalhados em:
- `buscarTurmasProfessorComPlanos()` - Loga parâmetros e resultados
- `getTurmas()` - Loga informações do usuário e requisição

### 2. Frontend - Logs de Debug

Adicionados logs detalhados em:
- `ProfessorDashboard.tsx` - Loga parâmetros enviados e dados retornados

### 3. Lógica Ajustada

**Ajuste:** Planos em RASCUNHO/EM_REVISAO com turma agora expõem como disciplina sem turma (para informação).

**Código:**
```typescript
// Se plano está em RASCUNHO/EM_REVISAO e tem turma
// Não expor a turma (regra institucional)
// Mas expor como disciplina sem turma para informação
if (!podeExporTurma && plano.turmaId && plano.turma) {
  // Criar entrada como disciplina sem turma
  turmasMap.set(chaveVirtual, {
    ...,
    turma: null, // Não expor turma
  });
}
```

---

## 📋 CHECKLIST DE DIAGNÓSTICO

### Verificar no Banco de Dados:

1. [ ] **Há planos de ensino para o professor?**
   ```sql
   SELECT COUNT(*) FROM plano_ensino WHERE professor_id = '<userId>';
   ```

2. [ ] **Qual é o estado dos planos?**
   ```sql
   SELECT estado, COUNT(*) FROM plano_ensino 
   WHERE professor_id = '<userId>' 
   GROUP BY estado;
   ```

3. [ ] **Os planos têm turma vinculada?**
   ```sql
   SELECT turma_id IS NOT NULL as tem_turma, COUNT(*) 
   FROM plano_ensino 
   WHERE professor_id = '<userId>' 
   GROUP BY (turma_id IS NOT NULL);
   ```

4. [ ] **O professorId está correto?**
   - Verificar se `PlanoEnsino.professorId` = `User.id` do Jose
   - Não usar `Professor.id`

5. [ ] **A instituição está correta?**
   - Verificar se `PlanoEnsino.instituicaoId` = `User.instituicaoId` do Jose

6. [ ] **O ano letivo está correto?**
   - Verificar se há ano letivo ativo
   - Verificar se os planos estão vinculados ao ano letivo correto

---

## 🔍 LOGS PARA VERIFICAR

### Backend (Console/Logs):

```
[getTurmas] Buscando turmas para professor <id>, incluirPendentes: true, anoLetivoId: <id>
[getTurmas] instituicaoId do token: <id>
[buscarTurmasProfessorComPlanos] Buscando planos com where: {...}
[buscarTurmasProfessorComPlanos] Parâmetros: instituicaoId=..., professorId=..., anoLetivoId=...
[buscarTurmasProfessorComPlanos] Encontrados X planos de ensino
[buscarTurmasProfessorComPlanos] Detalhes dos planos encontrados: [...]
```

### Frontend (Console do Navegador):

```
[ProfessorDashboard] Buscando turmas com params: {...}
[ProfessorDashboard] user?.id: <id>
[ProfessorDashboard] anoLetivoId: <id>
[ProfessorDashboard] Atribuições retornadas: X
[ProfessorDashboard] Detalhes das atribuições: [...]
```

---

## 🎯 PRÓXIMOS PASSOS

1. **Verificar logs do backend** para ver se planos estão sendo encontrados
2. **Verificar logs do frontend** para ver o que está sendo retornado
3. **Verificar no banco** se há planos para o professor
4. **Verificar estado dos planos** (RASCUNHO, EM_REVISAO, APROVADO, ENCERRADO)
5. **Verificar mapeamento** do professorId (deve ser User.id, não Professor.id)

---

**Status:** 🔍 **AGUARDANDO DIAGNÓSTICO**

