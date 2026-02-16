import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, User, GraduationCap, CheckCircle, XCircle, Clock, AlertCircle, Printer, Download } from 'lucide-react';
import { relatoriosApi } from '@/services/api';
import { safeToFixed } from '@/lib/utils';

interface BoletimVisualizacaoProps {
  alunoId: string;
  anoLetivoId?: string;
  anoLetivo?: number;
}

export function BoletimVisualizacao({ alunoId, anoLetivoId, anoLetivo }: BoletimVisualizacaoProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: boletimData, isLoading, error } = useQuery({
    queryKey: ['boletim-aluno', alunoId, anoLetivoId, anoLetivo],
    queryFn: () => relatoriosApi.getBoletimAluno(alunoId, { anoLetivoId, anoLetivo }),
    enabled: !!alunoId,
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Boletim - ${boletimData?.aluno?.nomeCompleto || 'N/A'}</title>
        <style>
          @page { margin: 2cm; }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            font-size: 10pt; 
            line-height: 1.4;
          }
          h1 { font-size: 16pt; margin-bottom: 10px; }
          h2 { font-size: 14pt; margin: 15px 0 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #333; padding: 6px; text-align: left; }
          th { background-color: #f0f0f0; font-weight: bold; }
          .stats { display: flex; gap: 20px; margin: 15px 0; }
          .stat-item { flex: 1; padding: 10px; border: 1px solid #ddd; }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Boletim Acadêmico</h1>
        <h2>${boletimData?.aluno?.nomeCompleto || 'N/A'}</h2>
        ${boletimData?.anoLetivo ? `<p>Ano Letivo: ${boletimData.anoLetivo}</p>` : ''}
        ${content}
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-destructive">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p>Erro ao carregar boletim</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!boletimData || !boletimData.aluno) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum boletim encontrado para este aluno</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { aluno, disciplinas } = boletimData;

  const getStatusBadge = (situacaoAcademica: string) => {
    switch (situacaoAcademica) {
      case 'APROVADO':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Aprovado</Badge>;
      case 'REPROVADO_FALTA':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reprovado por Falta</Badge>;
      case 'REPROVADO':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Reprovado</Badge>;
      case 'EM_CURSO':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Em Curso</Badge>;
      default:
        return <Badge variant="outline">{situacaoAcademica}</Badge>;
    }
  };

  return (
    <div className="space-y-6" ref={printRef}>
      {/* Informações do Aluno */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                {aluno.nomeCompleto}
              </CardTitle>
              <CardDescription>
                {aluno.email}
                {aluno.numeroIdentificacaoPublica && ` • ${aluno.numeroIdentificacaoPublica}`}
                {boletimData.anoLetivo && ` • Ano Letivo: ${boletimData.anoLetivo}`}
              </CardDescription>
            </div>
            <div className="flex gap-2 no-print">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Estatísticas Gerais */}
      {disciplinas && disciplinas.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total de Disciplinas</p>
                  <p className="text-2xl font-bold">{disciplinas.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Aprovadas</p>
                  <p className="text-2xl font-bold text-green-600">
                    {disciplinas.filter((d: any) => d.situacaoAcademica === 'APROVADO').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Reprovadas</p>
                  <p className="text-2xl font-bold text-red-600">
                    {disciplinas.filter((d: any) => d.situacaoAcademica === 'REPROVADO' || d.situacaoAcademica === 'REPROVADO_FALTA').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Em Curso</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {disciplinas.filter((d: any) => d.situacaoAcademica === 'EM_CURSO').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Disciplinas */}
      <Card>
        <CardHeader>
          <CardTitle>Boletim Acadêmico</CardTitle>
          <CardDescription>Notas e frequência por disciplina</CardDescription>
        </CardHeader>
        <CardContent>
          {!disciplinas || disciplinas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma disciplina encontrada</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    <TableHead className="text-center">Frequência</TableHead>
                    <TableHead className="text-center">Média Final</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Situação Acadêmica</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disciplinas.map((disciplina: any) => (
                    <TableRow key={disciplina.planoEnsinoId}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{disciplina.disciplina.nome}</div>
                          {disciplina.turma && (
                            <div className="text-sm text-muted-foreground">
                              Turma: {disciplina.turma.nome}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {disciplina.frequencia ? (
                          <div className="flex flex-col items-center">
                            <span className="font-medium">
                              {safeToFixed(disciplina.frequencia.percentualFrequencia, 1) || '-'}%
                            </span>
                            <span className="text-xs text-muted-foreground">
                              ({disciplina.frequencia.presencas || 0}/{disciplina.frequencia.totalAulas || 0})
                            </span>
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {disciplina.notas?.mediaFinal !== undefined && disciplina.notas.mediaFinal !== null
                          ? safeToFixed(disciplina.notas.mediaFinal, 1)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        {disciplina.notas?.status ? (
                          <Badge variant={disciplina.notas.status === 'APROVADO' ? 'default' : 'destructive'}>
                            {disciplina.notas.status}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(disciplina.situacaoAcademica || 'EM_CURSO')}
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
}

