import jsPDF from 'jspdf';

export const gerarManualBackendPDF = async (): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;
  let currentPage = 1;

  const checkNewPage = (neededSpace = 30) => {
    if (yPos > pageHeight - neededSpace) {
      doc.addPage();
      currentPage++;
      yPos = addHeader();
    }
  };

  const addHeader = () => {
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Manual Técnico do Backend - DSICOLA', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text(`Página ${currentPage}`, pageWidth - 15, 25, { align: 'right' });
    return 40;
  };

  const addSectionTitle = (title: string) => {
    checkNewPage(40);
    doc.setTextColor(30, 64, 175);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 10;
    doc.setTextColor(0, 0, 0);
  };

  const addSubsectionTitle = (title: string) => {
    checkNewPage(30);
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, margin, yPos);
    yPos += 8;
    doc.setTextColor(0, 0, 0);
  };

  const addParagraph = (text: string) => {
    checkNewPage(30);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 4.5 + 4;
  };

  const addCodeBlock = (code: string) => {
    checkNewPage(40);
    doc.setFillColor(245, 245, 245);
    const lines = doc.splitTextToSize(code, pageWidth - margin * 2 - 10);
    const boxHeight = lines.length * 4 + 8;
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, boxHeight, 'F');
    doc.setFontSize(7);
    doc.setFont('courier', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(lines, margin + 5, yPos);
    yPos += boxHeight + 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);
  };

  const addListItem = (item: string, indent = 0) => {
    checkNewPage(15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const bullet = indent > 0 ? '  ○' : '•';
    const lines = doc.splitTextToSize(`${bullet} ${item}`, pageWidth - margin * 2 - indent * 5);
    doc.text(lines, margin + indent * 5, yPos);
    yPos += lines.length * 4.5 + 2;
  };

  const addTable = (headers: string[], rows: string[][]) => {
    checkNewPage(50);
    const colWidth = (pageWidth - margin * 2) / headers.length;
    
    // Header
    doc.setFillColor(30, 64, 175);
    doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    headers.forEach((header, i) => {
      doc.text(header, margin + i * colWidth + 2, yPos);
    });
    yPos += 8;
    
    // Rows
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    rows.forEach((row, rowIndex) => {
      checkNewPage(12);
      if (rowIndex % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPos - 4, pageWidth - margin * 2, 8, 'F');
      }
      row.forEach((cell, i) => {
        const truncated = cell.length > 25 ? cell.substring(0, 22) + '...' : cell;
        doc.text(truncated, margin + i * colWidth + 2, yPos);
      });
      yPos += 8;
    });
    yPos += 6;
  };

  // === CAPA ===
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('DSICOLA', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(18);
  doc.text('Manual Técnico do Backend', pageWidth / 2, 70, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Documentação Completa da Arquitetura', pageWidth / 2, 90, { align: 'center' });
  
  // Badge
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(40, 110, pageWidth - 80, 40, 3, 3, 'F');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Inclui:', pageWidth / 2, 120, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('• Edge Functions • Políticas RLS • Estrutura do Banco', pageWidth / 2, 130, { align: 'center' });
  doc.text('• Autenticação • Middleware • Tratamento de Erros', pageWidth / 2, 138, { align: 'center' });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text(`Versão 1.0 - ${new Date().toLocaleDateString('pt-AO')}`, pageWidth / 2, pageHeight - 20, { align: 'center' });

  // === ÍNDICE ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('ÍNDICE');
  
  const indice = [
    '1. Visão Geral da Arquitetura',
    '2. Estrutura de Arquivos',
    '3. Banco de Dados (Supabase)',
    '4. Tabelas Principais',
    '5. Row Level Security (RLS)',
    '6. Edge Functions (Endpoints)',
    '7. Autenticação e Sessões',
    '8. Sistema de Roles/Perfis',
    '9. Middleware de Permissões',
    '10. Tratamento de Erros',
    '11. Códigos de Resposta HTTP',
    '12. Fluxos de Negócio',
    '13. Integrações Externas',
    '14. Backup e Recuperação',
    '15. Segurança',
  ];
  
  indice.forEach(item => {
    addListItem(item);
  });

  // === 1. VISÃO GERAL ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('1. VISÃO GERAL DA ARQUITETURA');
  
  addParagraph('O DSICOLA é uma aplicação SaaS multi-tenant desenvolvida com as seguintes tecnologias:');
  yPos += 3;
  
  addSubsectionTitle('1.1 Frontend');
  addListItem('React 18 com TypeScript');
  addListItem('Vite como bundler');
  addListItem('TailwindCSS para estilização');
  addListItem('Shadcn/UI para componentes');
  addListItem('React Query para gerenciamento de estado assíncrono');
  addListItem('React Router DOM para navegação SPA');
  
  addSubsectionTitle('1.2 Backend (Supabase)');
  addListItem('PostgreSQL como banco de dados');
  addListItem('Row Level Security (RLS) para controle de acesso');
  addListItem('Edge Functions (Deno) para lógica de negócio');
  addListItem('Supabase Auth para autenticação');
  addListItem('Supabase Storage para arquivos');
  addListItem('Realtime para notificações em tempo real');

  addSubsectionTitle('1.3 Arquitetura Multi-Tenant');
  addParagraph('O sistema opera com isolamento por instituição:');
  addListItem('Cada instituição possui um subdomínio único (ex: escola.dsicola.com)');
  addListItem('Dados são isolados por instituicao_id em todas as tabelas');
  addListItem('RLS policies garantem que usuários só acessem dados da sua instituição');
  addListItem('Super Admin tem acesso global a todas as instituições');

  // === 2. ESTRUTURA DE ARQUIVOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('2. ESTRUTURA DE ARQUIVOS');
  
  addSubsectionTitle('2.1 Diretório Principal');
  addCodeBlock(`src/
├── components/        # Componentes React reutilizáveis
│   ├── admin/         # Componentes do painel admin
│   ├── auth/          # Login, registro, proteção de rotas
│   ├── layout/        # Layout principal (sidebar, header)
│   ├── superadmin/    # Componentes do Super Admin
│   └── ui/            # Componentes base (shadcn)
├── contexts/          # Contextos React (Auth, Tenant, etc)
├── hooks/             # Hooks personalizados
├── integrations/      # Integrações (Supabase client)
├── pages/             # Páginas da aplicação
├── types/             # Definições TypeScript
└── utils/             # Funções utilitárias`);

  addSubsectionTitle('2.2 Edge Functions (Backend)');
  addCodeBlock(`supabase/functions/
├── ai-assistant/          # Assistente IA
├── create-aluno/          # Criar aluno
├── create-funcionario/    # Criar funcionário
├── create-instituicao-admin/  # Criar admin de instituição
├── create-professor/      # Criar professor
├── create-super-admin/    # Criar super admin
├── delete-aluno/          # Excluir aluno
├── generate-backup/       # Gerar backup
├── notify-lead/           # Notificar lead
├── onboard-instituicao/   # Onboarding de instituição
├── restore-backup/        # Restaurar backup
├── scheduled-backup/      # Backup agendado
├── send-boletim-email/    # Enviar boletim por email
├── send-comunicado/       # Enviar comunicado
├── send-frequencia-alert/ # Alerta de frequência
├── send-nota-notification/  # Notificação de nota
├── send-password-email/   # Email de senha
├── send-payment-reminder/ # Lembrete de pagamento
├── send-professor-welcome/  # Boas-vindas professor
├── send-secretaria-welcome/ # Boas-vindas secretaria
├── send-subscription-reminder/ # Lembrete assinatura
└── update-user-password/  # Atualizar senha`);

  // === 3. BANCO DE DADOS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('3. BANCO DE DADOS (SUPABASE)');
  
  addParagraph('O banco de dados PostgreSQL é gerenciado pelo Supabase com as seguintes características:');
  
  addSubsectionTitle('3.1 Schemas');
  addListItem('public: Tabelas principais da aplicação');
  addListItem('auth: Gerenciado pelo Supabase (users, sessions, etc)');
  addListItem('storage: Gerenciado pelo Supabase (buckets, objects)');
  
  addSubsectionTitle('3.2 Convenções');
  addListItem('UUIDs como chaves primárias (gen_random_uuid())');
  addListItem('created_at e updated_at em todas as tabelas');
  addListItem('instituicao_id para isolamento multi-tenant');
  addListItem('Soft delete quando apropriado (status/ativo)');
  addListItem('Triggers para updated_at automático');

  // === 4. TABELAS PRINCIPAIS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('4. TABELAS PRINCIPAIS');
  
  addSubsectionTitle('4.1 Gestão de Usuários');
  addTable(
    ['Tabela', 'Descrição', 'Campos Principais'],
    [
      ['profiles', 'Perfis de usuários', 'id, email, nome_completo, instituicao_id'],
      ['user_roles', 'Roles dos usuários', 'user_id, role, instituicao_id'],
      ['login_attempts', 'Tentativas de login', 'email, attempt_count, locked_until'],
    ]
  );

  addSubsectionTitle('4.2 Instituições e Assinaturas');
  addTable(
    ['Tabela', 'Descrição', 'Campos Principais'],
    [
      ['instituicoes', 'Cadastro de instituições', 'id, nome, subdominio, status'],
      ['planos', 'Planos de assinatura', 'id, nome, valor, limites'],
      ['assinaturas', 'Assinaturas ativas', 'instituicao_id, plano_id, status'],
    ]
  );

  addSubsectionTitle('4.3 Acadêmico');
  addTable(
    ['Tabela', 'Descrição', 'Campos Principais'],
    [
      ['cursos', 'Cursos oferecidos', 'id, nome, codigo, valor_mensalidade'],
      ['disciplinas', 'Disciplinas por curso', 'id, nome, curso_id, carga_horaria'],
      ['turmas', 'Turmas de alunos', 'id, nome, curso_id, professor_id'],
      ['matriculas', 'Matrículas em turmas', 'aluno_id, turma_id, status'],
      ['notas', 'Notas dos alunos', 'matricula_id, tipo, valor, peso'],
      ['frequencias', 'Frequência em aulas', 'aluno_id, aula_id, presente'],
    ]
  );

  // === 5. RLS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('5. ROW LEVEL SECURITY (RLS)');
  
  addParagraph('O RLS garante que cada usuário só acesse dados permitidos. Todas as tabelas têm RLS habilitado.');
  
  addSubsectionTitle('5.1 Funções de Segurança');
  addCodeBlock(`-- Verifica se usuário tem determinada role
CREATE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER;`);

  addCodeBlock(`-- Obtém instituição do usuário
CREATE FUNCTION public.get_user_instituicao(_user_id uuid)
RETURNS uuid AS $$
  SELECT instituicao_id FROM public.profiles
  WHERE id = _user_id
$$ LANGUAGE sql STABLE SECURITY DEFINER;`);

  addSubsectionTitle('5.2 Exemplo de Policy');
  addCodeBlock(`-- Usuários só veem dados da própria instituição
CREATE POLICY "Users view own institution data"
ON public.cursos FOR SELECT
USING (
  instituicao_id = public.get_user_instituicao(auth.uid())
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
);`);

  addSubsectionTitle('5.3 Hierarquia de Acesso');
  addListItem('SUPER_ADMIN: Acesso a todas as instituições');
  addListItem('ADMIN: Acesso total à própria instituição');
  addListItem('SECRETARIA: Acesso a módulos financeiros e matrículas');
  addListItem('PROFESSOR: Acesso às turmas atribuídas');
  addListItem('ALUNO: Acesso apenas aos próprios dados');

  // === 6. EDGE FUNCTIONS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('6. EDGE FUNCTIONS (ENDPOINTS)');
  
  addParagraph('As Edge Functions são funções serverless executadas no Deno. Cada função é um endpoint HTTP.');
  
  addSubsectionTitle('6.1 Estrutura Padrão');
  addCodeBlock(`// supabase/functions/example/index.ts
import { serve } from "https://deno.land/std/http/server.ts"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    // Lógica da função aqui
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})`);

  addSubsectionTitle('6.2 Endpoints Disponíveis');
  addTable(
    ['Função', 'Método', 'Descrição'],
    [
      ['create-aluno', 'POST', 'Cria novo aluno no sistema'],
      ['create-professor', 'POST', 'Cria novo professor'],
      ['create-funcionario', 'POST', 'Cria funcionário RH'],
      ['create-instituicao-admin', 'POST', 'Cria admin de instituição'],
      ['onboard-instituicao', 'POST', 'Onboarding completo'],
      ['delete-aluno', 'POST', 'Remove aluno (soft delete)'],
      ['update-user-password', 'POST', 'Atualiza senha de usuário'],
      ['generate-backup', 'POST', 'Gera backup do sistema'],
      ['restore-backup', 'POST', 'Restaura backup'],
    ]
  );

  // === 7. AUTENTICAÇÃO ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('7. AUTENTICAÇÃO E SESSÕES');
  
  addSubsectionTitle('7.1 Fluxo de Login');
  addParagraph('1. Usuário submete email/senha no formulário de login');
  addParagraph('2. Frontend chama supabase.auth.signInWithPassword()');
  addParagraph('3. Supabase valida credenciais e retorna JWT token');
  addParagraph('4. Token é armazenado automaticamente pelo Supabase client');
  addParagraph('5. AuthContext carrega dados do perfil e roles');
  addParagraph('6. Usuário é redirecionado ao dashboard apropriado');
  
  addSubsectionTitle('7.2 Proteção de Rotas');
  addCodeBlock(`// ProtectedRoute.tsx
const ProtectedRoute = ({ allowedRoles, children }) => {
  const { user, userRole, loading } = useAuth();
  
  if (loading) return <Loading />;
  if (!user) return <Navigate to="/auth" />;
  if (!allowedRoles.includes(userRole)) {
    return <AccessDenied />;
  }
  
  return children;
};`);

  addSubsectionTitle('7.3 Proteção Contra Brute Force');
  addParagraph('O sistema implementa proteção contra ataques de força bruta:');
  addListItem('Máximo 5 tentativas de login por email');
  addListItem('Bloqueio de 5 minutos após exceder tentativas');
  addListItem('Bloqueio de 10 minutos em reincidência');
  addListItem('Função record_failed_login() registra tentativas');
  addListItem('Função reset_login_attempts() limpa após sucesso');

  // === 8. SISTEMA DE ROLES ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('8. SISTEMA DE ROLES/PERFIS');
  
  addSubsectionTitle('8.1 Enum de Roles');
  addCodeBlock(`CREATE TYPE public.user_role AS ENUM (
  'SUPER_ADMIN',   -- Administrador global da plataforma
  'ADMIN',         -- Administrador de instituição
  'SECRETARIA',    -- Funcionário de secretaria
  'PROFESSOR',     -- Professor
  'ALUNO',         -- Estudante
  'RESPONSAVEL',   -- Responsável por aluno
  'POS'            -- Ponto de venda
);`);

  addSubsectionTitle('8.2 Tabela user_roles');
  addCodeBlock(`CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  instituicao_id UUID REFERENCES instituicoes(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, role)
);`);

  addSubsectionTitle('8.3 Prioridade de Roles');
  addParagraph('Quando um usuário tem múltiplas roles, a prioridade é:');
  addCodeBlock(`const rolePriority: Record<string, number> = {
  'SUPER_ADMIN': 1,
  'ADMIN': 2,
  'SECRETARIA': 3,
  'PROFESSOR': 4,
  'POS': 5,
  'RESPONSAVEL': 6,
  'ALUNO': 7,
};`);

  // === 9. MIDDLEWARE ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('9. MIDDLEWARE DE PERMISSÕES');
  
  addSubsectionTitle('9.1 Verificação em Edge Functions');
  addCodeBlock(`// Verificar se usuário pode executar ação
const { data: authUser } = await supabase.auth.getUser();
if (!authUser?.user) {
  throw new Error('Usuário não autenticado');
}

// Verificar role do usuário
const { data: roles } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', authUser.user.id);

const allowedRoles = ['ADMIN', 'SECRETARIA', 'SUPER_ADMIN'];
const hasPermission = roles?.some(r => allowedRoles.includes(r.role));

if (!hasPermission) {
  throw new Error('Sem permissão para esta ação');
}`);

  addSubsectionTitle('9.2 Verificação em RLS');
  addCodeBlock(`-- Policy que verifica role do usuário
CREATE POLICY "Admin can manage all"
ON public.alunos FOR ALL
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'SUPER_ADMIN')
);`);

  // === 10. TRATAMENTO DE ERROS ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('10. TRATAMENTO DE ERROS');
  
  addSubsectionTitle('10.1 Estrutura de Resposta');
  addCodeBlock(`// Sucesso
{
  "success": true,
  "data": { ... }
}

// Erro
{
  "success": false,
  "error": "Mensagem descritiva do erro",
  "code": "ERROR_CODE"
}`);

  addSubsectionTitle('10.2 Códigos de Erro Comuns');
  addTable(
    ['Código', 'Descrição', 'Ação'],
    [
      ['AUTH_REQUIRED', 'Usuário não autenticado', 'Redirecionar para login'],
      ['PERMISSION_DENIED', 'Sem permissão', 'Mostrar mensagem de acesso negado'],
      ['NOT_FOUND', 'Recurso não encontrado', 'Mostrar 404'],
      ['VALIDATION_ERROR', 'Dados inválidos', 'Mostrar erros de validação'],
      ['DUPLICATE_ENTRY', 'Registro duplicado', 'Informar conflito'],
      ['LIMIT_EXCEEDED', 'Limite do plano', 'Sugerir upgrade'],
    ]
  );

  // === 11. CÓDIGOS HTTP ===
  addSubsectionTitle('11. CÓDIGOS DE RESPOSTA HTTP');
  addTable(
    ['Código', 'Status', 'Uso'],
    [
      ['200', 'OK', 'Requisição bem-sucedida'],
      ['201', 'Created', 'Recurso criado'],
      ['400', 'Bad Request', 'Dados inválidos'],
      ['401', 'Unauthorized', 'Não autenticado'],
      ['403', 'Forbidden', 'Sem permissão'],
      ['404', 'Not Found', 'Recurso não existe'],
      ['409', 'Conflict', 'Conflito (duplicado)'],
      ['500', 'Server Error', 'Erro interno'],
    ]
  );

  // === 12. FLUXOS DE NEGÓCIO ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('12. FLUXOS DE NEGÓCIO');
  
  addSubsectionTitle('12.1 Criação de Instituição');
  addParagraph('1. Super Admin acessa "Onboarding" no painel');
  addParagraph('2. Preenche dados da instituição + admin');
  addParagraph('3. Edge Function "onboard-instituicao" executa:');
  addListItem('Cria registro em "instituicoes"', 1);
  addListItem('Cria usuário admin no Supabase Auth', 1);
  addListItem('Cria perfil em "profiles"', 1);
  addListItem('Atribui role ADMIN em "user_roles"', 1);
  addListItem('Cria assinatura vinculada ao plano', 1);
  addListItem('Envia email de boas-vindas', 1);
  
  addSubsectionTitle('12.2 Matrícula de Aluno');
  addParagraph('1. Admin/Secretaria acessa "Criar Aluno"');
  addParagraph('2. Preenche dados pessoais + seleciona turma');
  addParagraph('3. Edge Function "create-aluno" executa:');
  addListItem('Cria usuário no Supabase Auth', 1);
  addListItem('Cria perfil com dados completos', 1);
  addListItem('Atribui role ALUNO', 1);
  addListItem('Cria matrícula na turma', 1);
  addListItem('Gera mensalidades do período', 1);
  
  addSubsectionTitle('12.3 Controle de Inadimplência');
  addParagraph('O sistema monitora automaticamente:');
  addListItem('Função aplicar_multas_mensalidades() roda diariamente');
  addListItem('Mensalidades vencidas recebem status "Atrasado" + multa');
  addListItem('Alunos inadimplentes têm status alterado');
  addListItem('Ao pagar, trigger reativar_aluno_apos_pagamento() libera acesso');

  // === 13. INTEGRAÇÕES ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('13. INTEGRAÇÕES EXTERNAS');
  
  addSubsectionTitle('13.1 Resend (Email)');
  addParagraph('Serviço de envio de emails transacionais.');
  addListItem('Secret: RESEND_API_KEY');
  addListItem('Usado para: boas-vindas, recuperação de senha, notificações');
  
  addCodeBlock(`// Exemplo de envio de email
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

await resend.emails.send({
  from: 'DSICOLA <noreply@dsicola.com>',
  to: [destinatario],
  subject: 'Bem-vindo ao DSICOLA',
  html: templateHtml,
});`);

  addSubsectionTitle('13.2 OpenAI AI');
  addParagraph('Integração com OpenAI para assistente inteligente.');
  addListItem('Secret: OPENAI_API_KEY');
  addListItem('Modelo: gpt-4o-mini');
  addListItem('Usado para: assistente IA no painel');

  // === 14. BACKUP ===
  addSubsectionTitle('14. BACKUP E RECUPERAÇÃO');
  addParagraph('O sistema oferece backup manual e agendado:');
  addListItem('generate-backup: Exporta dados em JSON/SQL');
  addListItem('restore-backup: Restaura a partir de arquivo');
  addListItem('scheduled-backup: Executado por cron (diário/semanal)');
  addListItem('Dados sensíveis são encriptados antes do armazenamento');

  // === 15. SEGURANÇA ===
  doc.addPage();
  currentPage++;
  yPos = addHeader();
  
  addSectionTitle('15. SEGURANÇA');
  
  addSubsectionTitle('15.1 Práticas Implementadas');
  addListItem('RLS em 100% das tabelas com dados sensíveis');
  addListItem('Validação de input em todas as Edge Functions');
  addListItem('Sanitização de dados antes de queries');
  addListItem('Rate limiting em endpoints críticos');
  addListItem('JWT tokens com expiração curta');
  addListItem('Refresh tokens para renovação automática');
  addListItem('Logs de auditoria para ações sensíveis');
  addListItem('Proteção CORS configurada');
  
  addSubsectionTitle('15.2 Logs de Auditoria');
  addCodeBlock(`CREATE TABLE public.logs_auditoria (
  id UUID PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  acao TEXT NOT NULL,
  tabela TEXT,
  registro_id TEXT,
  dados_anteriores JSONB,
  dados_novos JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);`);

  addSubsectionTitle('15.3 Secrets Configurados');
  addTable(
    ['Secret', 'Uso'],
    [
      ['SUPABASE_URL', 'URL do projeto Supabase'],
      ['SUPABASE_ANON_KEY', 'Chave pública'],
      ['SUPABASE_SERVICE_ROLE_KEY', 'Chave admin (backend)'],
      ['RESEND_API_KEY', 'API de email'],
      ['OPENAI_API_KEY', 'API de IA (OpenAI)'],
    ]
  );

  // === PÁGINA FINAL ===
  doc.addPage();
  currentPage++;
  yPos = 80;
  
  doc.setFillColor(30, 64, 175);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Manual Técnico DSICOLA', pageWidth / 2, yPos, { align: 'center' });
  yPos += 20;
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Documentação Completa do Backend', pageWidth / 2, yPos, { align: 'center' });
  yPos += 30;
  
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(40, yPos, pageWidth - 80, 50, 3, 3, 'F');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(10);
  yPos += 15;
  doc.text(`✓ Total de páginas: ${currentPage}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text(`✓ Gerado em: ${new Date().toLocaleString('pt-AO')}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.text('✓ Versão: 1.0', pageWidth / 2, yPos, { align: 'center' });
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('Sistema DSICOLA - Gestão Acadêmica e Financeira', pageWidth / 2, pageHeight - 30, { align: 'center' });
  doc.text('Desenvolvido para instituições de ensino em Angola', pageWidth / 2, pageHeight - 20, { align: 'center' });

  // Salvar
  doc.save(`manual-tecnico-backend-dsicola-${Date.now()}.pdf`);
};
