# Políticas de Sessão e Senha - DSICOLA

Documento de referência para conformidade com requisitos de segurança institucional.

---

## 1. Sessão (JWT)

| Parâmetro | Valor | Variável de ambiente |
|-----------|-------|----------------------|
| **Access Token** | 15 minutos | `JWT_EXPIRES_IN=15m` |
| **Refresh Token** | 7 dias | `JWT_REFRESH_EXPIRES_IN=7d` |
| **Renovação** | Via `POST /auth/refresh` com refreshToken válido | — |

### Comportamento

- Access token expirado → frontend chama refresh automaticamente (se refreshToken válido)
- Refresh token expirado → utilizador deve fazer login novamente
- Logout invalida tokens no cliente (e opcionalmente no servidor, se implementado)

---

## 2. Política de Senha

| Requisito | Implementação |
|-----------|---------------|
| **Comprimento mínimo** | 6 caracteres (recomendado: 8+) |
| **Complexidade** | Letra maiúscula + caractere especial (validação no frontend) |
| **Armazenamento** | Hash bcrypt (custo 10) |
| **Alteração** | Endpoint `PUT /users/:id/password` com senha atual |
| **Recuperação** | Fluxo "Esqueci a senha" com token temporário por email |

### Validação (frontend)

- `ChangePasswordRequiredForm`, `LoginForm`: validação de complexidade
- Mensagens: "A senha deve conter pelo menos uma letra maiúscula e um caractere especial"

---

## 3. Rate Limiting

| Rota | Limite | Objetivo |
|------|--------|----------|
| `POST /auth/login` | 5 tentativas / 15 min por IP | Proteção brute force |
| `POST /auth/login-step2` (2FA) | 5 tentativas / 15 min | Proteção código TOTP |
| `POST /auth/forgot-password` | 3 pedidos / hora por IP | Evitar abuso de email |
| API geral | 200 req/min por IP | Proteção contra abuso |

---

## 4. 2FA (Opcional)

- TOTP (Google Authenticator, etc.)
- Ativação por utilizador nas configurações de perfil
- Login em 2 passos: `login` → `login-step2` com código

---

## 5. Referências

- [SESSAO-E-SEGURANCA.md](./SESSAO-E-SEGURANCA.md)
- [CHECKLIST_PRODUCAO.md](./CHECKLIST_PRODUCAO.md)
