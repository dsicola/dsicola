# Assistente de IA - DSICOLA

## Configuração

O assistente virtual de IA está integrado ao backend. Para ativar as respostas inteligentes, configure a variável de ambiente no ficheiro `.env` do backend:

```
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
```

- Usa o modelo `gpt-4o-mini`
- Requer conta OpenAI

### Sem configuração
Se a chave não estiver configurada, o assistente retorna uma mensagem informativa pedindo ao administrador para configurar.

## Endpoint

- **POST** `/ai/assistant` (requer autenticação)
- Body: `{ "messages": [{ "role": "user", "content": "..." }] }`
- Response: `{ "response": "..." }`

## Teste

```bash
npm run test:ai-assistant
```

## Uso no frontend

O componente `AssistenteIA` está integrado no `DashboardLayout` e aparece como botão flutuante no canto inferior direito (ícone de mensagem).
