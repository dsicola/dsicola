# Configuração OIDC (Login com Google, Azure AD, etc.)

O OIDC é **opcional**. Se não configurar, o botão não aparece e o login continua só por email/senha.

## Variáveis de ambiente

Adicione ao `.env` do backend:

```env
# Ativar OIDC (obrigatório para mostrar o botão)
OIDC_ENABLED=true

# URL do IdP (ex.: Google, Azure AD)
OIDC_ISSUER=https://accounts.google.com

# Credenciais da aplicação (obtidas no console do provedor)
OIDC_CLIENT_ID=seu-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=seu-client-secret

# URL de callback (exatamente como registada no provedor)
# Ex.: https://api.dsicola.com/auth/oidc/callback
# Ou same-origin: https://app.dsicola.com/auth/oidc/callback
OIDC_REDIRECT_URI=https://SEU_DOMINIO/auth/oidc/callback

# Nome exibido no botão (opcional)
OIDC_PROVIDER_NAME=Google

# Scopes (opcional, padrão: openid email profile)
OIDC_SCOPES=openid email profile
```

## Exemplo: Google

1. Aceda a [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Crie credenciais OAuth 2.0 (Web application)
3. Autorized redirect URIs: `https://seu-dominio/auth/oidc/callback`
4. Copie Client ID e Client Secret para o `.env`
5. OIDC_ISSUER: `https://accounts.google.com`

## Exemplo: Azure AD

1. Azure Portal → App registrations → New registration
2. Em Authentication: adicione Redirect URI `https://seu-dominio/auth/oidc/callback`
3. Em Certificates & secrets: crie um client secret
4. OIDC_ISSUER: `https://login.microsoftonline.com/{tenant-id}/v2.0`  
   (ou `https://login.microsoftonline.com/common/v2.0` para multi-tenant)

## Configuração do frontend (produção)

**Obrigatório** quando frontend e backend estão em domínios diferentes (ex.: Vercel + Railway).

No Vercel: Project → Settings → Environment Variables:

```
VITE_API_URL=https://dsicola-backend.up.railway.app
```

(ou a URL do teu backend no Railway)

Sem isto, as chamadas após o callback OIDC vão para o domínio errado e o login falha com "Token não fornecido".

## Regras

- **Utilizadores devem existir na base** – não há auto-criação por OIDC (segurança em produção)
- O login OIDC faz match por **email**
- O JWT gerado é o mesmo do login por email/senha – fluxo idêntico para o resto do sistema
