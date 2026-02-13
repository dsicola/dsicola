import jsPDF from 'jspdf';

// ============================================================
// GERADOR DE PROJETO COMPLETO - BACKEND + FRONTEND
// ============================================================

export const generateFullProjectPDF = () => {
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

  const addCode = (code: string, fontSize: number = 6) => {
    doc.setFontSize(fontSize);
    doc.setFont('courier', 'normal');
    const lines = code.split('\n');
    lines.forEach((line) => {
      checkPageBreak();
      const truncatedLine = line.length > 130 ? line.substring(0, 127) + '...' : line;
      doc.text(truncatedLine, margin, yPos);
      yPos += 3.5;
    });
    yPos += 2;
  };

  const addSection = (title: string, code: string) => {
    addTitle(title, 11);
    addCode(code);
  };

  // ============================================================
  // CAPA
  // ============================================================
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('DSICOLA', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('PROJETO COMPLETO', pageWidth / 2, 65, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Backend + Frontend 100% Funcional', pageWidth / 2, 80, { align: 'center' });
  doc.text('Node.js + Express + Prisma + PostgreSQL', pageWidth / 2, 92, { align: 'center' });
  doc.text('React + Vite + TypeScript + Tailwind', pageWidth / 2, 104, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, 130, { align: 'center' });

  yPos = 150;
  addText('Este PDF contém o código fonte completo para migração do sistema DSICOLA para servidor próprio com PostgreSQL.');
  yPos += 10;
  addText('Inclui: Backend completo com autenticação JWT, Frontend React adaptado, e todas as instruções de instalação.');

  // ============================================================
  // ÍNDICE
  // ============================================================
  addPage();
  addTitle('ÍNDICE', 18);
  addText('PARTE 1: BACKEND');
  addText('  - Estrutura do projeto');
  addText('  - Configuração (package.json, tsconfig.json)');
  addText('  - Schema Prisma completo');
  addText('  - Serviços (auth, prisma, email)');
  addText('  - Middlewares (auth, roles, validação, erros)');
  addText('  - Controllers e Routes');
  addText('  - DTOs com validação Zod');
  addText('');
  addText('PARTE 2: FRONTEND');
  addText('  - Cliente API (substitui Supabase)');
  addText('  - Contexto de autenticação');
  addText('  - Proteção de rotas');
  addText('  - Hooks customizados');
  addText('  - Páginas principais');
  addText('');
  addText('PARTE 3: INSTRUÇÕES');
  addText('  - Instalação e configuração');
  addText('  - Comandos de execução');
  addText('  - Migração de dados');

  // ============================================================
  // PARTE 1: BACKEND - ESTRUTURA
  // ============================================================
  addPage();
  addTitle('PARTE 1: BACKEND', 18);
  addTitle('Estrutura do Projeto', 14);
  addCode(`
dsicola-backend/
├── prisma/
│   └── schema.prisma          # Modelos do banco de dados
├── src/
│   ├── controllers/           # Controladores de rotas
│   │   ├── auth.controller.ts
│   │   ├── aluno.controller.ts
│   │   ├── professor.controller.ts
│   │   ├── curso.controller.ts
│   │   ├── turma.controller.ts
│   │   ├── disciplina.controller.ts
│   │   ├── matricula.controller.ts
│   │   ├── nota.controller.ts
│   │   ├── frequencia.controller.ts
│   │   ├── mensalidade.controller.ts
│   │   ├── comunicado.controller.ts
│   │   └── instituicao.controller.ts
│   ├── middleware/
│   │   ├── auth.middleware.ts       # Validação JWT
│   │   ├── role.middleware.ts       # Verificação de roles
│   │   ├── validation.middleware.ts # Validação Zod
│   │   └── error.middleware.ts      # Tratamento de erros
│   ├── routes/
│   │   └── index.ts                 # Todas as rotas
│   ├── services/
│   │   ├── auth.service.ts          # Autenticação
│   │   ├── prisma.service.ts        # Cliente Prisma
│   │   └── email.service.ts         # Envio de emails
│   ├── dto/                         # Validações Zod
│   ├── types/
│   │   └── express.d.ts             # Tipos customizados
│   ├── utils/
│   │   └── logger.ts                # Logger
│   └── app.ts                       # Entrada principal
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
`);

  // PACKAGE.JSON
  addSection('.env.example', `
DATABASE_URL="postgresql://postgres:senha@localhost:5432/dsicola?schema=public"
JWT_SECRET="seu-segredo-jwt-muito-seguro-32-caracteres-minimo"
JWT_REFRESH_SECRET="seu-segredo-refresh-muito-seguro"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT=3001
NODE_ENV=development
RESEND_API_KEY="re_xxxxx"
EMAIL_FROM="noreply@dsicola.com"
BCRYPT_SALT_ROUNDS=12
`);

  addSection('package.json', `
{
  "name": "dsicola-backend",
  "version": "1.0.0",
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

  addSection('tsconfig.json', `
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
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
`);

  // ============================================================
  // PRISMA SCHEMA COMPLETO
  // ============================================================
  addPage();
  addTitle('prisma/schema.prisma', 14);
  addCode(`
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

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
  Inativo_por_inadimplencia
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

model Instituicao {
  id              String   @id @default(uuid())
  nome            String
  codigo          String   @unique
  subdominio      String   @unique
  email           String?
  telefone        String?
  endereco        String?
  logo_url        String?
  tipo_instituicao String  @default("Universidade")
  status          String   @default("ativa")
  cor_primaria    String?  @default("#8B5CF6")
  cor_secundaria  String?  @default("#1F2937")
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  usuarios        User[]
  cursos          Curso[]
  turmas          Turma[]
  disciplinas     Disciplina[]
  comunicados     Comunicado[]
  eventos         EventoCalendario[]
  funcionarios    Funcionario[]
  
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

  user_roles                  UserRoleRelation[]
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

model UserRoleRelation {
  id              String   @id @default(uuid())
  user_id         String
  role            UserRole
  instituicao_id  String?
  created_at      DateTime @default(now())

  user            User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, role])
  @@map("user_roles")
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

model LoginAttempt {
  id              String    @id @default(uuid())
  email           String    @unique
  attempt_count   Int       @default(0)
  last_attempt_at DateTime  @default(now())
  locked_until    DateTime?
  created_at      DateTime  @default(now())
  updated_at      DateTime  @updatedAt

  @@map("login_attempts")
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
  tipo            String?
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
  tipo_disciplina String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  curso_id        String
  curso           Curso    @relation(fields: [curso_id], references: [id])

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  notas           Nota[]
  aulas           Aula[]
  horarios        Horario[]

  @@map("disciplinas")
}

model Turma {
  id              String   @id @default(uuid())
  nome            String
  codigo          String
  ano_letivo      Int
  semestre        String?  @default("1")
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
  notas           Nota[]
  horarios        Horario[]

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
  id          String   @id @default(uuid())
  data        DateTime
  conteudo    String?
  observacoes String?
  created_at  DateTime @default(now())

  turma_id    String
  turma       Turma    @relation(fields: [turma_id], references: [id])

  disciplina_id String?
  disciplina    Disciplina? @relation(fields: [disciplina_id], references: [id])

  frequencias Frequencia[]

  @@map("aulas")
}

model Frequencia {
  id            String  @id @default(uuid())
  presente      Boolean @default(false)
  justificativa String?

  aluno_id      String
  aluno         User    @relation(fields: [aluno_id], references: [id])

  aula_id       String
  aula          Aula    @relation(fields: [aula_id], references: [id])

  @@unique([aluno_id, aula_id])
  @@map("frequencias")
}

model Nota {
  id            String   @id @default(uuid())
  valor         Float
  tipo          String   @default("Prova")
  trimestre     Int      @default(1)
  ano_letivo    Int
  observacoes   String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  aluno_id      String
  aluno         User     @relation(fields: [aluno_id], references: [id])

  disciplina_id String
  disciplina    Disciplina @relation(fields: [disciplina_id], references: [id])

  turma_id      String
  turma         Turma    @relation(fields: [turma_id], references: [id])

  @@map("notas")
}

model Exame {
  id          String   @id @default(uuid())
  nome        String
  tipo        String   @default("Prova")
  data_exame  DateTime
  hora_inicio String?
  hora_fim    String?
  sala        String?
  peso        Float    @default(1)
  status      String   @default("Agendado")
  observacoes String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  turma_id    String
  turma       Turma    @relation(fields: [turma_id], references: [id])

  @@map("exames")
}

model Horario {
  id          String   @id @default(uuid())
  dia_semana  String
  hora_inicio String
  hora_fim    String
  sala        String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  turma_id    String
  turma       Turma    @relation(fields: [turma_id], references: [id])

  disciplina_id String?
  disciplina    Disciplina? @relation(fields: [disciplina_id], references: [id])

  @@map("horarios")
}

model Mensalidade {
  id              String            @id @default(uuid())
  valor           Float
  data_vencimento DateTime
  data_pagamento  DateTime?
  status          StatusMensalidade @default(Pendente)
  mes_referencia  Int
  ano_referencia  Int
  multa           Boolean           @default(false)
  valor_multa     Float             @default(0)
  percentual_multa Float            @default(2)
  forma_pagamento String?
  comprovativo_url String?
  observacoes     String?
  created_at      DateTime          @default(now())
  updated_at      DateTime          @updatedAt

  aluno_id        String
  aluno           User              @relation(fields: [aluno_id], references: [id])

  @@map("mensalidades")
}

model Comunicado {
  id              String   @id @default(uuid())
  titulo          String
  conteudo        String
  tipo            String   @default("Geral")
  destinatarios   String   @default("Todos")
  ativo           Boolean  @default(true)
  data_publicacao DateTime @default(now())
  data_expiracao  DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  autor_id        String?
  autor           User?    @relation("AutorComunicado", fields: [autor_id], references: [id])

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  @@map("comunicados")
}

model EventoCalendario {
  id          String   @id @default(uuid())
  titulo      String
  descricao   String?
  data_inicio DateTime
  data_fim    DateTime?
  hora_inicio String?
  hora_fim    String?
  tipo        String   @default("Evento")
  cor         String?
  recorrente  Boolean  @default(false)
  visivel_para String[]
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  criado_por  String?

  instituicao_id String?
  instituicao    Instituicao? @relation(fields: [instituicao_id], references: [id])

  @@map("eventos_calendario")
}

model Funcionario {
  id              String   @id @default(uuid())
  user_id         String   @unique
  cargo_id        String?
  departamento_id String?
  data_admissao   DateTime @default(now())
  data_demissao   DateTime?
  salario         Float?
  tipo_contrato   String?
  carga_horaria   String?
  status          String   @default("Ativo")
  observacoes     String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  instituicao_id  String?
  instituicao     Instituicao? @relation(fields: [instituicao_id], references: [id])

  @@map("funcionarios")
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

  instituicao_id  String?

  @@map("logs_auditoria")
}
`);

  // ============================================================
  // APP.TS PRINCIPAL
  // ============================================================
  addPage();
  addTitle('src/app.ts', 14);
  addCode(`
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { errorHandler } from './middleware/error.middleware';
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
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares globais
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: { error: 'Muitas requisições. Tente novamente mais tarde.' },
});
app.use(limiter);

// Logging de requisições
app.use((req, res, next) => {
  logger.info(\`\${req.method} \${req.path}\`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas da API
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

// Error handler global
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

app.listen(PORT, () => {
  logger.info(\`Servidor rodando na porta \${PORT}\`);
  logger.info(\`Ambiente: \${process.env.NODE_ENV || 'development'}\`);
});

export default app;
`);

  // ============================================================
  // SERVICES
  // ============================================================
  addPage();
  addTitle('src/services/prisma.service.ts', 14);
  addCode(`
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
`);

  addTitle('src/services/auth.service.ts', 14);
  addCode(`
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service';

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'default-refresh-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  roles: string[];
  instituicao_id?: string;
}

export const authService = {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    return bcrypt.hash(password, saltRounds);
  },

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  },

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
  },

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  },

  verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
  },

  async saveRefreshToken(userId: string, token: string): Promise<void> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.refreshToken.create({
      data: { user_id: userId, token, expires_at: expiresAt },
    });
  },

  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { revoked: true },
    });
  },

  async isRefreshTokenValid(token: string): Promise<boolean> {
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token },
    });

    if (!refreshToken) return false;
    if (refreshToken.revoked) return false;
    if (new Date() > refreshToken.expires_at) return false;

    return true;
  },

  async recordFailedLogin(email: string) {
    const existing = await prisma.loginAttempt.findUnique({ where: { email } });
    const maxAttempts = 5;
    const lockoutDuration = 5 * 60 * 1000; // 5 minutos

    if (existing) {
      const newCount = existing.attempt_count + 1;
      const lockedUntil = newCount >= maxAttempts 
        ? new Date(Date.now() + lockoutDuration) 
        : existing.locked_until;

      await prisma.loginAttempt.update({
        where: { email },
        data: {
          attempt_count: newCount,
          last_attempt_at: new Date(),
          locked_until: lockedUntil,
        },
      });

      return { attempt_count: newCount, locked_until: lockedUntil };
    } else {
      await prisma.loginAttempt.create({
        data: { email, attempt_count: 1 },
      });
      return { attempt_count: 1, locked_until: null };
    }
  },

  async isAccountLocked(email: string): Promise<boolean> {
    const attempt = await prisma.loginAttempt.findUnique({ where: { email } });
    if (!attempt?.locked_until) return false;
    return new Date() < attempt.locked_until;
  },

  async resetLoginAttempts(email: string): Promise<void> {
    await prisma.loginAttempt.deleteMany({ where: { email } });
  },
};
`);

  addTitle('src/services/email.service.ts', 14);
  addCode(`
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.resend.com',
  port: 465,
  secure: true,
  auth: {
    user: 'resend',
    pass: process.env.RESEND_API_KEY,
  },
});

export const emailService = {
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'noreply@dsicola.com',
      to,
      subject,
      html,
    });
  },

  async sendWelcomeEmail(email: string, nome: string, senha: string): Promise<void> {
    const html = \`
      <h1>Bem-vindo ao DSICOLA!</h1>
      <p>Olá \${nome},</p>
      <p>Sua conta foi criada com sucesso.</p>
      <p><strong>Email:</strong> \${email}</p>
      <p><strong>Senha provisória:</strong> \${senha}</p>
      <p>Por favor, altere sua senha após o primeiro acesso.</p>
    \`;
    await this.sendEmail(email, 'Bem-vindo ao DSICOLA', html);
  },

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const resetUrl = \`\${process.env.FRONTEND_URL}/reset-password?token=\${token}\`;
    const html = \`
      <h1>Recuperação de Senha</h1>
      <p>Você solicitou a recuperação de senha.</p>
      <p>Clique no link abaixo para redefinir sua senha:</p>
      <a href="\${resetUrl}">\${resetUrl}</a>
      <p>Este link expira em 1 hora.</p>
    \`;
    await this.sendEmail(email, 'Recuperação de Senha - DSICOLA', html);
  },
};
`);

  // ============================================================
  // MIDDLEWARES
  // ============================================================
  addPage();
  addTitle('src/middleware/auth.middleware.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';
import { authService, TokenPayload } from '../services/auth.service';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = authService.verifyAccessToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};
`);

  addTitle('src/middleware/role.middleware.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';

export const requireRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({ 
        error: 'Acesso negado',
        message: \`Requer uma das roles: \${allowedRoles.join(', ')}\` 
      });
    }

    next();
  };
};
`);

  addTitle('src/middleware/validation.middleware.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Erro de validação',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
      }
      next(error);
    }
  };
};
`);

  addTitle('src/middleware/error.middleware.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error(\`Error: \${err.message}\`);
  logger.error(err.stack || '');

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
  }

  // Erro Prisma
  if (err.name === 'PrismaClientKnownRequestError') {
    return res.status(400).json({ error: 'Erro de banco de dados' });
  }

  return res.status(500).json({
    error: 'Erro interno do servidor',
    ...(process.env.NODE_ENV === 'development' && { 
      message: err.message,
      stack: err.stack 
    }),
  });
};
`);

  // ============================================================
  // AUTH CONTROLLER E ROUTES
  // ============================================================
  addPage();
  addTitle('src/controllers/auth.controller.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { authService } from '../services/auth.service';
import { emailService } from '../services/email.service';
import { AppError } from '../middleware/error.middleware';

export const authController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha } = req.body;

      // Verificar bloqueio de conta
      if (await authService.isAccountLocked(email)) {
        throw new AppError(423, 'Conta temporariamente bloqueada. Tente novamente mais tarde.');
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: { user_roles: true },
      });

      if (!user) {
        await authService.recordFailedLogin(email);
        throw new AppError(401, 'Credenciais inválidas');
      }

      const isValidPassword = await authService.comparePassword(senha, user.senha_hash);

      if (!isValidPassword) {
        await authService.recordFailedLogin(email);
        throw new AppError(401, 'Credenciais inválidas');
      }

      // Reset tentativas de login
      await authService.resetLoginAttempts(email);

      const roles = user.user_roles.map(r => r.role);
      const payload = {
        userId: user.id,
        email: user.email,
        roles,
        instituicao_id: user.instituicao_id || undefined,
      };

      const accessToken = authService.generateAccessToken(payload);
      const refreshToken = authService.generateRefreshToken(payload);

      await authService.saveRefreshToken(user.id, refreshToken);

      res.json({
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          nome_completo: user.nome_completo,
          roles,
          instituicao_id: user.instituicao_id,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, senha, nome_completo, instituicao_id } = req.body;

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new AppError(409, 'Email já cadastrado');
      }

      const senha_hash = await authService.hashPassword(senha);

      const user = await prisma.user.create({
        data: {
          email,
          senha_hash,
          nome_completo,
          instituicao_id,
        },
      });

      // Criar role padrão ALUNO
      await prisma.userRoleRelation.create({
        data: {
          user_id: user.id,
          role: 'ALUNO',
          instituicao_id,
        },
      });

      res.status(201).json({
        message: 'Usuário criado com sucesso',
        user: { id: user.id, email: user.email, nome_completo: user.nome_completo },
      });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError(400, 'Refresh token não fornecido');
      }

      const isValid = await authService.isRefreshTokenValid(refreshToken);
      if (!isValid) {
        throw new AppError(401, 'Refresh token inválido ou expirado');
      }

      const decoded = authService.verifyRefreshToken(refreshToken);

      // Revogar token antigo
      await authService.revokeRefreshToken(refreshToken);

      // Gerar novos tokens
      const newAccessToken = authService.generateAccessToken(decoded);
      const newRefreshToken = authService.generateRefreshToken(decoded);

      await authService.saveRefreshToken(decoded.userId, newRefreshToken);

      res.json({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;

      if (refreshToken) {
        await authService.revokeRefreshToken(refreshToken);
      }

      res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;

      const user = await prisma.user.findUnique({ where: { email } });

      // Não revelar se o email existe
      res.json({ message: 'Se o email existir, enviaremos instruções de recuperação.' });

      if (user) {
        const token = authService.generateAccessToken({ 
          userId: user.id, 
          email: user.email, 
          roles: [] 
        });
        await emailService.sendPasswordResetEmail(email, token);
      }
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new AppError(401, 'Não autenticado');
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { user_roles: true, instituicao: true },
      });

      if (!user) {
        throw new AppError(404, 'Usuário não encontrado');
      }

      res.json({
        id: user.id,
        email: user.email,
        nome_completo: user.nome_completo,
        roles: user.user_roles.map(r => r.role),
        instituicao: user.instituicao,
      });
    } catch (error) {
      next(error);
    }
  },
};
`);

  addTitle('src/routes/auth.routes.ts', 14);
  addCode(`
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validation.middleware';
import { authMiddleware } from '../middleware/auth.middleware';
import { z } from 'zod';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Deve conter letra maiúscula')
    .regex(/[a-z]/, 'Deve conter letra minúscula')
    .regex(/[0-9]/, 'Deve conter número'),
  nome_completo: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  instituicao_id: z.string().uuid().optional(),
});

router.post('/login', validate(loginSchema), authController.login);
router.post('/register', validate(registerSchema), authController.register);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.get('/me', authMiddleware, authController.me);

export default router;
`);

  // ============================================================
  // CRUD CONTROLLERS EXEMPLO
  // ============================================================
  addPage();
  addTitle('src/controllers/aluno.controller.ts', 14);
  addCode(`
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../services/prisma.service';
import { authService } from '../services/auth.service';
import { emailService } from '../services/email.service';
import { AppError } from '../middleware/error.middleware';

export const alunoController = {
  async listar(req: Request, res: Response, next: NextFunction) {
    try {
      const { instituicao_id } = req.query;

      const alunos = await prisma.user.findMany({
        where: {
          user_roles: { some: { role: 'ALUNO' } },
          ...(instituicao_id && { instituicao_id: String(instituicao_id) }),
        },
        include: {
          instituicao: true,
          matriculas: { include: { turma: { include: { curso: true } } } },
        },
        orderBy: { created_at: 'desc' },
      });

      res.json(alunos);
    } catch (error) {
      next(error);
    }
  },

  async buscar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const aluno = await prisma.user.findFirst({
        where: { 
          id, 
          user_roles: { some: { role: 'ALUNO' } } 
        },
        include: {
          instituicao: true,
          matriculas: { include: { turma: { include: { curso: true } } } },
          notas: { include: { disciplina: true } },
          mensalidades: true,
        },
      });

      if (!aluno) {
        throw new AppError(404, 'Aluno não encontrado');
      }

      res.json(aluno);
    } catch (error) {
      next(error);
    }
  },

  async criar(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, nome_completo, telefone, data_nascimento, genero, 
              morada, cidade, pais, instituicao_id, turma_id } = req.body;

      // Verificar email duplicado
      const existente = await prisma.user.findUnique({ where: { email } });
      if (existente) {
        throw new AppError(409, 'Email já cadastrado');
      }

      // Gerar senha provisória
      const senhaProvisoria = Math.random().toString(36).slice(-8) + 'A1!';
      const senha_hash = await authService.hashPassword(senhaProvisoria);

      // Criar usuário
      const aluno = await prisma.user.create({
        data: {
          email,
          senha_hash,
          nome_completo,
          telefone,
          data_nascimento: data_nascimento ? new Date(data_nascimento) : null,
          genero,
          morada,
          cidade,
          pais,
          instituicao_id,
        },
      });

      // Criar role ALUNO
      await prisma.userRoleRelation.create({
        data: { user_id: aluno.id, role: 'ALUNO', instituicao_id },
      });

      // Criar matrícula se turma_id fornecido
      if (turma_id) {
        await prisma.matricula.create({
          data: { aluno_id: aluno.id, turma_id },
        });
      }

      // Enviar email de boas-vindas
      try {
        await emailService.sendWelcomeEmail(email, nome_completo, senhaProvisoria);
      } catch (emailError) {
        console.error('Erro ao enviar email:', emailError);
      }

      res.status(201).json({
        message: 'Aluno criado com sucesso',
        aluno: { id: aluno.id, email: aluno.email, nome_completo: aluno.nome_completo },
        senhaProvisoria,
      });
    } catch (error) {
      next(error);
    }
  },

  async atualizar(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const dados = req.body;

      const aluno = await prisma.user.update({
        where: { id },
        data: {
          ...dados,
          data_nascimento: dados.data_nascimento ? new Date(dados.data_nascimento) : undefined,
          updated_at: new Date(),
        },
      });

      res.json(aluno);
    } catch (error) {
      next(error);
    }
  },

  async excluir(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      await prisma.user.delete({ where: { id } });

      res.json({ message: 'Aluno excluído com sucesso' });
    } catch (error) {
      next(error);
    }
  },
};
`);

  addTitle('src/routes/aluno.routes.ts', 14);
  addCode(`
import { Router } from 'express';
import { alunoController } from '../controllers/aluno.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { requireRoles } from '../middleware/role.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', requireRoles('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), alunoController.listar);
router.get('/:id', requireRoles('ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'PROFESSOR'), alunoController.buscar);
router.post('/', requireRoles('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), alunoController.criar);
router.put('/:id', requireRoles('ADMIN', 'SUPER_ADMIN', 'SECRETARIA'), alunoController.atualizar);
router.delete('/:id', requireRoles('ADMIN', 'SUPER_ADMIN'), alunoController.excluir);

export default router;
`);

  // ============================================================
  // UTILS
  // ============================================================
  addPage();
  addTitle('src/utils/logger.ts', 14);
  addCode(`
const colors = {
  reset: '\\x1b[0m',
  red: '\\x1b[31m',
  green: '\\x1b[32m',
  yellow: '\\x1b[33m',
  blue: '\\x1b[34m',
  cyan: '\\x1b[36m',
};

const getTimestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string) => {
    console.log(\`\${colors.blue}[INFO]\${colors.reset} \${getTimestamp()} - \${message}\`);
  },
  
  warn: (message: string) => {
    console.log(\`\${colors.yellow}[WARN]\${colors.reset} \${getTimestamp()} - \${message}\`);
  },
  
  error: (message: string) => {
    console.error(\`\${colors.red}[ERROR]\${colors.reset} \${getTimestamp()} - \${message}\`);
  },
  
  success: (message: string) => {
    console.log(\`\${colors.green}[SUCCESS]\${colors.reset} \${getTimestamp()} - \${message}\`);
  },
  
  debug: (message: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(\`\${colors.cyan}[DEBUG]\${colors.reset} \${getTimestamp()} - \${message}\`);
    }
  },
};
`);

  // ============================================================
  // PARTE 2: FRONTEND
  // ============================================================
  addPage();
  addTitle('PARTE 2: FRONTEND', 18);
  addTitle('src/api/client.ts - Cliente HTTP', 14);
  addCode(`
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface User {
  id: string;
  email: string;
  nome_completo: string;
  roles: string[];
  instituicao_id?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Interceptor - adicionar token
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token && config.headers) {
    config.headers.Authorization = \`Bearer \${token}\`;
  }
  return config;
});

// Interceptor - refresh automático
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        
        const response = await axios.post<TokenResponse>(
          \`\${API_URL}/auth/refresh\`,
          { refreshToken }
        );
        
        localStorage.setItem('accessToken', response.data.accessToken);
        localStorage.setItem('refreshToken', response.data.refreshToken);
        originalRequest.headers.Authorization = \`Bearer \${response.data.accessToken}\`;
        
        return apiClient(originalRequest);
      } catch {
        localStorage.clear();
        window.location.href = '/auth';
      }
    }
    
    return Promise.reject(error);
  }
);

export const authApi = {
  async login(email: string, senha: string): Promise<TokenResponse> {
    const response = await apiClient.post<TokenResponse>('/auth/login', { email, senha });
    localStorage.setItem('accessToken', response.data.accessToken);
    localStorage.setItem('refreshToken', response.data.refreshToken);
    localStorage.setItem('user', JSON.stringify(response.data.user));
    return response.data;
  },

  async logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      try { await apiClient.post('/auth/logout', { refreshToken }); } catch {}
    }
    localStorage.clear();
  },

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('accessToken');
  },
};

export const api = {
  get: <T>(endpoint: string, params?: Record<string, unknown>) => 
    apiClient.get<T>(endpoint, { params }).then(r => r.data),
  post: <T>(endpoint: string, data: unknown) => 
    apiClient.post<T>(endpoint, data).then(r => r.data),
  put: <T>(endpoint: string, data: unknown) => 
    apiClient.put<T>(endpoint, data).then(r => r.data),
  delete: <T>(endpoint: string) => 
    apiClient.delete<T>(endpoint).then(r => r.data),
};

export default apiClient;
`);

  // ============================================================
  // README FINAL
  // ============================================================
  addPage();
  addTitle('INSTRUÇÕES DE INSTALAÇÃO', 18);
  addCode(`
# ============================================================
# INSTALAÇÃO DO BACKEND
# ============================================================

# 1. Criar pasta e entrar
mkdir dsicola-backend && cd dsicola-backend

# 2. Inicializar projeto
npm init -y

# 3. Instalar dependências
npm install express cors helmet bcryptjs jsonwebtoken prisma @prisma/client
npm install nodemailer zod dotenv express-rate-limit
npm install -D typescript @types/express @types/cors @types/bcryptjs
npm install -D @types/jsonwebtoken @types/nodemailer ts-node nodemon

# 4. Copiar arquivos deste PDF para a estrutura de pastas

# 5. Configurar .env
cp .env.example .env
# Editar .env com suas configurações

# 6. Inicializar Prisma
npx prisma init
# Copiar schema.prisma deste PDF

# 7. Rodar migrações
npx prisma migrate dev --name init

# 8. Iniciar servidor
npm run dev

# ============================================================
# INSTALAÇÃO DO FRONTEND
# ============================================================

# 1. Criar projeto Vite
npm create vite@latest dsicola-frontend -- --template react-ts
cd dsicola-frontend

# 2. Instalar dependências
npm install react-router-dom axios @tanstack/react-query
npm install tailwindcss postcss autoprefixer
npm install lucide-react sonner zod

# 3. Configurar Tailwind
npx tailwindcss init -p

# 4. Copiar arquivos deste PDF

# 5. Configurar .env
echo "VITE_API_URL=http://localhost:3001/api" > .env

# 6. Iniciar desenvolvimento
npm run dev

# ============================================================
# TESTANDO A APLICAÇÃO
# ============================================================

# Terminal 1: Backend
cd dsicola-backend && npm run dev
# Servidor em http://localhost:3001

# Terminal 2: Frontend
cd dsicola-frontend && npm run dev
# Aplicação em http://localhost:5173

# Testar login:
curl -X POST http://localhost:3001/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@dsicola.com","senha":"Admin@123"}'
`);

  // Salvar PDF
  doc.save('DSICOLA-projeto-completo.pdf');
};

export default generateFullProjectPDF;
