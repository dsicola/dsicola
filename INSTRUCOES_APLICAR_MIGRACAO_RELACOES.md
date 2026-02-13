# 🔧 INSTRUÇÕES: Aplicar Migração de Relações Acadêmicas

## ✅ O QUE FOI CORRIGIDO

Esta migração adiciona as **foreign keys faltantes** para garantir integridade referencial completa:

1. ✅ `MatriculaAnual.anoLetivoId` → `AnoLetivo.id`
2. ✅ `PlanoEnsino.anoLetivoId` → `AnoLetivo.id`
3. ✅ `AlunoDisciplina.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`
4. ✅ `AulaLancada.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`
5. ✅ `Avaliacao.semestreId/trimestreId` → `Semestre.id`/`Trimestre.id`

## 📋 COMO APLICAR

### Opção 1: Via Prisma Migrate (Recomendado)

```bash
cd backend
npx prisma migrate dev --name add_missing_academic_relations
npx prisma generate
```

### Opção 2: Executar SQL Manualmente

Execute o arquivo `backend/prisma/migrations/20250127000000_add_missing_academic_relations/migration.sql` diretamente no banco de dados:

**Via psql:**
```bash
psql -U seu_usuario -d seu_banco -f backend/prisma/migrations/20250127000000_add_missing_academic_relations/migration.sql
```

**Via pgAdmin ou DBeaver:**
1. Abra o arquivo `backend/prisma/migrations/20250127000000_add_missing_academic_relations/migration.sql`
2. Execute o script completo

## 📊 O QUE A MIGRAÇÃO FAZ

1. ✅ Adiciona colunas faltantes (se não existirem)
2. ✅ Preenche dados existentes automaticamente:
   - `MatriculaAnual.anoLetivoId` baseado em `anoLetivo` (número)
   - `PlanoEnsino.anoLetivoId` baseado em `anoLetivo` (número)
   - `AlunoDisciplina.semestreId/trimestreId` baseado em `ano` + `semestre` (string)
   - `AulaLancada.semestreId/trimestreId` baseado em `PlanoAula` → `PlanoEnsino` → `anoLetivo`
   - `Avaliacao.semestreId/trimestreId` baseado em `PlanoEnsino` → `anoLetivo` + `trimestre` (número)
3. ✅ Cria índices para melhorar performance
4. ✅ Adiciona foreign keys para garantir integridade referencial

## ⚠️ IMPORTANTE

- A migração é **idempotente** (pode ser executada múltiplas vezes sem erro)
- Não afeta dados existentes (apenas adiciona colunas e preenche)
- Mantém compatibilidade com código existente (campos antigos continuam funcionando)

## ✅ APÓS APLICAR

1. Reinicie o servidor backend
2. Teste criar/editar:
   - Matrícula Anual
   - Plano de Ensino
   - Aluno Disciplina
   - Aula Lançada
   - Avaliação
3. Verifique se as relações estão funcionando corretamente

## 🔍 VERIFICAÇÃO

Após aplicar a migração, você pode verificar se as relações foram criadas:

```sql
-- Verificar foreign keys criadas
SELECT 
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('matriculas_anuais', 'plano_ensino', 'aluno_disciplinas', 'aulas_lancadas', 'avaliacoes')
ORDER BY tc.table_name, kcu.column_name;
```

---

**Status**: ✅ **PRONTO PARA APLICAR**

