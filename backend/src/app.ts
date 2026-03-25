import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import routes from './routes/index.js';
import socialPublicRoutes from './modules/social/social.public.routes.js';
import communityRoutes from './modules/community/community.routes.js';
import communityAdminRoutes from './modules/community/community.admin.routes.js';
import { parseTenantDomain } from './middlewares/validateTenantDomain.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { swaggerUiHandler, swaggerUiSetup, spec as openApiSpec } from './lib/swagger.js';
import { authenticate } from './middlewares/auth.js';
import { serveSecureUploads } from './middlewares/secureUploads.middleware.js';
import { isOriginRegisteredInstitutionCustomDomain } from './utils/corsCustomInstituicaoDomain.js';

const app = express();

// Sentry request/tracing via init() in server.ts; error handler added after routes

// Trust proxy (Railway, Nginx, etc.) - req.protocol e req.get('host') corretos
app.set('trust proxy', 1);

// CORS configuration - MUST be before helmet to avoid conflicts
// PLATFORM_BASE_DOMAIN: domínio raiz para subdomínios (ex: dsicola.com) - permite *.dsicola.com para instituições
const platformBaseDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
const baseAllowed =
  process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((url: string) => url.trim())
    : [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:3000',
        'http://127.0.0.1:8080',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3000',
      ];
// Em produção, garantir que o domínio principal está sempre permitido (fallback se FRONTEND_URL faltar no Railway)
const productionOrigins =
  process.env.NODE_ENV === 'production'
    ? [`https://www.${platformBaseDomain}`, `https://${platformBaseDomain}`]
    : [];
const corsExtraOrigins = (process.env.CORS_EXTRA_ORIGINS || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);
const allowedOrigins = [...new Set([...baseAllowed, ...productionOrigins, ...corsExtraOrigins])];

/** Railway/Render/etc.: exigir HTTPS em CORS mesmo se NODE_ENV vier errado */
const isLikelyCloudDeploy = Boolean(
  process.env.RAILWAY_ENVIRONMENT ||
    process.env.RAILWAY_PROJECT_ID ||
    process.env.RENDER ||
    process.env.FLY_APP_NAME,
);
const secureCorsRequireHttps =
  process.env.NODE_ENV === 'production' || process.env.RAILWAY_ENVIRONMENT === 'production' || isLikelyCloudDeploy;

// Log CORS configuration on startup
console.log('[CORS] Allowed origins:', allowedOrigins);
console.log('[CORS] PLATFORM_BASE_DOMAIN:', platformBaseDomain, '(permite subdomínios *.domain)');
if (corsExtraOrigins.length) console.log('[CORS] CORS_EXTRA_ORIGINS:', corsExtraOrigins.length, 'entrada(s)');

// Verifica se origin é subdomínio permitido (instituição) ou domínio principal
function isAllowedSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (url.protocol !== 'https:' && secureCorsRequireHttps) return false;
    // Domínio exato (dsicola.com) ou www (www.dsicola.com)
    if (host === platformBaseDomain || host === `www.${platformBaseDomain}`) return true;
    const parts = host.split('.');
    if (parts.length >= 3 && parts.slice(-2).join('.') === platformBaseDomain) {
      const sub = parts[0].toLowerCase();
      if (['app', 'admin', 'www'].includes(sub)) return true; // domínio principal
      return /^[a-z0-9-]+$/.test(sub); // subdomínio válido para instituição
    }
    return false;
  } catch {
    return false;
  }
}

// Previews Vercel em HTTPS (qualquer *.vercel.app). Antes só hostnames começados por "dsicola"
// — deploys com outro nome de projeto falhavam em CORS no Chrome/Firefox (Origin sempre enviado).
function isVercelPreview(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:') return false;
    return host === 'vercel.app' || host.endsWith('.vercel.app');
  } catch {
    return false;
  }
}

// CORS configuration function - Simplified and more explicit
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, curl, or same-origin requests)
    if (!origin) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('[CORS] Request with no origin - allowing');
      }
      return callback(null, true);
    }
    
    // In development, allow all localhost origins (any port)
    if (process.env.NODE_ENV !== 'production') {
      if (
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        origin.startsWith('http://[::1]:')
      ) {
        console.log(`[CORS] Allowing localhost origin: ${origin}`);
        return callback(null, true);
      }
    }
    
    // Check against allowed origins list
    if (allowedOrigins.includes(origin)) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[CORS] Allowing origin from allowed list: ${origin}`);
      }
      return callback(null, true);
    }
    
    // Subdomínios da plataforma (escola.dsicola.com, etc.) — não depender só de NODE_ENV===production
    // (deploys com NODE_ENV vazio/staging bloqueavam preflight e a SPA mostrava listagens vazias / sem dados).
    if (isAllowedSubdomain(origin)) {
      return callback(null, true);
    }

    // Previews Vercel (*.vercel.app)
    if (isVercelPreview(origin)) {
      return callback(null, true);
    }

    // Domínio próprio registado na instituição (produção: sem lista manual CORS_EXTRA_ORIGINS por cliente)
    void isOriginRegisteredInstitutionCustomDomain(origin)
      .then((registered) => {
        if (registered) {
          if (process.env.NODE_ENV !== 'production') {
            console.log(`[CORS] Allowing registered institution custom domain: ${origin}`);
          }
          callback(null, true);
          return;
        }
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[CORS] Allowing origin in dev (not in list): ${origin}`);
          callback(null, true);
          return;
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        console.warn(
          `[CORS] Tip: origins em *.${platformBaseDomain}, lista FRONTEND_URL/CORS_EXTRA_ORIGINS, ou domínio próprio guardado na instituição.`
        );
        callback(new Error('Not allowed by CORS'));
      })
      .catch((err) => {
        console.error('[CORS] Erro ao verificar domínio institucional:', err);
        if (process.env.NODE_ENV !== 'production') {
          callback(null, true);
          return;
        }
        callback(new Error('Not allowed by CORS'));
      });
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  // X-Idempotency-Key: enviado pelo frontend (api.ts) em POST/PUT/PATCH — sem isto o preflight falha
  // (Chrome/Firefox mostram "not allowed by Access-Control-Allow-Headers"; Safari por vezes mascarava).
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-Idempotency-Key',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400, // 24 hours
};

// Apply CORS middleware FIRST - before any routes or other middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly for all routes
// This ensures OPTIONS requests are handled before reaching route handlers
app.options('*', cors(corsOptions));

// Security middleware - Configure helmet to work with CORS
// CSP desligada em TODAS as envs: esta API só devolve JSON (SPA está noutro host — Vercel, etc.).
// Enviar Content-Security-Policy nas respostas /auth/login, /..., é inútil para HTML e em alguns
// cenários (extensões + DevTools + credenciais CORS) pode gerar ruído ou comportamento estranho
// entre motores (Chromium vs WebKit). A política real da app deve vir do hosting do frontend.
const helmetConfig: any = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false,
};

app.use(helmet(helmetConfig));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// /uploads só com JWT (header Authorization ou ?token= nas signed URLs). Evita leitura anónima de ficheiros.
app.use('/uploads', authenticate, serveSecureUploads);

// Rate limit geral para API (proteção contra abuso; auth tem limites próprios)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200, // 200 req/min por IP
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  skip: (req) => req.path === '/health' || req.path === '/api-docs' || req.path === '/api-docs.json' || req.path.startsWith('/api-docs'),
});
app.use(apiLimiter);

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Swagger/OpenAPI docs (dev ou quando DOCS_ENABLED=true)
if (process.env.NODE_ENV !== 'production' || process.env.DOCS_ENABLED === 'true') {
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(openApiSpec);
  });
  app.use('/api-docs', swaggerUiHandler, swaggerUiSetup);
}

// Tenant domain context (hostname → central vs subdomain; localhost ignored)
app.use(parseTenantDomain);

// Social público: antes do router principal — rotas montadas em "/" com auth (ex.: aulasLancadas) capturariam /api/social/public/* primeiro.
app.use('/api/social/public', socialPublicRoutes);

// Diretório público Comunidade (instituições, cursos divulgados, seguir).
app.use('/api/community', communityRoutes);

// Ofertas do diretório Comunidade (admin institucional).
app.use('/api/community/admin', communityAdminRoutes);

// API routes - mounted at root level
app.use('/', routes);

// 404 handler
app.use(notFoundHandler);

// Sentry error handler (antes do nosso; captura e repassa)
if (process.env.SENTRY_DSN && process.env.NODE_ENV === 'production') {
  Sentry.setupExpressErrorHandler(app);
}
// Error handler (must be last)
app.use(errorHandler);

export default app;
