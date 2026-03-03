# 🔄 MIGRAÇÃO PROFESSOR institucional - DSICOLA

## 📋 Visão Geral

Esta migração implementa o padrão **institucional real** no sistema DSICOLA, onde:

- **Professor** é uma entidade institucional própria (não apenas um User)
- **Plano de Ensino** referencia `professores.id` (não `users.id`)
- Mantém compatibilidade com **Ensino Superior** e **Ensino Secundário**
- Preserva **isolamento multi-tenant**
- **Não perde dados** existentes

---

## ⚠️ IMPORTANTE

**Esta migração altera dados críticos do banco de dados!**

- ✅ **FAZ BACKUP** automaticamente antes de qualquer alteração
- ✅ **IDEMPOTENTE**: pode ser executada múltiplas vezes sem erro
- ✅ **SEGURA**: não apaga dados, apenas atualiza referências
- ✅ **VALIDADA**: verifica integridade antes e depois

**Execute apenas em ambiente de desenvolvimento/teste primeiro!**

---

## 🚀 Execução Rápida

### Opção 1: Script Automatizado (Recomendado)

```bash
cd backend/scripts/migracao_professor_siga
chmod +x 00_executar_migracao_completa.sh
chmod +x 01_backup_banco.sh
./00_executar_migracao_completa.sh
```

### Opção 2: Execução Manual (Passo a Passo)

```bash
cd backend/scripts/migracao_professor_siga

# 1. Backup
bash 01_backup_banco.sh

# 2. Validação pré-migração
psql $DATABASE_URL -f 02_validacao_pre_migracao.sql

# 3. Popular professores
psql $DATABASE_URL -f 03_popular_professores.sql

# 4. Migrar plano_ensino
psql $DATABASE_URL -f 04_migrar_plano_ensino.sql

# 5. Verificação pós-migração
psql $DATABASE_URL -f 05_verificacao_pos_migracao.sql
```

---

## 📝 O Que Cada Script Faz

### 1. `01_backup_banco.sh`
- Cria backup completo do banco PostgreSQL
- Valida integridade do backup
- Armazena em `backups_migracao_professor/`

### 2. `02_validacao_pre_migracao.sql`
- Verifica existência das tabelas necessárias
- Conta dados atuais
- Valida integridade referencial
- Identifica problemas antes da migração

### 3. `03_popular_professores.sql`
- Cria registros em `professores` para todos os usuários com role `PROFESSOR`
- **Idempotente**: não cria duplicados
- Preserva multi-tenant (valida `instituicao_id`)

### 4. `04_migrar_plano_ensino.sql`
- Atualiza `plano_ensino.professor_id` de `users.id` → `professores.id`
- **Idempotente**: pode ser executado múltiplas vezes
- Preserva todos os planos existentes
- Valida multi-tenant

### 5. `05_verificacao_pos_migracao.sql`
- Valida que a migração foi executada corretamente
- Verifica integridade referencial
- Confirma isolamento multi-tenant
- Gera relatório completo

---

## ✅ Pré-requisitos

1. **PostgreSQL** instalado e acessível
2. **DATABASE_URL** configurada no ambiente
3. **pg_dump** instalado (para backup)
4. **psql** instalado (para executar SQL)
5. **Permissões** adequadas no banco de dados

---

## 🔍 Validação Pós-Migração

Após executar a migração, valide:

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

### 3. Testar no Sistema

- ✅ Login de professores funciona
- ✅ Painel do professor carrega corretamente
- ✅ Planos de ensino aparecem para o professor
- ✅ Multi-tenant preservado (professor só vê dados da sua instituição)

---

## 🔄 Restaurar Backup (Se Necessário)

Se algo der errado, restaure o backup:

```bash
# Encontrar último backup
BACKUP_FILE=$(cat backend/scripts/migracao_professor_siga/backups_migracao_professor/.ultimo_backup)

# Restaurar
psql $DATABASE_URL < $BACKUP_FILE
```

---

## 📊 Estrutura Esperada Após Migração

### Antes (Legacy)
```
User (id)
  └─ plano_ensino.professor_id → users.id
```

### Depois (institucional)
```
User (id)
  └─ Professor (user_id → users.id)
      └─ plano_ensino.professor_id → professores.id
```

---

## 🐛 Troubleshooting

### Erro: "Tabela não existe"
- Verifique se todas as migrations do Prisma foram aplicadas
- Execute: `npx prisma migrate deploy`

### Erro: "DATABASE_URL não definida"
- Exporte a variável: `export DATABASE_URL="postgresql://..."`

### Erro: "Permissão negada"
- Verifique se o usuário do banco tem permissões adequadas
- Pode precisar executar como superuser

### Planos não migrados
- Verifique se o script de popular professores foi executado primeiro
- Verifique se os planos têm `professor_id` válido
- Verifique se os professores têm `instituicao_id` correspondente

---

## 📚 Referências

- [Documentação Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [PostgreSQL Backup/Restore](https://www.postgresql.org/docs/current/backup-dump.html)
- [Padrão institucional](https://www.mec.gov.br/siga)

---

## 📞 Suporte

Em caso de problemas:

1. Verifique os logs em `/tmp/migracao_*.log`
2. Revise o backup criado
3. Execute a verificação pós-migração novamente
4. Consulte a documentação do sistema

---

**Última atualização:** 2025-01-XX  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para produção (após testes)

