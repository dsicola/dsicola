/**
 * OIDC (OpenID Connect) Service
 *
 * Integração opcional - só ativo quando OIDC_* configurado.
 * Não quebra o fluxo existente de email/senha.
 */
import { Issuer, Client, generators } from 'openid-client';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../lib/jwtSecrets.js';
import { AppError } from '../middlewares/errorHandler.js';

let cachedClient: Client | null = null;

export function isOidcEnabled(): boolean {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const enabled = process.env.OIDC_ENABLED === 'true' || process.env.OIDC_ENABLED === '1';
  return !!(enabled && issuer && clientId && clientSecret && redirectUri);
}

export function getOidcProviderName(): string {
  return process.env.OIDC_PROVIDER_NAME || 'Google';
}

/**
 * Gera state signed para CSRF protection.
 * Inclui returnUrl e codeVerifier (PKCE) para segurança.
 */
function createState(returnUrl: string, codeVerifier: string): string {
  const payload = {
    returnUrl,
    nonce: generators.nonce(),
    codeVerifier,
    exp: Math.floor(Date.now() / 1000) + 600, // 10 min
  };
  return jwt.sign(payload, getJwtSecret());
}

/**
 * Obtém o cliente OIDC (com cache).
 */
async function getClient(): Promise<Client> {
  if (cachedClient) return cachedClient;

  const issuer = process.env.OIDC_ISSUER!;
  const clientId = process.env.OIDC_CLIENT_ID!;
  const clientSecret = process.env.OIDC_CLIENT_SECRET!;
  const redirectUri = process.env.OIDC_REDIRECT_URI!;

  const oidcIssuer = await Issuer.discover(issuer);
  cachedClient = new oidcIssuer.Client({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uris: [redirectUri],
    response_types: ['code'],
    scope: process.env.OIDC_SCOPES || 'openid email profile',
  });

  return cachedClient;
}

/**
 * Gera URL de autorização para redirecionar o utilizador ao IdP.
 */
export async function getAuthorizationUrl(returnUrl: string): Promise<string> {
  const client = await getClient();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const state = createState(returnUrl, codeVerifier);

  const authUrl = client.authorizationUrl({
    scope: process.env.OIDC_SCOPES || 'openid email profile',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
  });

  return authUrl;
}

export interface OidcCallbackResult {
  returnUrl: string;
  email: string;
  name?: string;
  sub: string;
}

/**
 * Troca o authorization code por tokens e obtém userinfo.
 * @param callbackUrl - URL completa do callback (com code e state na query)
 * @param state - state da requisição (para validar e extrair codeVerifier)
 */
export async function handleCallback(callbackUrl: string, state: string): Promise<OidcCallbackResult> {
  const decoded = jwt.verify(state, getJwtSecret()) as {
    returnUrl: string;
    nonce: string;
    codeVerifier?: string;
    exp: number;
  };

  const client = await getClient();
  const redirectUri = process.env.OIDC_REDIRECT_URI!;

  const params = client.callbackParams(callbackUrl);

  const tokenSet = await client.callback(
    redirectUri,
    params,
    {
      state,
      code_verifier: decoded.codeVerifier,
    }
  );

  const userinfo = await client.userinfo(tokenSet.access_token!);

  const email = (userinfo.email as string)?.toLowerCase?.() || (userinfo.preferred_username as string)?.toLowerCase?.();
  if (!email) {
    throw new AppError('Provedor OIDC não retornou email. Verifique as permissões da aplicação.', 400);
  }

  return {
    returnUrl: decoded.returnUrl,
    email,
    name: (userinfo.name as string) || (userinfo.given_name as string),
    sub: (userinfo.sub as string) || email,
  };
}
