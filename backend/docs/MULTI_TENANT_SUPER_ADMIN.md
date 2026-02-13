# Multi-Tenant e SUPER_ADMIN - Documentação Técnica

## 📋 Visão Geral

O sistema DSICOLA é **multi-tenant**, garantindo que cada instituição tenha isolamento completo de dados. O papel `SUPER_ADMIN` tem permissões especiais para gerenciar múltiplas instituições, mas **sempre respeitando o isolamento multi-tenant**.

## 🔐 Princípios Fundamentais

### 1. Isolamento de Dados
- **Cada instituição vê apenas seus próprios dados**
- **Nenhum dado pode ser acessado sem validação de `instituicaoId`**
- **Filtros multi-tenant são aplicados em TODAS as consultas**

### 2. SUPER_ADMIN - Permissões e Limitações

#### ✅ O que SUPER_ADMIN PODE fazer:
- **Criar novas instituições** (onboarding)
- **Visualizar dados de qualquer instituição** (quando explicitamente solicitado via `?instituicaoId=xxx`)
- **Gerenciar assinaturas e licenças** de qualquer instituição
- **Enviar e-mails para qualquer instituição** (útil para notificações administrativas)
- **Acessar logs e auditoria** de todas as instituições
- **Gerenciar configurações globais** do sistema

#### ❌ O que SUPER_ADMIN NÃO PODE fazer:
- **Modificar dados de uma instituição sem contexto explícito**
- **Acessar dados sem especificar `instituicaoId`** (quando aplicável)
- **Bypassar validações de segurança multi-tenant**
- **Enviar e-mails cross-tenant sem intenção explícita**

### 3. Validação Multi-Tenant

#### Em Consultas (SELECT):
```typescript
// ✅ CORRETO: Usar addInstitutionFilter
const filter = addInstitutionFilter(req);
const dados = await prisma.entidade.findMany({
  where: { ...filter, ...outrosFiltros }
});

// ❌ ERRADO: Não filtrar por instituição
const dados = await prisma.entidade.findMany({
  where: { ...outrosFiltros } // FALTA FILTRO!
});
```

#### Em Criações (CREATE):
```typescript
// ✅ CORRETO: Usar requireTenantScope
const instituicaoId = requireTenantScope(req);
await prisma.entidade.create({
  data: {
    instituicaoId, // Do contexto, nunca do frontend
    ...outrosDados
  }
});

// ❌ ERRADO: Aceitar instituicaoId do frontend
const { instituicaoId } = req.body; // PERIGO!
```

#### Em Atualizações (UPDATE):
```typescript
// ✅ CORRETO: Validar que o registro pertence à instituição
const filter = addInstitutionFilter(req);
const registro = await prisma.entidade.findFirst({
  where: { id, ...filter }
});

if (!registro) {
  throw new AppError('Registro não encontrado ou sem permissão', 404);
}

// ❌ ERRADO: Atualizar sem validar
await prisma.entidade.update({
  where: { id }, // FALTA VALIDAÇÃO!
  data: { ... }
});
```

## 🛡️ Sistema de E-mail - Multi-Tenant

### Validação Dupla

O sistema de e-mail implementa **validação dupla** para garantir segurança:

1. **Validação em `EmailService.sendEmail()`**:
   - Antes de enviar o e-mail
   - Valida que `instituicaoId` nas options corresponde ao do contexto
   - Bloqueia tentativas de enviar para outra instituição

2. **Validação em `EmailService.registrarEmail()`**:
   - Antes de salvar no banco
   - Garante que logs sempre têm `instituicaoId` correto

### Comportamento do SUPER_ADMIN

```typescript
// SUPER_ADMIN pode enviar para qualquer instituição
if (isSuperAdmin) {
  // Permite qualquer instituicaoId
} else {
  // Valida que instituicaoId corresponde ao do contexto
  if (userInstituicaoId !== requestedInstituicaoId) {
    // BLOQUEIA e usa instituicaoId do contexto
  }
}
```

### Exemplo de Uso Correto

```typescript
// ✅ CORRETO: SUPER_ADMIN criando instituição
await EmailService.sendEmail(
  req, // req.user.roles inclui 'SUPER_ADMIN'
  emailContato,
  'INSTITUICAO_CRIADA',
  { ... },
  {
    instituicaoId: novaInstituicao.id // Instituição recém-criada
  }
);

// ✅ CORRETO: Admin da instituição enviando e-mail
await EmailService.sendEmail(
  req, // req.user.instituicaoId = 'inst-123'
  aluno.email,
  'CANDIDATURA_APROVADA',
  { ... },
  {
    instituicaoId: candidatura.instituicaoId // 'inst-123' (do banco)
  }
);
```

## 🚨 Monitoramento de Segurança

### Tentativas Bloqueadas

O sistema monitora e registra todas as tentativas de violação multi-tenant:

1. **Registro Automático**:
   - Cada tentativa bloqueada é registrada em `LogAuditoria`
   - Inclui: userId, instituicaoId, tipo de tentativa, timestamp

2. **Alertas Automáticos**:
   - Após **3 tentativas bloqueadas** em **15 minutos**
   - Gera alerta de segurança em `LogAuditoria`
   - Log crítico no console

3. **Estatísticas**:
   - `SecurityMonitorService.getBlockedAttemptsStats()` retorna:
     - Total de tentativas bloqueadas
     - Tentativas por instituição (apenas SUPER_ADMIN)
     - Alertas recentes (últimas 24h)

### Exemplo de Log de Tentativa Bloqueada

```json
{
  "modulo": "COMUNICACAO",
  "acao": "BLOCK",
  "entidade": "EMAIL_ENVIADO",
  "observacao": "Tentativa de envio de e-mail bloqueada: usuário tentou enviar para instituição inst-456 (usuário pertence a inst-123)",
  "dadosNovos": {
    "userInstituicaoId": "inst-123",
    "requestedInstituicaoId": "inst-456",
    "destinatarioEmail": "aluno@example.com",
    "tipo": "CANDIDATURA_APROVADA"
  }
}
```

### Exemplo de Alerta de Segurança

```json
{
  "modulo": "COMUNICACAO",
  "acao": "SECURITY_ALERT",
  "entidade": "SISTEMA",
  "observacao": "ALERTA DE SEGURANÇA: 3 tentativas bloqueadas de violação multi-tenant em 15 minutos",
  "dadosNovos": {
    "alertType": "EMAIL_CROSS_TENANT",
    "userId": "user-789",
    "userEmail": "usuario@example.com",
    "userInstituicaoId": "inst-123",
    "requestedInstituicaoId": "inst-456",
    "attemptCount": 3,
    "timeWindow": 15
  }
}
```

## 📊 Consultando Estatísticas de Segurança

### Para Administradores de Instituição

```typescript
// Ver estatísticas da própria instituição
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req);
// Retorna: { total, byInstitution: [], recentAlerts }
```

### Para SUPER_ADMIN

```typescript
// Ver estatísticas de todas as instituições
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req);
// Retorna: { total, byInstitution: [{ instituicaoId, count }], recentAlerts }

// Ver estatísticas de uma instituição específica
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req, {
  instituicaoId: 'inst-123'
});
```

## 🔍 Boas Práticas

### 1. Sempre Validar Multi-Tenant

```typescript
// ✅ SEMPRE usar filtros
const filter = addInstitutionFilter(req);
const dados = await prisma.entidade.findMany({ where: filter });
```

### 2. Nunca Aceitar instituicaoId do Frontend

```typescript
// ❌ NUNCA fazer isso
const { instituicaoId } = req.body;

// ✅ SEMPRE usar do contexto
const instituicaoId = requireTenantScope(req);
```

### 3. Validar Antes de Atualizar/Deletar

```typescript
// ✅ SEMPRE validar que o registro pertence à instituição
const registro = await prisma.entidade.findFirst({
  where: { id, ...addInstitutionFilter(req) }
});

if (!registro) {
  throw new AppError('Registro não encontrado', 404);
}
```

### 4. SUPER_ADMIN com Contexto Explícito

```typescript
// ✅ SUPER_ADMIN deve especificar instituicaoId quando necessário
if (isSuperAdmin && req.query.instituicaoId) {
  // Usar instituicaoId do query param
} else {
  // Usar instituicaoId do contexto
}
```

## 🛠️ Ferramentas de Desenvolvimento

### Verificar Tentativas Bloqueadas

```typescript
// Verificar se há alertas recentes
const hasAlerts = await SecurityMonitorService.hasRecentAlerts(
  userId,
  instituicaoId,
  60 // minutos
);
```

### Obter Estatísticas

```typescript
// Estatísticas gerais
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req, {
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-12-31'),
});
```

## 📝 Checklist de Segurança

Antes de implementar qualquer funcionalidade, verifique:

- [ ] Consultas usam `addInstitutionFilter(req)` ou `requireTenantScope(req)`
- [ ] Criações usam `instituicaoId` do contexto, nunca do frontend
- [ ] Atualizações validam que o registro pertence à instituição
- [ ] Deletes validam que o registro pertence à instituição
- [ ] E-mails validam `instituicaoId` antes de enviar
- [ ] Logs sempre incluem `instituicaoId` correto
- [ ] SUPER_ADMIN tem comportamento documentado e testado
- [ ] Tentativas bloqueadas são registradas e monitoradas

## 🎯 Conclusão

O sistema DSICOLA implementa **isolamento multi-tenant rigoroso** com:

- ✅ Validação dupla em pontos críticos
- ✅ Monitoramento automático de tentativas bloqueadas
- ✅ Alertas para múltiplas tentativas suspeitas
- ✅ SUPER_ADMIN com permissões controladas e documentadas
- ✅ Logs completos para auditoria

**Nunca comprometa a segurança multi-tenant por conveniência!**

