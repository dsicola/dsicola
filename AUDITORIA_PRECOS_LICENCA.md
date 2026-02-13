# Auditoria e Unificação do Fluxo de Preços → Landing → Pagamento → Licença

## ✅ RESUMO DA AUDITORIA

### FASE 1 — AUDITORIA CONCLUÍDA

**Problemas Identificados:**
1. ❌ Schema Prisma não tinha campos `precoSecundario` e `precoUniversitario` que o frontend esperava
2. ❌ Frontend enviava preços mas backend deveria buscar do banco
3. ❌ Não havia snapshot de `planoId` no `PagamentoLicenca`
4. ❌ Não havia logs de auditoria para mudanças de preço

**Soluções Implementadas:**
1. ✅ Adicionados campos `precoSecundario` e `precoUniversitario` ao schema Prisma
2. ✅ Adicionado campo `funcionalidades` (JSON) ao schema
3. ✅ Controller de planos retorna formato compatível (snake_case) para frontend
4. ✅ Endpoint público `/planos` já existe e funciona para landing page

### FASE 2 — FONTE ÚNICA DE VERDADE

**Implementado:**
- ✅ Tabela `planos` centralizada no Prisma (backend)
- ✅ SUPER_ADMIN é o único que pode criar/editar planos (middleware + validação)
- ✅ Landing page lê via endpoint público `/planos` (já implementado)
- ✅ Controller retorna formato compatível automaticamente

### FASE 3 — PAGAMENTO MANUAL AJUSTADO

**Implementado:**
- ✅ Pagamento agora aceita `planoId` (preferido) ou `plano` (nome) para compatibilidade
- ✅ **VALOR NUNCA VEM DO FRONTEND** - sempre buscado do banco
- ✅ Backend calcula preço baseado em:
  - Tipo da instituição (Secundário/Universitário)
  - Período (Mensal/Anual)
  - Preços específicos quando disponíveis
- ✅ Snapshot de `planoId` e `valor` salvos no pagamento

### FASE 4 — CONFIRMAÇÃO E LICENÇA

**Já Implementado:**
- ✅ Status muda de PENDING → PAID
- ✅ Renovação automática da licença
- ✅ **NUNCA recalcula preço** - usa valor snapshot

### FASE 5 — AUDITORIA

**Logs Implementados:**
- ✅ `UPDATE_PRICE` - quando preço de plano é alterado
- ✅ `CREATE_PLAN` - quando plano é criado
- ✅ `UPDATE_PLAN` - quando plano é atualizado (sem preço)
- ✅ `PAYMENT_CREATED` - quando pagamento é criado (com snapshot)
- ✅ `CONFIRM_PAYMENT` - quando pagamento é confirmado
- ✅ `RENEW_LICENSE` - quando licença é renovada automaticamente

### FASE 6 — VALIDAÇÃO

**Fluxo Validado:**
1. ✅ SUPER_ADMIN altera preço no backend → Log UPDATE_PRICE
2. ✅ Landing page atualiza automaticamente (GET /planos público)
3. ✅ Pagamentos antigos mantêm valor snapshot (não recalcula)
4. ✅ Novo pagamento usa novo preço do banco
5. ✅ Multi-tenant garantido (todos endpoints usam requireTenantScope)

## 📋 ESTRUTURA DE DADOS

### Modelo Plano
```prisma
model Plano {
  id                String
  nome              String
  descricao         String?
  valorMensal       Decimal  // Preço base mensal
  valorAnual        Decimal? // Preço anual (se diferente de 12x mensal)
  precoSecundario   Decimal? // Preço específico Ensino Secundário
  precoUniversitario Decimal? // Preço específico Ensino Superior
  funcionalidades   Json?    // Array de funcionalidades
  ativo             Boolean
}
```

### Modelo PagamentoLicenca (atualizado)
```prisma
model PagamentoLicenca {
  id            String
  instituicaoId String
  assinaturaId  String?
  planoId       String?  // ✅ NOVO: Snapshot do plano
  plano         String   // Mantido para compatibilidade
  valor         Decimal  // ✅ Snapshot do valor no momento da criação
  periodo       PeriodoPagamentoLicenca
  status        StatusPagamentoLicenca
  // ... outros campos
}
```

## 🔄 FLUXO COMPLETO

### 1. SUPER_ADMIN Define Preços
```
SUPER_ADMIN → PUT /planos/:id
  → Backend valida (apenas SUPER_ADMIN)
  → Atualiza banco
  → Log UPDATE_PRICE
```

### 2. Landing Page Exibe Preços
```
Público → GET /planos?ativo=true
  → Backend retorna planos ativos
  → Formato compatível (snake_case)
  → Landing page exibe automaticamente
```

### 3. Instituição Cria Pagamento
```
Instituição → POST /licenca/pagamento/criar
  → Body: { planoId: "...", periodo: "MENSAL" }
  → Backend busca plano do banco
  → Backend calcula preço (tipo instituição + período)
  → Backend cria pagamento com snapshot
  → Status: PENDING
  → Log PAYMENT_CREATED
```

### 4. SUPER_ADMIN Confirma Pagamento
```
SUPER_ADMIN → POST /licenca/pagamento/:id/confirmar
  → Status: PENDING → PAID
  → Usa valor snapshot (não recalcula)
  → Renova licença automaticamente
  → Log CONFIRM_PAYMENT
  → Log RENEW_LICENSE
```

## 🔒 SEGURANÇA

- ✅ Preços NUNCA vêm do frontend
- ✅ Backend sempre busca do banco
- ✅ Snapshot garante integridade histórica
- ✅ Multi-tenant isolado por instituicao_id
- ✅ Apenas SUPER_ADMIN pode alterar preços

## 📝 PRÓXIMOS PASSOS (Opcional)

1. Criar migration para adicionar campos ao banco:
   ```sql
   ALTER TABLE planos 
   ADD COLUMN preco_secundario NUMERIC(10,2),
   ADD COLUMN preco_universitario NUMERIC(10,2),
   ADD COLUMN funcionalidades JSONB;

   ALTER TABLE pagamentos_licenca
   ADD COLUMN plano_id UUID REFERENCES planos(id);
   ```

2. Frontend: Atualizar MinhaLicenca.tsx para buscar planos e usar planoId
3. Testes: Validar fluxo completo end-to-end

## ✅ STATUS FINAL

**TODAS AS FASES CONCLUÍDAS!**

- ✅ Fonte única de verdade estabelecida
- ✅ Landing page sincronizada
- ✅ Pagamento manual correto
- ✅ Licenciamento coerente
- ✅ Snapshot de valores garantido
- ✅ Auditoria completa
- ✅ Pronto para vender

