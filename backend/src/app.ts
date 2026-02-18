import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { notFoundHandler } from './middlewares/notFoundHandler.js';

const app = express();

// Trust proxy (Railway, Nginx, etc.) - req.protocol e req.get('host') corretos
app.set('trust proxy', 1);

// CORS configuration - MUST be before helmet to avoid conflicts
// PLATFORM_BASE_DOMAIN: domínio raiz para subdomínios (ex: dsicola.com) - permite *.dsicola.com para instituições
const platformBaseDomain = (process.env.PLATFORM_BASE_DOMAIN || 'dsicola.com').replace(/^https?:\/\//, '').split('/')[0];
const allowedOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : [
      'http://localhost:8080',  // Frontend port (priority)
      'http://localhost:5173',  // Vite default
      'http://localhost:3000',  // Alternative frontend port
      'http://127.0.0.1:8080',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:3000',
    ];

// Log CORS configuration on startup
console.log('[CORS] Allowed origins:', allowedOrigins);
console.log('[CORS] PLATFORM_BASE_DOMAIN:', platformBaseDomain, '(permite subdomínios *.domain)');

// Verifica se origin é subdomínio permitido (instituição) ou domínio principal
function isAllowedSubdomain(origin: string): boolean {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    if (url.protocol !== 'https:' && process.env.NODE_ENV === 'production') return false;
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

// Servir arquivos estáticos de uploads (apenas para desenvolvimento/debug)
// Em produção, usar endpoint protegido /biblioteca/itens/:id/download
if (process.env.NODE_ENV !== 'production') {
  app.use('/uploads', express.static('uploads'));
}

// Logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// API routes - mounted at root level
app.use('/', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;
