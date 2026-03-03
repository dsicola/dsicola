# 🚀 INSTRUÇÕES DE EXECUÇÃO - MIGRAÇÃO PROFESSOR

## ⚠️ IMPORTANTE

**Esta migração altera dados críticos do banco de dados!**

- ✅ **FAZ BACKUP** automaticamente antes de qualquer alteração
- ✅ **IDEMPOTENTE**: pode ser executada múltiplas vezes sem erro
- ✅ **SEGURA**: não apaga dados, apenas atualiza referências
- ✅ **VALIDADA**: verifica integridade antes e depois

**Execute apenas em ambiente de desenvolvimento/teste primeiro!**

---

## 📋 PRÉ-REQUISITOS

1. **PostgreSQL** instalado e acessível
2. **DATABASE_URL** configurada no ambiente
3. **pg_dump** instalado (para backup)
4. **psql** instalado (para executar SQL)
5. **Permissões** adequadas no banco de dados

---

## 🚀 EXECUÇÃO RÁPIDA

### Opção 1: Script Automatizado (Recomendado)

```bash
cd backend/scripts/migracao_professor_siga

# Definir DATABASE_URL (se necessário)
export DATABASE_URL="postgresql://usuario:senha@host:porta/banco"

# Executar migração completa
./EXECUTAR_MIGRACAO_COMPLETA.sh
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

## 📝 O QUE CADA ETAPA FAZ

### ETAPA 1: Backup (`01_backup_banco.sh`)
- Cria backup completo do banco PostgreSQL
- Valida integridade do backup
- Armazena em `backups_migracao_professor/`
- **CRÍTICO**: Guarde este backup em local seguro!

### ETAPA 2: Validação Pré-Migração (`02_validacao_pre_migracao.sql`)
- Verifica existência das tabelas necessárias
- Conta dados atuais
- Valida integridade referencial
- Identifica problemas antes da migração

### ETAPA 3: Popular Professores (`03_popular_professores.sql`)
- Cria registros em `professores` para todos os usuários com role `PROFESSOR`
- **Idempotente**: não cria duplicados
- Preserva multi-tenant (valida `instituicao_id`)

### ETAPA 4: Migrar Plano de Ensino (`04_migrar_plano_ensino.sql`)
- Atualiza `plano_ensino.professor_id` de `users.id` → `professores.id`
- **Idempotente**: pode ser executado múltiplas vezes
- Preserva todos os planos existentes
- Valida multi-tenant

### ETAPA 5: Verificação Pós-Migração (`05_verificacao_pos_migracao.sql`)
- Valida que a migração foi executada corretamente
- Verifica integridade referencial
- Confirma isolamento multi-tenant
- Gera relatório completo

---

## ✅ VALIDAÇÃO PÓS-MIGRAÇÃO

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

## 🔄 RESTAURAR BACKUP (Se Necessário)

Se algo der errado, restaure o backup:

```bash
# Encontrar último backup
BACKUP_FILE=$(cat backend/scripts/migracao_professor_siga/backups_migracao_professor/.ultimo_backup)

# Restaurar
psql $DATABASE_URL < $BACKUP_FILE
```

---

## 📊 ESTRUTURA ESPERADA APÓS MIGRAÇÃO

### Antes (Legacy)
```
User (id)
  └─ plano_ensino.professor_id → users.id
```

### Depois
```
User (id)
  └─ Professor (user_id → users.id)
      └─ plano_ensino.professor_id → professores.id
```

---

## 🐛 TROUBLESHOOTING

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

## 📚 PRÓXIMOS PASSOS APÓS MIGRAÇÃO

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

## ✅ CHECKLIST FINAL

- [ ] Backup criado e guardado em local seguro
- [ ] Validação pré-migração passou sem erros
- [ ] Tabela professores populada
- [ ] Plano de ensino migrado corretamente
- [ ] Verificação pós-migração passou sem erros
- [ ] Prisma Client atualizado
- [ ] Backend reiniciado
- [ ] Testes funcionais realizados

---

**Última atualização:** 2025-01-XX  
**Versão:** 1.0.0  
**Status:** ✅ Pronto para execução

