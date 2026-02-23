import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';
import { swaggerUiHandler, swaggerUiSetup } from './lib/swagger.js';

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
const allowedOrigins = [...new Set([...baseAllowed, ...productionOrigins])];

// Log CORS configuration on startup
console.log('[CORS] Allowed origins:', allowedOrigins);
console.log('[CORS] PLATFORM_BASE_DOMAIN:', platformBaseDomain, '(permite subdomínios *.domain)');

// Verifica se origin é subdomínio permitido (instituição) ou domínio principal
function isAllowedSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return false;
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
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
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
    
    // Produção: permitir subdomínios da plataforma (escola.dsicola.com, etc.)
    if (process.env.NODE_ENV === 'production' && isAllowedSubdomain(origin)) {
      return callback(null, true);
    }
    
    // In development, be more permissive (log warning but allow)
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[CORS] Allowing origin in dev (not in list): ${origin}`);
      return callback(null, true);
    }
    
    // In production, block unknown origins
    console.warn(`[CORS] Blocked origin: ${origin}`);
    console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}, + *.${platformBaseDomain}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
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
// CSP: Desabilitada em desenvolvimento, restritiva em produção
const helmetConfig: any = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
};

// Configurar CSP baseado no ambiente
if (process.env.NODE_ENV === 'production') {
  // PRODUÇÃO: CSP restritiva e segura
  helmetConfig.contentSecurityPolicy = {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Necessário para React/Vite
      scriptSrc: [
        "'self'",
        // Permitir scripts do próprio domínio
        // NÃO usar 'unsafe-inline' em produção - scripts devem ser de arquivos externos
      ],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  };
} else {
  // DESENVOLVIMENTO: CSP completamente desabilitada
  helmetConfig.contentSecurityPolicy = false;
}

app.use(helmet(helmetConfig));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir arquivos estáticos de uploads (logo, favicon, capa, etc.)
// Em produção com volume persistente (Railway/Docker), uploads fica em ./uploads
app.use('/uploads', express.static('uploads'));

// Rate limit geral para API (proteção contra abuso; auth tem limites próprios)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 200, // 200 req/min por IP
  message: { error: 'Muitas requisições. Tente novamente em breve.' },
  standardHeaders: true,
  skip: (req) => req.path === '/health' || req.path === '/api-docs' || req.path.startsWith('/api-docs'),
});
app.use(apiLimiter);

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Swagger/OpenAPI docs (dev ou quando DOCS_ENABLED=true)
if (process.env.NODE_ENV !== 'production' || process.env.DOCS_ENABLED === 'true') {
  app.use('/api-docs', swaggerUiHandler, swaggerUiSetup);
}

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
