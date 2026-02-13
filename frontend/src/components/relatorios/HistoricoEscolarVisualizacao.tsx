import { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, User, GraduationCap, CheckCircle, XCircle, Clock, AlertCircle, Calendar, Printer, Download } from 'lucide-react';
import { relatoriosApi } from '@/services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricoEscolarVisualizacaoProps {
  alunoId: string;
}

export function HistoricoEscolarVisualizacao({ alunoId }: HistoricoEscolarVisualizacaoProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: historicoData, isLoading, error } = useQuery({
    queryKey: ['historico-escolar', alunoId],
    queryFn: () => relatoriosApi.getHistoricoEscolar(alunoId),
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
        <title>Histórico Escolar - ${historicoData?.aluno?.nomeCompleto || 'N/A'}</title>
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
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Histórico Escolar</h1>
        <h2>${historicoData?.aluno?.nomeCompleto || 'N/A'}</h2>
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
            <p>Erro ao carregar histórico escolar</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!historicoData || !historicoData.aluno) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum histórico escolar encontrado para este aluno</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { aluno, historico } = historicoData;

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
                {aluno.dataNascimento && ` • Nascimento: ${format(new Date(aluno.dataNascimento), "dd/MM/yyyy", { locale: ptBR })}`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 no-print">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                📄 Documento Oficial
              </Badge>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Histórico por Ano Letivo */}
      {historico && historico.length > 0 ? (
        historico.map((ano: any) => (
          <Card key={ano.anoLetivo.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Ano Letivo {ano.anoLetivo.ano}
              </CardTitle>
              <CardDescription>
                Status: {ano.anoLetivo.status === 'ATIVO' ? '🟢 Ativo' : ano.anoLetivo.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!ano.disciplinas || ano.disciplinas.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GraduationCap className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma disciplina encontrada para este ano letivo</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Disciplina</TableHead>
                        <TableHead className="text-center">Carga Horária</TableHead>
                        <TableHead className="text-center">Frequência</TableHead>
                        <TableHead className="text-center">Média Final</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Situação Acadêmica</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ano.disciplinas.map((disciplina: any) => (
                        <TableRow key={disciplina.disciplina.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{disciplina.disciplina.nome}</div>
                              {disciplina.curso && (
                                <div className="text-sm text-muted-foreground">
                                  Curso: {disciplina.curso.nome}
                                </div>
                              )}
                              {disciplina.turma && (
                                <div className="text-sm text-muted-foreground">
                                  Turma: {disciplina.turma.nome}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {disciplina.disciplina.cargaHoraria || '-'}h
                          </TableCell>
                          <TableCell className="text-center">
                            {disciplina.frequencia ? (
                              <div className="flex flex-col items-center">
                                <span className="font-medium">
                                  {disciplina.frequencia.percentualFrequencia?.toFixed(1) || '-'}%
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
                              ? disciplina.notas.mediaFinal.toFixed(1)
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
        ))
      ) : (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="font-medium mb-2">Nenhum histórico encontrado</p>
              <p className="text-sm">
                O histórico acadêmico só é gerado automaticamente quando um ano letivo é encerrado.
                Este documento é imutável e representa um snapshot oficial dos dados acadêmicos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

