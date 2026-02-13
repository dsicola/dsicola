# 🔄 Migration: Padrão Acadêmico Oficial

## ⚠️ IMPORTANTE: Execute esta migration ANTES de continuar

Esta migration atualiza o schema para o padrão oficial acadêmico do DSICOLA.

### Comandos a executar:

```bash
cd backend
npx prisma migrate dev --name padrao_academico_oficial
npx prisma generate
```

---

## 📋 Mudanças no Schema

### 1. Enum StatusSemestre
- ❌ Removido: `INICIADO`
- ✅ Adicionado: `ATIVO`

### 2. Novo Enum StatusAnoLetivo
```prisma
enum StatusAnoLetivo {
  PLANEJADO
  ATIVO
  ENCERRADO
}
```

### 3. Novo Modelo AnoLetivo
- Campos: ano, dataInicio, dataFim, status, instituicaoId
- Relações: semestres, trimestres

### 4. Modelo Semestre - Atualizações
- Campos renomeados:
  - `iniciadoPor` → `ativadoPor`
  - `iniciadoEm` → `ativadoEm`
- Novos campos:
  - `dataInicioNotas` (DateTime?)
  - `dataFimNotas` (DateTime?)
  - `anoLetivoId` (String?) - relação com AnoLetivo

### 5. Novo Modelo Trimestre
- Similar ao Semestre
- Campos: numero (1, 2, 3), dataInicio, dataFim, dataInicioNotas, dataFimNotas
- Status: PLANEJADO, ATIVO, ENCERRADO

### 6. Relações User
- Adicionadas:
  - `semestresAtivados`
  - `trimestresAtivados`
  - `anosLetivosAtivados`
  - `anosLetivosEncerrados`
  - `trimestresEncerrados`

---

## ⚠️ ATENÇÃO: Dados Existentes

Se você já tem dados no banco:

1. **Status INICIADO → ATIVO**: A migration deve fazer isso automaticamente
2. **Campos iniciadoPor/iniciadoEm**: Serão renomeados para ativadoPor/ativadoEm
3. **Novos campos**: Serão NULL inicialmente (você pode preencher depois)

---

## ✅ Após a Migration

1. Verifique se os tipos TypeScript foram atualizados
2. Execute `npm run build` no backend
3. Teste a criação e ativação de semestres
4. Verifique se os dados antigos foram migrados corretamente

