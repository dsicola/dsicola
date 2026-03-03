# 🔄 MIGRAÇÃO COMPLETA: PROFESSOR institucional REAL

## 📋 Resumo Executivo

Esta migração implementa o padrão **institucional real** no sistema DSICOLA, transformando o modelo acadêmico para seguir o padrão institucional onde **Professor** é uma entidade própria, não apenas um User.

---

## 🎯 Objetivos

1. ✅ Popular tabela `professores` corretamente
2. ✅ Migrar `plano_ensino.professor_id` de `users.id` → `professores.id`
3. ✅ Garantir integridade referencial
4. ✅ Preservar dados existentes
5. ✅ Manter isolamento multi-tenant
6. ✅ Compatibilidade com Ensino Superior e Secundário

---

## 📊 Estado Atual vs. Estado Desejado

### ANTES (Legacy)
```
┌─────────────┐
│    User     │
│  (id, ...)  │
└──────┬──────┘
       │
       │ plano_ensino.professor_id → users.id
       │
       ▼
┌─────────────┐
│ PlanoEnsino │
│(professorId)│
└─────────────┘
```

### DEPOIS (institucional Real)
```
┌─────────────┐
│    User     │
│  (id, ...)  │
└──────┬──────┘
       │
       │ user_id (FK)
       │
       ▼
┌─────────────┐
│  Professor   │
│  (id, ...)   │
└──────┬──────┘
       │
       │ plano_ensino.professor_id → professores.id
       │
       ▼
┌─────────────┐
│ PlanoEnsino │
│(professorId)│
└─────────────┘
```

---

## 🔧 Scripts Criados

### 1. `00_executar_migracao_completa.sh`
**Script master** que executa toda a migração em ordem:
- Backup automático
- Validação pré-migração
- Popular professores
- Migrar plano_ensino
- Verificação pós-migração

### 2. `01_backup_banco.sh`
Cria backup completo do banco antes de qualquer alteração.

### 3. `02_validacao_pre_migracao.sql`
Valida estado do banco antes da migração:
- Existência das tabelas
- Contagem de dados
- Integridade referencial

### 4. `03_popular_professores.sql`
Popula tabela `professores`:
- Cria registros para todos os usuários com role `PROFESSOR`
- Idempotente (não cria duplicados)
- Preserva multi-tenant

### 5. `04_migrar_plano_ensino.sql`
Migra `plano_ensino.professor_id`:
- Atualiza de `users.id` → `professores.id`
- Idempotente (pode rodar múltiplas vezes)
- Preserva todos os planos

### 6. `05_verificacao_pos_migracao.sql`
Valida resultados da migração:
- Verifica integridade referencial
- Confirma isolamento multi-tenant
- Gera relatório completo

---

## 🚀 Como Executar

### Opção 1: Script Automatizado (Recomendado)

```bash
cd backend/scripts/migracao_professor_siga
./00_executar_migracao_completa.sh
```

### Opção 2: Manual (Passo a Passo)

```bash
# 1. Backup
bash 01_backup_banco.sh

# 2. Validação
psql $DATABASE_URL -f 02_validacao_pre_migracao.sql

# 3. Popular professores
psql $DATABASE_URL -f 03_popular_professores.sql

# 4. Migrar plano_ensino
psql $DATABASE_URL -f 04_migrar_plano_ensino.sql

# 5. Verificação
psql $DATABASE_URL -f 05_verificacao_pos_migracao.sql
```

---

## ✅ Checklist de Validação

Após executar a migração, verifique:

- [ ] Backup criado com sucesso
- [ ] Tabela `professores` populada (total > 0)
- [ ] Todos os usuários PROFESSOR têm registro em `professores`
- [ ] `plano_ensino.professor_id` referencia `professores.id` (não `users.id`)
- [ ] Nenhum plano foi perdido
- [ ] Isolamento multi-tenant preservado
- [ ] Login de professores funciona
- [ ] Painel do professor carrega corretamente
- [ ] Planos de ensino aparecem para o professor

---

## 🔍 Validações SQL

### Verificar Professores

```sql
-- Total de professores
SELECT COUNT(*) FROM professores;

-- Professores sem user válido (deve ser 0)
SELECT COUNT(*) 
FROM professores p
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.user_id);

-- Usuários PROFESSOR sem registro em professores (deve ser 0)
SELECT COUNT(DISTINCT u.id)
FROM users u
INNER JOIN user_roles ur ON u.id = ur.user_id
WHERE ur.role = 'PROFESSOR'
  AND u.instituicao_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM professores p 
    WHERE p.user_id = u.id AND p.instituicao_id = u.instituicao_id
  );
```

### Verificar Plano de Ensino

```sql
-- Planos que referenciam professores.id corretamente
SELECT COUNT(*) 
FROM plano_ensino pe
INNER JOIN professores p ON p.id = pe.professor_id;

-- Planos que ainda referenciam users.id (deve ser 0)
SELECT COUNT(*) 
FROM plano_ensino pe
WHERE pe.professor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM professores p WHERE p.id = pe.professor_id)
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = pe.professor_id);

-- Isolamento multi-tenant (deve ser 0)
SELECT COUNT(*) 
FROM plano_ensino pe
INNER JOIN professores p ON p.id = pe.professor_id
WHERE pe.instituicao_id IS NOT NULL
  AND p.instituicao_id IS NOT NULL
  AND pe.instituicao_id != p.instituicao_id;
```

---

## 🔄 Restaurar Backup (Se Necessário)

Se algo der errado:

```bash
# Encontrar último backup
BACKUP_FILE=$(cat backend/scripts/migracao_professor_siga/backups_migracao_professor/.ultimo_backup)

# Restaurar
psql $DATABASE_URL < $BACKUP_FILE
```

---

## 📝 Schema Prisma

O schema Prisma **já está correto**:

```prisma
model Professor {
  id            String   @id @default(uuid())
  userId        String   @unique @map("user_id")
  instituicaoId String   @map("instituicao_id")
  // ...
  planosEnsino  PlanoEnsino[]
}

model PlanoEnsino {
  // ...
  professorId   String   @map("professor_id")
  professor     Professor @relation(fields: [professorId], references: [id])
  // ...
}
```

**Não é necessário alterar o schema Prisma** - apenas executar as migrações de dados.

---

## 🐛 Troubleshooting

### Erro: "Tabela não existe"
```bash
# Aplicar migrations do Prisma
cd backend
npx prisma migrate deploy
```

### Erro: "DATABASE_URL não definida"
```bash
export DATABASE_URL="postgresql://user:password@host:port/database"
```

### Erro: "Permissão negada"
- Verifique permissões do usuário do banco
- Pode precisar executar como superuser

### Planos não migrados
- Execute `03_popular_professores.sql` primeiro
- Verifique se planos têm `professor_id` válido
- Verifique se professores têm `instituicao_id` correspondente

---

## 📚 Arquivos Relacionados

- `backend/prisma/schema.prisma` - Schema Prisma (já correto)
- `backend/src/controllers/professorDisciplina.controller.ts` - Controller (já usa professores.id)
- `backend/src/utils/professorResolver.ts` - Helper para resolver professorId

---

## ✅ Resultado Final Esperado

Após a migração:

1. ✅ **Modelo acadêmico institucional real** implementado
2. ✅ **Professor como entidade institucional** (não apenas User)
3. ✅ **Plano de Ensino como fonte única da verdade**
4. ✅ **Painel do professor funcional**
5. ✅ **Dados preservados** (nenhum dado perdido)
6. ✅ **Base pronta para auditoria e escala**

---

**Data:** 2025-01-XX  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para execução

