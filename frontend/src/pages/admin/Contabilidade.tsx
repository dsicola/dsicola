import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, FileText, BarChart3, Scale, TrendingUp, FileDown, ScrollText, Lock, Settings, PieChart, Zap, LayoutDashboard, BookMarked } from 'lucide-react';
import { PlanoContasTab } from '@/components/contabilidade/PlanoContasTab';
import { ConfiguracaoContabilidadeTab } from '@/components/contabilidade/ConfiguracaoContabilidadeTab';
import { CentroCustosTab } from '@/components/contabilidade/CentroCustosTab';
import { LancamentosTab } from '@/components/contabilidade/LancamentosTab';
import { BalanceteTab } from '@/components/contabilidade/BalanceteTab';
import { BalancoTab } from '@/components/contabilidade/BalancoTab';
import { DRETab } from '@/components/contabilidade/DRETab';
import { RazaoTab } from '@/components/contabilidade/RazaoTab';
import { FechoExercicioTab } from '@/components/contabilidade/FechoExercicioTab';
import { ExportacaoContabilistasTab } from '@/components/contabilidade/ExportacaoContabilistasTab';
import { RegrasContabeisTab } from '@/components/contabilidade/RegrasContabeisTab';
import { DashboardContabilTab } from '@/components/contabilidade/DashboardContabilTab';
import { DiarioTab } from '@/components/contabilidade/DiarioTab';

const Contabilidade = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['dashboard', 'plano', 'config', 'regras', 'centros-custo', 'lancamentos', 'diario', 'balancete', 'razao', 'balanco', 'dre', 'fecho', 'exportacao'];
  const getTabFromUrl = (): string => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) return tab;
    return 'dashboard';
  };
  const [activeTab, setActiveTab] = useState(() => getTabFromUrl());

  useEffect(() => {
    setActiveTab(getTabFromUrl());
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams({ tab: value });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Contabilidade
          </h1>
          <p className="text-muted-foreground">
            Plano de contas, lançamentos contábeis, balancete, relatórios (Balanço, DRE) e exportação para contabilistas
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Cada aba tem uma descrição no topo. Comece por <strong>Plano de Contas</strong> e <strong>Configuração</strong>, depois use <strong>Integração Contábil</strong> para mapear eventos às contas.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="flex items-center gap-2">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="plano" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plano de Contas</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configuração</span>
            </TabsTrigger>
            <TabsTrigger value="regras" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Integração Contábil</span>
            </TabsTrigger>
            <TabsTrigger value="centros-custo" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Centros de Custo</span>
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="diario" className="flex items-center gap-2">
              <BookMarked className="h-4 w-4" />
              <span className="hidden sm:inline">Diário</span>
            </TabsTrigger>
            <TabsTrigger value="balancete" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Balancete</span>
            </TabsTrigger>
            <TabsTrigger value="razao" className="flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              <span className="hidden sm:inline">Razão</span>
            </TabsTrigger>
            <TabsTrigger value="balanco" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Balanço</span>
            </TabsTrigger>
            <TabsTrigger value="dre" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">DRE</span>
            </TabsTrigger>
            <TabsTrigger value="fecho" className="flex items-center gap-2">
              <Lock className="h-4 w-4" />
              <span className="hidden sm:inline">Fecho</span>
            </TabsTrigger>
            <TabsTrigger value="exportacao" className="flex items-center gap-2">
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline">Exportação</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="dashboard">
            <DashboardContabilTab />
          </TabsContent>
          <TabsContent value="plano">
            <PlanoContasTab />
          </TabsContent>
          <TabsContent value="config">
            <ConfiguracaoContabilidadeTab />
          </TabsContent>
          <TabsContent value="regras">
            <RegrasContabeisTab />
          </TabsContent>
          <TabsContent value="centros-custo">
            <CentroCustosTab />
          </TabsContent>
          <TabsContent value="lancamentos">
            <LancamentosTab />
          </TabsContent>
          <TabsContent value="diario">
            <DiarioTab />
          </TabsContent>
          <TabsContent value="balancete">
            <BalanceteTab />
          </TabsContent>
          <TabsContent value="razao">
            <RazaoTab />
          </TabsContent>
          <TabsContent value="balanco">
            <BalancoTab />
          </TabsContent>
          <TabsContent value="dre">
            <DRETab />
          </TabsContent>
          <TabsContent value="fecho">
            <FechoExercicioTab />
          </TabsContent>
          <TabsContent value="exportacao">
            <ExportacaoContabilistasTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Contabilidade;
