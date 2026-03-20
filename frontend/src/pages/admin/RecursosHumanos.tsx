import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnoLetivoContextHeader } from '@/components/dashboard/AnoLetivoContextHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Briefcase, BarChart3, Calendar, DollarSign, FileText, Fingerprint, Network, Store, Shield } from 'lucide-react';
import { FuncionariosRHTab } from '@/components/rh/FuncionariosRHTab';
import { FornecedoresTab } from '@/components/rh/FornecedoresTab';
import { DepartamentosTab } from '@/components/rh/DepartamentosTab';
import { CargosTab } from '@/components/rh/CargosTab';
import { RelatoriosRHTab } from '@/components/rh/RelatoriosRHTab';
import { FrequenciaFuncionariosTab } from '@/components/rh/FrequenciaFuncionariosTab';
import { FolhaPagamentoTab } from '@/components/rh/FolhaPagamentoTab';
import { FolhaProfessoresTab } from '@/components/rh/FolhaProfessoresTab';
import { ContratosTab } from '@/components/rh/ContratosTab';
import { DispositivosBiometricosTab } from '@/components/rh/DispositivosBiometricosTab';
import { EstruturaOrganizacionalTab } from '@/components/rh/EstruturaOrganizacionalTab';
import { PermissoesRbacTab } from '@/components/rh/PermissoesRbacTab';

const RH_VALID_TABS = [
  'estrutura',
  'permissoes',
  'funcionarios',
  'frequencia',
  'folha',
  'contratos',
  'fornecedores',
  'departamentos',
  'cargos',
  'relatorios',
  'biometricos',
] as const;

const RecursosHumanos = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const getTabFromUrl = (): string => {
    const tab = searchParams.get('tab');
    if (tab && (RH_VALID_TABS as readonly string[]).includes(tab)) {
      return tab;
    }
    return 'estrutura';
  };

  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());

  useEffect(() => {
    const tab = getTabFromUrl();
    setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  /** Sempre mostrar ícone + texto (scroll horizontal em mobile) — evita abas ambíguas só com ícone. */
  const tabTriggerClass =
    'flex items-center gap-1.5 sm:gap-2 shrink-0 px-2.5 sm:px-3 py-2 text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="RH" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t('pages.recursosHumanos.title')}
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">{t('pages.recursosHumanos.subtitle')}</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <p className="text-xs text-muted-foreground md:hidden">{t('pages.recursosHumanos.tabsScrollHint')}</p>
          <div className="w-full overflow-x-auto pb-1 -mx-1 px-1">
            <TabsList className="inline-flex h-auto min-h-10 w-max max-w-full flex-wrap gap-1 p-1">
              <TabsTrigger value="estrutura" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.structure')}>
                <Network className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.structure')}</span>
              </TabsTrigger>
              <TabsTrigger value="permissoes" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.access')}>
                <Shield className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.access')}</span>
              </TabsTrigger>
              <TabsTrigger value="funcionarios" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.employees')}>
                <Users className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.employees')}</span>
              </TabsTrigger>
              <TabsTrigger value="frequencia" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.attendance')}>
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.attendance')}</span>
              </TabsTrigger>
              <TabsTrigger value="folha" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.payroll')}>
                <DollarSign className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.payroll')}</span>
              </TabsTrigger>
              <TabsTrigger value="contratos" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.contracts')}>
                <FileText className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.contracts')}</span>
              </TabsTrigger>
              <TabsTrigger value="fornecedores" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.suppliers')}>
                <Store className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.suppliers')}</span>
              </TabsTrigger>
              <TabsTrigger value="departamentos" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.departments')}>
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.departments')}</span>
              </TabsTrigger>
              <TabsTrigger value="cargos" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.roles')}>
                <Briefcase className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.roles')}</span>
              </TabsTrigger>
              <TabsTrigger value="relatorios" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.reports')}>
                <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.reports')}</span>
              </TabsTrigger>
              <TabsTrigger value="biometricos" className={tabTriggerClass} title={t('pages.recursosHumanos.tabs.biometrics')}>
                <Fingerprint className="h-4 w-4 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">{t('pages.recursosHumanos.tabs.biometrics')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="estrutura">
            <EstruturaOrganizacionalTab />
          </TabsContent>

          <TabsContent value="permissoes">
            <PermissoesRbacTab />
          </TabsContent>

          <TabsContent value="funcionarios">
            <FuncionariosRHTab />
          </TabsContent>

          <TabsContent value="frequencia">
            <FrequenciaFuncionariosTab />
          </TabsContent>

          <TabsContent value="folha">
            <Tabs defaultValue="funcionarios" className="space-y-4">
              <TabsList>
                <TabsTrigger value="funcionarios">{t('pages.recursosHumanos.tabs.employees')}</TabsTrigger>
                <TabsTrigger value="professores">{t('pages.recursosHumanos.payrollContractedTeachers')}</TabsTrigger>
              </TabsList>
              <TabsContent value="funcionarios">
                <FolhaPagamentoTab />
              </TabsContent>
              <TabsContent value="professores">
                <FolhaProfessoresTab />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="contratos">
            <ContratosTab />
          </TabsContent>

          <TabsContent value="fornecedores">
            <FornecedoresTab />
          </TabsContent>

          <TabsContent value="departamentos">
            <DepartamentosTab />
          </TabsContent>

          <TabsContent value="cargos">
            <CargosTab />
          </TabsContent>

          <TabsContent value="relatorios">
            <RelatoriosRHTab />
          </TabsContent>

          <TabsContent value="biometricos">
            <DispositivosBiometricosTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RecursosHumanos;
