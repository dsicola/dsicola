# Assistente de IA - DSICOLA

Guia completo para configurar o assistente virtual de IA.

---

## 1. Obter a chave da OpenAI

1. Aceda a [platform.openai.com](https://platform.openai.com) e faça login (ou crie conta).
2. Vá a **API keys** (menu lateral ou [direct link](https://platform.openai.com/api-keys)).
3. Clique em **Create new secret key**.
4. Dê um nome (ex: "DSICOLA") e copie a chave (começa com `sk-` ou `sk-proj-`).
5. **Importante:** Guarde a chave num local seguro — só é mostrada uma vez.
6. Verifique se tem **créditos/billing** ativo em [Billing](https://platform.openai.com/account/billing) (a OpenAI exige método de pagamento para usar a API).

---

## 2. Configuração local (desenvolvimento)

1. Na pasta `backend/`, crie ou edite o ficheiro `.env`.
2. Adicione a linha (substitua pela sua chave):

```
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

3. Reinicie o backend (`npm run dev`).
4. O assistente deve responder normalmente no botão flutuante (canto inferior direito).

**Exemplo de `.env` mínimo:**
```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 3. Configuração em produção (Railway)

1. No [Railway](https://railway.app), abra o projeto DSICOLA.
2. Selecione o serviço **Backend** (API).
3. Vá a **Variables** (ou **Settings** → **Variables**).
4. Clique em **Add Variable** ou **New Variable**.
5. Nome: `OPENAI_API_KEY`
6. Valor: cole a sua chave (ex: `sk-proj-...`).
7. Guarde — o Railway fará um novo deploy automaticamente.
8. Aguarde o deploy e teste o assistente.

---

## 4. Verificação

- **Sem chave:** O assistente mostra: "O assistente de IA está em configuração..."
- **Chave inválida/expirada:** Mostra: "Configuração de IA inválida. A chave OPENAI_API_KEY..."
- **Funcionando:** O assistente responde às perguntas sobre o sistema.

**Teste via terminal:**
```bash
cd backend && npm run test:ai-assistant
```

---

## 5. Variáveis opcionais (qualidade das respostas)

| Variável | Valor padrão | Descrição |
|----------|--------------|-----------|
| `OPENAI_MODEL` | `gpt-4o-mini` | Modelo OpenAI. Use `gpt-4o` para respostas mais precisas (custo maior). |
| `OPENAI_MAX_TOKENS` | `800` | Limite de tokens por resposta (máx. 1500). Aumente se as respostas forem cortadas. |
| `OPENAI_TEMPERATURE` | `0.1` | Temperatura (0–1). Valores baixos = respostas mais exatas e determinísticas. Aumente (ex.: 0.3) se as respostas ficarem muito rígidas. |

**Exemplo para melhor precisão** (em `.env` ou Railway):
```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o
OPENAI_MAX_TOKENS=1000
OPENAI_TEMPERATURE=0.1
```

## 6. Detalhes técnicos

- **Modelo:** `gpt-4o-mini` (ou `OPENAI_MODEL`)
- **Temperature:** 0.1 (respostas exatas e determinísticas; configurável via `OPENAI_TEMPERATURE`)
- **Contexto:** O frontend envia `path`, `role` e `tipoAcademico` (SECUNDARIO/SUPERIOR) para respostas adaptadas ao tipo de instituição
- **UX / passo a passo:** O `SYSTEM_PROMPT` instrui o modelo a guiar o utilizador com **passos numerados** alinhados à interface real (cartões, separadores, textos de botões, URLs). Para **RESPONSAVEL**, há secção dedicada ao Portal do Responsável (`/painel-responsavel`, `/educandos`, `/notas`, `/frequencia`, `/mensagens`) e reforço extra quando `role === 'RESPONSAVEL'` no contexto.
- **Endpoint:** `POST /ai/assistant` (requer autenticação)
- **Body:** `{ "messages": [{ "role": "user", "content": "..." }] }`
- **Response:** `{ "response": "..." }`

O componente `AssistenteIA` está no `DashboardLayout` como botão flutuante no canto inferior direito (ícone de mensagem).
