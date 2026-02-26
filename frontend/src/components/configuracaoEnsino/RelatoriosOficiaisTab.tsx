import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { relatoriosApi, planoEnsinoApi, cursosApi, classesApi, disciplinasApi, profilesApi, turmasApi, alunosApi, anoLetivoApi, trimestreApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
// REMOVIDO: AnoLetivoAtivoGuard - Relatórios são ADMINISTRATIVOS, não dependem de Ano Letivo
// Ano Letivo é apenas um filtro opcional para relatórios acadêmicos
import { useAnoLetivoAtivo } from "@/hooks/useAnoLetivoAtivo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { FileText, Download, Eye, Loader2, AlertCircle, CheckCircle, XCircle, Calendar, BookOpen, Users, GraduationCap, Printer } from "lucide-react";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PautaVisualizacao } from "@/components/relatorios/PautaVisualizacao";
import { BoletimVisualizacao } from "@/components/relatorios/BoletimVisualizacao";
import { HistoricoEscolarVisualizacao } from "@/components/relatorios/HistoricoEscolarVisualizacao";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";

const TIPOS_RELATORIO = [
  { value: 'PLANO_ENSINO_OFICIAL', label: 'Plano de Ensino Oficial', icon: BookOpen, desc: 'Plano de ensino aprovado com conteúdo, carga horária e assinaturas' },
  { value: 'MAPA_AULAS_MINISTRADAS', label: 'Mapa de Aulas Ministradas', icon: Calendar, desc: 'Aulas planejadas vs ministradas com percentual de cumprimento' },
  { value: 'MAPA_PRESENCAS', label: 'Mapa de Presenças', icon: Users, desc: 'Frequência por aluno com percentual final e situação' },
  { value: 'ATA_AVALIACOES', label: 'Ata de Avaliações', icon: FileText, desc: 'Avaliações e notas por trimestre encerrado' },
  { value: 'BOLETIM_ALUNO', label: 'Boletim do Aluno', icon: FileText, desc: 'Notas finais, frequência e situação acadêmica' },
  { value: 'RELATORIO_FINAL_ANO_LETIVO', label: 'Relatório Final do Ano Letivo', icon: FileText, desc: 'Resumo institucional com indicadores acadêmicos' },
];

export function RelatoriosOficiaisTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSecundario } = useInstituicao();
  const { anoLetivoAtivo } = useAnoLetivoAtivo();
  const { searchAlunos } = useAlunoSearch();

  // Buscar anos letivos disponíveis
  const { data: anosLetivos = [], isLoading: isLoadingAnosLetivos } = useQuery({
    queryKey: ["anos-letivos-relatorios", instituicaoId],
    queryFn: async () => {
      return await anoLetivoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  const [selectedTipo, setSelectedTipo] = useState<string>("");
  const [showDialogGerar, setShowDialogGerar] = useState(false);
  const [formData, setFormData] = useState({
    planoEnsinoId: "",
    disciplinaId: "",
    turmaId: "",
    alunoId: "",
    anoLetivo: anoLetivoAtivo?.ano || new Date().getFullYear(),
    trimestre: "",
  });

  // Buscar trimestres do ano letivo selecionado (apenas para Ensino Secundário)
  const anoLetivoSelecionado = anosLetivos.find((al: any) => al.ano === formData.anoLetivo);
  const { data: trimestres = [], isLoading: isLoadingTrimestres } = useQuery({
    queryKey: ["trimestres-relatorios", instituicaoId, formData.anoLetivo, anoLetivoSelecionado?.id],
    queryFn: async () => {
      if (anoLetivoSelecionado?.id) {
        return await trimestreApi.getAll({ anoLetivoId: anoLetivoSelecionado.id });
      }
      if (formData.anoLetivo) {
        return await trimestreApi.getAll({ anoLetivo: formData.anoLetivo });
      }
      return [];
    },
    enabled: !!instituicaoId && isSecundario && !!formData.anoLetivo,
  });

  // Estados para visualização de relatórios
  const [viewMode, setViewMode] = useState<'gerar' | 'visualizar'>('visualizar');
  const [selectedPlanoEnsinoId, setSelectedPlanoEnsinoId] = useState<string>("");
  const [selectedAlunoIdBoletim, setSelectedAlunoIdBoletim] = useState<string>("");
  const [selectedAlunoIdHistorico, setSelectedAlunoIdHistorico] = useState<string>("");
  const [selectedAnoLetivoId, setSelectedAnoLetivoId] = useState<string>("");

  // Buscar alunos para seleção
  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-relatorios", instituicaoId],
    queryFn: async () => {
      const response = await alunosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return response?.data ?? [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar planos de ensino para seleção (filtrado por ano letivo ativo)
  const { data: planosEnsino = [] } = useQuery({
    queryKey: ["planos-ensino-relatorios-select", instituicaoId, anoLetivoAtivo?.id],
    queryFn: async () => {
      if (!anoLetivoAtivo?.id) return [];
      try {
        const planos = await planoEnsinoApi.getByContext({
          anoLetivoId: anoLetivoAtivo.id,
        });
        return Array.isArray(planos) ? planos : [planos].filter(Boolean);
      } catch {
        return [];
      }
    },
    enabled: !!instituicaoId, // Removido bloqueio de anoLetivoAtivo - sempre habilitado
  });

  // Buscar relatórios gerados
  const { data: relatorios = [], isLoading: loadingRelatorios } = useQuery({
    queryKey: ['relatorios', instituicaoId],
    queryFn: async () => {
      return await relatoriosApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Mutation para gerar relatório
  const gerarRelatorioMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTipo) {
        throw new Error('Selecione um tipo de relatório');
      }

      let referenciaId = formData.planoEnsinoId;
      
      // Determinar referenciaId baseado no tipo
      if (selectedTipo === 'BOLETIM_ALUNO') {
        referenciaId = formData.alunoId;
      } else if (selectedTipo === 'RELATORIO_FINAL_ANO_LETIVO') {
        referenciaId = formData.turmaId || 'ano-letivo';
      }

      return await relatoriosApi.gerar({
        tipoRelatorio: selectedTipo,
        referenciaId,
        anoLetivo: formData.anoLetivo,
        turmaId: formData.turmaId || undefined,
        disciplinaId: formData.disciplinaId || undefined,
        alunoId: formData.alunoId || undefined,
        trimestre: formData.trimestre && formData.trimestre !== "all" ? Number(formData.trimestre) : undefined,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['relatorios'] });
      toast({
        title: "Relatório gerado",
        description: "O relatório foi gerado com sucesso",
      });
      setShowDialogGerar(false);
      setSelectedTipo("");
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao gerar relatório",
        description: error?.response?.data?.message || error.message,
        variant: "destructive",
      });
    },
  });

  const handleGerarRelatorio = () => {
    gerarRelatorioMutation.mutate();
  };

  const handleDownload = async (id: string, nomeArquivo?: string) => {
    try {
      const blob = await relatoriosApi.download(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo || `relatorio_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Erro ao baixar relatório",
        description: error?.response?.data?.message || "Erro ao baixar o arquivo",
        variant: "destructive",
      });
    }
  };

  const handleVisualizar = async (id: string) => {
    try {
      const blob = await relatoriosApi.visualizar(id);
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (error: any) {
      toast({
        title: "Erro ao visualizar relatório",
        description: error?.response?.data?.message || "Erro ao abrir o arquivo",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Concluído</Badge>;
      case 'GERANDO':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Gerando</Badge>;
      case 'ERRO':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTipoLabel = (tipo: string) => {
    return TIPOS_RELATORIO.find(t => t.value === tipo)?.label || tipo;
  };

  return (
    <div className="space-y-6">
        {/* Cabeçalho */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Relatórios Oficiais
            </CardTitle>
            <CardDescription>
              Visualize relatórios acadêmicos em tempo real ou gere documentos oficiais institucionais
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Visualização de Relatórios */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'gerar' | 'visualizar')} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="visualizar">Visualizar Relatórios</TabsTrigger>
            <TabsTrigger value="gerar">Gerar PDFs Oficiais</TabsTrigger>
          </TabsList>

          <TabsContent value="visualizar" className="space-y-6 mt-6">
            {/* Visualização de Pauta */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Pauta de Avaliação (por Plano de Ensino)
                </CardTitle>
                <CardDescription>
                  Visualize notas e frequência dos alunos de um Plano de Ensino
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Plano de Ensino *</Label>
                    <Select
                      value={selectedPlanoEnsinoId || ""}
                      onValueChange={(value) => setSelectedPlanoEnsinoId(value)}
                      disabled={planosEnsino.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={planosEnsino.length === 0 ? "Carregando planos de ensino..." : "Selecione um Plano de Ensino"} />
                      </SelectTrigger>
                      <SelectContent>
                        {planosEnsino.length === 0 ? (
                          <SelectItem value="no-planos" disabled>Nenhum plano de ensino encontrado</SelectItem>
                        ) : (
                          planosEnsino.map((plano: any) => (
                            <SelectItem key={plano.id} value={plano.id}>
                              {plano.disciplina?.nome || 'N/A'} - {plano.professor?.nomeCompleto || 'N/A'}
                              {plano.turma && ` - ${plano.turma.nome}`}
                              {plano.semestre && ` (${plano.semestre}º Semestre)`}
                              {plano.classeOuAno && ` (${plano.classeOuAno})`}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {!anoLetivoAtivo && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum ano letivo ativo. Você pode selecionar um ano letivo específico ou usar o ano atual como padrão.
                      </p>
                    )}
                    {anoLetivoAtivo && planosEnsino.length === 0 && (
                      <p className="text-xs text-muted-foreground">
                        Nenhum plano de ensino encontrado para o ano letivo {anoLetivoAtivo.ano}
                      </p>
                    )}
                  </div>
                  {selectedPlanoEnsinoId && (
                    <div className="mt-4">
                      <PautaVisualizacao planoEnsinoId={selectedPlanoEnsinoId} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visualização de Boletim */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Boletim do Aluno
                </CardTitle>
                <CardDescription>
                  Visualize notas e frequência de um aluno por ano letivo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Aluno *</Label>
                      <SmartSearch
                        placeholder="Digite o nome do aluno, email ou número de identificação..."
                        value={alunos?.find((a: any) => a.id === selectedAlunoIdBoletim)?.nome_completo || alunos?.find((a: any) => a.id === selectedAlunoIdBoletim)?.nomeCompleto || ""}
                        selectedId={selectedAlunoIdBoletim || undefined}
                        onSelect={(item) => {
                          setSelectedAlunoIdBoletim(item ? item.id : "");
                        }}
                        onClear={() => {
                          setSelectedAlunoIdBoletim("");
                        }}
                        searchFn={searchAlunos}
                        emptyMessage="Nenhum aluno encontrado"
                        minSearchLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ano Letivo (opcional)</Label>
                      <Select
                        value={selectedAnoLetivoId || "all"}
                        onValueChange={(value) => {
                          setSelectedAnoLetivoId(value === "all" ? "" : value);
                        }}
                        disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Todos os anos"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos os anos letivos</SelectItem>
                          {anosLetivos.map((al: any) => (
                            <SelectItem key={al.id} value={al.id}>
                              {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {selectedAlunoIdBoletim && (
                    <div className="mt-4">
                      <BoletimVisualizacao 
                        alunoId={selectedAlunoIdBoletim} 
                        anoLetivoId={selectedAnoLetivoId || undefined}
                        anoLetivo={anosLetivos.find((al: any) => al.id === selectedAnoLetivoId)?.ano}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Visualização de Histórico Escolar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Histórico Escolar
                </CardTitle>
                <CardDescription>
                  Visualize histórico acadêmico completo de um aluno (todos os anos letivos)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Aluno *</Label>
                    <SmartSearch
                      placeholder="Digite o nome do aluno, email ou número de identificação..."
                      value={alunos?.find((a: any) => a.id === selectedAlunoIdHistorico)?.nome_completo || alunos?.find((a: any) => a.id === selectedAlunoIdHistorico)?.nomeCompleto || ""}
                      selectedId={selectedAlunoIdHistorico || undefined}
                      onSelect={(item) => {
                        setSelectedAlunoIdHistorico(item ? item.id : "");
                      }}
                      onClear={() => {
                        setSelectedAlunoIdHistorico("");
                      }}
                      searchFn={searchAlunos}
                      emptyMessage="Nenhum aluno encontrado"
                      minSearchLength={2}
                    />
                  </div>
                  {selectedAlunoIdHistorico && (
                    <div className="mt-4">
                      <HistoricoEscolarVisualizacao alunoId={selectedAlunoIdHistorico} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="gerar" className="space-y-6 mt-6">
        {/* Tipos de Relatórios Disponíveis */}
        <Card>
          <CardHeader>
            <CardTitle>Tipos de Relatórios</CardTitle>
            <CardDescription>Selecione o tipo de relatório que deseja gerar</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TIPOS_RELATORIO.map((tipo) => {
                const Icon = tipo.icon;
                return (
                  <Card
                    key={tipo.value}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTipo === tipo.value ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => {
                      setSelectedTipo(tipo.value);
                      setShowDialogGerar(true);
                    }}
                  >
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {tipo.label}
                      </CardTitle>
                      <CardDescription className="text-sm">{tipo.desc}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Lista de Relatórios Gerados */}
        <Card>
          <CardHeader>
            <CardTitle>Relatórios Gerados</CardTitle>
            <CardDescription>Histórico de relatórios gerados</CardDescription>
          </CardHeader>
          <CardContent>
          {loadingRelatorios ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando relatórios...</p>
            </div>
          ) : relatorios.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum relatório gerado ainda</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Gerado por</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relatorios.map((relatorio: any) => (
                    <TableRow key={relatorio.id}>
                      <TableCell className="font-medium">{getTipoLabel(relatorio.tipoRelatorio)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {relatorio.referenciaId?.substring(0, 8)}...
                      </TableCell>
                      <TableCell>{getStatusBadge(relatorio.status)}</TableCell>
                      <TableCell>{relatorio.usuario?.nomeCompleto || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(relatorio.geradoEm), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {relatorio.status === 'CONCLUIDO' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVisualizar(relatorio.id)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Visualizar
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownload(relatorio.id, relatorio.nomeArquivo)}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </>
                          )}
                          {relatorio.status === 'ERRO' && (
                            <Alert variant="destructive" className="p-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">{relatorio.erro}</AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog para Gerar Relatório */}
        <Dialog open={showDialogGerar} onOpenChange={setShowDialogGerar}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Gerar Relatório</DialogTitle>
              <DialogDescription>
                Preencha os dados necessários para gerar o relatório: {selectedTipo && getTipoLabel(selectedTipo)}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
            {selectedTipo === 'PLANO_ENSINO_OFICIAL' && (
              <>
                <Alert>
                  <AlertDescription>
                    O plano de ensino deve estar APROVADO para gerar este relatório oficial.
                  </AlertDescription>
                </Alert>
                <div className="space-y-2">
                  <Label>Plano de Ensino ID *</Label>
                  <Input
                    value={formData.planoEnsinoId}
                    onChange={(e) => setFormData({ ...formData, planoEnsinoId: e.target.value })}
                    placeholder="ID do plano de ensino aprovado"
                  />
                </div>
              </>
            )}

            {(selectedTipo === 'MAPA_AULAS_MINISTRADAS' || selectedTipo === 'MAPA_PRESENCAS') && (
              <>
                <div className="space-y-2">
                  <Label>Plano de Ensino ID *</Label>
                  <Input
                    value={formData.planoEnsinoId}
                    onChange={(e) => setFormData({ ...formData, planoEnsinoId: e.target.value })}
                    placeholder="ID do plano de ensino"
                  />
                </div>
              </>
            )}

            {selectedTipo === 'ATA_AVALIACOES' && (
              <>
                <Alert>
                  <AlertDescription>
                    O trimestre deve estar ENCERRADO para gerar a ata de avaliações.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plano de Ensino ID *</Label>
                    <Input
                      value={formData.planoEnsinoId}
                      onChange={(e) => setFormData({ ...formData, planoEnsinoId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ano Letivo *</Label>
                    <Select
                      value={formData.anoLetivo?.toString() || ""}
                      onValueChange={(value) => {
                        const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                        setFormData({ 
                          ...formData, 
                          anoLetivo: anoSelecionado ? anoSelecionado.ano : Number(value) 
                        });
                      }}
                      disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione o ano letivo"} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingAnosLetivos ? (
                          <SelectItem value="loading" disabled>Carregando...</SelectItem>
                        ) : anosLetivos.length === 0 ? (
                          <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                        ) : (
                          anosLetivos.map((al: any) => (
                            <SelectItem key={al.id} value={al.ano.toString()}>
                              {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Trimestre *</Label>
                  <Select
                    value={formData.trimestre}
                    onValueChange={(value) => setFormData({ ...formData, trimestre: value })}
                    disabled={isLoadingTrimestres || trimestres.length === 0}
                  >
                    <SelectTrigger className={trimestres.length === 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                      <SelectValue placeholder={isLoadingTrimestres ? "Carregando..." : trimestres.length === 0 ? "Nenhum trimestre cadastrado" : "Selecione o trimestre"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingTrimestres ? (
                        <SelectItem value="loading" disabled>Carregando...</SelectItem>
                      ) : trimestres.length === 0 ? (
                        <SelectItem value="empty" disabled>Nenhum trimestre cadastrado para este ano letivo</SelectItem>
                      ) : (
                        trimestres.map((trimestre: any) => (
                          <SelectItem key={trimestre.id} value={trimestre.numero.toString()}>
                            {trimestre.numero}º Trimestre
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  {trimestres.length === 0 && !isLoadingTrimestres && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre trimestres para o ano letivo selecionado em Configuração de Ensino → Trimestres
                    </p>
                  )}
                </div>
              </>
            )}

            {selectedTipo === 'BOLETIM_ALUNO' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Aluno ID *</Label>
                    <Input
                      value={formData.alunoId}
                      onChange={(e) => setFormData({ ...formData, alunoId: e.target.value })}
                      placeholder="ID do aluno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ano Letivo *</Label>
                    <Select
                      value={formData.anoLetivo?.toString() || ""}
                      onValueChange={(value) => {
                        const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                        setFormData({ 
                          ...formData, 
                          anoLetivo: anoSelecionado ? anoSelecionado.ano : Number(value) 
                        });
                      }}
                      disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione o ano letivo"} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingAnosLetivos ? (
                          <SelectItem value="loading" disabled>Carregando...</SelectItem>
                        ) : anosLetivos.length === 0 ? (
                          <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                        ) : (
                          anosLetivos.map((al: any) => (
                            <SelectItem key={al.id} value={al.ano.toString()}>
                              {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                  <div className="space-y-2">
                    <Label>Trimestre (opcional)</Label>
                    <Select
                      value={formData.trimestre || "all"}
                      onValueChange={(value) => setFormData({ ...formData, trimestre: value === "all" ? "" : value })}
                      disabled={isLoadingTrimestres || trimestres.length === 0}
                    >
                      <SelectTrigger className={trimestres.length === 0 ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20" : ""}>
                        <SelectValue placeholder={isLoadingTrimestres ? "Carregando..." : trimestres.length === 0 ? "Nenhum trimestre cadastrado" : "Selecione o trimestre (opcional)"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os trimestres</SelectItem>
                        {isLoadingTrimestres ? (
                          <SelectItem value="loading" disabled>Carregando...</SelectItem>
                        ) : trimestres.length === 0 ? (
                          <SelectItem value="empty" disabled>Nenhum trimestre cadastrado para este ano letivo</SelectItem>
                        ) : (
                          trimestres.map((trimestre: any) => (
                            <SelectItem key={trimestre.id} value={trimestre.numero.toString()}>
                              {trimestre.numero}º Trimestre
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {trimestres.length === 0 && !isLoadingTrimestres && (
                      <p className="text-xs text-muted-foreground">
                        Cadastre trimestres para o ano letivo selecionado em Configuração de Ensino → Trimestres
                      </p>
                    )}
                  </div>
              </>
            )}

            {selectedTipo === 'RELATORIO_FINAL_ANO_LETIVO' && (
              <>
                <Alert>
                  <AlertDescription>
                    Todos os trimestres devem estar ENCERRADOS para gerar o relatório final.
                  </AlertDescription>
                </Alert>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Turma ID (opcional)</Label>
                    <Input
                      value={formData.turmaId}
                      onChange={(e) => setFormData({ ...formData, turmaId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ano Letivo *</Label>
                    <Select
                      value={formData.anoLetivo?.toString() || ""}
                      onValueChange={(value) => {
                        const anoSelecionado = anosLetivos.find((al: any) => al.ano.toString() === value);
                        setFormData({ 
                          ...formData, 
                          anoLetivo: anoSelecionado ? anoSelecionado.ano : Number(value) 
                        });
                      }}
                      disabled={isLoadingAnosLetivos || anosLetivos.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingAnosLetivos ? "Carregando..." : anosLetivos.length === 0 ? "Nenhum ano letivo cadastrado" : "Selecione o ano letivo"} />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingAnosLetivos ? (
                          <SelectItem value="loading" disabled>Carregando...</SelectItem>
                        ) : anosLetivos.length === 0 ? (
                          <SelectItem value="empty" disabled>Nenhum ano letivo cadastrado</SelectItem>
                        ) : (
                          anosLetivos.map((al: any) => (
                            <SelectItem key={al.id} value={al.ano.toString()}>
                              {al.ano} - {al.status === 'ATIVO' ? '🟢 Ativo' : al.status === 'ENCERRADO' ? '🔴 Encerrado' : '🟡 Planejado'}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialogGerar(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleGerarRelatorio}
                disabled={gerarRelatorioMutation.isPending}
              >
                {gerarRelatorioMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Gerar Relatório
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
          </TabsContent>
        </Tabs>
      </div>
  );
}

