import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { AnoLetivoContextHeader } from '@/components/dashboard/AnoLetivoContextHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Briefcase, BarChart3, Calendar, DollarSign, FileText, Fingerprint, Network, Store } from 'lucide-react';
import { FuncionariosRHTab } from '@/components/rh/FuncionariosRHTab';
import { FornecedoresTab } from '@/components/rh/FornecedoresTab';
import { DepartamentosTab } from '@/components/rh/DepartamentosTab';
import { CargosTab } from '@/components/rh/CargosTab';
import { RelatoriosRHTab } from '@/components/rh/RelatoriosRHTab';
import { FrequenciaFuncionariosTab } from '@/components/rh/FrequenciaFuncionariosTab';
import { FolhaPagamentoTab } from '@/components/rh/FolhaPagamentoTab';
import { ContratosTab } from '@/components/rh/ContratosTab';
import { DispositivosBiometricosTab } from '@/components/rh/DispositivosBiometricosTab';
import { EstruturaOrganizacionalTab } from '@/components/rh/EstruturaOrganizacionalTab';

const RecursosHumanos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Valid tabs
  const validTabs = ['estrutura', 'funcionarios', 'frequencia', 'folha', 'contratos', 'fornecedores', 'departamentos', 'cargos', 'relatorios', 'biometricos'];
  
  // Get tab from URL or default
  const getTabFromUrl = (): string => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) {
      return tab;
    }
    return 'estrutura';
  };
  
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());
  
  // Update tab when URL changes
  useEffect(() => {
    const tab = getTabFromUrl();
    setActiveTab(tab);
  }, [searchParams]);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <AnoLetivoContextHeader showBannerWhenInactive={false} userRole="RH" />
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Recursos Humanos
          </h1>
          <p className="text-muted-foreground">
            Gerencie funcionários, frequência, folha de pagamento, contratos e documentação
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="estrutura" className="flex items-center gap-2">
              <Network className="h-4 w-4" />
              <span className="hidden sm:inline">Estrutura Organizacional</span>
            </TabsTrigger>
            <TabsTrigger value="funcionarios" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Funcionários</span>
            </TabsTrigger>
            <TabsTrigger value="frequencia" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Frequência</span>
            </TabsTrigger>
            <TabsTrigger value="folha" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Folha Pagamento</span>
            </TabsTrigger>
            <TabsTrigger value="contratos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Contratos</span>
            </TabsTrigger>
            <TabsTrigger value="fornecedores" className="flex items-center gap-2">
              <Store className="h-4 w-4" />
              <span className="hidden sm:inline">Fornecedores</span>
            </TabsTrigger>
            <TabsTrigger value="departamentos" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Departamentos</span>
            </TabsTrigger>
            <TabsTrigger value="cargos" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline">Cargos</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="biometricos" className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              <span className="hidden sm:inline">Dispositivos Biométricos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="estrutura">
            <EstruturaOrganizacionalTab />
          </TabsContent>

          <TabsContent value="funcionarios">
            <FuncionariosRHTab />
          </TabsContent>

          <TabsContent value="frequencia">
            <FrequenciaFuncionariosTab />
          </TabsContent>

          <TabsContent value="folha">
            <FolhaPagamentoTab />
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
