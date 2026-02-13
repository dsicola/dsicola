# 🔍 DIAGNÓSTICO: Problema ao Salvar Semestres

## ✅ Verificações Realizadas

### 1. Rotas
- ✅ Rota `POST /semestres` existe e está configurada
- ✅ Middleware de autenticação aplicado
- ✅ Middleware de autorização: `ADMIN`, `DIRECAO`, `SUPER_ADMIN`
- ✅ Middleware de validação de licença aplicado

### 2. Controller
- ✅ Função `createSemestre` implementada
- ✅ Validações de campos obrigatórios
- ✅ Validação de tipo acadêmico (bloqueia SECUNDARIO)
- ✅ Validação de Ano Letivo existente
- ✅ Validação de datas
- ✅ Validação de duplicatas
- ✅ Logs de erro adicionados

### 3. Schema
- ✅ `anoLetivoId` é obrigatório (String, não nullable)
- ✅ Foreign key para `AnoLetivo` configurada
- ✅ Colunas `data_inicio_notas` e `data_fim_notas` no schema

## ⚠️ Possíveis Problemas

### 1. Coluna `ano_letivo_id` não existe no banco
**Sintoma**: Erro ao criar semestre
**Solução**: Executar `backend/APLICAR_MIGRACAO_URGENTE.sql`

### 2. Colunas `data_inicio_notas` e `data_fim_notas` não existem
**Sintoma**: Erro `The column semestres.data_inicio_notas does not exist`
**Solução**: Executar `backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql`

### 3. Tipo Acadêmico não configurado
**Sintoma**: Erro "Semestres são permitidos apenas para instituições de Ensino Superior"
**Solução**: Verificar `instituicao.tipoAcademico` no banco

### 4. Ano Letivo não existe
**Sintoma**: Erro "Ano letivo X não encontrado"
**Solução**: Criar Ano Letivo primeiro

### 5. Validação de datas falhando
**Sintoma**: Erro sobre datas fora do período
**Solução**: Verificar se datas estão dentro do Ano Letivo

### 6. Semestre duplicado
**Sintoma**: Erro "Já existe um semestre X para o ano letivo Y"
**Solução**: Verificar semestres existentes

## 🔧 Passos para Diagnosticar

### 1. Verificar Logs do Backend
```bash
# Verificar logs do servidor ao tentar salvar
# Procurar por erros do Prisma ou validações
```

### 2. Verificar Console do Frontend
```javascript
// Verificar erro na resposta da API
// Verificar se há mensagem de erro específica
```

### 3. Verificar Banco de Dados
```sql
-- Verificar se colunas existem
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'semestres' 
AND column_name IN ('ano_letivo_id', 'data_inicio_notas', 'data_fim_notas');

-- Verificar se há Ano Letivo
SELECT * FROM anos_letivos WHERE instituicao_id = 'SEU_ID';

-- Verificar tipo acadêmico
SELECT id, nome, tipo_academico FROM instituicoes WHERE id = 'SEU_ID';
```

### 4. Testar via API diretamente
```bash
curl -X POST http://localhost:3001/semestres \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "anoLetivo": 2025,
    "numero": 1,
    "dataInicio": "2025-01-01T00:00:00Z"
  }'
```

## 📋 Checklist de Verificação

- [ ] Coluna `ano_letivo_id` existe em `semestres`
- [ ] Colunas `data_inicio_notas` e `data_fim_notas` existem em `semestres`
- [ ] Ano Letivo existe no banco
- [ ] Instituição tem `tipoAcademico = 'SUPERIOR'`
- [ ] Datas estão dentro do período do Ano Letivo
- [ ] Não há semestre duplicado
- [ ] Usuário tem permissão (ADMIN, DIRECAO ou SUPER_ADMIN)
- [ ] Token de autenticação é válido
- [ ] Licença da instituição está ativa

## 🚀 Solução Rápida

Execute estas migrações na ordem:

1. **Aplicar coluna ano_letivo_id**:
```bash
psql -U usuario -d banco -f backend/APLICAR_MIGRACAO_URGENTE.sql
```

2. **Aplicar colunas data_notas**:
```bash
psql -U usuario -d banco -f backend/APLICAR_COLUNAS_DATA_NOTAS_URGENTE.sql
```

3. **Reiniciar servidor backend**

4. **Testar novamente**

