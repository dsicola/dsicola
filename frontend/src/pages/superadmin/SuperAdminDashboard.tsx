import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Users, BarChart3, Lock, Rocket, CreditCard, ExternalLink, RefreshCw, UserPlus, FileText, Download, Video, Briefcase, UserCog, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstituicoesTab } from '@/components/superadmin/InstituicoesTab';
import { SuperAdminUsersTab } from '@/components/superadmin/SuperAdminUsersTab';
import { AdminsInstituicoesTab } from '@/components/superadmin/AdminsInstituicoesTab';
import { EstatisticasTab } from '@/components/superadmin/EstatisticasTab';
import { SegurancaTab } from '@/components/superadmin/SegurancaTab';
import { OnboardingInstituicaoForm } from '@/components/superadmin/OnboardingInstituicaoForm';
import { AssinaturasTab } from '@/components/superadmin/AssinaturasTab';
import { PagamentosLicencaTab } from '@/components/superadmin/PagamentosLicencaTab';
import { LeadsTab } from '@/components/superadmin/LeadsTab';
import { PlanosTab } from '@/components/superadmin/PlanosTab';
import { LandingConfigTab } from '@/components/superadmin/LandingConfigTab';
import { SuperAdminBackupSystem } from '@/components/superadmin/SuperAdminBackupSystem';
import { GestaoVideoAulasTab } from '@/components/superadmin/GestaoVideoAulasTab';
import { EquipeComercialTab } from '@/components/superadmin/EquipeComercialTab';
import { generateFullProjectPDF } from '@/utils/fullProjectGenerator';
import { toast } from 'sonner';

const TABS_VALIDAS = ['leads', 'onboarding', 'instituicoes', 'planos', 'assinaturas', 'pagamentos-licenca', 'landing', 'equipe-comercial', 'usuarios', 'admins-instituicoes', 'estatisticas', 'backup', 'seguranca', 'videoaulas'];

const SuperAdminDashboard = () => {
  const { role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const isComercial = role === 'COMERCIAL';
  const activeTab = searchParams.get('tab') || 'instituicoes';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  useEffect(() => {
    // Tab inválida ou inexistente → redirecionar para instituições
    if (!TABS_VALIDAS.includes(activeTab)) {
      setSearchParams({ tab: 'instituicoes' });
      return;
    }
    // COMERCIAL: apenas tabs comerciais
    const tabsComercial = ['onboarding', 'instituicoes', 'planos', 'assinaturas', 'pagamentos-licenca'];
    if (isComercial && !tabsComercial.includes(activeTab)) {
      setSearchParams({ tab: 'instituicoes' });
    }
  }, [isComercial, activeTab, setSearchParams]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-xl p-4 sm:p-6 border border-primary/20 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3 sm:gap-4 min-w-0">
              <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-xl sm:rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl font-bold text-foreground leading-tight">
                  Administração Global DSICOLA
                </h1>
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                  {isComercial ? 'Painel comercial: instituições, assinaturas e pagamentos' : 'Painel de controle exclusivo para Super Administradores'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              {!isComercial && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    toast.info('Gerando PDF completo do projeto...');
                    generateFullProjectPDF();
                    toast.success('PDF completo do projeto gerado!');
                  }}
                  className="flex items-center gap-2 min-h-[40px] touch-manipulation"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">PDF Completo</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('/vendas', '_blank')}
                className="flex items-center gap-2 min-h-[40px] touch-manipulation"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Landing de Vendas</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs - Estrutura: Comercial | Marketing | Equipe | Sistema */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4 overflow-hidden">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 overflow-x-auto overflow-y-hidden scrollbar-hide justify-start min-h-[44px]">
            {/* Fluxo Comercial */}
            {!isComercial && (
              <TabsTrigger value="leads" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Leads</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="onboarding" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
              <Rocket className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">Onboarding</span>
            </TabsTrigger>
            <TabsTrigger value="instituicoes" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">Instituições</span>
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
              <Package className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="assinaturas" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">Assinaturas</span>
            </TabsTrigger>
            <TabsTrigger value="pagamentos-licenca" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
              <CreditCard className="h-4 w-4 shrink-0" />
              <span className="hidden xs:inline">Pagamentos</span>
            </TabsTrigger>
            {/* Marketing, Equipe e Sistema - apenas SUPER_ADMIN */}
            {!isComercial && (
              <>
                <TabsTrigger value="landing" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Landing</span>
                </TabsTrigger>
                <TabsTrigger value="equipe-comercial" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <UserCog className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Equipe</span>
                </TabsTrigger>
                <TabsTrigger value="usuarios" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <Shield className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Super Admins</span>
                </TabsTrigger>
                <TabsTrigger value="admins-instituicoes" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Admins</span>
                </TabsTrigger>
                <TabsTrigger value="estatisticas" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <BarChart3 className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Stats</span>
                </TabsTrigger>
                <TabsTrigger value="backup" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Backup</span>
                </TabsTrigger>
                <TabsTrigger value="seguranca" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <Lock className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Segurança</span>
                </TabsTrigger>
                <TabsTrigger value="videoaulas" className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 min-h-[40px] touch-manipulation shrink-0">
                  <Video className="h-4 w-4 shrink-0" />
                  <span className="hidden xs:inline">Vídeos</span>
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <TabsContent value="leads">
            <LeadsTab />
          </TabsContent>

          <TabsContent value="onboarding">
            <OnboardingInstituicaoForm />
          </TabsContent>

          <TabsContent value="instituicoes">
            <InstituicoesTab />
          </TabsContent>

          <TabsContent value="planos">
            <PlanosTab />
          </TabsContent>

          <TabsContent value="assinaturas">
            <AssinaturasTab />
          </TabsContent>

          <TabsContent value="pagamentos-licenca">
            <PagamentosLicencaTab />
          </TabsContent>

          <TabsContent value="landing">
            <LandingConfigTab />
          </TabsContent>

          <TabsContent value="equipe-comercial">
            <EquipeComercialTab />
          </TabsContent>

          <TabsContent value="usuarios">
            <SuperAdminUsersTab />
          </TabsContent>

          <TabsContent value="admins-instituicoes">
            <AdminsInstituicoesTab />
          </TabsContent>

          <TabsContent value="estatisticas">
            <EstatisticasTab />
          </TabsContent>

          <TabsContent value="backup">
            <SuperAdminBackupSystem />
          </TabsContent>

          <TabsContent value="seguranca">
            <SegurancaTab />
          </TabsContent>

          <TabsContent value="videoaulas">
            <GestaoVideoAulasTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
