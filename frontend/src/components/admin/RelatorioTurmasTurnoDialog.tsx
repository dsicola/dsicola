import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { turnosApi, turmasApi, matriculasApi } from '@/services/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, Sun, Sunset, Moon, Clock, Printer, Loader2 } from 'lucide-react';
import { useInstituicao } from '@/contexts/InstituicaoContext';

interface TurmaComAlunos {
  id: string;
  nome: string;
  turno: string | null;
  ano: number;
  semestre: string;
  cursos: { nome: string } | null;
  alunosCount: number;
}

interface ResumoTurno {
  turno: string;
  totalTurmas: number;
  totalAlunos: number;
}

export const RelatorioTurmasTurnoDialog: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [filterTurno, setFilterTurno] = useState<string>('all');
  const { instituicao, isSecundario } = useInstituicao();
  const { instituicaoId, shouldFilter } = useTenantFilter();

  const { data: turnos = [] } = useQuery({
    queryKey: ['turnos-ativos-relatorio', instituicaoId],
    queryFn: async () => {
      const data = await turnosApi.getAll({ instituicaoId: shouldFilter ? instituicaoId : undefined });
      return data?.filter((t: any) => t.ativo) || [];
    },
    enabled: open,
  });

  const { data: turmasComAlunos = [], isLoading } = useQuery({
    queryKey: ['turmas-com-alunos', filterTurno, instituicaoId],
    queryFn: async () => {
      // Fetch turmas
      const turmas = await turmasApi.getAll({ instituicaoId: shouldFilter ? instituicaoId : undefined });

      // Fetch matriculas
      const matriculas = await matriculasApi.getAll({ status: 'ativa' });

      // Count students per turma
      const countByTurma = (matriculas || []).reduce((acc: Record<string, number>, m: any) => {
        const turmaId = m.turma_id || m.turmaId;
        acc[turmaId] = (acc[turmaId] || 0) + 1;
        return acc;
      }, {});

      // Map turmas with student count
      const result: TurmaComAlunos[] = (turmas || []).map((t: any) => ({
        id: t.id,
        nome: t.nome,
        turno: t.turno,
        ano: t.ano,
        semestre: t.semestre,
        cursos: t.cursos || null,
        alunosCount: countByTurma[t.id] || 0,
      }));

      return result;
    },
    enabled: open,
  });

  const filteredTurmas = turmasComAlunos.filter(
    (t) => filterTurno === 'all' || t.turno === filterTurno
  );

  // Group by turno for summary
  const resumoPorTurno: ResumoTurno[] = React.useMemo(() => {
    const grupos: Record<string, { totalTurmas: number; totalAlunos: number }> = {};

    turmasComAlunos.forEach((t) => {
      const turnoKey = t.turno || 'Sem turno';
      if (!grupos[turnoKey]) {
        grupos[turnoKey] = { totalTurmas: 0, totalAlunos: 0 };
      }
      grupos[turnoKey].totalTurmas++;
      grupos[turnoKey].totalAlunos += t.alunosCount;
    });

    return Object.entries(grupos).map(([turno, dados]) => ({
      turno,
      ...dados,
    }));
  }, [turmasComAlunos]);

  const getTurnoIcon = (turnoNome: string | null) => {
    if (!turnoNome) return <Clock className="h-4 w-4" />;
    const nomeLower = turnoNome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return <Sun className="h-4 w-4 text-amber-500" />;
    if (nomeLower.includes('tarde')) return <Sunset className="h-4 w-4 text-orange-500" />;
    if (nomeLower.includes('noite')) return <Moon className="h-4 w-4 text-indigo-500" />;
    return <Clock className="h-4 w-4" />;
  };

  const getTurnoBadgeColor = (turnoNome: string | null) => {
    if (!turnoNome) return 'bg-gray-500';
    const nomeLower = turnoNome.toLowerCase();
    if (nomeLower.includes('manhã') || nomeLower.includes('manha')) return 'bg-amber-500';
    if (nomeLower.includes('tarde')) return 'bg-orange-500';
    if (nomeLower.includes('noite')) return 'bg-indigo-500';
    return 'bg-gray-500';
  };

  const totalAlunos = filteredTurmas.reduce((acc, t) => acc + t.alunosCount, 0);

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Relatório de Turmas por Turno</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 15px; }
          .logo { max-height: 60px; margin-bottom: 8px; }
          .institution-name { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
          .document-title { font-size: 16px; color: #666; }
          .filter-info { font-size: 11px; color: #666; margin-top: 8px; }
          .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
          .summary-card { border: 1px solid #ddd; padding: 12px; border-radius: 4px; min-width: 120px; }
          .summary-card h4 { font-size: 11px; color: #666; margin-bottom: 4px; }
          .summary-card p { font-size: 18px; font-weight: bold; }
          .summary-card .sub { font-size: 10px; color: #888; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background: #f5f5f5; font-weight: bold; }
          .turno-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; color: white; font-size: 10px; }
          .turno-manha { background: #f59e0b; }
          .turno-tarde { background: #f97316; }
          .turno-noite { background: #6366f1; }
          .turno-outro { background: #6b7280; }
          .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #ddd; padding-top: 10px; }
          .total-row { font-weight: bold; background: #f9fafb; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${instituicao?.logo_url ? `<img src="${instituicao.logo_url}" class="logo" alt="Logo" />` : ''}
          <div class="institution-name">${instituicao?.nome || 'Instituição de Ensino'}</div>
          <div class="document-title">RELATÓRIO DE TURMAS POR TURNO</div>
          <div class="filter-info">Filtro: ${filterTurno === 'all' ? 'Todos os turnos' : filterTurno}</div>
        </div>

        <div class="summary">
          ${resumoPorTurno.map(r => `
            <div class="summary-card">
              <h4>${r.turno}</h4>
              <p>${r.totalAlunos}</p>
              <div class="sub">${r.totalTurmas} turma(s)</div>
            </div>
          `).join('')}
        </div>

        <table>
          <thead>
            <tr>
              <th>Turma</th>
              <th>Curso</th>
              <th>Período</th>
              <th>Turno</th>
              <th style="text-align: right;">Alunos</th>
            </tr>
          </thead>
          <tbody>
            ${filteredTurmas.map(t => {
              const turnoClass = t.turno?.toLowerCase().includes('manhã') || t.turno?.toLowerCase().includes('manha') 
                ? 'turno-manha' 
                : t.turno?.toLowerCase().includes('tarde') 
                  ? 'turno-tarde' 
                  : t.turno?.toLowerCase().includes('noite') 
                    ? 'turno-noite' 
                    : 'turno-outro';
              return `
                <tr>
                  <td>${t.nome}</td>
                  <td>${t.cursos?.nome || '-'}</td>
                  <td>${isSecundario ? t.ano : `${t.ano}/${t.semestre}º`}</td>
                  <td><span class="turno-badge ${turnoClass}">${t.turno || '-'}</span></td>
                  <td style="text-align: right;">${t.alunosCount}</td>
                </tr>
              `;
            }).join('')}
            <tr class="total-row">
              <td colspan="4">Total</td>
              <td style="text-align: right;">${totalAlunos}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <p>Documento gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 250);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <BarChart3 className="h-4 w-4 mr-2" />
          Relatório por Turno
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Relatório de Turmas por Turno
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <Select value={filterTurno} onValueChange={setFilterTurno}>
              <SelectTrigger className="w-[200px]">
                <Clock className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por turno" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os turnos</SelectItem>
                {turnos.map((t: any) => (
                  <SelectItem key={t.id} value={t.nome}>
                    {t.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handlePrint} disabled={filteredTurmas.length === 0}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {resumoPorTurno.map((r) => (
              <Card key={r.turno}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                    {getTurnoIcon(r.turno)}
                    <span>{r.turno}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{r.totalAlunos}</span>
                    <span className="text-sm text-muted-foreground">alunos</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.totalTurmas} turma(s)</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTurmas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma turma encontrada para o filtro selecionado.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead className="text-right">Alunos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTurmas.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.nome}</TableCell>
                      <TableCell>{t.cursos?.nome || '-'}</TableCell>
                      <TableCell>{isSecundario ? t.ano : `${t.ano}/${t.semestre}º`}</TableCell>
                      <TableCell>
                        {t.turno ? (
                          <Badge className={getTurnoBadgeColor(t.turno)}>
                            {getTurnoIcon(t.turno)}
                            <span className="ml-1">{t.turno}</span>
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{t.alunosCount}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4}>Total</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Users className="h-4 w-4" />
                        <span>{totalAlunos}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
