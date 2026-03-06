import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, FileText, BarChart3 } from 'lucide-react';
import { PlanoContasTab } from '@/components/contabilidade/PlanoContasTab';
import { LancamentosTab } from '@/components/contabilidade/LancamentosTab';
import { BalanceteTab } from '@/components/contabilidade/BalanceteTab';

const Contabilidade = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['plano', 'lancamentos', 'balancete'];
  const getTabFromUrl = (): string => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) return tab;
    return 'plano';
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
            Plano de contas, lançamentos contábeis e balancete
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="plano" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Plano de Contas</span>
            </TabsTrigger>
            <TabsTrigger value="lancamentos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Lançamentos</span>
            </TabsTrigger>
            <TabsTrigger value="balancete" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Balancete</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="plano">
            <PlanoContasTab />
          </TabsContent>
          <TabsContent value="lancamentos">
            <LancamentosTab />
          </TabsContent>
          <TabsContent value="balancete">
            <BalanceteTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Contabilidade;
