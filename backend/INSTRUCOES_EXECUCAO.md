# 📋 INSTRUÇÕES DE EXECUÇÃO - Resolver Erro P3006

## ⚠️ IMPORTANTE

Execute os passos **NA ORDEM** e **UM POR VEZ**, verificando o resultado antes de continuar.

---

## PASSO 1: Verificar Tabelas no Banco Real

### Opção A: Via psql

```bash
psql -U seu_usuario -d seu_banco -f backend/scripts/verificar_tabelas.sql
```

### Opção B: Via pgAdmin/DBeaver

1. Abra o arquivo `backend/scripts/verificar_tabelas.sql`
2. Execute o script completo
3. Verifique os resultados:
   - ✅ `semestres` deve existir
   - ✅ `trimestres` deve existir
   - ✅ `anos_letivos` deve existir
   - ✅ `ano_letivo_id` deve existir em `semestres` e `trimestres`

**Se alguma tabela NÃO existir**: Pare aqui e informe o problema.

---

## PASSO 2: Marcar Migrations como Aplicadas

### Opção A: Script Automático

```bash
cd backend
./scripts/resolver_migrations.sh
```

### Opção B: Manual (Recomendado para Primeira Vez)

```bash
cd backend

# Marcar uma por uma (verifique se cada uma já está no banco)
npx prisma migrate resolve --applied 20250127120000_add_ano_letivo_id_to_semestres_trimestres
npx prisma migrate resolve --applied 20250127150000_add_semestre_audit_fields
npx prisma migrate resolve --applied 20250128000000_add_semestre_audit_fields
npx prisma migrate resolve --applied 20250127180000_add_ano_letivo_id_fix
npx prisma migrate resolve --applied 20260101000134_init_academic_modules
npx prisma migrate resolve --applied 20260102095243_fix_semestre_encerramento_relations
npx prisma migrate resolve --applied 20260108154847_add_ano_letivo_id_to_semestres_trimestres
npx prisma migrate resolve --applied 20260125000000_create_anos_letivos_table
npx prisma migrate resolve --applied 20260130000000_make_ano_letivo_id_required
```

**⚠️ Se alguma migration falhar**: Isso é normal se ela já estiver aplicada. Continue.

---

## PASSO 3: Sincronizar Schema

```bash
cd backend
npx prisma db push
```

**⚠️ IMPORTANTE**: 
- Se perguntar sobre perda de dados, **REVISE** antes de aceitar
- Use `--accept-data-loss` apenas se tiver certeza
- **NÃO use** `--force-reset`

---

## PASSO 4: Gerar Prisma Client

```bash
cd backend
npx prisma generate
```

---

## PASSO 5: Verificar Status

```bash
cd backend
npx prisma migrate status
```

**Resultado Esperado**:
- Todas as migrations devem aparecer como `Applied`
- Nenhuma migration pendente

---

## PASSO 6: Testar Backend

```bash
cd backend
npm run dev
```

**Verificar**:
- ✅ Backend inicia sem erro
- ✅ Nenhum erro P3006 ou P2022
- ✅ Scheduler inicia sem erro
- ✅ Logs mostram "Server running"

---

## PASSO 7: Testar Funcionalidades

1. **Criar Ano Letivo**:
   - Acesse Configuração de Ensino → Anos Letivos
   - Tente criar um novo ano letivo
   - ✅ Deve funcionar sem erro

2. **Criar Semestre/Trimestre**:
   - Acesse Configuração de Ensino → Semestres/Trimestres
   - Tente criar um novo período
   - ✅ Deve funcionar sem erro

---

## 🚨 SE ALGO FALHAR

### Erro: "Migration already applied"
- ✅ **Normal**: A migration já está aplicada. Continue.

### Erro: "Table does not exist"
- ❌ **Problema**: Tabela não existe no banco real
- **Solução**: Execute a migration que cria a tabela primeiro

### Erro: "Column does not exist"
- ❌ **Problema**: Coluna não existe no banco real
- **Solução**: Execute `prisma db push` para sincronizar

### Erro: "Foreign key constraint"
- ❌ **Problema**: Dados inconsistentes
- **Solução**: Revise os dados antes de continuar

---

## ✅ CHECKLIST FINAL

- [ ] Tabelas verificadas no banco real
- [ ] Migrations marcadas como aplicadas
- [ ] Schema sincronizado (`prisma db push`)
- [ ] Prisma Client gerado
- [ ] Status das migrations verificado
- [ ] Backend inicia sem erro
- [ ] Criação de Ano Letivo funciona
- [ ] Criação de Semestre/Trimestre funciona
- [ ] Nenhum erro P3006 ou P2022

---

**Status**: 📋 **INSTRUÇÕES PRONTAS**  
**Próximo Passo**: Execute PASSO 1 e siga a sequência

