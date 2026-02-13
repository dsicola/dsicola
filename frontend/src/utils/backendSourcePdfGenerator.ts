import jsPDF from "jspdf";

// Import all edge function source files
const edgeFunctions: Record<string, string> = {};

// We'll manually include the code since dynamic imports don't work well with Vite
const functionSources = import.meta.glob(
  "../../supabase/functions/**/index.ts",
  { as: "raw", eager: true }
) as Record<string, string>;

export const gerarCodigoBackendPDF = async (): Promise<void> => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const marginX = 40;
  const marginTop = 60;
  const marginBottom = 50;
  const contentWidth = pageWidth - marginX * 2;
  const lineHeight = 10;

  let page = 1;
  let y = marginTop;

  const addHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageWidth, 45, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("DSICOLA • Código-fonte Completo do Backend", marginX, 28);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Página ${page}`, pageWidth - marginX, 28, { align: "right" });

    doc.setTextColor(0, 0, 0);
  };

  const addFooter = () => {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-AO")} • DSICOLA Sistema de Gestão Escolar`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  };

  const newPage = () => {
    addFooter();
    doc.addPage();
    page += 1;
    y = marginTop;
    addHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - marginBottom) {
      newPage();
    }
  };

  const writeText = (text: string, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) => {
    const size = opts?.size ?? 10;
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(size);
    if (opts?.color) doc.setTextColor(opts.color[0], opts.color[1], opts.color[2]);

    const lines = doc.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(size + 4);
      doc.text(line, marginX, y);
      y += size + 4;
    }

    doc.setTextColor(0, 0, 0);
  };

  const writeTitle = (text: string) => {
    ensureSpace(35);
    doc.setFillColor(59, 130, 246);
    doc.rect(marginX - 5, y - 15, contentWidth + 10, 25, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, marginX, y);
    doc.setTextColor(0, 0, 0);
    y += 20;
  };

  const writeSubtitle = (text: string) => {
    ensureSpace(25);
    doc.setFillColor(241, 245, 249);
    doc.rect(marginX - 5, y - 12, contentWidth + 10, 20, "F");
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text, marginX, y);
    doc.setTextColor(0, 0, 0);
    y += 15;
  };

  const writeCode = (code: string) => {
    doc.setFont("courier", "normal");
    doc.setFontSize(7);
    doc.setTextColor(30, 41, 59);

    const lines = code.split("\n");
    let lineNum = 1;

    for (const line of lines) {
      const displayLine = line.length > 0 ? line : " ";
      const wrapped = doc.splitTextToSize(displayLine, contentWidth - 30);

      for (let i = 0; i < wrapped.length; i++) {
        ensureSpace(9);
        
        // Line number only on first wrapped line
        if (i === 0) {
          doc.setTextColor(150, 150, 150);
          doc.text(String(lineNum).padStart(4, " "), marginX, y);
        }
        
        doc.setTextColor(30, 41, 59);
        doc.text(wrapped[i], marginX + 30, y);
        y += 9;
      }
      lineNum++;
    }

    doc.setTextColor(0, 0, 0);
    y += 5;
  };

  const writeDivider = () => {
    ensureSpace(15);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 15;
  };

  // ========== CAPA ==========
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, pageHeight, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(36);
  doc.text("DSICOLA", pageWidth / 2, 180, { align: "center" });

  doc.setFontSize(18);
  doc.setFont("helvetica", "normal");
  doc.text("Sistema de Gestão Escolar", pageWidth / 2, 215, { align: "center" });

  doc.setFontSize(14);
  doc.text("Código-fonte Completo do Backend", pageWidth / 2, 280, { align: "center" });

  doc.setFontSize(11);
  doc.text("Edge Functions • Supabase • PostgreSQL", pageWidth / 2, 310, { align: "center" });

  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-AO")}`, pageWidth / 2, 380, { align: "center" });

  // ========== PÁGINA 2: ARQUITETURA ==========
  doc.addPage();
  page = 2;
  y = marginTop;
  addHeader();

  writeTitle("1. ARQUITETURA DO BACKEND");

  writeText("Este documento contém o código-fonte completo de todas as funções do backend do sistema DSICOLA.", { size: 10 });
  y += 10;

  writeSubtitle("1.1 Stack Tecnológica");
  writeText("• Runtime: Deno (Edge Functions)", { size: 9 });
  writeText("• Banco de Dados: PostgreSQL (Supabase)", { size: 9 });
  writeText("• Autenticação: Supabase Auth (JWT automático)", { size: 9 });
  writeText("• Email: Resend API", { size: 9 });
  writeText("• IA: Lovable AI Gateway", { size: 9 });
  y += 10;

  writeSubtitle("1.2 Segurança");
  writeText("• Row Level Security (RLS) em todas as tabelas", { size: 9 });
  writeText("• Tokens JWT validados automaticamente pelo Supabase", { size: 9 });
  writeText("• Service Role Key para operações administrativas", { size: 9 });
  writeText("• CORS configurado para todas as funções", { size: 9 });
  y += 10;

  writeSubtitle("1.3 Estrutura das Funções");
  writeText("Cada função está em: supabase/functions/<nome-funcao>/index.ts", { size: 9 });
  writeText("Padrão de resposta: JSON com { data, error, success }", { size: 9 });
  y += 10;

  writeDivider();

  writeTitle("2. VARIÁVEIS DE AMBIENTE NECESSÁRIAS");

  writeCode(`# .env.example - Variáveis obrigatórias para o backend

# Supabase (fornecidas automaticamente pelo Lovable Cloud)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
SUPABASE_DB_URL=postgresql://postgres:senha@db.projeto.supabase.co:5432/postgres

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxx

# IA (OpenAI)
OPENAI_API_KEY=sk-xxxxxxxx`);

  // ========== PÁGINA 3: COMO EXECUTAR ==========
  newPage();

  writeTitle("3. COMO EXECUTAR O BACKEND");

  writeSubtitle("3.1 Pré-requisitos");
  writeText("• Conta no Lovable.dev com Cloud habilitado", { size: 9 });
  writeText("• Ou conta Supabase com projeto configurado", { size: 9 });
  writeText("• Deno instalado (para desenvolvimento local)", { size: 9 });
  y += 10;

  writeSubtitle("3.2 Comandos para Desenvolvimento Local");
  writeCode(`# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase start

# Servir funções localmente
supabase functions serve --env-file .env.local

# Testar uma função específica
curl -X POST http://localhost:54321/functions/v1/create-aluno \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"aluno@teste.com","nome_completo":"Teste"}'`);

  y += 10;

  writeSubtitle("3.3 Deploy (Automático no Lovable)");
  writeText("No Lovable, as funções são deployadas automaticamente ao salvar.", { size: 9 });
  writeText("Para Supabase manual:", { size: 9 });
  writeCode(`# Deploy de todas as funções
supabase functions deploy

# Deploy de função específica
supabase functions deploy create-aluno`);

  // ========== CÓDIGO DAS FUNÇÕES ==========
  const sortedPaths = Object.keys(functionSources).sort();

  for (const filePath of sortedPaths) {
    newPage();

    const functionName = filePath.replace(/^\.\.\/\.\.\/supabase\/functions\//, "").replace(/\/index\.ts$/, "");
    
    writeTitle(`FUNÇÃO: ${functionName}`);
    
    writeText(`Arquivo: supabase/functions/${functionName}/index.ts`, { size: 9, color: [100, 100, 100] });
    y += 10;

    const code = functionSources[filePath];
    writeCode(code);
  }

  // ========== PÁGINA FINAL: EXEMPLOS DE USO ==========
  newPage();

  writeTitle("EXEMPLOS DE REQUISIÇÕES HTTP");

  writeSubtitle("Criar Aluno");
  writeCode(`curl -X POST "https://zqgrypggiceabyiaqzxb.supabase.co/functions/v1/create-aluno" \\
  -H "Authorization: Bearer <JWT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "aluno@escola.ao",
    "nome_completo": "João Silva",
    "numero_identificacao": "123456789LA001",
    "data_nascimento": "2000-01-15",
    "telefone": "+244912345678",
    "turma_id": "uuid-da-turma"
  }'`);

  y += 10;

  writeSubtitle("Criar Professor");
  writeCode(`curl -X POST "https://zqgrypggiceabyiaqzxb.supabase.co/functions/v1/create-professor" \\
  -H "Authorization: Bearer <JWT_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "professor@escola.ao",
    "nome_completo": "Maria Santos",
    "numero_identificacao": "987654321LA002",
    "telefone": "+244923456789",
    "disciplinas": ["Matemática", "Física"]
  }'`);

  y += 10;

  writeSubtitle("Login (Supabase Auth)");
  writeCode(`curl -X POST "https://zqgrypggiceabyiaqzxb.supabase.co/auth/v1/token?grant_type=password" \\
  -H "apikey: <ANON_KEY>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "usuario@escola.ao",
    "password": "senha123"
  }'

# Resposta:
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "xxxxxx",
  "expires_in": 3600,
  "token_type": "bearer",
  "user": { "id": "uuid", "email": "usuario@escola.ao" }
}`);

  y += 10;

  writeSubtitle("Assistente IA");
  writeCode(`curl -X POST "https://zqgrypggiceabyiaqzxb.supabase.co/functions/v1/ai-assistant" \\
  -H "Content-Type: application/json" \\
  -d '{
    "messages": [
      {"role": "user", "content": "Quantos alunos estão matriculados?"}
    ]
  }'`);

  // ========== PÁGINA: SCHEMA DO BANCO ==========
  newPage();

  writeTitle("ESTRUTURA DO BANCO DE DADOS (Principais Tabelas)");

  writeCode(`-- profiles (dados dos usuários)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nome_completo TEXT,
  numero_identificacao TEXT,
  data_nascimento DATE,
  telefone TEXT,
  genero TEXT,
  morada TEXT,
  cidade TEXT,
  pais TEXT DEFAULT 'Angola',
  foto_url TEXT,
  instituicao_id UUID REFERENCES instituicoes(id),
  numero_identificacao_publica TEXT,
  status_aluno TEXT DEFAULT 'Ativo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_roles (papéis dos usuários)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL, -- ENUM: SUPER_ADMIN, ADMIN, PROFESSOR, SECRETARIA, ALUNO, RESPONSAVEL
  instituicao_id UUID REFERENCES instituicoes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- instituicoes
CREATE TABLE public.instituicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  subdominio TEXT UNIQUE NOT NULL,
  tipo_instituicao TEXT NOT NULL,
  logo_url TEXT,
  email_contato TEXT,
  telefone TEXT,
  endereco TEXT,
  status TEXT DEFAULT 'ativa',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- turmas
CREATE TABLE public.turmas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  curso_id UUID REFERENCES cursos(id),
  professor_id UUID REFERENCES profiles(id),
  turno_id UUID REFERENCES turnos(id),
  ano_letivo INTEGER DEFAULT EXTRACT(YEAR FROM now()),
  instituicao_id UUID REFERENCES instituicoes(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- matriculas
CREATE TABLE public.matriculas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES profiles(id) NOT NULL,
  turma_id UUID REFERENCES turmas(id) NOT NULL,
  data_matricula DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Ativa',
  ano_letivo INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- notas
CREATE TABLE public.notas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES profiles(id) NOT NULL,
  disciplina_id UUID REFERENCES disciplinas(id) NOT NULL,
  turma_id UUID REFERENCES turmas(id),
  nota DECIMAL(5,2),
  tipo TEXT, -- 'prova', 'trabalho', 'exame'
  trimestre INTEGER,
  ano_letivo INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- mensalidades
CREATE TABLE public.mensalidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id UUID REFERENCES profiles(id) NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'Pendente',
  mes_referencia TEXT,
  ano_referencia INTEGER,
  multa BOOLEAN DEFAULT false,
  valor_multa DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);`);

  // Adicionar footer na última página
  addFooter();

  // Salvar PDF
  doc.save("DSICOLA-backend-codigo-completo.pdf");
};
