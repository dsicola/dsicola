import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { relatoriosOficiaisApi, alunosApi, planoEnsinoApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Printer, BookOpen, GraduationCap } from "lucide-react";
import { BoletimVisualizacao } from "@/components/relatorios/BoletimVisualizacao";
import { PautaVisualizacao } from "@/components/relatorios/PautaVisualizacao";
import { HistoricoEscolarVisualizacao } from "@/components/relatorios/HistoricoEscolarVisualizacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Componente de Relatórios Oficiais para Secretaria
 * REGRA ABSOLUTA SIGA/SIGAE: Documentos derivados de dados reais, somente leitura
 */
export function RelatoriosOficiaisTab() {
  const { instituicaoId } = useTenantFilter();
  const { anoLetivo, anoLetivoId } = useAnoLetivoAtivo();
  
  const [tipoRelatorio, setTipoRelatorio] = useState<'boletim' | 'pauta' | 'historico'>('boletim');
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>("");
  const [selectedPlanoEnsinoId, setSelectedPlanoEnsinoId] = useState<string>("");
  const [selectedAnoLetivoId, setSelectedAnoLetivoId] = useState<string>(anoLetivoId || "");

  // Buscar anos letivos
  const { data: anosLetivos = [] } = useQuery({
    queryKey: ["anos-letivos-relatorios-secretaria", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Buscar alunos
  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-relatorios-secretaria", instituicaoId],
    queryFn: async () => {
      const response = await alunosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(response) ? response : (response?.data || []);
    },
    enabled: !!instituicaoId,
  });

  // Buscar planos de ensino (apenas APROVADOS ou ENCERRADOS para pauta)
  const { data: planosEnsino = [] } = useQuery({
    queryKey: ["planos-ensino-relatorios-secretaria", instituicaoId, selectedAnoLetivoId],
    queryFn: async () => {
      const params: any = {};
      if (selectedAnoLetivoId) {
        params.anoLetivoId = selectedAnoLetivoId;
      }
      const data = await planoEnsinoApi.getAll(params);
      // Filtrar apenas planos APROVADOS ou ENCERRADOS (para pauta)
      return (data || []).filter((p: any) => 
        p.estado === 'APROVADO' || p.estado === 'ENCERRADO'
      );
    },
    enabled: !!instituicaoId,
  });

  // Gerar boletim
  const [shouldLoadBoletim, setShouldLoadBoletim] = useState(false);
  const { data: boletimData, isLoading: isLoadingBoletim, error: errorBoletim } = useQuery({
    queryKey: ['boletim-oficial', selectedAlunoId, selectedAnoLetivoId],
    queryFn: async () => {
      if (!selectedAlunoId) return null;
      const response = await relatoriosOficiaisApi.gerarBoletimAluno(
        selectedAlunoId,
        selectedAnoLetivoId ? { anoLetivoId: selectedAnoLetivoId } : undefined
      );
      // A API retorna { success: true, data: ... }
      return response?.data || response;
    },
    enabled: tipoRelatorio === 'boletim' && !!selectedAlunoId && shouldLoadBoletim,
    retry: false,
  });

  // Gerar pauta
  const [shouldLoadPauta, setShouldLoadPauta] = useState(false);
  const { data: pautaData, isLoading: isLoadingPauta, error: errorPauta } = useQuery({
    queryKey: ['pauta-oficial', selectedPlanoEnsinoId],
    queryFn: async () => {
      if (!selectedPlanoEnsinoId) return null;
      const response = await relatoriosOficiaisApi.gerarPauta(selectedPlanoEnsinoId);
      // A API retorna { success: true, data: ... }
      return response?.data || response;
    },
    enabled: tipoRelatorio === 'pauta' && !!selectedPlanoEnsinoId && shouldLoadPauta,
    retry: false,
  });

  // Gerar histórico
  const [shouldLoadHistorico, setShouldLoadHistorico] = useState(false);
  const { data: historicoData, isLoading: isLoadingHistorico, error: errorHistorico } = useQuery({
    queryKey: ['historico-oficial', selectedAlunoId],
    queryFn: async () => {
      if (!selectedAlunoId) return null;
      const response = await relatoriosOficiaisApi.gerarHistoricoAcademico(selectedAlunoId);
      // A API retorna { success: true, data: ... }
      return response?.data || response;
    },
    enabled: tipoRelatorio === 'historico' && !!selectedAlunoId && shouldLoadHistorico,
    retry: false,
  });

  const handleGerarRelatorio = () => {
    if (tipoRelatorio === 'boletim') {
      if (!selectedAlunoId) {
        toast.error("Selecione um aluno para gerar o boletim");
        return;
      }
      setShouldLoadBoletim(true);
    } else if (tipoRelatorio === 'pauta') {
      if (!selectedPlanoEnsinoId) {
        toast.error("Selecione um plano de ensino para gerar a pauta");
        return;
      }
      setShouldLoadPauta(true);
    } else if (tipoRelatorio === 'historico') {
      if (!selectedAlunoId) {
        toast.error("Selecione um aluno para gerar o histórico");
        return;
      }
      setShouldLoadHistorico(true);
    }
  };

  // Resetar flags quando mudar de tipo de relatório
  const handleTipoRelatorioChange = (tipo: string) => {
    setTipoRelatorio(tipo as any);
    setShouldLoadBoletim(false);
    setShouldLoadPauta(false);
    setShouldLoadHistorico(false);
  };

  const getErrorMessage = (error: any): string => {
    if (!error) return "";
    
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error?.message) {
      return error.message;
    }
    
    return "Erro ao gerar relatório. Verifique os pré-requisitos.";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Relatórios Oficiais
        </h2>
        <p className="text-muted-foreground">
          Documentos acadêmicos oficiais derivados de dados reais (Padrão SIGA/SIGAE)
        </p>
      </div>

      {/* Tabs para tipos de relatório */}
      <Tabs value={tipoRelatorio} onValueChange={handleTipoRelatorioChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="boletim">
            <FileText className="h-4 w-4 mr-2" />
            Boletim do Aluno
          </TabsTrigger>
          <TabsTrigger value="pauta">
            <BookOpen className="h-4 w-4 mr-2" />
            Pauta Oficial
          </TabsTrigger>
          <TabsTrigger value="historico">
            <GraduationCap className="h-4 w-4 mr-2" />
            Histórico Acadêmico
          </TabsTrigger>
        </TabsList>

        {/* Boletim do Aluno */}
        <TabsContent value="boletim" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Boletim do Aluno</CardTitle>
              <CardDescription>
                Documento oficial com notas finais, frequência e situação acadêmica
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ano Letivo (opcional)</Label>
                  <Select value={selectedAnoLetivoId} onValueChange={setSelectedAnoLetivoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o ano letivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Ano Letivo Ativo ({anoLetivo || 'N/A'})</SelectItem>
                      {anosLetivos.map((al: any) => (
                        <SelectItem key={al.id} value={al.id}>
                          {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Aluno *</Label>
                  <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {alunos.map((aluno: any) => (
                        <SelectItem key={aluno.id} value={aluno.id}>
                          {aluno.nome_completo || aluno.nomeCompleto} - {aluno.numero_identificacao_publica || aluno.numeroIdentificacaoPublica || 'N/A'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button 
                onClick={handleGerarRelatorio}
                disabled={!selectedAlunoId || isLoadingBoletim}
                className="w-full"
              >
                {isLoadingBoletim ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando boletim...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Gerar Boletim
                  </>
                )}
              </Button>

              {errorBoletim && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar boletim</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(errorBoletim)}
                  </AlertDescription>
                </Alert>
              )}

              {boletimData && (
                <div className="mt-4">
                  <BoletimVisualizacao
                    alunoId={selectedAlunoId}
                    anoLetivoId={selectedAnoLetivoId || undefined}
                    anoLetivo={boletimData.anoLetivo?.ano}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pauta Oficial */}
        <TabsContent value="pauta" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pauta Oficial</CardTitle>
              <CardDescription>
                Documento oficial da turma/disciplina (apenas após fechamento do plano de ensino)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Regra SIGA/SIGAE:</strong> A pauta só pode ser gerada após o plano de ensino estar APROVADO ou ENCERRADO.
                  Todas as avaliações devem estar fechadas.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Plano de Ensino *</Label>
                <Select value={selectedPlanoEnsinoId} onValueChange={setSelectedPlanoEnsinoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano de ensino" />
                  </SelectTrigger>
                  <SelectContent>
                    {planosEnsino.map((plano: any) => (
                      <SelectItem key={plano.id} value={plano.id}>
                        {plano.disciplina?.nome || 'N/A'} - {plano.turma?.nome || 'N/A'} 
                        {' '}
                        <Badge variant={plano.estado === 'APROVADO' ? 'default' : 'secondary'} className="ml-2">
                          {plano.estado}
                        </Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {planosEnsino.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum plano de ensino APROVADO ou ENCERRADO encontrado.
                  </p>
                )}
              </div>

              <Button 
                onClick={handleGerarRelatorio}
                disabled={!selectedPlanoEnsinoId || isLoadingPauta}
                className="w-full"
              >
                {isLoadingPauta ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando pauta...
                  </>
                ) : (
                  <>
                    <BookOpen className="h-4 w-4 mr-2" />
                    Gerar Pauta
                  </>
                )}
              </Button>

              {errorPauta && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar pauta</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(errorPauta)}
                  </AlertDescription>
                </Alert>
              )}

              {pautaData && (
                <div className="mt-4">
                  <PautaVisualizacao planoEnsinoId={selectedPlanoEnsinoId} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Histórico Acadêmico */}
        <TabsContent value="historico" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Histórico Acadêmico</CardTitle>
              <CardDescription>
                Histórico completo do aluno com todas as disciplinas cursadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Aluno *</Label>
                <Select value={selectedAlunoId} onValueChange={setSelectedAlunoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o aluno" />
                  </SelectTrigger>
                  <SelectContent>
                    {alunos.map((aluno: any) => (
                      <SelectItem key={aluno.id} value={aluno.id}>
                        {aluno.nome_completo || aluno.nomeCompleto} - {aluno.numero_identificacao_publica || aluno.numeroIdentificacaoPublica || 'N/A'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGerarRelatorio}
                disabled={!selectedAlunoId || isLoadingHistorico}
                className="w-full"
              >
                {isLoadingHistorico ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Gerando histórico...
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4 mr-2" />
                    Gerar Histórico
                  </>
                )}
              </Button>

              {errorHistorico && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar histórico</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(errorHistorico)}
                  </AlertDescription>
                </Alert>
              )}

              {historicoData && (
                <div className="mt-4">
                  <HistoricoEscolarVisualizacao alunoId={selectedAlunoId} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

