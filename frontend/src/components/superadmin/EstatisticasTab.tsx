import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Users, GraduationCap, DollarSign, Building2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { statsApi } from '@/services/api';

interface Stats {
  totalAlunos: number;
  totalProfessores: number;
  totalPagamentos: number;
  valorTotalPago: number;
  instituicoes: {
    nome: string;
    subdominio: string;
    alunos: number;
    professores: number;
    pagamentos: number;
  }[];
}

export const EstatisticasTab = () => {
  const [stats, setStats] = useState<Stats>({
    totalAlunos: 0,
    totalProfessores: 0,
    totalPagamentos: 0,
    valorTotalPago: 0,
    instituicoes: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      // Fetch super admin stats from API
      const statsData = await statsApi.getSuperAdminStats();

      setStats({
        totalAlunos: statsData?.totalAlunos || 0,
        totalProfessores: statsData?.totalProfessores || 0,
        totalPagamentos: statsData?.totalPagamentos || 0,
        valorTotalPago: statsData?.valorTotalPago || 0,
        instituicoes: (statsData?.instituicoes || []).map((inst: any) => ({
          nome: inst.nome,
          subdominio: inst.subdominio,
          alunos: inst.totalAlunos || 0,
          professores: inst.totalProfessores || 0,
          pagamentos: inst.totalPagamentos || 0,
        })),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast.error('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-AO', {
      style: 'currency',
      currency: 'AOA',
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Estudantes</CardTitle>
            <GraduationCap className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAlunos}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as instituições
            </p>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Professores</CardTitle>
            <Users className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProfessores}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as instituições
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamentos Realizados</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPagamentos}</div>
            <p className="text-xs text-muted-foreground">
              Mensalidades pagas
            </p>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Arrecadado</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.valorTotalPago)}</div>
            <p className="text-xs text-muted-foreground">
              Em todas as instituições
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stats per Institution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estatísticas por Instituição
          </CardTitle>
          <CardDescription>
            Dados detalhados de cada instituição cadastrada
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.instituicoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma instituição cadastrada</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Subdomínio</TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <GraduationCap className="h-4 w-4" />
                        Alunos
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-4 w-4" />
                        Professores
                      </div>
                    </TableHead>
                    <TableHead className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <DollarSign className="h-4 w-4" />
                        Pagamentos
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.instituicoes.map((inst) => (
                    <TableRow key={inst.subdominio}>
                      <TableCell className="font-medium">{inst.nome}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {inst.subdominio}.dsicola.com
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                          {inst.alunos}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-green-500/10 text-green-500 font-medium">
                          {inst.professores}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-purple-500/10 text-purple-500 font-medium">
                          {inst.pagamentos}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
