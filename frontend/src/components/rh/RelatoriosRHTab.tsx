import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, Download, Users, Building2, Briefcase, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { safeToFixed } from '@/lib/utils';
import { funcionariosApi } from '@/services/api';

interface Stats {
  totalFuncionarios: number;
  ativos: number;
  inativos: number;
  porDepartamento: { nome: string; count: number }[];
  porCargo: { nome: string; count: number }[];
  porStatus: { status: string; count: number }[];
}

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

export const RelatoriosRHTab = () => {
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();
  const [stats, setStats] = useState<Stats>({
    totalFuncionarios: 0,
    ativos: 0,
    inativos: 0,
    porDepartamento: [],
    porCargo: [],
    porStatus: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);

  useEffect(() => {
    if (instituicaoId || isSuperAdmin) {
      fetchStats();
    }
  }, [instituicaoId, isSuperAdmin]);

  const fetchStats = async () => {
    setIsLoading(true);

    try {
      const funcData = await funcionariosApi.getAll({ 
        instituicaoId: shouldFilter ? instituicaoId : undefined 
      });

      if (funcData) {
        setFuncionarios(funcData);

        const total = funcData.length;
        const ativos = funcData.filter((f: any) => f.status === 'Ativo').length;
        const inativos = funcData.filter((f: any) => f.status === 'Inativo').length;

        const deptCount: Record<string, number> = {};
        funcData.forEach((f: any) => {
          const deptName = f.departamentos?.nome || 'Sem Departamento';
          deptCount[deptName] = (deptCount[deptName] || 0) + 1;
        });
        const porDepartamento = Object.entries(deptCount).map(([nome, count]) => ({ nome, count }));

        const cargoCount: Record<string, number> = {};
        funcData.forEach((f: any) => {
          const cargoName = f.cargos?.nome || 'Sem Cargo';
          cargoCount[cargoName] = (cargoCount[cargoName] || 0) + 1;
        });
        const porCargo = Object.entries(cargoCount).map(([nome, count]) => ({ nome, count }));

        const statusCount: Record<string, number> = {};
        funcData.forEach((f: any) => {
          statusCount[f.status] = (statusCount[f.status] || 0) + 1;
        });
        const porStatus = Object.entries(statusCount).map(([status, count]) => ({ status, count }));

        setStats({
          totalFuncionarios: total,
          ativos,
          inativos,
          porDepartamento,
          porCargo,
          porStatus,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }

    setIsLoading(false);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Recursos Humanos', 20, 20);
    
    doc.setFontSize(12);
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, 20, 30);
    
    doc.setFontSize(14);
    doc.text('Resumo Geral', 20, 45);
    
    doc.setFontSize(11);
    doc.text(`Total de Funcionários: ${stats.totalFuncionarios}`, 20, 55);
    doc.text(`Ativos: ${stats.ativos}`, 20, 62);
    doc.text(`Inativos: ${stats.inativos}`, 20, 69);
    
    doc.setFontSize(14);
    doc.text('Por Departamento', 20, 85);
    
    let yPos = 95;
    stats.porDepartamento.forEach(d => {
      doc.setFontSize(11);
      doc.text(`${d.nome}: ${d.count}`, 25, yPos);
      yPos += 7;
    });
    
    yPos += 10;
    doc.setFontSize(14);
    doc.text('Por Cargo', 20, yPos);
    
    yPos += 10;
    stats.porCargo.forEach(c => {
      doc.setFontSize(11);
      doc.text(`${c.nome}: ${c.count}`, 25, yPos);
      yPos += 7;
    });
    
    doc.save('relatorio-rh.pdf');
  };

  const exportToExcel = () => {
    const data = funcionarios.map(f => ({
      'Nome': f.profiles?.nome_completo || '',
      'Email': f.profiles?.email || '',
      'Departamento': f.departamentos?.nome || '',
      'Cargo': f.cargos?.nome || '',
      'Salário': f.salario,
      'Data Admissão': f.data_admissao,
      'Status': f.status,
      'Tipo Contrato': f.tipo_contrato,
      'Carga Horária': f.carga_horaria,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Funcionários');
    XLSX.writeFile(wb, 'funcionarios-rh.xlsx');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <Button onClick={exportToPDF} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar PDF
        </Button>
        <Button onClick={exportToExcel} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Exportar Excel
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total de Funcionários</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              {stats.totalFuncionarios}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ativos</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {stats.ativos}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inativos</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {stats.inativos}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Taxa de Atividade</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              {stats.totalFuncionarios > 0 ? Math.round((stats.ativos / stats.totalFuncionarios) * 100) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Funcionários por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.porStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={stats.porStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ status, percent }) => `${status} (${safeToFixed(percent != null ? percent * 100 : 0, 0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                    nameKey="status"
                  >
                    {stats.porStatus.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Funcionários por Departamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.porDepartamento.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={stats.porDepartamento}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#8B5CF6" name="Funcionários" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Funcionários por Cargo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.porCargo.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.porCargo} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="nome" type="category" width={150} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#06B6D4" name="Funcionários" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
