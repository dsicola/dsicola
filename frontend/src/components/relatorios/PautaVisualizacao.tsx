import { useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookOpen, Users, CheckCircle, XCircle, Clock, AlertCircle, Printer, Download } from 'lucide-react';
import { relatoriosApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';

interface PautaVisualizacaoProps {
  planoEnsinoId: string;
}

export function PautaVisualizacao({ planoEnsinoId }: PautaVisualizacaoProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { data: pautaData, isLoading, error } = useQuery({
    queryKey: ['pauta-plano-ensino', planoEnsinoId],
    queryFn: () => relatoriosApi.getPautaPlanoEnsino(planoEnsinoId),
    enabled: !!planoEnsinoId,
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
        <title>Pauta de Avaliação - ${pautaData?.disciplina?.nome || 'N/A'}</title>
        <style>
          @page { margin: 2cm; size: A4 landscape; }
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
        <h1>Pauta de Avaliação</h1>
        <h2>${pautaData?.disciplina?.nome || 'N/A'}</h2>
        <p>Carga Horária: ${pautaData?.disciplina?.cargaHoraria || 0} horas</p>
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
            <p>Erro ao carregar pauta</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pautaData || !pautaData.disciplina) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma pauta encontrada para este Plano de Ensino</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { disciplina, alunos, tipoInstituicao } = pautaData;
  const { instituicao } = useInstituicao();
  const isSuperior = (tipoInstituicao || instituicao?.tipoAcademico) === 'SUPERIOR';

  // Extrair avaliações únicas para criar colunas dinâmicas
  const avaliacoesUnicas = useMemo(() => {
    if (!alunos || alunos.length === 0) return [];
    
    const avaliacoesMap = new Map<string, { id: string; nome: string; tipo: string; trimestre?: number }>();
    
    alunos.forEach((aluno: any) => {
      if (aluno.notas?.notasPorAvaliacao) {
        aluno.notas.notasPorAvaliacao.forEach((av: any) => {
          if (!avaliacoesMap.has(av.avaliacaoId)) {
            avaliacoesMap.set(av.avaliacaoId, {
              id: av.avaliacaoId,
              nome: av.avaliacaoNome || av.avaliacaoTipo,
              tipo: av.avaliacaoTipo,
              trimestre: av.trimestre,
            });
          }
        });
      }
    });
    
    // Ordenar avaliações: Superior (P1, P2, P3, Trabalho, Recurso) ou Secundário (por trimestre e data)
    const avaliacoesArray = Array.from(avaliacoesMap.values());
    
    if (isSuperior) {
      // Ordenar por tipo: P1, P2, P3, Trabalho, Recurso
      const ordem = ['P1', 'P2', 'P3', 'TRABALHO', 'RECUPERACAO', 'PROVA_FINAL'];
      avaliacoesArray.sort((a, b) => {
        const indexA = ordem.findIndex(o => a.tipo?.includes(o) || a.nome?.toUpperCase().includes(o));
        const indexB = ordem.findIndex(o => b.tipo?.includes(o) || b.nome?.toUpperCase().includes(o));
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.nome.localeCompare(b.nome);
      });
    } else {
      // Secundário: ordenar por trimestre e depois por nome
      avaliacoesArray.sort((a, b) => {
        if (a.trimestre && b.trimestre) {
          if (a.trimestre !== b.trimestre) return a.trimestre - b.trimestre;
        }
        return a.nome.localeCompare(b.nome);
      });
    }
    
    return avaliacoesArray;
  }, [alunos, isSuperior]);

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
      {/* Informações da Disciplina */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                {disciplina.nome}
              </CardTitle>
              <CardDescription>
                Carga Horária: {disciplina.cargaHoraria} horas
                {pautaData.totalAulasPlanejadas && ` • Total de Aulas Planejadas: ${pautaData.totalAulasPlanejadas}`}
                {pautaData.totalAulasMinistradas && ` • Total de Aulas Ministradas: ${pautaData.totalAulasMinistradas}`}
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

      {/* Estatísticas */}
      {alunos && alunos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Total de Estudantes</p>
                  <p className="text-2xl font-bold">{alunos.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm text-muted-foreground">Aprovados</p>
                  <p className="text-2xl font-bold text-green-600">
                    {alunos.filter((a: any) => a.situacaoAcademica === 'APROVADO').length}
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
                  <p className="text-sm text-muted-foreground">Reprovados</p>
                  <p className="text-2xl font-bold text-red-600">
                    {alunos.filter((a: any) => a.situacaoAcademica === 'REPROVADO' || a.situacaoAcademica === 'REPROVADO_FALTA').length}
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
                    {alunos.filter((a: any) => a.situacaoAcademica === 'EM_CURSO').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de Alunos */}
      <Card>
        <CardHeader>
          <CardTitle>Pauta de Avaliação</CardTitle>
          <CardDescription>Notas e frequência dos alunos</CardDescription>
        </CardHeader>
        <CardContent>
          {!alunos || alunos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum estudante encontrado</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Nome do Estudante</TableHead>
                    {/* Colunas dinâmicas de avaliações */}
                    {avaliacoesUnicas.map((av) => (
                      <TableHead key={av.id} className="text-center min-w-[80px]">
                        {isSuperior ? (
                          <div className="flex flex-col">
                            <span className="font-medium">{av.nome}</span>
                            <span className="text-xs text-muted-foreground">{av.tipo}</span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-medium">{av.nome}</span>
                            {av.trimestre && (
                              <span className="text-xs text-muted-foreground">T{av.trimestre}</span>
                            )}
                          </div>
                        )}
                      </TableHead>
                    ))}
                    {isSuperior && (
                      <TableHead className="text-center">Média Parcial</TableHead>
                    )}
                    <TableHead className="text-center">Frequência</TableHead>
                    <TableHead className="text-center">Média Final</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Situação Acadêmica</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alunos.map((aluno: any, index: number) => {
                    // Criar mapa de notas por avaliação para acesso rápido
                    const notasMap = new Map<string, number | null>();
                    if (aluno.notas?.notasPorAvaliacao) {
                      aluno.notas.notasPorAvaliacao.forEach((av: any) => {
                        notasMap.set(av.avaliacaoId, av.nota);
                      });
                    }
                    
                    return (
                      <TableRow key={aluno.alunoId}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{aluno.nomeCompleto}</div>
                          </div>
                        </TableCell>
                        {/* Notas por avaliação */}
                        {avaliacoesUnicas.map((av) => {
                          const nota = notasMap.get(av.id);
                          return (
                            <TableCell key={av.id} className="text-center">
                              {nota !== null && nota !== undefined ? (
                                <span className="font-medium">{nota.toFixed(1)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          );
                        })}
                        {/* Média Parcial (apenas Superior) */}
                        {isSuperior && (
                          <TableCell className="text-center">
                            {aluno.notas?.mediaParcial !== undefined && aluno.notas.mediaParcial !== null
                              ? <span className="font-medium">{aluno.notas.mediaParcial.toFixed(1)}</span>
                              : '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          {aluno.frequencia ? (
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {aluno.frequencia.percentualFrequencia?.toFixed(1) || '-'}%
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({aluno.frequencia.presencas || 0}/{aluno.frequencia.totalAulas || 0})
                              </span>
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          {aluno.notas?.mediaFinal !== undefined && aluno.notas.mediaFinal !== null
                            ? aluno.notas.mediaFinal.toFixed(1)
                            : '-'}
                        </TableCell>
                        <TableCell className="text-center">
                          {aluno.notas?.status ? (
                            <Badge variant={aluno.notas.status === 'APROVADO' ? 'default' : 'destructive'}>
                              {aluno.notas.status}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(aluno.situacaoAcademica || 'EM_CURSO')}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

