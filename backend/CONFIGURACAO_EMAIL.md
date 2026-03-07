# 📧 Configuração de E-mail - DSICOLA

## Como Funciona

O sistema DSICOLA possui um serviço centralizado de e-mail (`EmailService`) que:
- ✅ **Utiliza exclusivamente o Resend** para envio de emails
- ✅ Registra todos os envios no banco de dados (`emails_enviados`)
- ✅ Não quebra a criação de instituição se o e-mail falhar
- ✅ Funciona em modo de teste quando `RESEND_API_KEY` não está configurado

## ⚠️ Status Atual

Se você criou uma instituição e **não recebeu e-mail**, é porque `RESEND_API_KEY` não está configurada.

**O sistema está funcionando corretamente**, mas está em **modo de teste** (apenas loga, não envia).

## ✅ Checklist para Produção (envio real de e-mail)

Em **produção**, confirme que as variáveis do Resend estão definidas:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `RESEND_API_KEY` | Sim | API key do Resend |
| `EMAIL_FROM` | Sim | Remetente (domínio verificado em [resend.com/domains](https://resend.com/domains)) |

Se `RESEND_API_KEY` não estiver configurada, o sistema continua a funcionar mas os e-mails são apenas simulados (log no console, não saem para a caixa de entrada).

## 🔧 Como Configurar o Envio Real de E-mails (Resend)

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

## ✅ Verificar se Está Funcionando

### 1. Verificar Logs do Servidor

Ao criar uma instituição, você verá no console:

**Se RESEND_API_KEY NÃO estiver configurada:**
```
[EmailService] 📧 E-mail simulado (RESEND_API_KEY não configurado):
  Para: email@exemplo.com
  Assunto: Bem-vindo ao DSICOLA - Nome da Instituição
```

**Se Resend estiver configurado:**
```
[EmailService] ✅ E-mail enviado via Resend: <message-id>
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

### Erro: "RESEND_API_KEY não configurada"
- **Causa**: Variável de ambiente ausente
- **Solução**: Adicione `RESEND_API_KEY` no `.env` com a API key do Resend

### E-mail não chega na caixa de entrada
- **Causa**: Pode estar na pasta de spam
- **Solução**: Verifique a pasta de spam e adicione o remetente aos contatos

## 📝 Notas Importantes

1. **O sistema NÃO quebra se e-mail falhar** - A instituição é criada mesmo se o e-mail não for enviado
2. **Todos os envios são registrados** - Mesmo falhas são salvas no banco para auditoria
3. **Modo de teste** - Se `RESEND_API_KEY` não estiver configurada, o sistema apenas loga (não envia)
4. **Multi-tenant seguro** - E-mails são sempre associados à instituição correta
5. **Resend exclusivo** - Todo o fluxo de emails utiliza o Resend (API HTTPS)

## 🔍 Verificar Configuração Atual

Para verificar se as variáveis estão configuradas, você pode:

1. Verificar o arquivo `.env` no backend
2. Verificar os logs do servidor ao iniciar
3. Consultar a tabela `emails_enviados` no banco

