# 📱 Configuração de Envio de SMS - DSICOLA

## Como Funciona

O sistema DSICOLA utiliza o **Twilio** para envio de SMS (plano Enterprise):
- ✅ Integrado ao sistema de notificações (Email, Telegram, SMS)
- ✅ Usado em credenciais, mensalidades pendentes, pagamentos, etc.
- ✅ Não falha o fluxo — retorna `{ success: false }` se não configurado
- ✅ Normalização automática de números para formato E.164 (+244...)

## Variáveis de Ambiente Obrigatórias

No arquivo `backend/.env`, adicione:

```env
# SMS (Twilio) - Plano Enterprise
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER=+244900000000
```

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `TWILIO_ACCOUNT_SID` | Sim | SID da conta Twilio (começa com `AC`) |
| `TWILIO_AUTH_TOKEN` | Sim | Token de autenticação da API |
| `TWILIO_PHONE_NUMBER` | Sim | Número de origem (formato E.164, ex: +244...) |

## Como Obter as Credenciais (Twilio)

1. Crie uma conta em [twilio.com](https://www.twilio.com/try-twilio)
2. No **Console** → [Account Info](https://console.twilio.com): copie **Account SID** e **Auth Token**
3. Para o número: vá em **Phone Numbers** → **Manage** → **Buy a number**
   - Para Angola: escolha um número com código +244
   - Ou use **Trial** para testes (há restrições de destino)

## Quando o SMS é Enviado

O canal SMS é ativado pelo admin em **Configurações da Instituição** → **Notificações**:

- Matrícula criada
- Credencial de acesso
- Mensalidade pendente
- Pagamento confirmado
- Entre outros triggers configuráveis

**Pré-requisito:** O utilizador deve ter o campo `telefone` preenchido no cadastro.

## Comportamento Sem Configuração

Se as variáveis `TWILIO_*` não estiverem definidas:

- O sistema **continua a funcionar** (email e Telegram seguem normalmente)
- Chamadas a `enviarSms()` retornam `{ success: false, error: 'Twilio não configurado (TWILIO_* ausente)' }`
- Nenhum SMS é enviado; não há erro que interrompa o fluxo

## Formato do Número de Telefone

O serviço normaliza automaticamente para E.164:

- `923456789` → `+244923456789`
- `244923456789` → `+244923456789`
- Números com menos de 10 dígitos são considerados inválidos

## Exemplo de Uso no Código

O SMS é usado via `notificacaoCanal.service.ts`:

```typescript
import { enviarSms } from './sms.service.js';

const res = await enviarSms(user.telefone, mensagem);
if (res.success) {
  // SMS enviado
} else {
  console.error('[SMS]', res.error);
}
```

## Checklist para Produção

- [ ] Conta Twilio criada
- [ ] `TWILIO_ACCOUNT_SID` no `.env` do backend
- [ ] `TWILIO_AUTH_TOKEN` no `.env` do backend
- [ ] `TWILIO_PHONE_NUMBER` no `.env` (formato E.164)
- [ ] Plano Enterprise (ou superior) para habilitar canal SMS nas notificações
