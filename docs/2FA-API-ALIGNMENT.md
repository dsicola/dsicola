# Alinhamento Frontend ↔ Backend (Auth e 2FA)

## Resumo
Este documento confirma que as chamadas do frontend e as rotas do backend estão alinhadas para login e 2FA.

---

## 1. Login (sem 2FA)

| Item | Backend | Frontend |
|------|---------|----------|
| **Rota** | `POST /auth/login` | `api.post('/auth/login', { email, password })` |
| **Body** | `{ email, password }` (zod: email, min 6 chars password) | `{ email, password }` |
| **Resposta login OK** | `{ accessToken, refreshToken, user }` | Usa `response.data` (mesmo shape) |
| **Resposta requer 2FA** | `{ requiresTwoFactor: true, userId, user }` | LoginForm verifica `loginResponse.requiresTwoFactor && loginResponse.userId` e mostra TwoFactorVerification |

✅ Alinhado.

---

## 2. Login Step 2 (verificação 2FA)

| Item | Backend | Frontend |
|------|---------|----------|
| **Rota** | `POST /auth/login-step2` (rate limit: 5/min prod) | `api.post('/auth/login-step2', { userId, token })` |
| **Body** | `{ userId: uuid, token: 6 dígitos }` (zod) | `{ userId, token }` |
| **Resposta** | `{ accessToken, refreshToken, user }` (LoginResult) | TwoFactorVerification chama `onSuccess(result)`; LoginForm usa `signInWithTokens(result.accessToken, result.refreshToken)` |

✅ Alinhado.

---

## 3. 2FA Setup/Verify/Disable/Status (perfil)

| Item | Backend | Frontend |
|------|---------|----------|
| **Base** | Rotas em `/two-factor` com `authenticate` | `api.post('/two-factor/...')` (api já autenticado com Bearer) |
| **Setup** | `POST /two-factor/setup` → `{ secret, qrCode, otpauthUrl }` | `twoFactorApi.setup()` → usa `res.qrCode`, `res.secret` |
| **Verify** | `POST /two-factor/verify` body `{ token, secret }` | `twoFactorApi.verifyAndEnable(token, secret)` |
| **Disable** | `POST /two-factor/disable` | `twoFactorApi.disable()` |
| **Status** | `GET /two-factor/status` → `{ twoFactorEnabled }` | `twoFactorApi.getStatus()` → `res.twoFactorEnabled` |
| **Reset** | `POST /two-factor/reset` body `{ userId }` | `twoFactorApi.reset(userId)` |

✅ Alinhado.

---

## 4. Perfil (pós-login 2FA)

| Item | Backend | Frontend |
|------|---------|----------|
| **Rota** | `GET /auth/profile` (alias `/auth/me`) com Bearer | `authApi.getProfile()` e `authApi.getProfileWithToken(accessToken)` |
| **Uso** | signInWithTokens usa getProfileWithToken(accessToken) para carregar user/roles após 2FA | AuthContext recebe dados e setUser/setRole |

✅ Alinhado.

---

## 5. Regra 2FA no login (backend)

- **Quando exige 2FA:** Sempre que o usuário tem `two_factor_enabled = true` (userHas2FA).
- **Resposta:** `{ requiresTwoFactor: true, userId, user }` (sem accessToken/refreshToken).
- **Frontend:** LoginForm detecta e mostra TwoFactorVerification; após código correto chama login-step2 e depois signInWithTokens.

---

## Conclusão

Frontend e backend estão alinhados para:
- Login com e sem 2FA
- Login step 2 (código TOTP)
- Setup/verify/disable/status 2FA no perfil
- Uso de tokens e perfil após 2FA

---

## Como testar localmente (100%)

### 1. Verificação estática (sem servidores)

No **backend**:

```bash
cd backend
npm run verify:auth-2fa
```

Confirma que rotas, serviços e frontend estão alinhados (19 verificações).

### 2. Testes unitários backend

```bash
cd backend
npx prisma generate   # se ainda não tiver feito
npm run test
```

Nota: Alguns testes podem falhar por ambiente (Prisma, RBAC mocks). Os relevantes para auth/2FA são os que não dependem de DB.

### 3. E2E de login (Playwright)

Requer **backend** e **frontend** a correr, e browsers do Playwright instalados:

```bash
# Terminal 1 – backend
cd backend && npm run dev

# Terminal 2 – instalar browsers (uma vez)
cd frontend && npx playwright install chromium

# Terminal 2 – e2e auth
cd frontend && npm run test:e2e:auth
```

Ou com frontend já a correr noutro terminal:

```bash
cd frontend
E2E_SKIP_WEB_SERVER=1 E2E_BASE_URL=http://localhost:8080 npm run test:e2e:auth
```

Os testes de auth fazem login com credenciais de seed (super admin, admin, etc.). Se algum utilizador tiver 2FA ativado, o teste de login desse perfil falhará a menos que o teste preencha o código 2FA (por defeito os usuários de seed não têm 2FA).
