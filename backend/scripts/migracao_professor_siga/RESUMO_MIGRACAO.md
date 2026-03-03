# 📋 RESUMO EXECUTIVO - MIGRAÇÃO PROFESSOR institucional

## ✅ STATUS: PRONTO PARA EXECUÇÃO

---

## 🎯 OBJETIVO

Migrar o modelo acadêmico do DSICOLA para o padrão **institucional real**, onde:

- **Professor** é uma entidade institucional própria (não apenas um User)
- **Plano de Ensino** referencia `professores.id` (não `users.id`)
- Mantém compatibilidade com **Ensino Superior** e **Ensino Secundário**
- Preserva **isolamento multi-tenant**

---

## 📊 ESTRUTURA ANTES E DEPOIS

### ❌ ANTES (Legacy)
```
User (id)
  └─ plano_ensino.professor_id → users.id
```

**Problemas:**
- Professor não é uma entidade institucional
- Plano de ensino referencia diretamente User
- Não segue padrão institucional

### ✅ DEPOIS (institucional)
```
User (id)
  └─ Professor (user_id → users.id)
      └─ plano_ensino.professor_id → professores.id
```

**Benefícios:**
- Professor como entidade institucional
- Modelo acadêmico padronizado
- Compatível com institucional
- Pronto para auditoria e escala

---

## 🔄 ETAPAS DA MIGRAÇÃO

### 1. **Backup** (`01_backup_banco.sh`)
- Cria backup completo do banco
- Valida integridade
- Armazena em `backups_migracao_professor/`

### 2. **Validação Pré-Migração** (`02_validacao_pre_migracao.sql`)
- Verifica existência das tabelas
- Conta dados atuais
- Valida integridade referencial
- Identifica problemas

### 3. **Popular Professores** (`03_popular_professores.sql`)
- Cria registros em `professores` para todos os usuários com role `PROFESSOR`
- **Idempotente**: não cria duplicados
- Preserva multi-tenant

### 4. **Migrar Plano de Ensino** (`04_migrar_plano_ensino.sql`)
- Atualiza `plano_ensino.professor_id` de `users.id` → `professores.id`
- **Idempotente**: pode ser executado múltiplas vezes
- Preserva todos os planos existentes

### 5. **Atualizar Constraints** (`06_atualizar_constraints.sql`)
- Remove foreign key antiga (`plano_ensino.professor_id → users.id`)
- Cria foreign key nova (`plano_ensino.professor_id → professores.id`)
- Garante integridade referencial

### 6. **Verificação Pós-Migração** (`05_verificacao_pos_migracao.sql`)
- Valida que a migração foi executada corretamente
- Verifica integridade referencial
- Confirma isolamento multi-tenant
- Gera relatório completo

---

## 🚀 EXECUÇÃO

### Script Automatizado (Recomendado)

```bash
cd backend/scripts/migracao_professor_siga
export DATABASE_URL="postgresql://usuario:senha@host:porta/banco"
./EXECUTAR_MIGRACAO_COMPLETA.sh
```

### Execução Manual

```bash
cd backend/scripts/migracao_professor_siga

# 1. Backup
bash 01_backup_banco.sh

# 2. Validação
psql $DATABASE_URL -f 02_validacao_pre_migracao.sql

# 3. Popular professores
psql $DATABASE_URL -f 03_popular_professores.sql

# 4. Migrar plano_ensino
psql $DATABASE_URL -f 04_migrar_plano_ensino.sql

# 5. Atualizar constraints
psql $DATABASE_URL -f 06_atualizar_constraints.sql

# 6. Verificação
psql $DATABASE_URL -f 05_verificacao_pos_migracao.sql
```

---

## ✅ VALIDAÇÃO PÓS-MIGRAÇÃO

### 1. Verificar Tabela Professores

```sql
SELECT COUNT(*) FROM professores;
-- Deve ser > 0

SELECT COUNT(*) 
FROM professores p
INNER JOIN users u ON u.id = p.user_id
INNER JOIN user_roles ur ON ur.user_id = u.id
WHERE ur.role = 'PROFESSOR';
-- Deve corresponder ao total de professores
```

### 2. Verificar Plano de Ensino

```sql
-- Planos devem referenciar professores.id (não users.id)
SELECT COUNT(*) 
FROM plano_ensino pe
INNER JOIN professores p ON p.id = pe.professor_id;
-- Deve corresponder ao total de planos com professor_id
```

### 3. Verificar Constraints

```sql
-- Verificar foreign key
SELECT 
  tc.constraint_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'plano_ensino'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.column_name = 'professor_id';
-- Deve mostrar: foreign_table_name = 'professores'
```

### 4. Testar no Sistema

- ✅ Login de professores funciona
- ✅ Painel do professor carrega corretamente
- ✅ Planos de ensino aparecem para o professor
- ✅ Multi-tenant preservado

---

## 🔄 RESTAURAR BACKUP (Se Necessário)

```bash
# Encontrar último backup
BACKUP_FILE=$(cat backend/scripts/migracao_professor_siga/backups_migracao_professor/.ultimo_backup)

# Restaurar
psql $DATABASE_URL < $BACKUP_FILE
```

---

## 📝 PRÓXIMOS PASSOS APÓS MIGRAÇÃO

1. **Atualizar Prisma Client:**
   ```bash
   cd backend
   npx prisma generate
   ```

2. **Reiniciar o backend:**
   ```bash
   npm run dev
   ```

3. **Testar funcionalidades:**
   - Login de professores
   - Painel do professor
   - Visualização de planos de ensino
   - Criação de novos planos de ensino

---

## ⚠️ IMPORTANTE

- ✅ **FAZ BACKUP** automaticamente antes de qualquer alteração
- ✅ **IDEMPOTENTE**: pode ser executada múltiplas vezes sem erro
- ✅ **SEGURA**: não apaga dados, apenas atualiza referências
- ✅ **VALIDADA**: verifica integridade antes e depois

**Execute apenas em ambiente de desenvolvimento/teste primeiro!**

---

## 📚 DOCUMENTAÇÃO

- **Instruções detalhadas:** `INSTRUCOES_EXECUCAO.md`
- **README completo:** `README.md`
- **Scripts de migração:** `03_popular_professores.sql`, `04_migrar_plano_ensino.sql`, etc.

---

**Última atualização:** 2025-01-XX  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para execução

