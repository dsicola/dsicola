import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { conclusaoCursoApi, alunosApi, cursosApi, classesApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { safeToFixed } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutenticidadeVerificacaoCallout } from "@/components/common/AutenticidadeVerificacaoCallout";
import { toast } from "sonner";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { 
  GraduationCap, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  FileText, 
  Award,
  CheckCircle,
  Clock,
  BookOpen,
  Calendar,
  User,
  Printer,
  Download,
  Eye,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch, useCursoSearch, useClasseSearch } from "@/hooks/useSmartSearch";

interface ValidacaoRequisitos {
  valido: boolean;
  erros: string[];
  avisos: string[];
  checklist: {
    disciplinasObrigatorias: {
      total: number;
      concluidas: number;
      pendentes: string[];
    };
    cargaHoraria: {
      exigida: number;
      cumprida: number;
      percentual: number;
    };
    frequencia: {
      media: number;
      minima: number;
      aprovado: boolean;
    };
    anoLetivoEncerrado: boolean;
    mediaGeral?: number;
  };
}

interface Conclusao {
  id: string;
  alunoId: string;
  cursoId?: string;
  classeId?: string;
  tipoConclusao: 'CONCLUIDO' | 'APROVEITAMENTO' | 'CERTIFICACAO';
  status: 'PENDENTE' | 'VALIDADO' | 'CONCLUIDO' | 'REJEITADO';
  dataConclusao: string;
  numeroAto?: string;
  disciplinasConcluidas: number;
  cargaHorariaTotal: number;
  frequenciaMedia?: number;
  mediaGeral?: number;
  aluno: {
    id: string;
    nomeCompleto: string;
    email: string;
  };
  curso?: {
    id: string;
    nome: string;
    codigo: string;
  };
  classe?: {
    id: string;
    nome: string;
    codigo: string;
  };
  colacaoGrau?: {
    id: string;
    dataColacao: string;
    numeroAta?: string;
  };
  certificado?: {
    id: string;
    numeroCertificado: string;
    dataEmissao: string;
    codigoVerificacao?: string | null;
  };
}

export function ConclusaoCursoTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSuperior: isSuperiorContext, isSecundario: isSecundarioContext, tipoAcademico } = useInstituicao();
  
  // CRÍTICO: Detectar tipo de instituição de forma mais robusta
  // Prioridade: 1) isSuperiorContext/isSecundarioContext do contexto, 2) tipoAcademico do contexto, 3) tipoAcademico da instituição
  const tipoAcademicoDetectado = tipoAcademico || instituicao?.tipoAcademico || instituicao?.tipo_academico;

  const tipoInstituicaoRaw =
    instituicao?.tipo_instituicao ||
    (instituicao as { tipoInstituicao?: string })?.tipoInstituicao ||
    '';
  const isMista = String(tipoInstituicaoRaw).toUpperCase() === 'MISTA';
  
  // CRÍTICO: Garantir que isSuperior e isSecundario sejam booleanos explícitos e mutuamente exclusivos
  const isSuperior = Boolean(
    isSuperiorContext || 
    tipoAcademicoDetectado === 'SUPERIOR'
  );
  const isSecundario = Boolean(
    isSecundarioContext || 
    tipoAcademicoDetectado === 'SECUNDARIO'
  );
  
  // DEBUG: Log para verificar detecção do tipo (apenas em desenvolvimento)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[ConclusaoCursoTab] Tipo de Instituição:', {
        tipoAcademico,
        instituicaoTipoAcademico: instituicao?.tipoAcademico,
        instituicaoTipoAcademicoSnake: instituicao?.tipo_academico,
        tipoAcademicoDetectado,
        isSuperiorContext,
        isSecundarioContext,
        isSuperior,
        isSecundario,
        isMista,
      });
    }
  }, [tipoAcademico, instituicao?.tipoAcademico, instituicao?.tipo_academico, tipoAcademicoDetectado, isSuperiorContext, isSecundarioContext, isSuperior, isSecundario, isMista]);
  const { searchAlunos } = useAlunoSearch();
  const { searchCursos } = useCursoSearch();
  const { searchClasses } = useClasseSearch();

  // Estados
  const [selectedAlunoId, setSelectedAlunoId] = useState<string>("");
  const [selectedCursoId, setSelectedCursoId] = useState<string>("");
  const [selectedClasseId, setSelectedClasseId] = useState<string>("");
  const [validacao, setValidacao] = useState<ValidacaoRequisitos | null>(null);
  const [showValidacaoDialog, setShowValidacaoDialog] = useSafeDialog(false);
  const [showConcluirDialog, setShowConcluirDialog] = useSafeDialog(false);
  const [showColacaoDialog, setShowColacaoDialog] = useSafeDialog(false);
  const [showCertificadoDialog, setShowCertificadoDialog] = useSafeDialog(false);
  const [conclusaoSelecionada, setConclusaoSelecionada] = useState<Conclusao | null>(null);
  const [numeroAto, setNumeroAto] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [dataColacao, setDataColacao] = useState("");
  const [numeroAta, setNumeroAta] = useState("");
  const [localColacao, setLocalColacao] = useState("");
  const [numeroCertificado, setNumeroCertificado] = useState("");
  const [livro, setLivro] = useState("");
  const [folha, setFolha] = useState("");
  const [notaTfc, setNotaTfc] = useState("");
  const [notaDefesa, setNotaDefesa] = useState("");
  const [dataTfc, setDataTfc] = useState("");
  const [dataDefesa, setDataDefesa] = useState("");
  const [pautaCicloOpen, setPautaCicloOpen] = useState(false);
  const [pautaCicloData, setPautaCicloData] = useState<any>(null);
  const [pautaPdfLoading, setPautaPdfLoading] = useState(false);
  const [certificadoPdfLoadingId, setCertificadoPdfLoadingId] = useState<string | null>(null);
  const [certificadoSupPdfLoadingId, setCertificadoSupPdfLoadingId] = useState<string | null>(null);
  /** Pré-visualização: mesmo PDF que o download (blob + iframe). */
  const [certPreviewOpen, setCertPreviewOpen] = useState(false);
  const [certPreviewUrl, setCertPreviewUrl] = useState<string | null>(null);
  const [certPreviewLoading, setCertPreviewLoading] = useState(false);
  const [certPreviewTitle, setCertPreviewTitle] = useState("");
  const certPreviewUrlCleanupRef = useRef<string | null>(null);

  useEffect(() => {
    certPreviewUrlCleanupRef.current = certPreviewUrl;
  }, [certPreviewUrl]);

  useEffect(() => {
    return () => {
      const u = certPreviewUrlCleanupRef.current;
      if (u) URL.revokeObjectURL(u);
    };
  }, []);

  const mistaSelectionInvalid =
    isMista &&
    ((!selectedCursoId && !selectedClasseId) || !!(selectedCursoId && selectedClasseId));

  // Buscar alunos
  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-conclusao", instituicaoId],
    queryFn: async () => {
      const response = await alunosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return response?.data ?? [];
    },
    enabled: !!instituicaoId,
  });

  // Buscar cursos (Superior)
  // CRÍTICO: NÃO enviar instituicaoId do frontend - backend usa req.user.instituicaoId do JWT
  // CRÍTICO: Backend filtra automaticamente por tipoAcademico (SUPERIOR)
  const { data: cursos = [], isLoading: isLoadingCursos } = useQuery({
    queryKey: ["cursos-conclusao", instituicaoId, tipoAcademicoDetectado],
    queryFn: async () => {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      // Backend também filtra por tipoAcademico automaticamente
      const response = await cursosApi.getAll({ ativo: true });
      const data = Array.isArray(response) ? response : (response?.data || []);
      
      // Filtrar apenas cursos ativos e que não sejam do tipo 'classe'
      return data.filter((curso: any) => {
        return curso.ativo !== false && curso.tipo !== 'classe';
      });
    },
    enabled: !!instituicaoId && (isSuperior || isMista),
  });

  // Buscar classes (Secundário)
  // CRÍTICO: NÃO enviar instituicaoId do frontend - backend usa req.user.instituicaoId do JWT
  const { data: classes = [], isLoading: isLoadingClasses } = useQuery({
    queryKey: ["classes-conclusao", instituicaoId, tipoAcademicoDetectado],
    queryFn: async () => {
      // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
      // O backend usa req.user.instituicaoId do JWT token automaticamente
      const response = await classesApi.getAll({ ativo: true });
      const data = Array.isArray(response) ? response : (response?.data || []);
      
      // Filtrar apenas classes ativas
      return data.filter((classe: any) => {
        return classe.ativo !== false;
      });
    },
    enabled: !!instituicaoId && (isSecundario || isMista),
  });

  // Limpar curso/classe cruzado só em instituição pura (em MISTA os dois selectores coexistem)
  useEffect(() => {
    if (isMista) return;
    if (isSuperior && selectedClasseId) {
      setSelectedClasseId("");
    }
    if (isSecundario && selectedCursoId) {
      setSelectedCursoId("");
    }
  }, [isMista, isSuperior, isSecundario, selectedClasseId, selectedCursoId]);

  // Buscar conclusões
  const { data: conclusoes = [], isLoading: loadingConclusoes } = useQuery({
    queryKey: ["conclusoes-cursos", instituicaoId],
    queryFn: async () => {
      return await conclusaoCursoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  const fetchCertificadoPdfBlob = async (kind: "sec" | "sup", conclusaoId: string) => {
    return kind === "sec"
      ? conclusaoCursoApi.downloadCertificadoConclusaoPdf(conclusaoId)
      : conclusaoCursoApi.downloadCertificadoConclusaoSuperiorPdf(conclusaoId);
  };

  const closeCertificadoPdfPreview = () => {
    setCertPreviewUrl((u) => {
      if (u) URL.revokeObjectURL(u);
      return null;
    });
    setCertPreviewOpen(false);
    setCertPreviewTitle("");
    setCertPreviewLoading(false);
  };

  const openCertificadoPdfPreview = async (kind: "sec" | "sup", conclusaoId: string, title: string) => {
    setCertPreviewOpen(true);
    setCertPreviewLoading(true);
    setCertPreviewTitle(title);
    setCertPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    try {
      const blob = await fetchCertificadoPdfBlob(kind, conclusaoId);
      const url = URL.createObjectURL(blob);
      setCertPreviewUrl(url);
    } catch (e: unknown) {
      toast.error(
        getApiErrorMessage(e, "Não foi possível carregar o PDF para pré-visualização."),
      );
      setCertPreviewOpen(false);
      setCertPreviewTitle("");
      setCertPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    } finally {
      setCertPreviewLoading(false);
    }
  };

  const baixarPautaPdf = async () => {
    if (!selectedAlunoId) return;
    setPautaPdfLoading(true);
    try {
      const blob = await conclusaoCursoApi.downloadPautaConclusaoCicloPdf({ alunoId: selectedAlunoId });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "pauta-conclusao-ciclo.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF descarregado.");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Não foi possível gerar o PDF."));
    } finally {
      setPautaPdfLoading(false);
    }
  };

  const baixarCertificadoPdf = async (conclusaoId: string, numeroCertificado?: string) => {
    setCertificadoPdfLoadingId(conclusaoId);
    try {
      const blob = await fetchCertificadoPdfBlob("sec", conclusaoId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = (numeroCertificado || "certificado").replace(/[^\w.-]+/g, "_").slice(0, 80);
      a.download = `certificado-${safe}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Certificado em PDF descarregado.");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Não foi possível gerar o PDF do certificado."));
    } finally {
      setCertificadoPdfLoadingId(null);
    }
  };

  const baixarCertificadoSuperiorPdf = async (conclusaoId: string) => {
    setCertificadoSupPdfLoadingId(conclusaoId);
    try {
      const blob = await fetchCertificadoPdfBlob("sup", conclusaoId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safe = conclusaoId.replace(/[^\w.-]+/g, "_").slice(0, 48);
      a.download = `certificado-superior-${safe || "conclusao"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Certificado em PDF descarregado.");
    } catch (e: unknown) {
      toast.error(getApiErrorMessage(e, "Não foi possível gerar o PDF do certificado."));
    } finally {
      setCertificadoSupPdfLoadingId(null);
    }
  };

  const pautaCicloMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAlunoId) throw new Error('Selecione um estudante');
      return await conclusaoCursoApi.getPautaConclusaoCiclo({ alunoId: selectedAlunoId });
    },
    onSuccess: (data) => {
      setPautaCicloData(data);
      setPautaCicloOpen(true);
      toast.success('Pauta de conclusão do ciclo carregada.');
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, 'Não foi possível carregar a pauta. Verifique se a instituição é Secundário.'));
    },
  });

  // Validar requisitos
  const validarMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAlunoId) {
        throw new Error('Selecione um estudante');
      }
      if (isMista) {
        if (!selectedCursoId && !selectedClasseId) {
          throw new Error('Selecione curso (superior) ou classe (secundário), apenas um.');
        }
        if (selectedCursoId && selectedClasseId) {
          throw new Error('Em instituição mista, selecione só curso ou só classe.');
        }
      } else if (!selectedCursoId && !selectedClasseId) {
        throw new Error('Selecione um curso ou classe');
      }
      return await conclusaoCursoApi.validarRequisitos({
        alunoId: selectedAlunoId,
        cursoId: selectedCursoId || undefined,
        classeId: selectedClasseId || undefined,
      });
    },
    onSuccess: (data) => {
      setValidacao(data);
      setShowValidacaoDialog(true);
      if (data.valido) {
        toast.success("Requisitos validados com sucesso!");
      } else {
        toast.error("Requisitos não atendidos. Verifique o checklist.");
      }
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível validar os requisitos. Tente novamente."));
    },
  });

  // Criar solicitação
  const criarSolicitacaoMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAlunoId) {
        throw new Error('Selecione um estudante');
      }
      if (isMista) {
        if (!selectedCursoId && !selectedClasseId) {
          throw new Error('Selecione curso ou classe (apenas um).');
        }
        if (selectedCursoId && selectedClasseId) {
          throw new Error('Em instituição mista, use só curso ou só classe.');
        }
      } else if (!selectedCursoId && !selectedClasseId) {
        throw new Error('Selecione um curso ou classe');
      }
      return await conclusaoCursoApi.criarSolicitacao({
        alunoId: selectedAlunoId,
        cursoId: selectedCursoId || undefined,
        classeId: selectedClasseId || undefined,
        observacoes: observacoes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conclusoes-cursos"] });
      setShowValidacaoDialog(false);
      setSelectedAlunoId("");
      setSelectedCursoId("");
      setSelectedClasseId("");
      setObservacoes("");
      toast.success("Solicitação de conclusão criada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível criar a solicitação. Verifique os dados e tente novamente."));
    },
  });

  // Concluir curso
  const concluirMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      const nTfc = notaTfc ? parseFloat(notaTfc) : undefined;
      const nDef = notaDefesa ? parseFloat(notaDefesa) : undefined;
      return await conclusaoCursoApi.concluirCurso(id, {
        numeroAto: numeroAto || undefined,
        observacoes: observacoes || undefined,
        notaTfc: nTfc != null && !isNaN(nTfc) ? nTfc : undefined,
        notaDefesa: nDef != null && !isNaN(nDef) ? nDef : undefined,
        dataTfc: dataTfc || undefined,
        dataDefesa: dataDefesa || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conclusoes-cursos"] });
      setShowConcluirDialog(false);
      setNumeroAto("");
      setObservacoes("");
      setNotaTfc("");
      setNotaDefesa("");
      setDataTfc("");
      setDataDefesa("");
      toast.success("Curso concluído oficialmente!");
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível concluir o curso. Verifique se todos os requisitos estão cumpridos."));
    },
  });

  // Criar colação de grau
  const criarColacaoMutation = useSafeMutation({
    mutationFn: async () => {
      if (!conclusaoSelecionada?.id) throw new Error('Conclusão não selecionada');
      return await conclusaoCursoApi.criarColacaoGrau(conclusaoSelecionada.id, {
        dataColacao: dataColacao || undefined,
        numeroAta: numeroAta || undefined,
        localColacao: localColacao || undefined,
        observacoes: observacoes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conclusoes-cursos"] });
      setShowColacaoDialog(false);
      setDataColacao("");
      setNumeroAta("");
      setLocalColacao("");
      setObservacoes("");
      toast.success("Colação de grau registrada com sucesso!");
    },
    onError: (error: any) => {
      toast.error(getApiErrorMessage(error, "Não foi possível registrar a colação de grau. Tente novamente."));
    },
  });

  // Criar certificado
  const criarCertificadoMutation = useSafeMutation({
    mutationFn: async () => {
      if (!conclusaoSelecionada?.id) throw new Error('Conclusão não selecionada');
      if (!numeroCertificado) throw new Error('Número do certificado é obrigatório');
      return await conclusaoCursoApi.criarCertificado(conclusaoSelecionada.id, {
        numeroCertificado,
        livro: livro || undefined,
        folha: folha || undefined,
        observacoes: observacoes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conclusoes-cursos"] });
      setShowCertificadoDialog(false);
      setNumeroCertificado("");
      setLivro("");
      setFolha("");
      setObservacoes("");
      toast.success("Certificado emitido com sucesso!");
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || error?.message;
      const fallback = error?.response?.status === 400
        ? "Verifique os dados: número do certificado obrigatório e não pode estar duplicado."
        : "Não foi possível emitir o certificado. Tente novamente ou contacte o suporte.";
      toast.error(msg || fallback);
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return <Badge className="bg-green-500">Concluído</Badge>;
      case 'VALIDADO':
        return <Badge className="bg-blue-500">Validado</Badge>;
      case 'PENDENTE':
        return <Badge className="bg-yellow-500">Pendente</Badge>;
      case 'REJEITADO':
        return <Badge className="bg-red-500">Rejeitado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          Conclusão de Curso / Certificação
        </h2>
        <p className="text-muted-foreground">
          Gerir conclusões de curso/classe e emissão de certificados oficiais (secundário: livro de registo; superior: colação de grau).
        </p>
        <AutenticidadeVerificacaoCallout variant="conclusao" />
        {/* DEBUG: Mostrar tipo detectado (apenas em desenvolvimento) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            <strong>DEBUG:</strong> Tipo: {tipoAcademicoDetectado || 'NÃO DETECTADO'} | 
            Mista: {isMista ? 'SIM' : 'NÃO'} | 
            Superior: {isSuperior ? 'SIM' : 'NÃO'} | 
            Secundário: {isSecundario ? 'SIM' : 'NÃO'}
          </div>
        )}
      </div>

      {/* Formulário de Validação */}
      <Card>
        <CardHeader>
          <CardTitle>Validar Requisitos para Conclusão</CardTitle>
          <CardDescription>
            Selecione o estudante e o curso/classe para validar os requisitos de conclusão
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Estudante *</Label>
              <SmartSearch
                placeholder="Digite nome, email ou BI do estudante..."
                value={alunos?.find((a: any) => a.id === selectedAlunoId)?.nome_completo || alunos?.find((a: any) => a.id === selectedAlunoId)?.nomeCompleto || ""}
                selectedId={selectedAlunoId || undefined}
                onSelect={(item) => setSelectedAlunoId(item ? item.id : "")}
                onClear={() => setSelectedAlunoId("")}
                searchFn={searchAlunos}
                minSearchLength={1}
                emptyMessage="Nenhum estudante encontrado"
                silent
              />
            </div>

            {isMista ? (
              <div className="space-y-3 md:col-span-1">
                <p className="text-xs text-muted-foreground">
                  Instituição mista: escolha <strong>só</strong> curso (conclusão superior) <strong>ou</strong> só classe (secundário).
                </p>
                <div className="space-y-2">
                  <Label>Curso (Ensino Superior)</Label>
                  <SmartSearch
                    placeholder="Opcional — fluxo superior..."
                    value={cursos?.find((c: any) => c.id === selectedCursoId)?.nome || ""}
                    selectedId={selectedCursoId || undefined}
                    onSelect={(item) => {
                      setSelectedCursoId(item ? item.id : "");
                      if (item) setSelectedClasseId("");
                    }}
                    onClear={() => setSelectedCursoId("")}
                    searchFn={searchCursos}
                    minSearchLength={1}
                    emptyMessage="Nenhum curso encontrado."
                    disabled={isLoadingCursos}
                    silent
                  />
                </div>
                <div className="space-y-2">
                  <Label>Classe (Ensino Secundário)</Label>
                  <SmartSearch
                    placeholder="Opcional — fluxo secundário..."
                    value={classes?.find((c: any) => c.id === selectedClasseId)?.nome || ""}
                    selectedId={selectedClasseId || undefined}
                    onSelect={(item) => {
                      setSelectedClasseId(item ? item.id : "");
                      if (item) setSelectedCursoId("");
                    }}
                    onClear={() => setSelectedClasseId("")}
                    searchFn={searchClasses}
                    minSearchLength={1}
                    emptyMessage="Nenhuma classe encontrada."
                    silent
                  />
                </div>
                {mistaSelectionInvalid && (
                  <p className="text-xs text-destructive">Indique exatamente um: curso ou classe.</p>
                )}
              </div>
            ) : isSuperior ? (
              <div className="space-y-2">
                <Label>Curso *</Label>
                <SmartSearch
                  placeholder="Digite o nome ou código do curso..."
                  value={cursos?.find((c: any) => c.id === selectedCursoId)?.nome || ""}
                  selectedId={selectedCursoId || undefined}
                  onSelect={(item) => {
                    setSelectedCursoId(item ? item.id : "");
                    if (selectedClasseId) setSelectedClasseId("");
                  }}
                  onClear={() => setSelectedCursoId("")}
                  searchFn={searchCursos}
                  minSearchLength={1}
                  emptyMessage={
                    isSuperior
                      ? "Nenhum curso cadastrado. Cadastre em Gestão Acadêmica → Cursos."
                      : "Nenhum curso encontrado."
                  }
                  disabled={isLoadingCursos}
                  silent
                />
                {!isLoadingCursos && cursos?.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Cadastre cursos em Gestão Acadêmica → Cursos.
                  </p>
                )}
              </div>
            ) : isSecundario ? (
              <div className="space-y-2">
                <Label>Classe *</Label>
                <SmartSearch
                  placeholder="Digite o nome ou código da classe..."
                  value={classes?.find((c: any) => c.id === selectedClasseId)?.nome || ""}
                  selectedId={selectedClasseId || undefined}
                  onSelect={(item) => {
                    setSelectedClasseId(item ? item.id : "");
                    if (selectedCursoId) setSelectedCursoId("");
                  }}
                  onClear={() => setSelectedClasseId("")}
                  searchFn={searchClasses}
                  minSearchLength={1}
                  emptyMessage="Nenhuma classe cadastrada. Cadastre em Configuração de Ensino → Classes."
                  silent
                />
                {classes?.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Cadastre classes em Configuração de Ensino → Classes.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-destructive">Tipo de Instituição *</Label>
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 font-medium">
                    Tipo de instituição não detectado
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Não foi possível determinar se a instituição é de Ensino Superior ou Secundário.
                    Defina o tipo académico em Configurações → Instituição ou utilize uma conta com instituição classificada como MISTA.
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                onClick={() => validarMutation.mutate()}
                disabled={
                  !selectedAlunoId ||
                  mistaSelectionInvalid ||
                  (!isMista && isSuperior && !selectedCursoId) ||
                  (!isMista && isSecundario && !selectedClasseId) ||
                  validarMutation.isPending
                }
                className="w-full"
                title={
                  !selectedAlunoId
                    ? "Selecione um estudante"
                    : mistaSelectionInvalid
                    ? "Em instituição mista, selecione só curso ou só classe"
                    : !isMista && isSuperior && !selectedCursoId
                    ? "Selecione um curso (obrigatório para Ensino Superior)"
                    : !isMista && isSecundario && !selectedClasseId
                    ? "Selecione uma classe (obrigatório para Ensino Secundário)"
                    : undefined
                }
              >
                {validarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Validar Requisitos
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {(isSecundario || isMista) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pauta de conclusão do ciclo</CardTitle>
            <CardDescription>
              Média por disciplina = média das notas finais nas classes do ciclo (10ª–12ª, ou conforme Parâmetros do Sistema).
              Média final do curso = média das disciplinas (simples ou por carga horária).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 items-center">
            <Button
              type="button"
              variant="secondary"
              disabled={!selectedAlunoId || pautaCicloMutation.isPending}
              onClick={() => pautaCicloMutation.mutate()}
            >
              {pautaCicloMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  A carregar…
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar / ver pauta do ciclo
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!selectedAlunoId || pautaPdfLoading}
              onClick={() => void baixarPautaPdf()}
            >
              {pautaPdfLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Printer className="h-4 w-4 mr-2" />
              )}
              Baixar PDF
            </Button>
            {!selectedAlunoId && (
              <p className="text-sm text-muted-foreground">Selecione um estudante para pré-visualizar a pauta.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={pautaCicloOpen} onOpenChange={setPautaCicloOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pauta de conclusão do ciclo</DialogTitle>
            <DialogDescription>
              Ensino secundário — baseada no histórico académico (anos letivos encerrados).
            </DialogDescription>
          </DialogHeader>
          {pautaCicloData && (
            <div className="space-y-3 text-sm">
              <div className="flex flex-wrap gap-4">
                <span>
                  <strong>Ciclo:</strong>{' '}
                  {(pautaCicloData.ordensCiclo || []).map((o: number) => `${o}ª`).join(', ') || '—'}
                </span>
                <span>
                  <strong>Média final do curso:</strong>{' '}
                  {pautaCicloData.mediaFinalCurso != null ? safeToFixed(pautaCicloData.mediaFinalCurso, 2) : '—'}
                </span>
                <span>
                  <strong>Tipo:</strong> {pautaCicloData.tipoMediaFinalCurso === 'PONDERADA_CARGA' ? 'Ponderada (CH)' : 'Simples'}
                </span>
                <span>
                  <strong>Situação:</strong>{' '}
                  {pautaCicloData.incompleto ? (
                    <Badge variant="secondary">Incompleto</Badge>
                  ) : pautaCicloData.aprovadoCurso ? (
                    <Badge className="bg-green-600">Aprovado (critério global)</Badge>
                  ) : (
                    <Badge variant="destructive">Não aprovado</Badge>
                  )}
                </span>
              </div>
              {Array.isArray(pautaCicloData.avisos) && pautaCicloData.avisos.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {pautaCicloData.avisos.map((a: string, i: number) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    {(pautaCicloData.ordensCiclo || []).map((o: number) => (
                      <TableHead key={o} className="text-center">
                        {o}ª
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Média ciclo</TableHead>
                    <TableHead className="text-center">≥ {pautaCicloData.percentualMinimo ?? 10}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(pautaCicloData.disciplinas || []).map((row: any) => (
                    <TableRow key={row.disciplinaId}>
                      <TableCell className="font-medium">{row.disciplinaNome}</TableCell>
                      {(row.notasPorClasse || []).map((c: any, idx: number) => (
                        <TableCell key={idx} className="text-center">
                          {c.mediaFinal != null ? safeToFixed(c.mediaFinal, 2) : '—'}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">
                        {row.mediaDisciplinaCiclo != null ? safeToFixed(row.mediaDisciplinaCiclo, 2) : '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.aprovadoDisciplina ? '✓' : '✗'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPautaCicloOpen(false)}>
              Fechar
            </Button>
            {pautaCicloData && selectedAlunoId && (
              <Button
                type="button"
                disabled={pautaPdfLoading}
                onClick={() => void baixarPautaPdf()}
              >
                {pautaPdfLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Baixar PDF
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checklist de Validação */}
      {validacao && (
        <Dialog open={showValidacaoDialog} onOpenChange={setShowValidacaoDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Checklist de Requisitos</DialogTitle>
              <DialogDescription>
                Verificação dos requisitos para conclusão de curso
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Status Geral */}
              <Alert variant={validacao.valido ? "default" : "destructive"}>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {validacao.valido
                    ? "Todos os requisitos foram atendidos. Você pode criar a solicitação de conclusão."
                    : "Alguns requisitos não foram atendidos. Corrija os problemas antes de continuar."}
                </AlertDescription>
              </Alert>

              {/* Checklist */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {validacao.checklist.disciplinasObrigatorias.concluidas ===
                  validacao.checklist.disciplinasObrigatorias.total ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">Disciplinas Obrigatórias</p>
                    <p className="text-sm text-muted-foreground">
                      {validacao.checklist.disciplinasObrigatorias.concluidas} de{" "}
                      {validacao.checklist.disciplinasObrigatorias.total} concluídas
                    </p>
                    {validacao.checklist.disciplinasObrigatorias.pendentes.length > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        Pendentes: {validacao.checklist.disciplinasObrigatorias.pendentes.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {validacao.checklist.cargaHoraria.percentual >= 100 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">Carga Horária</p>
                    <p className="text-sm text-muted-foreground">
                      {validacao.checklist.cargaHoraria.cumprida}h de{" "}
                      {validacao.checklist.cargaHoraria.exigida}h (
                      {safeToFixed(validacao.checklist.cargaHoraria.percentual, 2)}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {validacao.checklist.frequencia.aprovado ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">Frequência</p>
                    <p className="text-sm text-muted-foreground">
                      Média: {safeToFixed(validacao.checklist.frequencia.media, 2)}% (Mínimo:{" "}
                      {validacao.checklist.frequencia.minima}%)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {validacao.checklist.anoLetivoEncerrado ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                  <div className="flex-1">
                    <p className="font-medium">Ano Letivo Encerrado</p>
                    <p className="text-sm text-muted-foreground">
                      {validacao.checklist.anoLetivoEncerrado
                        ? "Todos os anos letivos relacionados estão encerrados"
                        : "Alguns anos letivos ainda não foram encerrados"}
                    </p>
                  </div>
                </div>

                {validacao.checklist.mediaGeral != null && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">Média Geral {isSecundario || isMista ? '(ciclo — quando fluxo secundário)' : ''}</p>
                      <p className="text-sm text-muted-foreground">
                        {safeToFixed(validacao.checklist.mediaGeral, 2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Erros */}
              {validacao.erros.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Erros encontrados:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validacao.erros.map((erro, index) => (
                        <li key={index} className="text-sm">
                          {erro}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Avisos */}
              {validacao.avisos.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Avisos:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {validacao.avisos.map((aviso, index) => (
                        <li key={index} className="text-sm">
                          {aviso}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowValidacaoDialog(false)}>
                Fechar
              </Button>
              {validacao.valido && (
                <Button
                  onClick={() => criarSolicitacaoMutation.mutate()}
                  disabled={criarSolicitacaoMutation.isPending}
                >
                  {criarSolicitacaoMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Criar Solicitação
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Lista de Conclusões */}
      <Card>
        <CardHeader>
          <CardTitle>Conclusões Registradas</CardTitle>
          <CardDescription>
            Histórico de conclusões de curso e certificações
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingConclusoes ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-muted-foreground">Carregando conclusões...</p>
            </div>
          ) : conclusoes.length === 0 ? (
            <div className="text-center py-8">
              <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma conclusão registrada ainda</p>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudante</TableHead>
                    <TableHead>{isMista ? 'Curso / Classe' : isSuperior ? 'Curso' : 'Classe'}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Documento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conclusoes.map((conclusao: Conclusao) => (
                    <TableRow key={conclusao.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{conclusao.aluno.nomeCompleto}</p>
                          <p className="text-xs text-muted-foreground">{conclusao.aluno.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {conclusao.curso ? (
                          <div>
                            <p className="font-medium">{conclusao.curso.nome}</p>
                            <p className="text-xs text-muted-foreground">{conclusao.curso.codigo}</p>
                          </div>
                        ) : conclusao.classe ? (
                          <div>
                            <p className="font-medium">{conclusao.classe.nome}</p>
                            <p className="text-xs text-muted-foreground">{conclusao.classe.codigo}</p>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(conclusao.status)}</TableCell>
                      <TableCell>
                        {format(new Date(conclusao.dataConclusao), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        {conclusao.colacaoGrau ? (
                          <Badge variant="outline">
                            <Award className="h-3 w-3 mr-1" />
                            Colação
                          </Badge>
                        ) : conclusao.certificado ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <Badge variant="outline">
                              <FileText className="h-3 w-3 mr-1" />
                              Certificado
                            </Badge>
                            {conclusao.certificado.codigoVerificacao ? (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                Verif.: {conclusao.certificado.codigoVerificacao}
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {conclusao.status === 'VALIDADO' && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setConclusaoSelecionada(conclusao);
                                setShowConcluirDialog(true);
                              }}
                            >
                              Concluir
                            </Button>
                          )}
                          {conclusao.status === 'CONCLUIDO' &&
                            !!conclusao.cursoId &&
                            !conclusao.colacaoGrau && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setConclusaoSelecionada(conclusao);
                                setShowColacaoDialog(true);
                              }}
                            >
                              <Award className="h-4 w-4 mr-1" />
                              Colação
                            </Button>
                          )}
                          {conclusao.status === 'CONCLUIDO' &&
                            !!conclusao.classeId &&
                            !conclusao.certificado && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setConclusaoSelecionada(conclusao);
                                setShowCertificadoDialog(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              Certificado
                            </Button>
                          )}
                          {conclusao.status === 'CONCLUIDO' && conclusao.certificado && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                title="Pré-visualizar o mesmo PDF que será descarregado"
                                disabled={
                                  certificadoPdfLoadingId === conclusao.id || certPreviewLoading
                                }
                                onClick={() =>
                                  openCertificadoPdfPreview(
                                    "sec",
                                    conclusao.id,
                                    `${conclusao.aluno.nomeCompleto} · N.º ${conclusao.certificado?.numeroCertificado ?? "—"}`,
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={certificadoPdfLoadingId === conclusao.id}
                                onClick={() =>
                                  baixarCertificadoPdf(conclusao.id, conclusao.certificado?.numeroCertificado)
                                }
                              >
                                {certificadoPdfLoadingId === conclusao.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-1" />
                                )}
                                PDF
                              </Button>
                            </>
                          )}
                          {conclusao.status === 'CONCLUIDO' && conclusao.colacaoGrau && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                title="Pré-visualizar o mesmo PDF que será descarregado"
                                disabled={
                                  certificadoSupPdfLoadingId === conclusao.id || certPreviewLoading
                                }
                                onClick={() =>
                                  openCertificadoPdfPreview(
                                    "sup",
                                    conclusao.id,
                                    `${conclusao.aluno.nomeCompleto} · Certificado (Ensino Superior)`,
                                  )
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Ver
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={certificadoSupPdfLoadingId === conclusao.id}
                                onClick={() => baixarCertificadoSuperiorPdf(conclusao.id)}
                              >
                                {certificadoSupPdfLoadingId === conclusao.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-1" />
                                )}
                                PDF cert.
                              </Button>
                            </>
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

      {/* Dialog: Concluir Curso */}
      <Dialog open={showConcluirDialog} onOpenChange={setShowConcluirDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Concluir Curso Oficialmente</DialogTitle>
            <DialogDescription>
              Esta ação marcará o curso como concluído e tornará o histórico acadêmico imutável.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número do Ato (Opcional)</Label>
              <Input
                value={numeroAto}
                onChange={(e) => setNumeroAto(e.target.value)}
                placeholder="Ex: Ato nº 123/2024"
              />
            </div>
            {(isSuperior || isMista) && !!conclusaoSelecionada?.cursoId && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nota TFC (Opcional)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={notaTfc}
                      onChange={(e) => setNotaTfc(e.target.value)}
                      placeholder="Ex: 16"
                    />
                    <p className="text-xs text-muted-foreground">Trabalho de Fim de Curso</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nota Defesa (Opcional)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="20"
                      step="0.5"
                      value={notaDefesa}
                      onChange={(e) => setNotaDefesa(e.target.value)}
                      placeholder="Ex: 15"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data TFC (Opcional)</Label>
                    <Input
                      type="date"
                      value={dataTfc}
                      onChange={(e) => setDataTfc(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Defesa (Opcional)</Label>
                    <Input
                      type="date"
                      value={dataDefesa}
                      onChange={(e) => setDataDefesa(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>Observações (Opcional)</Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre a conclusão"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConcluirDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => conclusaoSelecionada && concluirMutation.mutate(conclusaoSelecionada.id)}
              disabled={concluirMutation.isPending}
            >
              {concluirMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Concluindo...
                </>
              ) : (
                "Concluir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Colação de Grau */}
      <Dialog open={showColacaoDialog} onOpenChange={setShowColacaoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Colação de Grau</DialogTitle>
            <DialogDescription>
              Registre os dados da cerimônia de colação de grau
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data da Colação</Label>
              <Input
                type="date"
                value={dataColacao}
                onChange={(e) => setDataColacao(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Número da Ata (Opcional)</Label>
              <Input
                value={numeroAta}
                onChange={(e) => setNumeroAta(e.target.value)}
                placeholder="Ex: Ata nº 45/2024"
              />
            </div>
            <div className="space-y-2">
              <Label>Local (Opcional)</Label>
              <Input
                value={localColacao}
                onChange={(e) => setLocalColacao(e.target.value)}
                placeholder="Ex: Auditório Principal"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (Opcional)</Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre a colação"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColacaoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarColacaoMutation.mutate()}
              disabled={criarColacaoMutation.isPending}
            >
              {criarColacaoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrando...
                </>
              ) : (
                "Registrar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Certificado */}
      <Dialog open={showCertificadoDialog} onOpenChange={setShowCertificadoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Emitir Certificado</DialogTitle>
            <DialogDescription>
              Registre os dados do certificado de conclusão
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Número do Certificado *</Label>
              <Input
                value={numeroCertificado}
                onChange={(e) => setNumeroCertificado(e.target.value)}
                placeholder="Ex: CERT-2024-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Livro (Opcional)</Label>
              <Input
                value={livro}
                onChange={(e) => setLivro(e.target.value)}
                placeholder="Ex: Livro 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Folha (Opcional)</Label>
              <Input
                value={folha}
                onChange={(e) => setFolha(e.target.value)}
                placeholder="Ex: Folha 123"
              />
            </div>
            <div className="space-y-2">
              <Label>Observações (Opcional)</Label>
              <Input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Observações sobre o certificado"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCertificadoDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarCertificadoMutation.mutate()}
              disabled={!numeroCertificado || criarCertificadoMutation.isPending}
            >
              {criarCertificadoMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Emitindo...
                </>
              ) : (
                "Emitir"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={certPreviewOpen}
        onOpenChange={(open) => {
          if (!open) closeCertificadoPdfPreview();
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 p-4 sm:p-6">
          <DialogHeader className="shrink-0 space-y-1 pr-8">
            <DialogTitle>Pré-visualização do certificado</DialogTitle>
            <DialogDescription className="line-clamp-2 break-words">{certPreviewTitle}</DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            {certPreviewLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">A carregar PDF…</p>
              </div>
            ) : certPreviewUrl ? (
              <>
                <div className="flex shrink-0 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(`${certPreviewUrl}#view=FitH`, "_blank", "noopener,noreferrer")
                    }
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Abrir em nova aba
                  </Button>
                </div>
                <iframe
                  title="Pré-visualização do certificado"
                  src={`${certPreviewUrl}#view=FitH`}
                  className="min-h-[60vh] w-full flex-1 rounded-md border bg-muted/30"
                />
              </>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

