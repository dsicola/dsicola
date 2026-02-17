import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { InstituicaoProvider } from "@/contexts/InstituicaoContext";
import { TenantProvider, useTenant } from "@/contexts/TenantContext";
import { FaviconUpdater } from "@/components/FaviconUpdater";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PromotionalContentGuard } from "@/components/security/PromotionalContentGuard";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import TenantNotFound from "./pages/TenantNotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import GestaoAcademica from "./pages/admin/GestaoAcademica";
import GestaoProfessores from "./pages/admin/GestaoProfessores";
import CriarProfessor from "./pages/admin/CriarProfessor";
import EditarProfessor from "./pages/admin/EditarProfessor";
import CriarAluno from "./pages/admin/CriarAluno";
import EditarAluno from "./pages/admin/EditarAluno";
import GestaoAlunos from "./pages/admin/GestaoAlunos";
import GestaoMoradias from "./pages/admin/GestaoMoradias";
import GestaoFinanceira from "./pages/admin/GestaoFinanceira";
import ConfiguracoesInstituicao from "./pages/admin/ConfiguracoesInstituicao";
import ConfiguracaoMultas from "./pages/admin/ConfiguracaoMultas";
import GestaoSecretaria from "./pages/admin/GestaoSecretaria";
import VideoAulas from "./pages/VideoAulas";
import Onboarding from "./pages/Onboarding";

import ProfessorDashboard from "./pages/professor/ProfessorDashboard";
import MinhasTurmasProfessor from "./pages/professor/MinhasTurmas";
import GestaoNotas from "./pages/professor/GestaoNotas";
import GestaoFrequencia from "./pages/professor/GestaoFrequencia";
import ProfessorRelatorios from "./pages/professor/ProfessorRelatorios";
import AlunoDashboard from "./pages/aluno/AlunoDashboard";
import HistoricoAcademico from "./pages/aluno/HistoricoAcademico";
import MinhasMensalidades from "./pages/aluno/MinhasMensalidades";
import MuralComunicados from "./pages/aluno/MuralComunicados";
import MeusDocumentos from "./pages/aluno/MeusDocumentos";
import SecretariaDashboard from "./pages/secretaria/SecretariaDashboard";
import POSDashboard from "./pages/pos/POSDashboard";
import ComunicadosPage from "./pages/admin/Comunicados";
import EmailsEnviados from "./pages/admin/EmailsEnviados";
import DocumentosPage from "./pages/admin/Documentos";
import DocumentosAlunos from "./pages/admin/DocumentosAlunos";
import RelatoriosOficiais from "./pages/secretaria/RelatoriosOficiais";
import InadimplenciaBloqueio from "./pages/InadimplenciaBloqueio";
import AccessDenied from "./pages/AccessDenied";
import NotFound from "./pages/NotFound";
import ResponsavelDashboard from "./pages/responsavel/ResponsavelDashboard";
import Analytics from "./pages/admin/Analytics";
import BolsasDescontos from "./pages/admin/BolsasDescontos";
import PlanoEnsino from "./pages/admin/PlanoEnsino";
import AvaliacoesNotas from "./pages/admin/AvaliacoesNotas";
import LancamentoAulas from "./pages/admin/LancamentoAulas";
import ControlePresencas from "./pages/admin/ControlePresencas";
import ConfiguracaoEnsino from "./pages/admin/ConfiguracaoEnsino";
import LogsAuditoria from "./pages/admin/LogsAuditoria";
import Auditoria from "./pages/admin/Auditoria";
import PainelSeguranca from "./pages/admin/PainelSeguranca";
import SuperAdminDashboard from "./pages/superadmin/SuperAdminDashboard";
import LandingPage from "./pages/LandingPage";
import VendasLanding from "./pages/VendasLanding";
import Inscricao from "./pages/Inscricao";
import Backup from "./pages/admin/Backup";
import RecursosHumanos from "./pages/admin/RecursosHumanos";
import ResetPassword from "./pages/ResetPassword";
import Certificados from "./pages/admin/Certificados";
import Boletim from "./pages/admin/Boletim";
import MeuBoletim from "./pages/aluno/MeuBoletim";
import AproveitamentoAcademico from "./pages/aluno/AproveitamentoAcademico";
import CalendarioAluno from "./pages/aluno/CalendarioAluno";
import HorariosAluno from "./pages/aluno/HorariosAluno";
import NotificacoesConfig from "./pages/admin/NotificacoesConfig";
import FaturasPagamentos from "./pages/admin/FaturasPagamentos";
import AssinaturaExpirada from "./pages/AssinaturaExpirada";
import RedefinirSenha from "./pages/admin/RedefinirSenha";
import CalendarioAcademico from "./pages/admin/CalendarioAcademico";
import ExportarSAFT from "./pages/admin/ExportarSAFT";
import Biblioteca from "./pages/admin/Biblioteca";
import EventosGovernamentais from "./pages/admin/EventosGovernamentais";
import Chat from "./pages/Chat";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Component to handle tenant loading state
const TenantGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { loading, error, isMainDomain, isSuperAdmin } = useTenant();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // If there's an error and we're on a subdomain (not main domain), show error
  if (error && !isMainDomain && !isSuperAdmin) {
    return <TenantNotFound />;
  }

  return <>{children}</>;
};

const AppRoutes = () => {
  const { isMainDomain, isSuperAdmin, instituicao } = useTenant();

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Routes>
        {/* Landing page for main domain without auth */}
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/acesso-negado" element={<AccessDenied />} />
        <Route path="/inadimplencia" element={<InadimplenciaBloqueio />} />
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/vendas" element={<VendasLanding />} />
        <Route path="/inscricao" element={<Inscricao />} />
        <Route path="/redefinir-senha" element={<ResetPassword />} />
        
        {/* Rota de Onboarding - protegida via ProtectedRoute */}
        <Route
          path="/onboarding"
          element={
            <ProtectedRoute>
              <Onboarding />
            </ProtectedRoute>
          }
        />
        
        {/* Rotas Super Admin - only accessible from main domain */}
        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COMERCIAL']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/exportar-saft"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <ExportarSAFT />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/*"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'COMERCIAL']}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        
        {/* Rotas Admin */}
        <Route
          path="/admin-dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-academica"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA']}>
              <GestaoAcademica />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-professores"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <GestaoProfessores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/criar-professor"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CriarProfessor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/editar-professor/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditarProfessor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/criar-aluno"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <CriarAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/editar-aluno/:id"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EditarAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-alunos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <GestaoAlunos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-moradias"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <GestaoMoradias />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/pagamentos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'FINANCEIRO', 'POS']}>
              <SecretariaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-secretaria"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <SecretariaDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ponto-de-venda"
          element={
            <ProtectedRoute allowedRoles={['POS', 'ADMIN']}>
              <POSDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-financeira"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'FINANCEIRO']}>
              <GestaoFinanceira />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/configuracoes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ConfiguracoesInstituicao />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/configuracao-multas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA']}>
              <ConfiguracaoMultas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/gestao-secretaria"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <GestaoSecretaria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/comunicados"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <ComunicadosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/emails"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <EmailsEnviados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/documentos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DocumentosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/documentos-alunos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DocumentosAlunos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/certificados"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Certificados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/boletim"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Boletim />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/analytics"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Analytics />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/bolsas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <BolsasDescontos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/configuracao-ensino"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR']}>
              <ConfiguracaoEnsino />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/plano-ensino"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA']}>
              <PlanoEnsino />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/plano-ensino"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR']}>
              <PlanoEnsino />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/biblioteca"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'SUPER_ADMIN']}>
              <Biblioteca />
            </ProtectedRoute>
          }
        />
        <Route
          path="/biblioteca"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ALUNO', 'ADMIN', 'SUPER_ADMIN', 'SECRETARIA']}>
              <Biblioteca />
            </ProtectedRoute>
          }
        />
        <Route
          path="/video-aulas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR', 'SECRETARIA', 'SUPER_ADMIN', 'DIRECAO', 'COORDENADOR']}>
              <VideoAulas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR', 'ALUNO', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'SUPER_ADMIN']}>
              <Chat />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/avaliacoes-notas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR', 'SECRETARIA']}>
              <AvaliacoesNotas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/lancamento-aulas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR']}>
              <LancamentoAulas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/presencas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'PROFESSOR', 'SECRETARIA']}>
              <ControlePresencas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/auditoria"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'DIRECAO', 'COORDENADOR', 'AUDITOR']}>
              <Auditoria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/logs"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <LogsAuditoria />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/seguranca"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <PainelSeguranca />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/backup"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <Backup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/recursos-humanos"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN', 'SECRETARIA', 'DIRECAO', 'COORDENADOR', 'RH']}>
              <RecursosHumanos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/notificacoes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <NotificacoesConfig />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/minha-assinatura"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'FINANCEIRO', 'POS']}>
              <FaturasPagamentos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/redefinir-senha"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <RedefinirSenha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/super-admin/redefinir-senha"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <RedefinirSenha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/calendario"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SECRETARIA', 'PROFESSOR']}>
              <CalendarioAcademico />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/exportar-saft"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <ExportarSAFT />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin-dashboard/eventos-governamentais"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']}>
              <EventosGovernamentais />
            </ProtectedRoute>
          }
        />
        <Route path="/assinatura-expirada" element={<AssinaturaExpirada />} />
        <Route
          path="/admin-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Rotas Secretaria */}
        <Route
          path="/secretaria-dashboard"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <GestaoAlunos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/alunos"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <GestaoAlunos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/matriculas"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <GestaoAcademica />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/criar-aluno"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <CriarAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/editar-aluno/:id"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <EditarAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/bolsas"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <BolsasDescontos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/certificados"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <Certificados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/boletim"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <Boletim />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/documentos"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <DocumentosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/documentos-alunos"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <DocumentosAlunos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/relatorios-oficiais"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA', 'DIRECAO', 'COORDENADOR']}>
              <RelatoriosOficiais />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/comunicados"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <ComunicadosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/emails"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <EmailsEnviados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/secretaria-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={['SECRETARIA']}>
              <GestaoAlunos />
            </ProtectedRoute>
          }
        />

        {/* Rotas Professor */}
        <Route
          path="/painel-professor"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <ProfessorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/turmas"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <MinhasTurmasProfessor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/notas"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <GestaoNotas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/frequencia"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <GestaoFrequencia />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/relatorios"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <ProfessorRelatorios />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/comunicados"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <MuralComunicados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-professor/*"
          element={
            <ProtectedRoute allowedRoles={['PROFESSOR', 'ADMIN']}>
              <ProfessorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Rotas Aluno */}
        <Route
          path="/painel-aluno"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <AlunoDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/historico"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <HistoricoAcademico />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/mensalidades"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <MinhasMensalidades />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/comunicados"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <MuralComunicados />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/documentos"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <MeusDocumentos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/boletim"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <MeuBoletim />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/aproveitamento"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <AproveitamentoAcademico />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/calendario"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <CalendarioAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/horarios"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <HorariosAluno />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-aluno/*"
          element={
            <ProtectedRoute allowedRoles={['ALUNO']}>
              <AlunoDashboard />
            </ProtectedRoute>
          }
        />

        {/* Rotas Responsável */}
        <Route
          path="/painel-responsavel"
          element={
            <ProtectedRoute allowedRoles={['RESPONSAVEL']}>
              <ResponsavelDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/painel-responsavel/*"
          element={
            <ProtectedRoute allowedRoles={['RESPONSAVEL']}>
              <ResponsavelDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <InstituicaoProvider>
            <PromotionalContentGuard />
            <FaviconUpdater />
            <ThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <ErrorBoundary>
                  <TenantGate>
                    <AppRoutes />
                  </TenantGate>
                </ErrorBoundary>
              </TooltipProvider>
            </ThemeProvider>
          </InstituicaoProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
