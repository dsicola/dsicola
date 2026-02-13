# 🗑️ GUIA: LIMPAR BANCO DE DADOS E COMEÇAR DO ZERO

**Objetivo:** Resetar completamente o banco de dados para começar testes do zero

---

## ⚠️ ATENÇÃO

**Este processo irá DELETAR TODOS OS DADOS do banco de dados!**

- ✅ Use apenas em ambiente de desenvolvimento/testes
- ❌ **NUNCA execute em produção**
- 💾 Faça backup antes se necessário

---

## 📋 MÉTODOS DE RESET

### Método 1: Reset Completo (Recomendado)

Este método deleta todas as tabelas e recria o schema do zero.

#### Passo 1: Parar o servidor
```bash
# Se o servidor estiver rodando, pare com Ctrl+C
```

#### Passo 2: Resetar o banco
```bash
cd backend
npx prisma migrate reset
```

**O que este comando faz:**
- ✅ Deleta todas as tabelas
- ✅ Recria o schema do zero
- ✅ Executa todas as migrations
- ✅ Executa o seed (se configurado)

#### Passo 3: Verificar
```bash
# Verificar se o banco foi resetado
npx prisma studio
```

---

### Método 2: Reset Manual (Mais Controle)

Se você quer mais controle sobre o processo:

#### Passo 1: Deletar todas as tabelas
```bash
cd backend
npx prisma db push --force-reset
```

**OU via SQL direto:**
```sql
-- Conectar ao PostgreSQL e executar:
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

#### Passo 2: Recriar schema
```bash
npx prisma db push
```

#### Passo 3: Executar migrations
```bash
npx prisma migrate deploy
```

#### Passo 4: Executar seed (opcional)
```bash
npm run db:seed
```

---

### Método 3: Reset via Script SQL

Criar um script SQL para deletar dados mantendo estrutura:

```sql
-- reset_database.sql
-- ATENÇÃO: Este script deleta TODOS os dados!

-- Desabilitar foreign keys temporariamente
SET session_replication_role = 'replica';

-- Deletar dados de todas as tabelas (ordem importante devido a foreign keys)
TRUNCATE TABLE "log_auditoria" CASCADE;
TRUNCATE TABLE "emails_enviados" CASCADE;
TRUNCATE TABLE "notificacoes" CASCADE;
TRUNCATE TABLE "comunicados" CASCADE;
TRUNCATE TABLE "mensagens_responsavel" CASCADE;
TRUNCATE TABLE "emprestimos_biblioteca" CASCADE;
TRUNCATE TABLE "biblioteca_itens" CASCADE;
TRUNCATE TABLE "documentos_emitidos" CASCADE;
TRUNCATE TABLE "documentos_aluno" CASCADE;
TRUNCATE TABLE "notas" CASCADE;
TRUNCATE TABLE "avaliacoes" CASCADE;
TRUNCATE TABLE "presencas" CASCADE;
TRUNCATE TABLE "aulas_lancadas" CASCADE;
TRUNCATE TABLE "plano_aulas" CASCADE;
TRUNCATE TABLE "plano_ensino" CASCADE;
TRUNCATE TABLE "distribuicao_aulas" CASCADE;
TRUNCATE TABLE "eventos_calendario" CASCADE;
TRUNCATE TABLE "encerramento_academico" CASCADE;
TRUNCATE TABLE "semestres" CASCADE;
TRUNCATE TABLE "aluno_disciplinas" CASCADE;
TRUNCATE TABLE "matriculas" CASCADE;
TRUNCATE TABLE "matriculas_anuais" CASCADE;
TRUNCATE TABLE "turmas" CASCADE;
TRUNCATE TABLE "disciplinas" CASCADE;
TRUNCATE TABLE "classes" CASCADE;
TRUNCATE TABLE "cursos" CASCADE;
TRUNCATE TABLE "turnos" CASCADE;
TRUNCATE TABLE "horarios" CASCADE;
TRUNCATE TABLE "exames" CASCADE;
TRUNCATE TABLE "mensalidades" CASCADE;
TRUNCATE TABLE "pagamentos" CASCADE;
TRUNCATE TABLE "bolsas_desconto" CASCADE;
TRUNCATE TABLE "aluno_bolsas" CASCADE;
TRUNCATE TABLE "candidaturas" CASCADE;
TRUNCATE TABLE "funcionarios" CASCADE;
TRUNCATE TABLE "cargos" CASCADE;
TRUNCATE TABLE "departamentos" CASCADE;
TRUNCATE TABLE "professor_disciplinas" CASCADE;
TRUNCATE TABLE "user_roles" CASCADE;
TRUNCATE TABLE "users" CASCADE;
TRUNCATE TABLE "instituicoes" CASCADE;

-- Reabilitar foreign keys
SET session_replication_role = 'origin';

-- Resetar sequences (se houver)
-- ALTER SEQUENCE nome_sequence RESTART WITH 1;
```

**Executar:**
```bash
psql -U postgres -d dsicola -f reset_database.sql
```

---

## 🔄 PROCESSO COMPLETO RECOMENDADO

### Para Começar Testes do Zero

#### Opção A: Script Automatizado (Mais Fácil)

```bash
# 1. Ir para o diretório backend
cd backend

# 2. Parar o servidor (se estiver rodando)
# Ctrl+C no terminal do servidor

# 3. Executar script de reset
./scripts/reset-db.sh

# 4. Iniciar o servidor
npm run dev
```

#### Opção B: Manual

```bash
# 1. Ir para o diretório backend
cd backend

# 2. Parar o servidor (se estiver rodando)
# Ctrl+C no terminal do servidor

# 3. Resetar o banco completamente
npx prisma migrate reset

# 4. (Opcional) Verificar o banco
npx prisma studio

# 5. Iniciar o servidor
npm run dev
```

**Nota:** O comando `prisma migrate reset` automaticamente:
- ✅ Deleta todas as tabelas
- ✅ Recria o schema
- ✅ Executa todas as migrations
- ✅ Executa o seed (cria SUPER_ADMIN)

---

## 📝 DADOS INICIAIS APÓS RESET

### Seed Automático

O seed já está configurado e é executado automaticamente após `prisma migrate reset`.

**O que o seed cria:**
- ✅ **SUPER_ADMIN** (usuário padrão)

**Credenciais padrão:**
- Email: `superadmin@dsicola.com`
- Senha: `SuperAdmin@123`

**Configurar no `.env` (opcional):**
```env
SUPER_ADMIN_EMAIL=seu-email@exemplo.com
SUPER_ADMIN_PASSWORD=SuaSenhaSegura123
SUPER_ADMIN_NAME=Seu Nome
```

### Criar Dados de Teste

Após resetar, você precisa criar manualmente:

1. **Fazer Login como SUPER_ADMIN**
   - Usar credenciais acima

2. **Criar Instituição de Teste**
   - Via interface do sistema
   - Configurar tipo acadêmico (SECUNDARIO ou SUPERIOR)

3. **Criar Usuários de Teste**
   - ADMIN da instituição
   - SECRETARIA
   - PROFESSOR
   - ALUNO

4. **Criar Estrutura Acadêmica**
   - Cursos/Classes (conforme tipo acadêmico)
   - Disciplinas
   - Turmas
   - Turnos

### Executar Seed Manualmente

Se precisar executar o seed novamente (sem reset):

```bash
npm run db:seed
```

**Nota:** O seed é idempotente - pode ser executado múltiplas vezes sem problemas.

---

## 🛠️ SCRIPT AUTOMATIZADO

Criar um script para facilitar o reset:

### Script Automatizado

Já existe um script em `backend/scripts/reset-db.sh` que faz todo o processo automaticamente.

**Usar:**
```bash
cd backend
./scripts/reset-db.sh
```

**O que o script faz:**
- ✅ Pede confirmação antes de deletar
- ✅ Verifica se `.env` existe
- ✅ Verifica se `DATABASE_URL` está configurado
- ✅ Executa `prisma migrate reset --force`
- ✅ Mostra credenciais do SUPER_ADMIN
- ✅ Mostra próximos passos

**Tornar executável (se necessário):**
```bash
chmod +x backend/scripts/reset-db.sh
```

---

## 🔍 VERIFICAR SE O RESET FUNCIONOU

### Via Prisma Studio
```bash
npx prisma studio
```
- Abre interface visual
- Verifica se tabelas estão vazias
- Verifica se schema está correto

### Via SQL
```sql
-- Verificar quantidades
SELECT 
    schemaname,
    tablename,
    n_tup_ins as row_count
FROM pg_stat_user_tables
ORDER BY tablename;

-- Verificar se há dados
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM instituicoes;
SELECT COUNT(*) FROM cursos;
-- etc...
```

---

## 🚨 PROBLEMAS COMUNS

### Erro: "Database is not empty"
```bash
# Forçar reset
npx prisma migrate reset --force
```

### Erro: "Foreign key constraint"
```bash
# Usar método 2 (reset manual) ou script SQL
```

### Erro: "Connection refused"
```bash
# Verificar se PostgreSQL está rodando
# Verificar DATABASE_URL no .env
```

### Erro: "Migration failed"
```bash
# Verificar migrations
npx prisma migrate status

# Se necessário, resetar migrations
npx prisma migrate reset
```

---

## 📋 CHECKLIST PRÉ-RESET

Antes de resetar, verifique:

- [ ] Servidor parado
- [ ] Backup feito (se necessário)
- [ ] `.env` configurado corretamente
- [ ] PostgreSQL rodando
- [ ] `DATABASE_URL` correto no `.env`

---

## 📋 CHECKLIST PÓS-RESET

Após resetar, verifique:

- [ ] Schema criado corretamente
- [ ] Tabelas vazias (ou com seed)
- [ ] Migrations aplicadas
- [ ] Servidor inicia sem erros
- [ ] Login funciona (se houver seed com usuários)

---

## 🎯 PRÓXIMOS PASSOS APÓS RESET

1. **Criar Instituição de Teste**
   - Via SUPER_ADMIN ou seed

2. **Criar Usuários de Teste**
   - ADMIN
   - SECRETARIA
   - PROFESSOR
   - ALUNO

3. **Criar Estrutura Acadêmica**
   - Cursos/Classes
   - Disciplinas
   - Turmas

4. **Começar Testes**
   - Seguir `TESTES_PRE_PRODUCAO.md`

---

## 💡 DICAS

### Manter Dados Específicos

Se você quer manter alguns dados (ex: SUPER_ADMIN), use SQL direto:

```sql
-- Deletar apenas dados específicos
DELETE FROM users WHERE role != 'SUPER_ADMIN';
DELETE FROM instituicoes WHERE id != 'id-da-instituicao-teste';
-- etc...
```

### Backup Antes de Reset

```bash
# Fazer backup
pg_dump -U postgres dsicola > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar depois (se necessário)
psql -U postgres dsicola < backup_20250127_120000.sql
```

---

## 📚 COMANDOS ÚTEIS

```bash
# Status do banco
npx prisma migrate status

# Ver schema atual
npx prisma db pull

# Gerar Prisma Client
npx prisma generate

# Abrir Prisma Studio
npx prisma studio

# Reset completo
npx prisma migrate reset

# Push schema (sem migrations)
npx prisma db push

# Criar nova migration
npx prisma migrate dev --name nome_da_migration
```

---

## ✅ RESUMO RÁPIDO

### Método Mais Rápido (Recomendado)

```bash
cd backend
./scripts/reset-db.sh
```

### Método Manual

```bash
cd backend
npx prisma migrate reset
```

**Pronto!** O banco está limpo e pronto para testes.

**Após reset:**
1. Fazer login como SUPER_ADMIN:
   - Email: `superadmin@dsicola.com`
   - Senha: `SuperAdmin@123`
2. Criar instituição de teste
3. Criar usuários de teste
4. Começar testes seguindo `TESTES_PRE_PRODUCAO.md`

---

**Última atualização:** 2025-01-27

