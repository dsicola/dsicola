# Diagnóstico: Professor não vê atribuições no painel

**Sintoma:** O professor tem disciplinas atribuídas (admin criou o Plano de Ensino), mas ao acessar o painel com suas credenciais vê "Nenhuma Atribuição" — sem turmas, disciplinas ou aulas.

---

## Causas mais prováveis

### 1. **professorId incorreto no Plano de Ensino** (mais comum)

Os planos usam `professores.id`, **não** `users.id`. Se o plano foi criado com o ID errado (ex.: user.id em vez de professores.id), o professor não verá as atribuições.

### 2. **Professor sem registro na tabela `professores`**

O usuário existe (users) e tem role PROFESSOR, mas não há registro em `professores` com `userId` vinculado. O sistema não consegue resolver o professor e retorna vazio.

### 3. **instituicaoId diferente**

O Plano de Ensino está em outra instituição que a do JWT do professor (multi-tenant).

### 4. **Admin selecionou outro professor**

Na atribuição, o admin pode ter escolhido um professor diferente com nome parecido.

---

## Script de diagnóstico (SQL)

Execute no banco para o professor **José Avelino** (avelino@gmail.com):

```sql
-- 1. Buscar o usuário pelo email
SELECT id AS user_id, "nomeCompleto" AS nome, email 
FROM users 
WHERE email = 'avelino@gmail.com';

-- 2. Com o user_id obtido acima, buscar o professor na tabela professores
-- Substitua :user_id pelo id retornado no passo 1
SELECT id AS professor_id, "userId", "instituicaoId"
FROM professores 
WHERE "userId" = ':user_id';

-- 3. Verificar planos de ensino para esse professor
-- Substitua :professor_id pelo professor_id do passo 2
SELECT pe.id, pe."professorId", pe."disciplinaId", pe."anoLetivoId", pe."instituicaoId",
       d.nome AS disciplina_nome, al.ano AS ano_letivo
FROM plano_ensino pe
LEFT JOIN disciplinas d ON d.id = pe."disciplinaId"
LEFT JOIN ano_letivo al ON al.id = pe."anoLetivoId"
WHERE pe."professorId" = ':professor_id';

-- 4. DIAGNÓSTICO CRÍTICO: Planos que usam users.id em vez de professores.id?
-- Se professorId do plano = users.id (e não professores.id), o professor não os verá
WITH dados AS (
  SELECT 
    u.id AS user_id,
    p.id AS professor_id
  FROM users u
  LEFT JOIN professores p ON p."userId" = u.id
  WHERE u.email = 'avelino@gmail.com'
)
SELECT 
  pe.id AS plano_id,
  pe."professorId",
  d.user_id,
  d.professor_id,
  CASE 
    WHEN pe."professorId" = d.user_id THEN 'ERRO: Plano usa users.id! Executar correção abaixo.'
    WHEN pe."professorId" = d.professor_id THEN 'OK: Plano usa professores.id'
    WHEN d.professor_id IS NULL THEN 'ERRO: Professor não existe na tabela professores'
    ELSE 'Outro professor: verificar se admin selecionou o correto'
  END AS diagnostico
FROM plano_ensino pe, dados d
WHERE pe."professorId" = d.user_id OR pe."professorId" = d.professor_id;
```

---

## Verificação rápida (por email)

Use este script completo substituindo apenas o email:

```sql
WITH usuario AS (
  SELECT id AS user_id FROM users WHERE email = 'avelino@gmail.com'
),
professor AS (
  SELECT p.id AS professor_id, p."instituicaoId"
  FROM professores p
  JOIN usuario u ON p."userId" = u.user_id
)
SELECT 
  '1. User existe?' AS check_item, 
  (SELECT COUNT(*) FROM usuario) AS resultado
UNION ALL
SELECT 
  '2. Professor na tabela professores?', 
  (SELECT COUNT(*) FROM professor)
UNION ALL
SELECT 
  '3. Planos com professorId correto (professores.id)?', 
  (SELECT COUNT(*) FROM plano_ensino pe 
   JOIN professor p ON pe."professorId" = p.professor_id 
   AND pe."instituicaoId" = p."instituicaoId")
UNION ALL
SELECT 
  '4. Planos com ERRO (professorId = users.id)?', 
  (SELECT COUNT(*) FROM plano_ensino pe 
   JOIN usuario u ON pe."professorId" = u.user_id);
```

**Interpretação:**
- Se **2 = 0**: Professor não está na tabela `professores` → cadastrar em Gestão de Professores.
- Se **3 = 0** e **4 > 0**: Planos foram criados com `users.id` em vez de `professores.id` → corrigir os planos.
- Se **3 = 0** e **4 = 0**: Não há planos para este professor → criar atribuição.

---

## Logs do backend

Com o backend rodando, faça o professor acessar o painel e confira nos logs:

```
[getTurmasByProfessor] 📋 Request: { userId, professorId, instituicaoId, ... }
[buscarTurmasEDisciplinasProfessorComPlanoAtivo] ✅ Encontrados X planos de ensino
```

Se aparecer **"Encontrados 0 planos"**, o problema está no vínculo entre `professorId`/`instituicaoId` e os planos.

---

## Script de diagnóstico (Node.js)

Na pasta do backend, execute:

```bash
cd backend
npx tsx scripts/diagnostico-professor.ts avelino@gmail.com
```

O script verifica automaticamente as 4 causas e sugere a correção.

---

## Correção: Planos com professorId errado

Se os planos foram criados com `users.id` em vez de `professores.id`:

```sql
-- Corrigir planos que usam users.id para usar professores.id
UPDATE plano_ensino 
SET professor_id = (SELECT id FROM professores WHERE user_id = (SELECT id FROM users WHERE email = 'avelino@gmail.com'))
WHERE professor_id = (SELECT id FROM users WHERE email = 'avelino@gmail.com');
```

*Nota: Use os nomes das colunas do banco (snake_case: professor_id, user_id).*

---

## Correção: Professor não cadastrado

1. Acesse como **ADMIN** → **Professores** → **Professores**
2. Clique em **"Criar Professor"**
3. Vincule ao usuário existente (avelino@gmail.com) ou crie novo usuário com role PROFESSOR
4. Após criar o professor, refaça a atribuição em **"Atribuição de Disciplinas"**
5. Confirme que está selecionando o professor da lista (que usa `professores.id`)

---

## Checklist de verificação

- [ ] Professor tem registro em `professores` com `userId` correto?
- [ ] Planos de Ensino usam `professorId` = `professores.id` (não `users.id`)?
- [ ] `instituicaoId` do plano = `instituicaoId` do professor no JWT?
- [ ] Na atribuição, o admin selecionou o professor correto da lista?
