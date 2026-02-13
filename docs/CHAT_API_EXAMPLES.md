# API Chat - Exemplos e Payloads

Módulo de chat interno estilo WhatsApp. Base URL: `http://localhost:3001` (ajuste conforme seu ambiente).

**Autenticação:** Todas as requisições exigem `Authorization: Bearer <JWT>`. O `instituicaoId` é sempre extraído do JWT, nunca do body/query.

---

## 1. Listar conversas do usuário

```bash
curl -X GET "http://localhost:3001/chat/threads" \
  -H "Authorization: Bearer SEU_JWT"
```

**Resposta 200:**
```json
[
  {
    "id": "uuid-thread",
    "tipo": "DISCIPLINA",
    "disciplinaId": "uuid-disciplina",
    "disciplina": { "id": "uuid", "nome": "Matemática" },
    "lastMessage": {
      "id": "uuid",
      "content": "Última mensagem...",
      "createdAt": "2025-02-12T10:00:00Z",
      "status": "READ",
      "isFromMe": false
    },
    "unreadCount": 3,
    "updatedAt": "2025-02-12T10:05:00Z",
    "lastReadAt": "2025-02-12T09:55:00Z"
  }
]
```

---

## 2. Criar/abrir conversa - DISCIPLINA

```bash
curl -X POST "http://localhost:3001/chat/threads" \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "DISCIPLINA",
    "disciplinaId": "uuid-da-disciplina"
  }'
```

**Regras:** Apenas professor vinculado à disciplina (via PlanoEnsino) pode criar. Se já existir thread da disciplina, retorna a existente.

**Resposta 201:**
```json
{
  "id": "uuid-thread",
  "instituicaoId": "uuid-inst",
  "tipo": "DISCIPLINA",
  "disciplinaId": "uuid-disciplina",
  "createdByUserId": "uuid-user",
  "createdAt": "2025-02-12T10:00:00Z",
  "updatedAt": "2025-02-12T10:00:00Z",
  "disciplina": { "id": "uuid", "nome": "Matemática" },
  "participants": [
    { "userId": "uuid", "user": { "id": "uuid", "nomeCompleto": "Prof. João", "avatarUrl": null } }
  ]
}
```

---

## 3. Criar/abrir conversa - DIRECT (privado)

```bash
curl -X POST "http://localhost:3001/chat/threads" \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo": "DIRECT",
    "targetUserId": "uuid-do-aluno-ou-professor"
  }'
```

**Regras:**
- **PROFESSOR:** Só pode abrir chat com aluno matriculado em turma/disciplina dele
- **ADMIN/SECRETARIA:** Pode abrir chat com qualquer usuário do tenant
- **ALUNO:** Pode abrir chat com professor da sua turma ou com ADMIN/SECRETARIA

---

## 4. Buscar mensagens (paginação cursor)

```bash
curl -X GET "http://localhost:3001/chat/threads/UUID_THREAD_ID/messages?cursor=uuid-msg&limit=50" \
  -H "Authorization: Bearer SEU_JWT"
```

**Resposta 200:**
```json
[
  {
    "id": "uuid-msg",
    "content": "Texto da mensagem",
    "senderUserId": "uuid",
    "senderRoleSnapshot": "PROFESSOR",
    "status": "READ",
    "attachments": [],
    "createdAt": "2025-02-12T10:00:00Z",
    "sender": { "id": "uuid", "nomeCompleto": "Prof. João", "avatarUrl": null },
    "isFromMe": false
  }
]
```

---

## 5. Enviar mensagem

```bash
curl -X POST "http://localhost:3001/chat/threads/UUID_THREAD_ID/messages" \
  -H "Authorization: Bearer SEU_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Olá, turma! Amanhã teremos prova.",
    "attachments": [
      {
        "url": "https://storage.exemplo.com/arquivo.pdf",
        "type": "application/pdf",
        "name": "material.pdf",
        "size": 102400
      }
    ]
  }'
```

**Validações:**
- `content`: obrigatório, 1 a 2000 caracteres
- `attachments`: opcional, array de `{ url, type?, name?, size? }`

**Resposta 201:**
```json
{
  "id": "uuid-msg",
  "threadId": "uuid-thread",
  "instituicaoId": "uuid-inst",
  "senderUserId": "uuid",
  "senderRoleSnapshot": "PROFESSOR",
  "content": "Olá, turma! Amanhã teremos prova.",
  "attachments": [...],
  "status": "SENT",
  "createdAt": "2025-02-12T10:00:00Z",
  "deletedAt": null,
  "sender": { "id": "uuid", "nomeCompleto": "Prof. João", "avatarUrl": null },
  "isFromMe": true
}
```

---

## 6. Marcar como lido

```bash
curl -X PATCH "http://localhost:3001/chat/threads/UUID_THREAD_ID/read" \
  -H "Authorization: Bearer SEU_JWT"
```

**Resposta 200:**
```json
{ "ok": true }
```

---

## 7. Contagem de não lidas

```bash
curl -X GET "http://localhost:3001/chat/unread-count" \
  -H "Authorization: Bearer SEU_JWT"
```

**Resposta 200:**
```json
{ "unreadCount": 5 }
```

---

## Erros comuns

| Código | Mensagem | Causa |
|--------|----------|-------|
| 401 | Token não fornecido | Falta header Authorization |
| 403 | Operação requer escopo de instituição | Usuário sem instituicaoId (ex: SUPER_ADMIN sem query) |
| 403 | Acesso negado: você não é participante | Tentativa de acessar thread de outro usuário/tenant |
| 403 | Você não está vinculado a esta disciplina | Professor tenta criar thread DISCIPLINA sem vínculo |
| 403 | Você só pode abrir chat com alunos das suas turmas | Professor tenta DIRECT com aluno fora da turma |
| 404 | Disciplina não encontrada | disciplinaId inválido ou de outro tenant |

---

## WebSocket (opcional - pontos de integração)

Se o projeto integrar Socket.IO no futuro:

```javascript
// Servidor: emitir ao enviar mensagem
// io.to(`tenant:${instituicaoId}:thread:${id}`).emit('chat:message:new', message);
// io.to(`tenant:${instituicaoId}:user:${userId}`).emit('chat:message:new', message);

// Cliente: conectar com JWT e validar tenant
// socket.emit('join', { threadId, userId, instituicaoId });
```
