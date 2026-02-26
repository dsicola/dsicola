# 📧 Configuração de E-mail - DSICOLA

## Como Funciona

O sistema DSICOLA possui um serviço centralizado de e-mail (`EmailService`) que:
- ✅ Registra todos os envios no banco de dados (`emails_enviados`)
- ✅ Não quebra a criação de instituição se o e-mail falhar
- ✅ Funciona em modo de teste quando SMTP não está configurado

## ⚠️ Status Atual

Se você criou uma instituição e **não recebeu e-mail**, é porque as variáveis de ambiente não estão configuradas.

**O sistema está funcionando corretamente**, mas está em **modo de teste** (apenas loga, não envia).

## ✅ Checklist para Produção (envio real de e-mail)

Em **produção**, confirme que uma das opções está definida no ambiente (variáveis de ambiente do servidor ou do painel de deploy):

| Opção | Variáveis obrigatórias | Observação |
|-------|------------------------|------------|
| **Resend** | `RESEND_API_KEY` + `EMAIL_FROM` | Domínio verificado em [resend.com/domains](https://resend.com/domains) |
| **SMTP** | `SMTP_USER` + `SMTP_PASS` | Opcional: `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM` |

Se **nenhuma** estiver configurada, o sistema continua a funcionar mas os e-mails são apenas simulados (log no console, não saem para a caixa de entrada).

## 🔧 Como Configurar o Envio Real de E-mails

O sistema suporta **duas opções**. Prioridade: 1) Resend, 2) SMTP genérico.

### Opção A: Resend (recomendado – mais simples)

No arquivo `backend/.env`, adicione:

```env
# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@seudominio.com
```

1. Crie uma conta em [resend.com](https://resend.com)
2. Gere uma API key em [resend.com/api-keys](https://resend.com/api-keys)
3. Verifique o seu domínio em [resend.com/domains](https://resend.com/domains) (obrigatório para envio real)
4. Use `EMAIL_FROM` com um email do domínio verificado (ex: `noreply@dsicola.com`)

**Para testes (sem domínio verificado):** Use `EMAIL_FROM=onboarding@resend.dev` — Resend permite este remetente para novas contas. Os emails chegam ao destinatário.

**Para produção:** Verifique o seu domínio em [resend.com/domains](https://resend.com/domains) e use `EMAIL_FROM=noreply@seudominio.com`.

### Opção B: SMTP Genérico

**1. Adicionar Variáveis no `.env`**

```env
# Configuração SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=sua-senha-app
SMTP_FROM=noreply@dsicola.com
```

### 2. Exemplo com Gmail

Para usar Gmail, você precisa criar uma **Senha de App**:

1. Acesse: https://myaccount.google.com/apppasswords
2. Gere uma senha de app
3. Use essa senha no `SMTP_PASS`

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # Senha de app do Gmail
SMTP_FROM=seu-email@gmail.com
```

### 3. Exemplo com Outlook/Hotmail

```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=seu-email@outlook.com
SMTP_PASS=sua-senha
SMTP_FROM=seu-email@outlook.com
```

### 4. Exemplo com SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=SG.xxxxxxxxxxxxx  # API Key do SendGrid
SMTP_FROM=noreply@dsicola.com
```

### 5. Exemplo com Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@seu-dominio.mailgun.org
SMTP_PASS=sua-senha-mailgun
SMTP_FROM=noreply@seu-dominio.com
```

## ✅ Verificar se Está Funcionando

### 1. Verificar Logs do Servidor

Ao criar uma instituição, você verá no console:

**Se SMTP NÃO estiver configurado:**
```
[EmailService] ⚠️  SMTP não configurado. E-mails serão logados mas não enviados.
[EmailService] 📧 E-mail simulado (SMTP não configurado):
  Para: email@exemplo.com
  Assunto: Bem-vindo ao DSICOLA - Nome da Instituição
```

**Se SMTP estiver configurado:**
```
[EmailService] ✅ E-mail enviado: <message-id>
```

### 2. Verificar no Banco de Dados

Consulte a tabela `emails_enviados`:

```sql
SELECT 
  destinatario_email,
  assunto,
  tipo,
  status,
  erro,
  created_at
FROM emails_enviados
ORDER BY created_at DESC
LIMIT 10;
```

- Se `status = 'enviado'` → E-mail foi enviado com sucesso
- Se `status = 'erro'` → Verifique o campo `erro` para ver o problema

### 3. Testar Manualmente

Você pode criar um script de teste ou usar o endpoint de teste (se existir).

## 🐛 Problemas Comuns

### Erro: "Invalid login"
- **Causa**: Credenciais SMTP incorretas
- **Solução**: Verifique `SMTP_USER` e `SMTP_PASS`

### Erro: "Connection timeout"
- **Causa**: Firewall bloqueando porta 587
- **Solução**: Verifique se a porta está aberta ou use porta 465 com `SMTP_SECURE=true`

### E-mail não chega na caixa de entrada
- **Causa**: Pode estar na pasta de spam
- **Solução**: Verifique a pasta de spam e adicione o remetente aos contatos

### Gmail bloqueia o envio
- **Causa**: Gmail requer autenticação de 2 fatores + senha de app
- **Solução**: 
  1. Ative 2FA no Gmail
  2. Gere senha de app em: https://myaccount.google.com/apppasswords
  3. Use a senha de app no `SMTP_PASS`

## 📝 Notas Importantes

1. **O sistema NÃO quebra se e-mail falhar** - A instituição é criada mesmo se o e-mail não for enviado
2. **Todos os envios são registrados** - Mesmo falhas são salvas no banco para auditoria
3. **Modo de teste** - Se SMTP não estiver configurado, o sistema apenas loga (não envia)
4. **Multi-tenant seguro** - E-mails são sempre associados à instituição correta

## 🔍 Verificar Configuração Atual

Para verificar se as variáveis estão configuradas, você pode:

1. Verificar o arquivo `.env` no backend
2. Verificar os logs do servidor ao iniciar
3. Consultar a tabela `emails_enviados` no banco

