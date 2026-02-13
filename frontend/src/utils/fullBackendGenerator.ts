import jsPDF from 'jspdf';

// ============================================================
// GERADOR DE BACKEND COMPLETO - NODE.JS + EXPRESS + PRISMA
// ============================================================

export const generateFullBackendPDF = () => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const maxWidth = pageWidth - 2 * margin;

  const addPage = () => {
    doc.addPage();
    yPos = 20;
  };

  const checkPageBreak = (height: number = 10) => {
    if (yPos + height > pageHeight - 20) {
      addPage();
    }
  };

  const addTitle = (text: string, size: number = 16) => {
    checkPageBreak(20);
    doc.setFontSize(size);
    doc.setFont('helvetica', 'bold');
    doc.text(text, margin, yPos);
    yPos += size / 2 + 5;
  };

  const addText = (text: string, size: number = 10) => {
    doc.setFontSize(size);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, maxWidth);
    lines.forEach((line: string) => {
      checkPageBreak();
      doc.text(line, margin, yPos);
      yPos += 5;
    });
  };

  const addCode = (code: string, fontSize: number = 7) => {
    doc.setFontSize(fontSize);
    doc.setFont('courier', 'normal');
    const lines = code.split('\n');
    lines.forEach((line) => {
      checkPageBreak();
      const truncatedLine = line.length > 120 ? line.substring(0, 117) + '...' : line;
      doc.text(truncatedLine, margin, yPos);
      yPos += 4;
    });
    yPos += 3;
  };

  const addSection = (title: string, code: string) => {
    addTitle(title, 12);
    addCode(code);
  };

  // ============================================================
  // CAPA
  // ============================================================
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('DSICOLA - BACKEND COMPLETO', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Node.js + Express + Prisma + PostgreSQL', pageWidth / 2, 55, { align: 'center' });
  doc.text('JWT Authentication + bcrypt', pageWidth / 2, 65, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 85, { align: 'center' });
  
  yPos = 100;
  addText('Este documento contém o código fonte completo do backend para migração para servidor próprio.');
  addText('Todas as funcionalidades: autenticação, CRUD, proteção de rotas, logs, validações.');

  // ============================================================
  // ESTRUTURA DO PROJETO
  // ============================================================
  addPage();
  addTitle('ESTRUTURA DO PROJETO', 16);
  addCode(`
dsicola-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── controllers/
│   │   ├── auth.controller.ts
│   │   ├── aluno.controller.ts
│   │   ├── professor.controller.ts
│   │   ├── curso.controller.ts
│   │   ├── turma.controller.ts
│   │   ├── disciplina.controller.ts
│   │   ├── matricula.controller.ts
│   │   ├── nota.controller.ts
│   │   ├── mensalidade.controller.ts
│   │   ├── comunicado.controller.ts
│   │   └── instituicao.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts
│   │   ├── role.middleware.ts
│   │   ├── validation.middleware.ts
│   │   └── error.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── aluno.routes.ts
│   │   ├── professor.routes.ts
│   │   ├── curso.routes.ts
│   │   ├── turma.routes.ts
│   │   ├── disciplina.routes.ts
│   │   ├── matricula.routes.ts
│   │   ├── nota.routes.ts
│   │   ├── mensalidade.routes.ts
│   │   ├── comunicado.routes.ts
│   │   └── instituicao.routes.ts
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── email.service.ts
│   │   └── prisma.service.ts
│   ├── dto/
│   │   ├── auth.dto.ts
│   │   ├── aluno.dto.ts
│   │   └── professor.dto.ts
│   ├── types/
│   │   └── express.d.ts
│   ├── utils/
│   │   ├── logger.ts
│   │   └── helpers.ts
│   └── app.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
`);

  // ============================================================
  // COMANDOS DE INSTALAÇÃO
  // ============================================================
  addTitle('COMANDOS DE INSTALAÇÃO', 14);
  addCode(`
# 1. Criar pasta do projeto
mkdir dsicola-backend
cd dsicola-backend

# 2. Inicializar projeto
npm init -y

# 3. Instalar dependências
npm install express cors helmet bcryptjs jsonwebtoken prisma @prisma/client
npm install nodemailer zod dotenv express-rate-limit
npm install -D typescript @types/express @types/cors @types/bcryptjs 
npm install -D @types/jsonwebtoken @types/nodemailer ts-node nodemon

# 4. Inicializar TypeScript
npx tsc --init

# 5. Inicializar Prisma
npx prisma init

# 6. Configurar .env (copiar de .env.example)
cp .env.example .env

# 7. Rodar migrações
npx prisma migrate dev --name init

# 8. Iniciar servidor
npm run dev
`);

  // ============================================================
  // ARQUIVO: .env.example
  // ============================================================
  addPage();
  addSection('ARQUIVO: .env.example', `
# ============================================================
# CONFIGURAÇÕES DO BANCO DE DADOS
# ============================================================
DATABASE_URL="postgresql://postgres:suasenha@localhost:5432/dsicola?schema=public"

# ============================================================
# CONFIGURAÇÕES JWT
# ============================================================
JWT_SECRET="seu-segredo-jwt-muito-seguro-aqui-minimo-32-caracteres"
JWT_REFRESH_SECRET="seu-segredo-refresh-token-muito-seguro-aqui"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# ============================================================
# CONFIGURAÇÕES DO SERVIDOR
# ============================================================
PORT=3001
NODE_ENV=development

# ============================================================
# CONFIGURAÇÕES DE EMAIL (RESEND)
# ============================================================
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_FROM="noreply@seudominio.com"

# ============================================================
# CONFIGURAÇÕES DE SEGURANÇA
# ============================================================
BCRYPT_SALT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
`);

  // ============================================================
  // ARQUIVO: package.json
  // ============================================================
  addSection('ARQUIVO: package.json', `
{
  "name": "dsicola-backend",
  "version": "1.0.0",
  "description": "Backend do Sistema de Gestão Escolar DSICOLA",
  "main": "dist/app.js",
  "scripts": {
    "dev": "nodemon src/app.ts",
    "build": "tsc",
    "start": "node dist/app.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.10.0",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.18.2",
    "express-rate-limit": "^7.1.5",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "nodemailer": "^6.9.8",
    "prisma": "^5.10.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/nodemailer": "^6.4.14",
    "nodemon": "^3.0.3",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.3"
  }
}
`);

  // ============================================================
  // ARQUIVO: tsconfig.json
  // ============================================================
  addSection('ARQUIVO: tsconfig.json', `
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": "./src",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`);

  // ============================================================
  // ARQUIVO: prisma/schema.prisma
  // ============================================================
  addPage();
  addTitle('ARQUIVO: prisma/schema.prisma', 14);
  addCode(`
// ============================================================
// PRISMA SCHEMA - BANCO DE DADOS DSICOLA
// ============================================================

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// ENUMS
// ============================================================

enum UserRole {
  SUPER_ADMIN
  ADMIN
  SECRETARIA
  PROFESSOR
  ALUNO
  RESPONSAVEL
}

enum StatusAluno {
  Ativo
  Inativo
  Formado
  Transferido
  Desistente
}

enum StatusMatricula {
  Ativa
  Cancelada
  Concluida
  Trancada
}

enum StatusMensalidade {
  Pendente
  Pago
  Atrasado
  Cancelado
}

// ============================================================
// TABELAS PRINCIPAIS
// ============================================================

model Instituicao {
  id              String   @id @default(uuid())
  nome            String
  codigo          String   @unique
  email           String?
  telefone        String?
  endereco        String?
  logo_url        String?
  cor_primaria    String?  @default("#8B5CF6")
  cor_secundaria  String?  @default("#1F2937")
  ativo           Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  usuarios        User[]
  cursos          Curso[]
  turmas          Turma[]
  disciplinas     Disciplina[]
  comunicados     Comunicado[]
  eventos         EventoCalendario[]
  
  @@map("instituicoes")
}

model User {
  id                          String       @id @default(uuid())
  email                       String       @unique
  senha_hash                  String
  nome_completo               String
  numero_identificacao        String?
  numero_identificacao_publica String?
  telefone                    String?
  data_nascimento             DateTime?
  genero                      String?
  avatar_url                  String?
  morada                      String?
  cidade                      String?
  pais                        String?      @default("Angola")
  status_aluno                StatusAluno? @default(Ativo)
  ativo                       Boolean      @default(true)
  created_at                  DateTime     @default(now())
  updated_at                  DateTime     @updatedAt

  instituicao_id              String?
  instituicao                 Instituicao? @relation(fields: [instituicao_id], references: [id])

  roles                       UserRole[]
  refresh_tokens              RefreshToken[]
  matriculas                  Matricula[]
  notas                       Nota[]
  frequencias                 Frequencia[]
  mensalidades                Mensalidade[]
  turmas_professor            Turma[]      @relation("ProfessorTurma")
  comunicados_autor           Comunicado[] @relation("AutorComunicado")
  logs_auditoria              LogAuditoria[]

  @@map("users")
}

model RefreshToken {
  id          String   @id @default(uuid())
  token       String   @unique
  user_id     String
  expires_at  DateTime
  created_at  DateTime @default(now())
  revoked     Boolean  @default(false)

  user        User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
}

model Curso {
  id              String   @id @default(uuid())
  nome            String
  codigo          String
  descricao       String?
  carga_horaria   Int      @default(60)
  valor_mensalidade Float  @default(50000)
  duracao         String?  @default("4 anos")
  grau            String?  @default("Licenciatura")
  ativo           Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  disciplinas     Disciplina[]
  turmas          Turma[]

  @@unique([codigo, instituicao_id])
  @@map("cursos")
}

model Disciplina {
  id              String   @id @default(uuid())
  nome            String
  carga_horaria   Int      @default(60)
  semestre        Int
  obrigatoria     Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  curso_id        String
  curso           Curso    @relation(fields: [curso_id], references: [id])

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  notas           Nota[]
  aulas           Aula[]

  @@map("disciplinas")
}

model Turma {
  id              String   @id @default(uuid())
  nome            String
  codigo          String
  ano_letivo      Int
  turno           String   @default("Manhã")
  sala            String?
  capacidade      Int      @default(40)
  ativa           Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  curso_id        String
  curso           Curso    @relation(fields: [curso_id], references: [id])

  professor_id    String?
  professor       User?    @relation("ProfessorTurma", fields: [professor_id], references: [id])

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  matriculas      Matricula[]
  aulas           Aula[]
  exames          Exame[]

  @@unique([codigo, ano_letivo, instituicao_id])
  @@map("turmas")
}

model Matricula {
  id              String          @id @default(uuid())
  numero_matricula String?
  data_matricula  DateTime        @default(now())
  status          StatusMatricula @default(Ativa)
  observacoes     String?
  created_at      DateTime        @default(now())
  updated_at      DateTime        @updatedAt

  aluno_id        String
  aluno           User            @relation(fields: [aluno_id], references: [id])

  turma_id        String
  turma           Turma           @relation(fields: [turma_id], references: [id])

  @@unique([aluno_id, turma_id])
  @@map("matriculas")
}

model Aula {
  id              String   @id @default(uuid())
  data            DateTime
  conteudo        String?
  observacoes     String?
  created_at      DateTime @default(now())

  turma_id        String
  turma           Turma    @relation(fields: [turma_id], references: [id])

  disciplina_id   String?
  disciplina      Disciplina? @relation(fields: [disciplina_id], references: [id])

  frequencias     Frequencia[]

  @@map("aulas")
}

model Frequencia {
  id              String   @id @default(uuid())
  presente        Boolean  @default(true)
  justificativa   String?
  created_at      DateTime @default(now())

  aluno_id        String
  aluno           User     @relation(fields: [aluno_id], references: [id])

  aula_id         String
  aula            Aula     @relation(fields: [aula_id], references: [id])

  @@unique([aluno_id, aula_id])
  @@map("frequencias")
}

model Nota {
  id              String   @id @default(uuid())
  valor           Float
  peso            Float    @default(1)
  tipo            String   @default("Prova")
  trimestre       Int?
  ano_letivo      Int?
  observacoes     String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  aluno_id        String
  aluno           User     @relation(fields: [aluno_id], references: [id])

  disciplina_id   String
  disciplina      Disciplina @relation(fields: [disciplina_id], references: [id])

  @@map("notas")
}

model Exame {
  id              String   @id @default(uuid())
  nome            String
  data_exame      DateTime
  hora_inicio     String?
  hora_fim        String?
  sala            String?
  tipo            String   @default("Escrito")
  peso            Float    @default(1)
  status          String   @default("Agendado")
  observacoes     String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  turma_id        String
  turma           Turma    @relation(fields: [turma_id], references: [id])

  @@map("exames")
}

model Mensalidade {
  id              String            @id @default(uuid())
  valor           Float
  mes_referencia  String
  ano_referencia  Int
  data_vencimento DateTime
  data_pagamento  DateTime?
  status          StatusMensalidade @default(Pendente)
  multa           Boolean           @default(false)
  valor_multa     Float?            @default(0)
  percentual_multa Float?           @default(5)
  forma_pagamento String?
  comprovativo_url String?
  observacoes     String?
  created_at      DateTime          @default(now())
  updated_at      DateTime          @updatedAt

  aluno_id        String
  aluno           User              @relation(fields: [aluno_id], references: [id])

  @@unique([aluno_id, mes_referencia, ano_referencia])
  @@map("mensalidades")
}

model Comunicado {
  id              String   @id @default(uuid())
  titulo          String
  conteudo        String
  tipo            String   @default("Geral")
  destinatarios   String   @default("Todos")
  data_publicacao DateTime @default(now())
  data_expiracao  DateTime?
  ativo           Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  autor_id        String?
  autor           User?    @relation("AutorComunicado", fields: [autor_id], references: [id])

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  @@map("comunicados")
}

model EventoCalendario {
  id              String   @id @default(uuid())
  titulo          String
  descricao       String?
  data_inicio     DateTime
  data_fim        DateTime?
  hora_inicio     String?
  hora_fim        String?
  tipo            String   @default("evento")
  cor             String?  @default("#3b82f6")
  recorrente      Boolean  @default(false)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  @@map("eventos_calendario")
}

model LogAuditoria {
  id              String   @id @default(uuid())
  acao            String
  tabela          String?
  registro_id     String?
  dados_anteriores Json?
  dados_novos     Json?
  ip_address      String?
  user_agent      String?
  created_at      DateTime @default(now())

  user_id         String?
  user            User?    @relation(fields: [user_id], references: [id])

  @@map("logs_auditoria")
}

model LoginAttempt {
  id              String   @id @default(uuid())
  email           String   @unique
  attempt_count   Int      @default(0)
  last_attempt_at DateTime @default(now())
  locked_until    DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@map("login_attempts")
}
`);

  // ============================================================
  // ARQUIVO: src/app.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/app.ts', `
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorMiddleware } from './middleware/error.middleware';
import { logger } from './utils/logger';

import authRoutes from './routes/auth.routes';
import alunoRoutes from './routes/aluno.routes';
import professorRoutes from './routes/professor.routes';
import cursoRoutes from './routes/curso.routes';
import turmaRoutes from './routes/turma.routes';
import disciplinaRoutes from './routes/disciplina.routes';
import matriculaRoutes from './routes/matricula.routes';
import notaRoutes from './routes/nota.routes';
import mensalidadeRoutes from './routes/mensalidade.routes';
import comunicadoRoutes from './routes/comunicado.routes';
import instituicaoRoutes from './routes/instituicao.routes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// MIDDLEWARE DE SEGURANÇA
// ============================================================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logger de requisições
app.use((req, res, next) => {
  logger.info(\`\${req.method} \${req.path}\`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// ============================================================
// ROTAS
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/alunos', alunoRoutes);
app.use('/api/professores', professorRoutes);
app.use('/api/cursos', cursoRoutes);
app.use('/api/turmas', turmaRoutes);
app.use('/api/disciplinas', disciplinaRoutes);
app.use('/api/matriculas', matriculaRoutes);
app.use('/api/notas', notaRoutes);
app.use('/api/mensalidades', mensalidadeRoutes);
app.use('/api/comunicados', comunicadoRoutes);
app.use('/api/instituicoes', instituicaoRoutes);

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================
// MIDDLEWARE DE ERRO GLOBAL
// ============================================================
app.use(errorMiddleware);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ============================================================
// INICIAR SERVIDOR
// ============================================================
app.listen(PORT, () => {
  logger.info(\`Servidor DSICOLA rodando na porta \${PORT}\`);
  console.log(\`🚀 Servidor iniciado em http://localhost:\${PORT}\`);
});

export default app;
`);

  // ============================================================
  // ARQUIVO: src/services/prisma.service.ts
  // ============================================================
  addSection('ARQUIVO: src/services/prisma.service.ts', `
import { PrismaClient } from '@prisma/client';

class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error'] 
        : ['error']
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

export const prisma = new PrismaService();
`);

  // ============================================================
  // ARQUIVO: src/services/auth.service.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/services/auth.service.ts', `
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service';
import { logger } from '../utils/logger';

interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  instituicaoId: string | null;
}

interface LoginResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    nome_completo: string;
    roles: string[];
    instituicao_id: string | null;
  };
}

class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET!;
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private readonly SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES_IN
    });
  }

  generateRefreshToken(userId: string): string {
    return jwt.sign({ userId }, this.JWT_REFRESH_SECRET, {
      expiresIn: this.JWT_REFRESH_EXPIRES_IN
    });
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, this.JWT_SECRET) as TokenPayload;
  }

  verifyRefreshToken(token: string): { userId: string } {
    return jwt.verify(token, this.JWT_REFRESH_SECRET) as { userId: string };
  }

  async isAccountLocked(email: string): Promise<boolean> {
    const attempt = await prisma.loginAttempt.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!attempt || !attempt.locked_until) return false;
    return attempt.locked_until > new Date();
  }

  async recordFailedLogin(email: string): Promise<{
    attemptCount: number;
    isLocked: boolean;
    lockedUntil: Date | null;
  }> {
    const now = new Date();
    const lockoutUntil = new Date(now.getTime() + this.LOCKOUT_DURATION_MS);

    const attempt = await prisma.loginAttempt.upsert({
      where: { email: email.toLowerCase() },
      create: {
        email: email.toLowerCase(),
        attempt_count: 1,
        last_attempt_at: now
      },
      update: {
        attempt_count: { increment: 1 },
        last_attempt_at: now,
        locked_until: {
          set: undefined // Will be set below if needed
        }
      }
    });

    // Check if we need to lock
    if (attempt.attempt_count >= this.MAX_LOGIN_ATTEMPTS) {
      await prisma.loginAttempt.update({
        where: { email: email.toLowerCase() },
        data: { locked_until: lockoutUntil }
      });

      return {
        attemptCount: attempt.attempt_count,
        isLocked: true,
        lockedUntil: lockoutUntil
      };
    }

    return {
      attemptCount: attempt.attempt_count,
      isLocked: false,
      lockedUntil: null
    };
  }

  async resetLoginAttempts(email: string): Promise<void> {
    await prisma.loginAttempt.deleteMany({
      where: { email: email.toLowerCase() }
    });
  }

  async login(email: string, password: string): Promise<LoginResult> {
    // Check if account is locked
    const isLocked = await this.isAccountLocked(email);
    if (isLocked) {
      throw new Error('Conta temporariamente bloqueada. Tente novamente em 5 minutos.');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !user.ativo) {
      await this.recordFailedLogin(email);
      throw new Error('Email ou senha inválidos');
    }

    // Verify password
    const validPassword = await this.comparePassword(password, user.senha_hash);
    if (!validPassword) {
      const result = await this.recordFailedLogin(email);
      if (result.isLocked) {
        throw new Error('Conta temporariamente bloqueada. Tente novamente em 5 minutos.');
      }
      throw new Error(\`Email ou senha inválidos. Tentativas restantes: \${this.MAX_LOGIN_ATTEMPTS - result.attemptCount}\`);
    }

    // Reset login attempts on successful login
    await this.resetLoginAttempts(email);

    // Generate tokens
    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      roles: user.roles,
      instituicaoId: user.instituicao_id
    };

    const accessToken = this.generateAccessToken(tokenPayload);
    const refreshToken = this.generateRefreshToken(user.id);

    // Save refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        user_id: user.id,
        expires_at: expiresAt
      }
    });

    logger.info(\`User logged in: \${user.email}\`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        nome_completo: user.nome_completo,
        roles: user.roles,
        instituicao_id: user.instituicao_id
      }
    };
  }

  async register(data: {
    email: string;
    password: string;
    nome_completo: string;
    instituicao_id?: string;
    role?: string;
  }): Promise<{ id: string; email: string }> {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error('Este email já está cadastrado');
    }

    // Hash password
    const senha_hash = await this.hashPassword(data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        senha_hash,
        nome_completo: data.nome_completo,
        instituicao_id: data.instituicao_id,
        roles: [data.role as any || 'ALUNO']
      }
    });

    logger.info(\`New user registered: \${user.email}\`);

    return { id: user.id, email: user.email };
  }

  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Verify token
    const payload = this.verifyRefreshToken(refreshToken);

    // Check if token exists and is not revoked
    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        token: refreshToken,
        user_id: payload.userId,
        revoked: false,
        expires_at: { gt: new Date() }
      },
      include: { user: true }
    });

    if (!storedToken) {
      throw new Error('Token de refresh inválido ou expirado');
    }

    // Revoke old token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revoked: true }
    });

    // Generate new tokens
    const tokenPayload: TokenPayload = {
      userId: storedToken.user.id,
      email: storedToken.user.email,
      roles: storedToken.user.roles,
      instituicaoId: storedToken.user.instituicao_id
    };

    const newAccessToken = this.generateAccessToken(tokenPayload);
    const newRefreshToken = this.generateRefreshToken(storedToken.user.id);

    // Save new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        user_id: storedToken.user.id,
        expires_at: expiresAt
      }
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          user_id: userId,
          token: refreshToken
        },
        data: { revoked: true }
      });
    } else {
      // Revoke all refresh tokens
      await prisma.refreshToken.updateMany({
        where: { user_id: userId },
        data: { revoked: true }
      });
    }

    logger.info(\`User logged out: \${userId}\`);
  }
}

export const authService = new AuthService();
`);

  // ============================================================
  // ARQUIVO: src/middleware/auth.middleware.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/middleware/auth.middleware.ts', `
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roles: string[];
    instituicaoId: string | null;
  };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de autenticação não fornecido'
      });
    }

    const token = authHeader.substring(7);

    try {
      const payload = authService.verifyAccessToken(token);
      req.user = payload;
      next();
    } catch (error) {
      logger.warn('Invalid token attempt', { error });
      return res.status(401).json({
        error: 'Token inválido ou expirado'
      });
    }
  } catch (error) {
    logger.error('Auth middleware error', { error });
    return res.status(500).json({
      error: 'Erro interno de autenticação'
    });
  }
};

export const optionalAuthMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const payload = authService.verifyAccessToken(token);
        req.user = payload;
      } catch (error) {
        // Token inválido, mas é opcional
      }
    }

    next();
  } catch (error) {
    next();
  }
};
`);

  // ============================================================
  // ARQUIVO: src/middleware/role.middleware.ts
  // ============================================================
  addSection('ARQUIVO: src/middleware/role.middleware.ts', `
import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Não autenticado'
      });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));

    if (!hasRole) {
      logger.warn('Access denied', {
        userId: req.user.userId,
        requiredRoles: allowedRoles,
        userRoles: req.user.roles
      });

      return res.status(403).json({
        error: 'Acesso negado. Você não tem permissão para esta ação.'
      });
    }

    next();
  };
};

export const requireSuperAdmin = requireRoles('SUPER_ADMIN');
export const requireAdmin = requireRoles('SUPER_ADMIN', 'ADMIN');
export const requireSecretaria = requireRoles('SUPER_ADMIN', 'ADMIN', 'SECRETARIA');
export const requireProfessor = requireRoles('SUPER_ADMIN', 'ADMIN', 'PROFESSOR');
export const requireAluno = requireRoles('SUPER_ADMIN', 'ADMIN', 'SECRETARIA', 'PROFESSOR', 'ALUNO');
`);

  // ============================================================
  // ARQUIVO: src/middleware/validation.middleware.ts
  // ============================================================
  addSection('ARQUIVO: src/middleware/validation.middleware.ts', `
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          error: 'Dados inválidos',
          details: errors
        });
      }

      next(error);
    }
  };
};

export const validateBody = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }));

        return res.status(400).json({
          error: 'Dados inválidos',
          details: errors
        });
      }

      next(error);
    }
  };
};
`);

  // ============================================================
  // ARQUIVO: src/middleware/error.middleware.ts
  // ============================================================
  addSection('ARQUIVO: src/middleware/error.middleware.ts', `
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error occurred', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method
  });

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.message
    });
  }

  // Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    if (prismaError.code === 'P2002') {
      return res.status(409).json({
        error: 'Registro duplicado. Este valor já existe.'
      });
    }

    if (prismaError.code === 'P2025') {
      return res.status(404).json({
        error: 'Registro não encontrado.'
      });
    }
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Token inválido'
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expirado'
    });
  }

  // Default error
  return res.status(500).json({
    error: process.env.NODE_ENV === 'development' 
      ? error.message 
      : 'Erro interno do servidor'
  });
};
`);

  // ============================================================
  // ARQUIVO: src/utils/logger.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/utils/logger.ts', `
type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: any;
}

class Logger {
  private formatLog(level: LogLevel, message: string, data?: any): LogEntry {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      data
    };
  }

  private output(entry: LogEntry): void {
    const color = {
      info: '\\x1b[36m',    // Cyan
      warn: '\\x1b[33m',    // Yellow
      error: '\\x1b[31m',   // Red
      debug: '\\x1b[35m'    // Magenta
    };
    const reset = '\\x1b[0m';

    const logString = \`\${color[entry.level]}[\${entry.level.toUpperCase()}]\${reset} \${entry.timestamp} - \${entry.message}\`;
    
    if (entry.data) {
      console.log(logString, JSON.stringify(entry.data, null, 2));
    } else {
      console.log(logString);
    }
  }

  info(message: string, data?: any): void {
    this.output(this.formatLog('info', message, data));
  }

  warn(message: string, data?: any): void {
    this.output(this.formatLog('warn', message, data));
  }

  error(message: string, data?: any): void {
    this.output(this.formatLog('error', message, data));
  }

  debug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      this.output(this.formatLog('debug', message, data));
    }
  }
}

export const logger = new Logger();
`);

  // ============================================================
  // ARQUIVO: src/dto/auth.dto.ts
  // ============================================================
  addSection('ARQUIVO: src/dto/auth.dto.ts', `
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres')
});

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string()
    .min(6, 'Senha deve ter no mínimo 6 caracteres')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
  nome_completo: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  instituicao_id: z.string().uuid().optional(),
  role: z.enum(['ALUNO', 'PROFESSOR', 'SECRETARIA', 'ADMIN']).optional()
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token é obrigatório')
});

export type LoginDTO = z.infer<typeof loginSchema>;
export type RegisterDTO = z.infer<typeof registerSchema>;
export type RefreshTokenDTO = z.infer<typeof refreshTokenSchema>;
`);

  // ============================================================
  // ARQUIVO: src/controllers/auth.controller.ts
  // ============================================================
  addSection('ARQUIVO: src/controllers/auth.controller.ts', `
import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { LoginDTO, RegisterDTO, RefreshTokenDTO } from '../dto/auth.dto';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body as LoginDTO;

      const result = await authService.login(email, password);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Login failed', { error: error.message });
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data = req.body as RegisterDTO;

      const result = await authService.register(data);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Usuário registrado com sucesso'
      });
    } catch (error: any) {
      logger.error('Registration failed', { error: error.message });
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body as RefreshTokenDTO;

      const result = await authService.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      logger.error('Token refresh failed', { error: error.message });
      res.status(401).json({
        success: false,
        error: error.message
      });
    }
  }

  async logout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.userId;
      const { refreshToken } = req.body;

      await authService.logout(userId, refreshToken);

      res.json({
        success: true,
        message: 'Logout realizado com sucesso'
      });
    } catch (error: any) {
      logger.error('Logout failed', { error: error.message });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async me(req: AuthRequest, res: Response) {
    res.json({
      success: true,
      data: req.user
    });
  }
}

export const authController = new AuthController();
`);

  // ============================================================
  // ARQUIVO: src/routes/auth.routes.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/routes/auth.routes.ts', `
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { loginSchema, registerSchema, refreshTokenSchema } from '../dto/auth.dto';

const router = Router();

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), authController.login);

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), authController.register);

// POST /api/auth/refresh
router.post('/refresh', validateBody(refreshTokenSchema), authController.refresh);

// POST /api/auth/logout (autenticado)
router.post('/logout', authMiddleware, authController.logout);

// GET /api/auth/me (autenticado)
router.get('/me', authMiddleware, authController.me);

export default router;
`);

  // ============================================================
  // ARQUIVO: src/controllers/aluno.controller.ts
  // ============================================================
  addSection('ARQUIVO: src/controllers/aluno.controller.ts', `
import { Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export class AlunoController {
  async listar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '20', search, status } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const where: any = {
        roles: { has: 'ALUNO' }
      };

      // Filtrar por instituição se não for SUPER_ADMIN
      if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
        where.instituicao_id = req.user!.instituicaoId;
      }

      if (search) {
        where.OR = [
          { nome_completo: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } },
          { numero_identificacao: { contains: search as string, mode: 'insensitive' } }
        ];
      }

      if (status) {
        where.status_aluno = status;
      }

      const [alunos, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limitNum,
          select: {
            id: true,
            email: true,
            nome_completo: true,
            numero_identificacao: true,
            numero_identificacao_publica: true,
            telefone: true,
            data_nascimento: true,
            genero: true,
            status_aluno: true,
            avatar_url: true,
            created_at: true,
            matriculas: {
              include: {
                turma: {
                  include: { curso: true }
                }
              }
            }
          },
          orderBy: { created_at: 'desc' }
        }),
        prisma.user.count({ where })
      ]);

      res.json({
        success: true,
        data: alunos,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      });
    } catch (error: any) {
      logger.error('Error listing students', { error: error.message });
      next(error);
    }
  }

  async buscar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const aluno = await prisma.user.findFirst({
        where: {
          id,
          roles: { has: 'ALUNO' }
        },
        include: {
          matriculas: {
            include: {
              turma: {
                include: { curso: true }
              }
            }
          },
          notas: {
            include: { disciplina: true }
          },
          mensalidades: true
        }
      });

      if (!aluno) {
        return res.status(404).json({
          success: false,
          error: 'Aluno não encontrado'
        });
      }

      res.json({
        success: true,
        data: aluno
      });
    } catch (error: any) {
      logger.error('Error fetching student', { error: error.message });
      next(error);
    }
  }

  async criar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { email, password, nome_completo, ...dadosAluno } = req.body;

      // Import auth service for password hashing
      const { authService } = await import('../services/auth.service');
      const senha_hash = await authService.hashPassword(password || 'Aluno@123');

      const aluno = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          senha_hash,
          nome_completo,
          roles: ['ALUNO'],
          instituicao_id: req.user!.instituicaoId,
          ...dadosAluno
        }
      });

      logger.info('Student created', { alunoId: aluno.id, by: req.user!.userId });

      res.status(201).json({
        success: true,
        data: {
          id: aluno.id,
          email: aluno.email,
          nome_completo: aluno.nome_completo
        },
        message: 'Aluno cadastrado com sucesso'
      });
    } catch (error: any) {
      logger.error('Error creating student', { error: error.message });
      next(error);
    }
  }

  async atualizar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const dados = req.body;

      // Remove campos que não devem ser atualizados diretamente
      delete dados.senha_hash;
      delete dados.roles;

      const aluno = await prisma.user.update({
        where: { id },
        data: dados
      });

      logger.info('Student updated', { alunoId: id, by: req.user!.userId });

      res.json({
        success: true,
        data: aluno,
        message: 'Aluno atualizado com sucesso'
      });
    } catch (error: any) {
      logger.error('Error updating student', { error: error.message });
      next(error);
    }
  }

  async deletar(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      // Soft delete - desativar em vez de excluir
      await prisma.user.update({
        where: { id },
        data: { ativo: false }
      });

      logger.info('Student deleted', { alunoId: id, by: req.user!.userId });

      res.json({
        success: true,
        message: 'Aluno removido com sucesso'
      });
    } catch (error: any) {
      logger.error('Error deleting student', { error: error.message });
      next(error);
    }
  }
}

export const alunoController = new AlunoController();
`);

  // ============================================================
  // ARQUIVO: src/routes/aluno.routes.ts
  // ============================================================
  addSection('ARQUIVO: src/routes/aluno.routes.ts', `
import { Router } from 'express';
import { alunoController } from '../controllers/aluno.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireSecretaria, requireAdmin } from '../middleware/role.middleware';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/alunos - Listar alunos
router.get('/', requireSecretaria, alunoController.listar);

// GET /api/alunos/:id - Buscar aluno por ID
router.get('/:id', requireSecretaria, alunoController.buscar);

// POST /api/alunos - Criar aluno
router.post('/', requireSecretaria, alunoController.criar);

// PUT /api/alunos/:id - Atualizar aluno
router.put('/:id', requireSecretaria, alunoController.atualizar);

// DELETE /api/alunos/:id - Deletar aluno
router.delete('/:id', requireAdmin, alunoController.deletar);

export default router;
`);

  // ============================================================
  // ARQUIVO: src/routes/curso.routes.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/routes/curso.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAdmin } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/cursos
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = {};
    
    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
      where.instituicao_id = req.user!.instituicaoId;
    }

    const cursos = await prisma.curso.findMany({
      where,
      include: {
        disciplinas: true,
        turmas: true
      },
      orderBy: { nome: 'asc' }
    });

    res.json({ success: true, data: cursos });
  } catch (error: any) {
    logger.error('Error listing courses', { error: error.message });
    next(error);
  }
});

// GET /api/cursos/:id
router.get('/:id', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const curso = await prisma.curso.findUnique({
      where: { id },
      include: {
        disciplinas: true,
        turmas: {
          include: { professor: true }
        }
      }
    });

    if (!curso) {
      return res.status(404).json({ success: false, error: 'Curso não encontrado' });
    }

    res.json({ success: true, data: curso });
  } catch (error: any) {
    logger.error('Error fetching course', { error: error.message });
    next(error);
  }
});

// POST /api/cursos
router.post('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const curso = await prisma.curso.create({
      data: {
        ...req.body,
        instituicao_id: req.user!.instituicaoId
      }
    });

    logger.info('Course created', { cursoId: curso.id, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: curso,
      message: 'Curso criado com sucesso'
    });
  } catch (error: any) {
    logger.error('Error creating course', { error: error.message });
    next(error);
  }
});

// PUT /api/cursos/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const curso = await prisma.curso.update({
      where: { id },
      data: req.body
    });

    logger.info('Course updated', { cursoId: id, by: req.user!.userId });

    res.json({ success: true, data: curso, message: 'Curso atualizado com sucesso' });
  } catch (error: any) {
    logger.error('Error updating course', { error: error.message });
    next(error);
  }
});

// DELETE /api/cursos/:id
router.delete('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.curso.update({
      where: { id },
      data: { ativo: false }
    });

    logger.info('Course deleted', { cursoId: id, by: req.user!.userId });

    res.json({ success: true, message: 'Curso removido com sucesso' });
  } catch (error: any) {
    logger.error('Error deleting course', { error: error.message });
    next(error);
  }
});

export default router;
`);

  // ============================================================
  // ARQUIVO: src/routes/turma.routes.ts
  // ============================================================
  addSection('ARQUIVO: src/routes/turma.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAdmin, requireProfessor } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/turmas
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { ano_letivo, curso_id, ativa } = req.query;
    const where: any = {};

    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
      where.instituicao_id = req.user!.instituicaoId;
    }

    if (ano_letivo) where.ano_letivo = parseInt(ano_letivo as string);
    if (curso_id) where.curso_id = curso_id;
    if (ativa !== undefined) where.ativa = ativa === 'true';

    const turmas = await prisma.turma.findMany({
      where,
      include: {
        curso: true,
        professor: {
          select: { id: true, nome_completo: true, email: true }
        },
        _count: {
          select: { matriculas: true }
        }
      },
      orderBy: [{ ano_letivo: 'desc' }, { nome: 'asc' }]
    });

    res.json({ success: true, data: turmas });
  } catch (error: any) {
    logger.error('Error listing classes', { error: error.message });
    next(error);
  }
});

// GET /api/turmas/professor - Turmas do professor logado
router.get('/professor', requireProfessor, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const turmas = await prisma.turma.findMany({
      where: {
        professor_id: req.user!.userId,
        ativa: true
      },
      include: {
        curso: true,
        matriculas: {
          include: {
            aluno: {
              select: { id: true, nome_completo: true, email: true, avatar_url: true }
            }
          }
        }
      }
    });

    res.json({ success: true, data: turmas });
  } catch (error: any) {
    logger.error('Error listing professor classes', { error: error.message });
    next(error);
  }
});

// POST /api/turmas
router.post('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const turma = await prisma.turma.create({
      data: {
        ...req.body,
        instituicao_id: req.user!.instituicaoId
      }
    });

    logger.info('Class created', { turmaId: turma.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: turma, message: 'Turma criada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating class', { error: error.message });
    next(error);
  }
});

// PUT /api/turmas/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const turma = await prisma.turma.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: turma, message: 'Turma atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating class', { error: error.message });
    next(error);
  }
});

export default router;
`);

  // ============================================================
  // ARQUIVO: src/routes/nota.routes.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/routes/nota.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireProfessor, requireAluno } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/notas/aluno/:alunoId - Notas de um aluno
router.get('/aluno/:alunoId', requireAluno, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { alunoId } = req.params;
    const { ano_letivo, trimestre } = req.query;

    // Aluno só pode ver suas próprias notas
    if (req.user!.roles.includes('ALUNO') && req.user!.userId !== alunoId) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const where: any = { aluno_id: alunoId };
    if (ano_letivo) where.ano_letivo = parseInt(ano_letivo as string);
    if (trimestre) where.trimestre = parseInt(trimestre as string);

    const notas = await prisma.nota.findMany({
      where,
      include: {
        disciplina: true
      },
      orderBy: [{ disciplina: { nome: 'asc' } }, { created_at: 'desc' }]
    });

    res.json({ success: true, data: notas });
  } catch (error: any) {
    logger.error('Error fetching grades', { error: error.message });
    next(error);
  }
});

// POST /api/notas - Lançar nota
router.post('/', requireProfessor, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const nota = await prisma.nota.create({
      data: req.body
    });

    logger.info('Grade created', { notaId: nota.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: nota, message: 'Nota lançada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating grade', { error: error.message });
    next(error);
  }
});

// PUT /api/notas/:id
router.put('/:id', requireProfessor, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const nota = await prisma.nota.update({
      where: { id },
      data: req.body
    });

    logger.info('Grade updated', { notaId: id, by: req.user!.userId });

    res.json({ success: true, data: nota, message: 'Nota atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating grade', { error: error.message });
    next(error);
  }
});

// POST /api/notas/bulk - Lançar várias notas de uma vez
router.post('/bulk', requireProfessor, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { notas } = req.body;

    const result = await prisma.nota.createMany({
      data: notas,
      skipDuplicates: true
    });

    logger.info('Bulk grades created', { count: result.count, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: { count: result.count },
      message: \`\${result.count} notas lançadas com sucesso\`
    });
  } catch (error: any) {
    logger.error('Error creating bulk grades', { error: error.message });
    next(error);
  }
});

export default router;
`);

  // ============================================================
  // ARQUIVO: src/routes/mensalidade.routes.ts
  // ============================================================
  addSection('ARQUIVO: src/routes/mensalidade.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAluno } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/mensalidades - Listar todas as mensalidades
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { status, ano_referencia, mes_referencia, aluno_id } = req.query;
    const where: any = {};

    if (status) where.status = status;
    if (ano_referencia) where.ano_referencia = parseInt(ano_referencia as string);
    if (mes_referencia) where.mes_referencia = mes_referencia;
    if (aluno_id) where.aluno_id = aluno_id;

    const mensalidades = await prisma.mensalidade.findMany({
      where,
      include: {
        aluno: {
          select: { id: true, nome_completo: true, email: true }
        }
      },
      orderBy: [{ ano_referencia: 'desc' }, { data_vencimento: 'desc' }]
    });

    res.json({ success: true, data: mensalidades });
  } catch (error: any) {
    logger.error('Error listing tuitions', { error: error.message });
    next(error);
  }
});

// GET /api/mensalidades/minhas - Mensalidades do aluno logado
router.get('/minhas', requireAluno, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mensalidades = await prisma.mensalidade.findMany({
      where: { aluno_id: req.user!.userId },
      orderBy: [{ ano_referencia: 'desc' }, { data_vencimento: 'desc' }]
    });

    res.json({ success: true, data: mensalidades });
  } catch (error: any) {
    logger.error('Error fetching my tuitions', { error: error.message });
    next(error);
  }
});

// POST /api/mensalidades - Criar mensalidade
router.post('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const mensalidade = await prisma.mensalidade.create({
      data: req.body
    });

    logger.info('Tuition created', { mensalidadeId: mensalidade.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: mensalidade, message: 'Mensalidade criada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating tuition', { error: error.message });
    next(error);
  }
});

// PUT /api/mensalidades/:id - Atualizar mensalidade (registrar pagamento)
router.put('/:id', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const mensalidade = await prisma.mensalidade.update({
      where: { id },
      data: req.body
    });

    logger.info('Tuition updated', { mensalidadeId: id, by: req.user!.userId });

    res.json({ success: true, data: mensalidade, message: 'Mensalidade atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating tuition', { error: error.message });
    next(error);
  }
});

// POST /api/mensalidades/gerar - Gerar mensalidades em massa
router.post('/gerar', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { mes_referencia, ano_referencia, valor, data_vencimento, turma_id } = req.body;

    // Buscar alunos matriculados na turma
    const matriculas = await prisma.matricula.findMany({
      where: { turma_id, status: 'Ativa' },
      select: { aluno_id: true }
    });

    const mensalidades = matriculas.map(m => ({
      aluno_id: m.aluno_id,
      mes_referencia,
      ano_referencia,
      valor,
      data_vencimento: new Date(data_vencimento)
    }));

    const result = await prisma.mensalidade.createMany({
      data: mensalidades,
      skipDuplicates: true
    });

    logger.info('Bulk tuitions created', { count: result.count, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: { count: result.count },
      message: \`\${result.count} mensalidades geradas com sucesso\`
    });
  } catch (error: any) {
    logger.error('Error generating tuitions', { error: error.message });
    next(error);
  }
});

export default router;
`);

  // ============================================================
  // OUTROS ARQUIVOS DE ROTAS
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/routes/professor.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAdmin } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/professores
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { roles: { has: 'PROFESSOR' } };
    
    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
      where.instituicao_id = req.user!.instituicaoId;
    }

    const professores = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        nome_completo: true,
        numero_identificacao: true,
        telefone: true,
        ativo: true,
        created_at: true,
        turmas_professor: {
          include: { curso: true }
        }
      },
      orderBy: { nome_completo: 'asc' }
    });

    res.json({ success: true, data: professores });
  } catch (error: any) {
    logger.error('Error listing professors', { error: error.message });
    next(error);
  }
});

// POST /api/professores
router.post('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, nome_completo, ...dados } = req.body;

    const { authService } = await import('../services/auth.service');
    const senha_hash = await authService.hashPassword(password || 'Professor@123');

    const professor = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        senha_hash,
        nome_completo,
        roles: ['PROFESSOR'],
        instituicao_id: req.user!.instituicaoId,
        ...dados
      }
    });

    logger.info('Professor created', { professorId: professor.id, by: req.user!.userId });

    res.status(201).json({
      success: true,
      data: { id: professor.id, email: professor.email, nome_completo: professor.nome_completo },
      message: 'Professor cadastrado com sucesso'
    });
  } catch (error: any) {
    logger.error('Error creating professor', { error: error.message });
    next(error);
  }
});

// PUT /api/professores/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const dados = req.body;
    delete dados.senha_hash;
    delete dados.roles;

    const professor = await prisma.user.update({
      where: { id },
      data: dados
    });

    res.json({ success: true, data: professor, message: 'Professor atualizado com sucesso' });
  } catch (error: any) {
    logger.error('Error updating professor', { error: error.message });
    next(error);
  }
});

export default router;
`);

  addSection('ARQUIVO: src/routes/matricula.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/matriculas
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { turma_id, aluno_id, status } = req.query;
    const where: any = {};

    if (turma_id) where.turma_id = turma_id;
    if (aluno_id) where.aluno_id = aluno_id;
    if (status) where.status = status;

    const matriculas = await prisma.matricula.findMany({
      where,
      include: {
        aluno: { select: { id: true, nome_completo: true, email: true } },
        turma: { include: { curso: true } }
      },
      orderBy: { data_matricula: 'desc' }
    });

    res.json({ success: true, data: matriculas });
  } catch (error: any) {
    logger.error('Error listing enrollments', { error: error.message });
    next(error);
  }
});

// POST /api/matriculas
router.post('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const matricula = await prisma.matricula.create({
      data: req.body,
      include: {
        aluno: { select: { id: true, nome_completo: true } },
        turma: { include: { curso: true } }
      }
    });

    logger.info('Enrollment created', { matriculaId: matricula.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: matricula, message: 'Matrícula realizada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating enrollment', { error: error.message });
    next(error);
  }
});

// PUT /api/matriculas/:id
router.put('/:id', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const matricula = await prisma.matricula.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: matricula, message: 'Matrícula atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating enrollment', { error: error.message });
    next(error);
  }
});

export default router;
`);

  addSection('ARQUIVO: src/routes/disciplina.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAdmin } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/disciplinas
router.get('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { curso_id } = req.query;
    const where: any = {};

    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
      where.instituicao_id = req.user!.instituicaoId;
    }
    if (curso_id) where.curso_id = curso_id;

    const disciplinas = await prisma.disciplina.findMany({
      where,
      include: { curso: true },
      orderBy: [{ curso: { nome: 'asc' } }, { semestre: 'asc' }, { nome: 'asc' }]
    });

    res.json({ success: true, data: disciplinas });
  } catch (error: any) {
    logger.error('Error listing subjects', { error: error.message });
    next(error);
  }
});

// POST /api/disciplinas
router.post('/', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const disciplina = await prisma.disciplina.create({
      data: {
        ...req.body,
        instituicao_id: req.user!.instituicaoId
      }
    });

    res.status(201).json({ success: true, data: disciplina, message: 'Disciplina criada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating subject', { error: error.message });
    next(error);
  }
});

// PUT /api/disciplinas/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const disciplina = await prisma.disciplina.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: disciplina, message: 'Disciplina atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating subject', { error: error.message });
    next(error);
  }
});

export default router;
`);

  addPage();
  addSection('ARQUIVO: src/routes/comunicado.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSecretaria, requireAluno } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/comunicados
router.get('/', requireAluno, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const where: any = { ativo: true };

    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId) {
      where.OR = [
        { instituicao_id: req.user!.instituicaoId },
        { instituicao_id: null }
      ];
    }

    const comunicados = await prisma.comunicado.findMany({
      where,
      include: {
        autor: { select: { nome_completo: true } }
      },
      orderBy: { data_publicacao: 'desc' }
    });

    res.json({ success: true, data: comunicados });
  } catch (error: any) {
    logger.error('Error listing announcements', { error: error.message });
    next(error);
  }
});

// POST /api/comunicados
router.post('/', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const comunicado = await prisma.comunicado.create({
      data: {
        ...req.body,
        autor_id: req.user!.userId,
        instituicao_id: req.user!.instituicaoId
      }
    });

    logger.info('Announcement created', { comunicadoId: comunicado.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: comunicado, message: 'Comunicado criado com sucesso' });
  } catch (error: any) {
    logger.error('Error creating announcement', { error: error.message });
    next(error);
  }
});

// PUT /api/comunicados/:id
router.put('/:id', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const comunicado = await prisma.comunicado.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: comunicado, message: 'Comunicado atualizado com sucesso' });
  } catch (error: any) {
    logger.error('Error updating announcement', { error: error.message });
    next(error);
  }
});

// DELETE /api/comunicados/:id
router.delete('/:id', requireSecretaria, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    await prisma.comunicado.update({
      where: { id },
      data: { ativo: false }
    });

    res.json({ success: true, message: 'Comunicado removido com sucesso' });
  } catch (error: any) {
    logger.error('Error deleting announcement', { error: error.message });
    next(error);
  }
});

export default router;
`);

  addSection('ARQUIVO: src/routes/instituicao.routes.ts', `
import { Router } from 'express';
import { prisma } from '../services/prisma.service';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { requireSuperAdmin, requireAdmin } from '../middleware/role.middleware';
import { Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

// GET /api/instituicoes
router.get('/', requireSuperAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instituicoes = await prisma.instituicao.findMany({
      include: {
        _count: {
          select: {
            usuarios: true,
            cursos: true,
            turmas: true
          }
        }
      },
      orderBy: { nome: 'asc' }
    });

    res.json({ success: true, data: instituicoes });
  } catch (error: any) {
    logger.error('Error listing institutions', { error: error.message });
    next(error);
  }
});

// GET /api/instituicoes/minha
router.get('/minha', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user!.instituicaoId) {
      return res.status(404).json({ success: false, error: 'Instituição não encontrada' });
    }

    const instituicao = await prisma.instituicao.findUnique({
      where: { id: req.user!.instituicaoId },
      include: {
        _count: {
          select: {
            usuarios: true,
            cursos: true,
            turmas: true
          }
        }
      }
    });

    res.json({ success: true, data: instituicao });
  } catch (error: any) {
    logger.error('Error fetching institution', { error: error.message });
    next(error);
  }
});

// POST /api/instituicoes
router.post('/', requireSuperAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const instituicao = await prisma.instituicao.create({
      data: req.body
    });

    logger.info('Institution created', { instituicaoId: instituicao.id, by: req.user!.userId });

    res.status(201).json({ success: true, data: instituicao, message: 'Instituição criada com sucesso' });
  } catch (error: any) {
    logger.error('Error creating institution', { error: error.message });
    next(error);
  }
});

// PUT /api/instituicoes/:id
router.put('/:id', requireAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Verificar permissão
    if (!req.user!.roles.includes('SUPER_ADMIN') && req.user!.instituicaoId !== id) {
      return res.status(403).json({ success: false, error: 'Acesso negado' });
    }

    const instituicao = await prisma.instituicao.update({
      where: { id },
      data: req.body
    });

    res.json({ success: true, data: instituicao, message: 'Instituição atualizada com sucesso' });
  } catch (error: any) {
    logger.error('Error updating institution', { error: error.message });
    next(error);
  }
});

export default router;
`);

  // ============================================================
  // ARQUIVO: src/types/express.d.ts
  // ============================================================
  addPage();
  addSection('ARQUIVO: src/types/express.d.ts', `
declare namespace Express {
  export interface Request {
    user?: {
      userId: string;
      email: string;
      roles: string[];
      instituicaoId: string | null;
    };
  }
}
`);

  // ============================================================
  // ARQUIVO: src/services/email.service.ts
  // ============================================================
  addSection('ARQUIVO: src/services/email.service.ts', `
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Para produção, use o Resend ou outro serviço
    if (process.env.RESEND_API_KEY) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.resend.com',
        port: 465,
        secure: true,
        auth: {
          user: 'resend',
          pass: process.env.RESEND_API_KEY
        }
      });
    } else {
      // Para desenvolvimento, use um servidor SMTP local ou Ethereal
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        auth: {
          user: 'ethereal.user@ethereal.email',
          pass: 'etherealpass'
        }
      });
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@dsicola.com',
        to: options.to,
        subject: options.subject,
        html: options.html
      });

      logger.info('Email sent', { messageId: info.messageId, to: options.to });
      return true;
    } catch (error: any) {
      logger.error('Failed to send email', { error: error.message, to: options.to });
      return false;
    }
  }

  async sendPasswordReset(email: string, name: string, newPassword: string): Promise<boolean> {
    return this.send({
      to: email,
      subject: 'DSICOLA - Nova Senha de Acesso',
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">DSICOLA - Sistema de Gestão Escolar</h2>
          <p>Olá, <strong>\${name}</strong>!</p>
          <p>Sua senha foi redefinida. Seguem os dados de acesso:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> \${email}</p>
            <p><strong>Nova Senha:</strong> \${newPassword}</p>
          </div>
          <p>Recomendamos que altere sua senha após o primeiro acesso.</p>
          <p style="color: #666; font-size: 12px;">Este é um email automático. Não responda.</p>
        </div>
      \`
    });
  }

  async sendWelcome(email: string, name: string, password: string, role: string): Promise<boolean> {
    return this.send({
      to: email,
      subject: 'Bem-vindo ao DSICOLA!',
      html: \`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #8B5CF6;">Bem-vindo ao DSICOLA!</h2>
          <p>Olá, <strong>\${name}</strong>!</p>
          <p>Sua conta foi criada com sucesso. Seguem os dados de acesso:</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Email:</strong> \${email}</p>
            <p><strong>Senha:</strong> \${password}</p>
            <p><strong>Perfil:</strong> \${role}</p>
          </div>
          <p>Acesse o portal e altere sua senha no primeiro acesso.</p>
          <p style="color: #666; font-size: 12px;">Este é um email automático. Não responda.</p>
        </div>
      \`
    });
  }
}

export const emailService = new EmailService();
`);

  // ============================================================
  // EXEMPLOS DE REQUISIÇÕES
  // ============================================================
  addPage();
  addTitle('EXEMPLOS DE REQUISIÇÕES HTTP', 16);

  addCode(`
# ============================================================
# 1. REGISTRO DE USUÁRIO
# ============================================================
POST http://localhost:3001/api/auth/register
Content-Type: application/json

{
  "email": "aluno@exemplo.com",
  "password": "Senha@123",
  "nome_completo": "João da Silva",
  "role": "ALUNO"
}

# Resposta esperada:
{
  "success": true,
  "data": {
    "id": "uuid-do-usuario",
    "email": "aluno@exemplo.com"
  },
  "message": "Usuário registrado com sucesso"
}

# ============================================================
# 2. LOGIN
# ============================================================
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "email": "aluno@exemplo.com",
  "password": "Senha@123"
}

# Resposta esperada:
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "uuid-do-usuario",
      "email": "aluno@exemplo.com",
      "nome_completo": "João da Silva",
      "roles": ["ALUNO"],
      "instituicao_id": null
    }
  }
}

# ============================================================
# 3. ACESSAR ROTA PROTEGIDA (usando o token)
# ============================================================
GET http://localhost:3001/api/auth/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Resposta esperada:
{
  "success": true,
  "data": {
    "userId": "uuid-do-usuario",
    "email": "aluno@exemplo.com",
    "roles": ["ALUNO"],
    "instituicaoId": null
  }
}

# ============================================================
# 4. REFRESH TOKEN
# ============================================================
POST http://localhost:3001/api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}

# Resposta esperada:
{
  "success": true,
  "data": {
    "accessToken": "novo-access-token...",
    "refreshToken": "novo-refresh-token..."
  }
}

# ============================================================
# 5. LISTAR ALUNOS (rota protegida - requer SECRETARIA ou superior)
# ============================================================
GET http://localhost:3001/api/alunos?page=1&limit=20
Authorization: Bearer <token-de-secretaria-ou-admin>

# Resposta esperada:
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}

# ============================================================
# 6. CRIAR ALUNO (rota protegida - requer SECRETARIA ou superior)
# ============================================================
POST http://localhost:3001/api/alunos
Authorization: Bearer <token-de-secretaria-ou-admin>
Content-Type: application/json

{
  "email": "novo.aluno@exemplo.com",
  "nome_completo": "Maria Santos",
  "numero_identificacao": "123456789LA123",
  "telefone": "923456789",
  "data_nascimento": "2000-01-15",
  "genero": "Feminino"
}

# ============================================================
# 7. LOGOUT
# ============================================================
POST http://localhost:3001/api/auth/logout
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "refreshToken": "refresh-token-para-invalidar"
}
`);

  // ============================================================
  // README.md
  // ============================================================
  addPage();
  addSection('ARQUIVO: README.md', `
# DSICOLA Backend

Backend do Sistema de Gestão Escolar DSICOLA.

## Tecnologias

- Node.js + Express
- TypeScript
- Prisma ORM
- PostgreSQL
- JWT (jsonwebtoken)
- bcrypt para hash de senhas
- Zod para validação
- Helmet para segurança
- Rate Limiting

## Instalação

\`\`\`bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Editar .env com suas configurações

# 3. Gerar cliente Prisma
npx prisma generate

# 4. Executar migrações
npx prisma migrate dev --name init

# 5. Iniciar servidor em desenvolvimento
npm run dev

# 6. Build para produção
npm run build
npm start
\`\`\`

## Estrutura de Rotas

| Método | Rota | Descrição | Roles Permitidas |
|--------|------|-----------|------------------|
| POST | /api/auth/login | Login | Público |
| POST | /api/auth/register | Registro | Público |
| POST | /api/auth/refresh | Refresh token | Público |
| POST | /api/auth/logout | Logout | Autenticado |
| GET | /api/auth/me | Dados do usuário | Autenticado |
| GET | /api/alunos | Listar alunos | SECRETARIA+ |
| POST | /api/alunos | Criar aluno | SECRETARIA+ |
| GET | /api/cursos | Listar cursos | SECRETARIA+ |
| POST | /api/cursos | Criar curso | ADMIN+ |
| GET | /api/turmas | Listar turmas | SECRETARIA+ |
| GET | /api/turmas/professor | Turmas do professor | PROFESSOR |

## Segurança

- Senhas criptografadas com bcrypt (12 rounds)
- Access Token expira em 15 minutos
- Refresh Token expira em 7 dias
- Rate limiting: 100 requisições por 15 minutos
- Helmet para headers de segurança
- CORS configurado
- Bloqueio após 5 tentativas de login falhas

## Roles do Sistema

- SUPER_ADMIN: Acesso total
- ADMIN: Gestão da instituição
- SECRETARIA: Gestão acadêmica
- PROFESSOR: Acesso a turmas e notas
- ALUNO: Acesso aos próprios dados
- RESPONSAVEL: Acesso aos dados do educando
`);

  // ============================================================
  // SALVAR PDF
  // ============================================================
  doc.save('DSICOLA_Backend_Completo.pdf');
};
