import { useRef, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { safeToFixed } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, BookOpen, Users, CheckCircle, XCircle, Clock, AlertCircle, Printer, Lock, FileCheck } from 'lucide-react';
import { relatoriosApi, pautasApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface PautaVisualizacaoProps {
  planoEnsinoId: string;
}

export function PautaVisualizacao({ planoEnsinoId }: PautaVisualizacaoProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [loadingPrint, setLoadingPrint] = useState<'PROVISORIA' | 'DEFINITIVA' | null>(null);
  const [loadingFechar, setLoadingFechar] = useState(false);
  const [loadingProvisoria, setLoadingProvisoria] = useState(false);
  const roles = (user as any)?.roles || [];

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
    const errorMsg = (error as any)?.response?.data?.message || (error as Error)?.message;
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-destructive">
            <AlertCircle className="h-12 w-12 mx-auto mb-4" />
            <p>Erro ao carregar pauta</p>
            {errorMsg && <p className="text-sm mt-2 text-muted-foreground">{errorMsg}</p>}
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
  const pautaStatus = (pautaData as any)?.pautaStatus ?? 'RASCUNHO';
  const { instituicao } = useInstituicao();
  const isSuperior = (tipoInstituicao || instituicao?.tipoAcademico) === 'SUPERIOR';
  const isAdminOrSecretaria = roles.some((r: string) => ['ADMIN', 'SUPER_ADMIN', 'SECRETARIA'].includes(r));

  const handleImprimirPDF = async (tipo: 'PROVISORIA' | 'DEFINITIVA') => {
    setLoadingPrint(tipo);
    try {
      await pautasApi.imprimirPauta(planoEnsinoId, tipo);
      toast.success(`Pauta ${tipo === 'PROVISORIA' ? 'provisória' : 'definitiva'} aberta em nova aba`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao imprimir pauta');
    } finally {
      setLoadingPrint(null);
    }
  };

  const handleFecharDefinitiva = async () => {
    setLoadingFechar(true);
    try {
      await pautasApi.fecharPauta(planoEnsinoId);
      toast.success('Pauta fechada como definitiva');
      queryClient.invalidateQueries({ queryKey: ['pauta-plano-ensino', planoEnsinoId] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao fechar pauta');
    } finally {
      setLoadingFechar(false);
    }
  };

  const handleGerarProvisoria = async () => {
    setLoadingProvisoria(true);
    try {
      await pautasApi.gerarProvisoria(planoEnsinoId);
      toast.success('Pauta marcada como provisória');
      queryClient.invalidateQueries({ queryKey: ['pauta-plano-ensino', planoEnsinoId] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Erro ao marcar pauta');
    } finally {
      setLoadingProvisoria(false);
    }
  };

  // Extrair avaliações únicas para criar colunas dinâmicas (ordem conforme padrão SIGA/SIGAE)
  const avaliacoesUnicas = useMemo(() => {
    if (!alunos || alunos.length === 0) return [];
    
    const avaliacoesMap = new Map<string, { id: string; nome: string; tipo: string; trimestre?: number; identificacao?: string; ordemOriginal?: number }>();
    let ordemIdx = 0;
    
    alunos.forEach((aluno: any) => {
      if (aluno.notas?.notasPorAvaliacao) {
        aluno.notas.notasPorAvaliacao.forEach((av: any, idx: number) => {
          if (!avaliacoesMap.has(av.avaliacaoId)) {
            avaliacoesMap.set(av.avaliacaoId, {
              id: av.avaliacaoId,
              nome: av.avaliacaoNome || av.avaliacaoTipo,
              tipo: av.avaliacaoTipo,
              trimestre: av.trimestre,
              identificacao: av.avaliacaoIdentificacao,
              ordemOriginal: ordemIdx++,
            });
          }
        });
      }
    });
    
    const avaliacoesArray = Array.from(avaliacoesMap.values());
    
    if (isSuperior) {
      // Superior: P1, P2, P3, Trabalho, Recuperação, Prova Final (padrão SIGA/SIGAE)
      const ordem = ['P1', 'P2', 'P3', 'TRABALHO', 'RECUPERACAO', 'PROVA_FINAL'];
      const indexDe = (item: typeof avaliacoesArray[0]) => {
        const ident = item.identificacao || item.nome?.toUpperCase();
        for (let i = 0; i < ordem.length; i++) {
          if (ident?.includes(ordem[i]) || item.tipo?.includes(ordem[i])) return i;
        }
        return ordem.length;
      };
      avaliacoesArray.sort((a, b) => {
        const ia = indexDe(a);
        const ib = indexDe(b);
        if (ia !== ib) return ia - ib;
        return (a.ordemOriginal ?? 999) - (b.ordemOriginal ?? 999);
      });
    } else {
      // Secundário: trimestre 1→2→3, depois por nome (padrão)
      avaliacoesArray.sort((a, b) => {
        const trimA = a.trimestre ?? 999;
        const trimB = b.trimestre ?? 999;
        if (trimA !== trimB) return trimA - trimB;
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
            <div className="flex flex-wrap gap-2 no-print">
              <Badge variant={pautaStatus === 'DEFINITIVA' ? 'default' : pautaStatus === 'PROVISORIA' ? 'secondary' : 'outline'}>
                {pautaStatus === 'RASCUNHO' && 'Rascunho'}
                {pautaStatus === 'PROVISORIA' && 'Provisória'}
                {pautaStatus === 'DEFINITIVA' && 'Definitiva'}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => handleImprimirPDF('PROVISORIA')} disabled={loadingPrint !== null}>
                {loadingPrint === 'PROVISORIA' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                Imprimir Provisória
              </Button>
              {pautaStatus === 'DEFINITIVA' && (
                <Button variant="outline" size="sm" onClick={() => handleImprimirPDF('DEFINITIVA')} disabled={loadingPrint !== null}>
                  {loadingPrint === 'DEFINITIVA' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className="h-4 w-4 mr-2" />}
                  Imprimir Definitiva
                </Button>
              )}
              {isAdminOrSecretaria && pautaStatus !== 'DEFINITIVA' && (
                <Button variant="default" size="sm" onClick={handleFecharDefinitiva} disabled={loadingFechar}>
                  {loadingFechar ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
                  Fechar como Definitiva
                </Button>
              )}
              {pautaStatus === 'RASCUNHO' && (
                <Button variant="secondary" size="sm" onClick={handleGerarProvisoria} disabled={loadingProvisoria}>
                  {loadingProvisoria ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className="h-4 w-4 mr-2" />}
                  Marcar como Provisória
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Imprimir tela
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
                                <span className="font-medium">{safeToFixed(nota)}</span>
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
                              ? <span className="font-medium">{safeToFixed(aluno.notas.mediaParcial)}</span>
                              : '-'}
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          {aluno.frequencia ? (
                            <div className="flex flex-col items-center">
                              <span className="font-medium">
                                {safeToFixed(aluno.frequencia?.percentualFrequencia)}%
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
                            ? safeToFixed(aluno.notas.mediaFinal)
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

