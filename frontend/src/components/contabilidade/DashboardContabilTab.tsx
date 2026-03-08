import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { useFormatarMoeda } from './useFormatarMoeda';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LayoutDashboard, Wallet, Building2, TrendingUp, TrendingDown } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export const DashboardContabilTab = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const { formatar } = useFormatarMoeda();

  const { data, isLoading } = useQuery({
    queryKey: ['contabilidade-dashboard', instituicaoId],
    queryFn: () => contabilidadeApi.getDashboard(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 w-24 rounded bg-muted" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-20 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const saldoCaixa = data?.saldoCaixa ?? 0;
  const saldoBancos = data?.saldoBancos ?? 0;
  const receitasMes = data?.receitasMes ?? 0;
  const despesasMes = data?.despesasMes ?? 0;
  const resultadoMes = data?.resultadoMes ?? 0;
  const chartData = data?.receitasVsDespesas12Meses ?? [];

  // Variação vs mês anterior (para indicador)
  const receitasMesAnt = chartData.length >= 2 ? chartData[chartData.length - 2]?.receitas ?? 0 : 0;
  const despesasMesAnt = chartData.length >= 2 ? chartData[chartData.length - 2]?.despesas ?? 0 : 0;
  const varReceitas = receitasMesAnt > 0 ? ((receitasMes - receitasMesAnt) / receitasMesAnt) * 100 : 0;
  const varDespesas = despesasMesAnt > 0 ? ((despesasMes - despesasMesAnt) / despesasMesAnt) * 100 : 0;

  const cards = [
    {
      title: 'Saldo Caixa',
      value: saldoCaixa,
      icon: Wallet,
      className: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Saldo Bancos',
      value: saldoBancos,
      icon: Building2,
      className: 'text-blue-600 dark:text-blue-400',
    },
    {
      title: 'Receitas do mês',
      value: receitasMes,
      icon: TrendingUp,
      className: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      title: 'Despesas do mês',
      value: despesasMes,
      icon: TrendingDown,
      className: 'text-rose-600 dark:text-rose-400',
    },
    {
      title: 'Resultado do mês',
      value: resultadoMes,
      icon: resultadoMes >= 0 ? TrendingUp : TrendingDown,
      className: resultadoMes >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5" />
          Visão geral
        </h2>
        <p className="text-sm text-muted-foreground">
          Saldos atuais e movimentos do mês. Gráfico com receitas vs despesas nos últimos 12 meses.
          {receitasMesAnt > 0 && (
            <span className="ml-2 text-xs">
              Receitas: {varReceitas >= 0 ? '+' : ''}{varReceitas.toFixed(1)}% vs mês ant. · Despesas: {varDespesas >= 0 ? '+' : ''}{varDespesas.toFixed(1)}% vs mês ant.
            </span>
          )}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.className}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c.className}`}>{formatar(c.value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receitas vs Despesas (12 meses)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Evolução mensal para acompanhar a saúde financeira da instituição.
          </p>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mesLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value: number) => formatar(value)}
                  labelFormatter={(label) => label}
                />
                <Legend />
                <Bar dataKey="receitas" name="Receitas" fill="rgb(34 197 94)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesas" name="Despesas" fill="rgb(244 63 94)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Sem dados para exibir. Crie lançamentos para ver o gráfico.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
