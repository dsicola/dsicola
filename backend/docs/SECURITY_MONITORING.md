# Sistema de Monitoramento de Segurança - Multi-Tenant

## 📋 Visão Geral

O sistema de monitoramento de segurança detecta e alerta sobre tentativas suspeitas de violação multi-tenant, especialmente relacionadas ao envio de e-mails.

## 🔍 Funcionalidades

### 1. Registro de Tentativas Bloqueadas

Todas as tentativas de envio de e-mail cross-tenant são automaticamente registradas:

- **Onde**: `LogAuditoria` (módulo: `COMUNICACAO`, ação: `BLOCK`)
- **Quando**: Sempre que um usuário tenta enviar e-mail para outra instituição
- **Dados registrados**:
  - `userId`: ID do usuário que tentou
  - `instituicaoId`: Instituição do usuário
  - `requestedInstituicaoId`: Instituição que o usuário tentou acessar
  - `destinatarioEmail`: E-mail de destino
  - `tipo`: Tipo de e-mail (CANDIDATURA_APROVADA, etc.)
  - `timestamp`: Data/hora da tentativa

### 2. Alertas Automáticos

O sistema gera alertas quando detecta padrões suspeitos:

- **Limite**: 3 tentativas bloqueadas
- **Janela de tempo**: 15 minutos
- **Ação**: Gera log de segurança em `LogAuditoria` (ação: `SECURITY_ALERT`)
- **Notificação**: Log crítico no console (pode ser integrado com sistema de notificações)

### 3. Estatísticas de Segurança

O serviço fornece estatísticas para análise:

```typescript
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req, {
  startDate?: Date,
  endDate?: Date,
  instituicaoId?: string // Apenas para SUPER_ADMIN
});

// Retorna:
{
  total: number,                    // Total de tentativas bloqueadas
  byInstitution: Array<{            // Por instituição (apenas SUPER_ADMIN)
    instituicaoId: string | null,
    count: number
  }>,
  recentAlerts: number              // Alertas nas últimas 24h
}
```

## 🛠️ Uso

### Registrar Tentativa Bloqueada

```typescript
await SecurityMonitorService.logEmailBlockedAttempt(req, {
  userInstituicaoId: req.user.instituicaoId,
  requestedInstituicaoId: 'inst-456',
  destinatarioEmail: 'aluno@example.com',
  tipo: 'CANDIDATURA_APROVADA'
});
```

### Verificar Alertas Recentes

```typescript
const hasAlerts = await SecurityMonitorService.hasRecentAlerts(
  userId,
  instituicaoId,
  60 // minutos
);
```

### Obter Estatísticas

```typescript
// Para administradores de instituição (veem apenas sua instituição)
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req);

// Para SUPER_ADMIN (veem todas as instituições)
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req);

// Para SUPER_ADMIN filtrar por instituição específica
const stats = await SecurityMonitorService.getBlockedAttemptsStats(req, {
  instituicaoId: 'inst-123'
});
```

## 📊 Exemplo de Logs

### Tentativa Bloqueada

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

### Alerta de Segurança

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

## 🔐 Respeitando Multi-Tenant

### Administradores de Instituição

- Veem apenas estatísticas da **sua própria instituição**
- Não podem ver tentativas de outras instituições
- Alertas são filtrados por `instituicaoId`

### SUPER_ADMIN

- Veem estatísticas de **todas as instituições**
- Podem filtrar por `instituicaoId` específico
- Têm acesso completo para análise de segurança

## 🚨 Integração com EmailService

O `EmailService` integra automaticamente com o monitoramento:

```typescript
// Em EmailService.sendEmail()
if (!isSuperAdmin && userInstituicaoId !== requestedInstituicaoId) {
  // Registra tentativa bloqueada
  await SecurityMonitorService.logEmailBlockedAttempt(req, {
    userInstituicaoId,
    requestedInstituicaoId: options.instituicaoId,
    destinatarioEmail: to,
    tipo,
  });
  
  // Bloqueia e usa instituicaoId do contexto
  options.instituicaoId = userInstituicaoId;
}
```

## 📈 Próximos Passos (TODO)

- [ ] Integrar com sistema de notificações (e-mail para SUPER_ADMIN)
- [ ] Dashboard de segurança para visualizar estatísticas
- [ ] Bloqueio temporário de usuários após múltiplas tentativas
- [ ] Webhook para integração com sistemas externos de segurança
- [ ] Relatórios periódicos de segurança

## 🎯 Conclusão

O sistema de monitoramento garante:

- ✅ **Detecção automática** de tentativas suspeitas
- ✅ **Registro completo** para auditoria
- ✅ **Alertas proativos** para múltiplas tentativas
- ✅ **Respeito ao multi-tenant** em todas as consultas
- ✅ **Estatísticas detalhadas** para análise

