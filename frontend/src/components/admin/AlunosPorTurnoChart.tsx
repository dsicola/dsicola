import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { safeToFixed } from '@/lib/utils';
import { turmasApi, matriculasApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Loader2, Users, Sun, Sunset, Moon, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTenantFilter } from '@/hooks/useTenantFilter';

interface TurnoData {
  turno: string;
  alunos: number;
  turmas: number;
  color: string;
  icon: React.ReactNode;
}

const getTurnoColor = (turnoNome: string): string => {
  const nomeLower = String(turnoNome ?? '').toLowerCase();
  if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return '#f59e0b';
  if (nomeLower.includes('tarde')) return '#f97316';
  if (nomeLower.includes('noite')) return '#6366f1';
  return '#6b7280';
};

const getTurnoIcon = (turnoNome: string) => {
  const nomeLower = String(turnoNome ?? '').toLowerCase();
  if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-4 w-4" />;
  if (nomeLower.includes('tarde')) return <Sunset className="h-4 w-4" />;
  if (nomeLower.includes('noite')) return <Moon className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
};

export const AlunosPorTurnoChart: React.FC = () => {
  const { instituicaoId, isSuperAdmin } = useTenantFilter();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ['alunos-por-turno-chart', instituicaoId],
    queryFn: async () => {
      // Fetch turmas with turno - filtered by institution
      const turmas = await turmasApi.getAll({ instituicaoId: instituicaoId || undefined });

      if (!turmas || turmas.length === 0) return [];

      // Count students per turma
      const alunosPorTurma: Record<string, number> = {};
      
      for (const turma of turmas) {
        const res = await matriculasApi.getAll({ turmaId: turma.id });
        const matriculas = res?.data ?? [];
        const activeMatriculas = matriculas.filter((m: any) => m.status === 'Ativa' || m.status === 'ativa');
        alunosPorTurma[turma.id] = activeMatriculas.length;
      }

      // Group by turno
      const turnoStats: Record<string, { alunos: number; turmas: number }> = {};
      
      turmas.forEach((t: any) => {
        const turnoKey = t.turno || 'Sem turno';
        if (!turnoStats[turnoKey]) {
          turnoStats[turnoKey] = { alunos: 0, turmas: 0 };
        }
        turnoStats[turnoKey].turmas++;
        turnoStats[turnoKey].alunos += alunosPorTurma[t.id] || 0;
      });

      // Format for chart
      const result: TurnoData[] = Object.entries(turnoStats).map(([turno, stats]) => ({
        turno,
        alunos: stats.alunos,
        turmas: stats.turmas,
        color: getTurnoColor(turno),
        icon: getTurnoIcon(turno),
      }));

      return result.sort((a, b) => b.alunos - a.alunos);
    },
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const totalAlunos = chartData?.reduce((acc, item) => acc + item.alunos, 0) || 0;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuição de Alunos por Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-[300px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Distribuição de Alunos por Turno
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col justify-center items-center h-[300px] text-muted-foreground">
          <Users className="h-12 w-12 mb-2 opacity-50" />
          <p>Nenhum dado disponível</p>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium flex items-center gap-2">
            {data.icon}
            {data.turno}
          </p>
          <p className="text-sm text-muted-foreground">
            {data.alunos} aluno(s) • {data.turmas} turma(s)
          </p>
          <p className="text-sm text-muted-foreground">
            {safeToFixed(totalAlunos > 0 ? (data.alunos / totalAlunos) * 100 : 0)}% do total
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
      >
        {`${safeToFixed(percent != null ? percent * 100 : 0, 0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Distribuição de Alunos por Turno
        </CardTitle>
        <CardDescription>
          Total de {totalAlunos} aluno(s) matriculado(s)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pie">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="pie">Pizza</TabsTrigger>
            <TabsTrigger value="bar">Barras</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pie">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomLabel}
                    outerRadius={100}
                    dataKey="alunos"
                    nameKey="turno"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    formatter={(value) => <span className="text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
          
          <TabsContent value="bar">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis 
                    type="category" 
                    dataKey="turno" 
                    width={80}
                    className="text-xs"
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="alunos" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          {chartData.map((item) => (
            <div
              key={item.turno}
              className="p-2 rounded-lg border text-center"
              style={{ borderColor: item.color }}
            >
              <div className="flex items-center justify-center gap-1 text-sm font-medium" style={{ color: item.color }}>
                {item.icon}
                {item.turno}
              </div>
              <div className="text-lg font-bold">{item.alunos}</div>
              <div className="text-xs text-muted-foreground">{item.turmas} turma(s)</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};