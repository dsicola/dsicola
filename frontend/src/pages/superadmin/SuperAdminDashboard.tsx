import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, Building2, Users, BarChart3, Lock, Rocket, CreditCard, Package, ExternalLink, RefreshCw, UserPlus, FileText, Download, Video, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InstituicoesTab } from '@/components/superadmin/InstituicoesTab';
import { SuperAdminUsersTab } from '@/components/superadmin/SuperAdminUsersTab';
import { AdminsInstituicoesTab } from '@/components/superadmin/AdminsInstituicoesTab';
import { EstatisticasTab } from '@/components/superadmin/EstatisticasTab';
import { SegurancaTab } from '@/components/superadmin/SegurancaTab';
import { OnboardingInstituicaoForm } from '@/components/superadmin/OnboardingInstituicaoForm';
import { PlanosTab } from '@/components/superadmin/PlanosTab';
import { AssinaturasTab } from '@/components/superadmin/AssinaturasTab';
import { PagamentosLicencaTab } from '@/components/superadmin/PagamentosLicencaTab';
import { LeadsTab } from '@/components/superadmin/LeadsTab';
import { LandingConfigTab } from '@/components/superadmin/LandingConfigTab';
import { SuperAdminBackupSystem } from '@/components/superadmin/SuperAdminBackupSystem';
import { GestaoVideoAulasTab } from '@/components/superadmin/GestaoVideoAulasTab';
import { generateFullProjectPDF } from '@/utils/fullProjectGenerator';
import { toast } from 'sonner';

const SuperAdminDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'instituicoes'; // Default para instituições

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-xl p-6 border border-primary/20">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  Administração Global da Plataforma DSICOLA
                </h1>
                <p className="text-muted-foreground mt-1">
                  Painel de controle exclusivo para Super Administradores
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  toast.info('Gerando PDF completo do projeto...');
                  generateFullProjectPDF();
                  toast.success('PDF completo do projeto gerado!');
                }}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">PDF Completo</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open('/vendas', '_blank')}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Landing de Vendas</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="leads" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Leads</span>
            </TabsTrigger>
            <TabsTrigger value="onboarding" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Onboarding</span>
            </TabsTrigger>
            <TabsTrigger value="instituicoes" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Instituições</span>
            </TabsTrigger>
            <TabsTrigger value="planos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Planos</span>
            </TabsTrigger>
            <TabsTrigger value="assinaturas" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Assinaturas</span>
            </TabsTrigger>
            <TabsTrigger value="pagamentos-licenca" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">Pagamentos</span>
            </TabsTrigger>
            <TabsTrigger value="landing" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Landing</span>
            </TabsTrigger>
            <TabsTrigger value="usuarios" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Super Admins</span>
            </TabsTrigger>
            <TabsTrigger value="admins-instituicoes" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Admins Instituições</span>
            </TabsTrigger>
            <TabsTrigger value="estatisticas" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Estatísticas</span>
            </TabsTrigger>
            <TabsTrigger value="backup" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">Backup</span>
            </TabsTrigger>
            <TabsTrigger value="seguranca" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Segurança</span>
            </TabsTrigger>
            <TabsTrigger value="videoaulas" className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              <span className="hidden sm:inline">Videoaulas</span>
            </TabsTrigger>
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
