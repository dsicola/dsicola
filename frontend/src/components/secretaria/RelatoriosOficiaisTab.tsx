import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { relatoriosOficiaisApi, alunosApi, planoEnsinoApi, anoLetivoApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { FileText, Download, Loader2, AlertCircle, CheckCircle, Printer, BookOpen, GraduationCap, FileSpreadsheet } from "lucide-react";
import { BoletimVisualizacao } from "@/components/relatorios/BoletimVisualizacao";
import { PautaVisualizacao } from "@/components/relatorios/PautaVisualizacao";
import { HistoricoEscolarVisualizacao } from "@/components/relatorios/HistoricoEscolarVisualizacao";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Componente de Relatórios Oficiais para Secretaria
 * Documentos derivados de dados reais, somente leitura
 */
export function RelatoriosOficiaisTab() {
  const { instituicaoId } = useTenantFilter();
  const { anoLetivo, anoLetivoId } = useAnoLetivoAtivo();
  const { isSecundario, isSuperior } = useInstituicao();
  
  const [tipoRelatorio, setTipoRelatorio] = useState<'boletim' | 'pauta' | 'historico'>('boletim');
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>("");
  const [selectedPlanoEnsinoId, setSelectedPlanoEnsinoId] = useState<string>("");
  const [selectedAnoLetivoId, setSelectedAnoLetivoId] = useState<string>(anoLetivoId || "_ativo_");

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
      return response?.data ?? [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar planos de ensino (apenas APROVADOS ou ENCERRADOS para pauta)
  const { data: planosEnsino = [] } = useQuery({
    queryKey: ["planos-ensino-relatorios-secretaria", instituicaoId, selectedAnoLetivoId, anoLetivoId],
    queryFn: async () => {
      const params: any = {};
      const anoId = selectedAnoLetivoId === "_ativo_" ? anoLetivoId : selectedAnoLetivoId;
      if (anoId) {
        params.anoLetivoId = anoId;
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
  const [excelDownloading, setExcelDownloading] = useState(false);
  const { data: boletimData, isLoading: isLoadingBoletim, error: errorBoletim } = useQuery({
    queryKey: ['boletim-oficial', selectedAlunoId, selectedAnoLetivoId],
    queryFn: async () => {
      if (!selectedAlunoId) return null;
      const response = await relatoriosOficiaisApi.gerarBoletimAluno(
        selectedAlunoId,
        (selectedAnoLetivoId && selectedAnoLetivoId !== "_ativo_") ? { anoLetivoId: selectedAnoLetivoId } : undefined
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

  const handleDescarregarPdfBoletim = async () => {
    if (!selectedAlunoId) {
      toast.error("Selecione um aluno para descarregar o boletim em PDF");
      return;
    }
    setExcelDownloading(true);
    try {
      const blob = await relatoriosOficiaisApi.gerarBoletimAluno(selectedAlunoId, {
        anoLetivoId: selectedAnoLetivoId && selectedAnoLetivoId !== "_ativo_" ? selectedAnoLetivoId : undefined,
        format: "pdf",
      }) as Blob;
      const aluno = alunos.find((a: any) => a.id === selectedAlunoId);
      const nome = aluno?.nome_completo || aluno?.nomeCompleto || "boletim";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `boletim-${(nome || "aluno").replace(/\s+/g, "-")}-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Boletim PDF descarregado. Use o modelo ativo (Word/PDF/HTML) se tiver importado um.");
    } catch (err: any) {
      let msg = err?.message || "Erro ao descarregar PDF";
      const data = err?.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const parsed = JSON.parse(text);
          msg = parsed?.message || msg;
        } catch {
          /* ignora */
        }
      } else if (typeof data?.message === "string") {
        msg = data.message;
      }
      toast.error(msg);
    } finally {
      setExcelDownloading(false);
    }
  };

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

    const data = error?.response?.data;
    if (typeof data?.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (typeof error?.message === "string" && error.message.trim()) {
      return error.message;
    }

    return "Não foi possível gerar o relatório. Verifique os pré-requisitos.";
  };

  /** Texto alinhado à validação institucional em `validarPreRequisitosDocumento` (PAUTA), sem misturar léxico superior/secundário. */
  const textoRegraAvaliacoesPauta =
    isSecundario === true
      ? "Todas as avaliações do plano (por trimestre, quando aplicável) devem estar fechadas; é obrigatório existir pelo menos uma avaliação."
      : isSuperior === true
        ? "Todas as avaliações do plano (provas, trabalhos e demais instrumentos do semestre) devem estar fechadas; é obrigatório existir pelo menos uma avaliação."
        : "Todas as avaliações do plano devem estar fechadas; é obrigatório existir pelo menos uma avaliação.";

  return (
    <div className="space-y-6" data-testid="relatorios-oficiais-secretaria">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Relatórios Oficiais
        </h2>
        <p className="text-muted-foreground">
          Documentos acadêmicos oficiais derivados de dados reais
        </p>
      </div>

      {/* Tabs para tipos de relatório */}
      <Tabs value={tipoRelatorio} onValueChange={handleTipoRelatorioChange}>
        <TabsList className="grid w-full grid-cols-3" data-testid="relatorios-oficiais-tabs">
          <TabsTrigger value="boletim" data-testid="relatorios-tab-boletim">
            <FileText className="h-4 w-4 mr-2" />
            Boletim do Aluno
          </TabsTrigger>
          <TabsTrigger value="pauta" data-testid="relatorios-tab-pauta">
            <BookOpen className="h-4 w-4 mr-2" />
            Pauta Oficial
          </TabsTrigger>
          <TabsTrigger value="historico" data-testid="relatorios-tab-historico">
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
                Documento oficial com notas finais, frequência e situação acadêmica.
                Para PDF com modelo: importe um modelo Boletim (Word, PDF ou HTML) em Documentos Acadêmicos → Boletins, depois use Descarregar PDF.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ano Letivo (opcional)</Label>
                  <Select value={selectedAnoLetivoId} onValueChange={setSelectedAnoLetivoId}>
                    <SelectTrigger data-testid="relatorios-boletim-select-ano">
                      <SelectValue placeholder="Selecione o ano letivo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_ativo_">Ano Letivo Ativo ({anoLetivo || 'N/A'})</SelectItem>
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
                    <SelectTrigger data-testid="relatorios-boletim-select-aluno">
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

              <div className="flex flex-wrap gap-2">
                <Button
                  data-testid="relatorios-boletim-gerar"
                  onClick={handleGerarRelatorio}
                  disabled={!selectedAlunoId || isLoadingBoletim}
                  className="flex-1 min-w-[140px]"
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
                <Button
                  data-testid="relatorios-boletim-pdf"
                  variant="outline"
                  onClick={handleDescarregarPdfBoletim}
                  disabled={!selectedAlunoId || excelDownloading}
                  className="flex-1 min-w-[140px]"
                  title="Descarrega PDF usando o modelo ativo (Word/PDF/HTML)"
                >
                  {excelDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      A descarregar...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Descarregar PDF
                    </>
                  )}
                </Button>
              </div>

              {errorBoletim && (
                <Alert variant="destructive" data-testid="relatorios-boletim-erro">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar boletim</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(errorBoletim)}
                  </AlertDescription>
                </Alert>
              )}

              {boletimData && (
                <div className="mt-4" data-testid="relatorios-boletim-resultado">
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
                {isSecundario
                  ? "Documento oficial da turma na disciplina, derivado de dados reais (ensino secundário)."
                  : isSuperior
                    ? "Documento oficial da turma na disciplina, derivado de dados reais (ensino superior)."
                    : "Documento oficial da turma na disciplina, derivado de dados reais da instituição."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm font-semibold leading-tight">
                  Pré-requisitos institucionais para emitir a pauta
                </AlertTitle>
                <AlertDescription className="mt-2 space-y-2 text-sm">
                  <p>
                    A pauta só é gerada quando o sistema valida o plano e os lançamentos abaixo. Estes critérios
                    coincidem com a regra interna de emissão (documento imutável após geração).
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <strong>Estado do plano:</strong> APROVADO ou ENCERRADO (apenas estes aparecem na lista
                      acima).
                    </li>
                    <li>
                      <strong>Aulas:</strong> deve existir pelo menos uma aula ministrada registada para este plano
                      de ensino.
                    </li>
                    <li>
                      <strong>Frequência:</strong> havendo aulas registadas, deve existir pelo menos uma presença
                      lançada para a turma neste plano.
                    </li>
                    <li>
                      <strong>Avaliações e notas:</strong> {textoRegraAvaliacoesPauta} Feche cada avaliação na
                      área de avaliações e notas da disciplina (ícone de confirmação ✓).
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label>Plano de Ensino *</Label>
                <Select value={selectedPlanoEnsinoId} onValueChange={setSelectedPlanoEnsinoId}>
                  <SelectTrigger data-testid="relatorios-pauta-select-plano">
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
                data-testid="relatorios-pauta-gerar"
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
                <Alert variant="destructive" data-testid="relatorios-pauta-erro">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar pauta</AlertTitle>
                  <AlertDescription className="whitespace-pre-wrap">
                    {getErrorMessage(errorPauta)}
                  </AlertDescription>
                </Alert>
              )}

              {pautaData && (
                <div className="mt-4" data-testid="relatorios-pauta-resultado">
                  <PautaVisualizacao
                    planoEnsinoId={selectedPlanoEnsinoId}
                    dadosPautaOficial={pautaData}
                  />
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
                  <SelectTrigger data-testid="relatorios-historico-select-aluno">
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
                data-testid="relatorios-historico-gerar"
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
                <Alert variant="destructive" data-testid="relatorios-historico-erro">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro ao gerar histórico</AlertTitle>
                  <AlertDescription>
                    {getErrorMessage(errorHistorico)}
                  </AlertDescription>
                </Alert>
              )}

              {historicoData && (
                <div className="mt-4" data-testid="relatorios-historico-resultado">
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

