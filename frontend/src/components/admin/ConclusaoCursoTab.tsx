import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { conclusaoCursoApi, alunosApi, cursosApi, classesApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
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
  User
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";

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
  };
}

export function ConclusaoCursoTab() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const { instituicao, isSuperior: isSuperiorContext, isSecundario: isSecundarioContext, tipoAcademico } = useInstituicao();
  
  // CRÍTICO: Detectar tipo de instituição de forma mais robusta
  // Prioridade: 1) isSuperiorContext/isSecundarioContext do contexto, 2) tipoAcademico do contexto, 3) tipoAcademico da instituição
  const tipoAcademicoDetectado = tipoAcademico || instituicao?.tipoAcademico || instituicao?.tipo_academico;
  
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
      });
    }
  }, [tipoAcademico, instituicao?.tipoAcademico, instituicao?.tipo_academico, tipoAcademicoDetectado, isSuperiorContext, isSecundarioContext, isSuperior, isSecundario]);
  const { searchAlunos } = useAlunoSearch();

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

  // Buscar alunos
  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-conclusao", instituicaoId],
    queryFn: async () => {
      const response = await alunosApi.getAll({ instituicaoId: instituicaoId || undefined });
      return Array.isArray(response) ? response : (response?.data || []);
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
    enabled: !!instituicaoId && isSuperior, // Só buscar se for Ensino Superior
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
    enabled: !!instituicaoId && isSecundario, // CRÍTICO: Só buscar classes se for Ensino Secundário
  });

  // CRÍTICO: Limpar campos inválidos quando tipo de instituição mudar
  useEffect(() => {
    if (isSuperior && selectedClasseId) {
      // Ensino Superior: limpar classeId se estiver selecionado
      setSelectedClasseId("");
    }
    if (isSecundario && selectedCursoId) {
      // Ensino Secundário: limpar cursoId se estiver selecionado
      setSelectedCursoId("");
    }
  }, [isSuperior, isSecundario, selectedClasseId, selectedCursoId]);

  // Buscar conclusões
  const { data: conclusoes = [], isLoading: loadingConclusoes } = useQuery({
    queryKey: ["conclusoes-cursos", instituicaoId],
    queryFn: async () => {
      return await conclusaoCursoApi.getAll();
    },
    enabled: !!instituicaoId,
  });

  // Validar requisitos
  const validarMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAlunoId) {
        throw new Error('Selecione um estudante');
      }
      if (!selectedCursoId && !selectedClasseId) {
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
      toast.error(error?.response?.data?.message || "Erro ao validar requisitos");
    },
  });

  // Criar solicitação
  const criarSolicitacaoMutation = useSafeMutation({
    mutationFn: async () => {
      if (!selectedAlunoId) {
        throw new Error('Selecione um estudante');
      }
      if (!selectedCursoId && !selectedClasseId) {
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
      toast.error(error?.response?.data?.message || "Erro ao criar solicitação");
    },
  });

  // Concluir curso
  const concluirMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await conclusaoCursoApi.concluirCurso(id, {
        numeroAto: numeroAto || undefined,
        observacoes: observacoes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conclusoes-cursos"] });
      setShowConcluirDialog(false);
      setNumeroAto("");
      setObservacoes("");
      toast.success("Curso concluído oficialmente!");
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao concluir curso");
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
      toast.error(error?.response?.data?.message || "Erro ao criar colação de grau");
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
      toast.error(error?.response?.data?.message || "Erro ao emitir certificado");
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
          Gerencie a conclusão de cursos e emissão de certificados/diplomas
        </p>
        {/* DEBUG: Mostrar tipo detectado (apenas em desenvolvimento) */}
        {process.env.NODE_ENV !== 'production' && (
          <div className="mt-2 p-2 bg-muted rounded text-xs">
            <strong>DEBUG:</strong> Tipo: {tipoAcademicoDetectado || 'NÃO DETECTADO'} | 
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
                options={alunos.map((a: any) => ({
                  value: a.id,
                  label: a.nome_completo || a.nomeCompleto || a.nome,
                  subtitle: a.email,
                }))}
                value={selectedAlunoId}
                onValueChange={setSelectedAlunoId}
                placeholder="Buscar estudante..."
              />
            </div>

            {/* CRÍTICO: ENSINO SUPERIOR - APENAS Curso, NUNCA Classe */}
            {/* REGRA ABSOLUTA: Se isSuperior === true, mostrar APENAS Curso */}
            {/* REGRA ABSOLUTA: Se isSecundario === true, mostrar APENAS Classe */}
            {/* REGRA ABSOLUTA: Se ambos forem false, mostrar mensagem de erro */}
            {isSuperior ? (
              <div className="space-y-2">
                <Label>Curso *</Label>
                <Select 
                  value={selectedCursoId} 
                  onValueChange={(value) => {
                    setSelectedCursoId(value);
                    // CRÍTICO: Limpar classeId se estiver selecionado (não deve acontecer, mas garantir)
                    if (selectedClasseId) {
                      setSelectedClasseId("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingCursos ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Carregando cursos...
                      </div>
                    ) : cursos.length === 0 ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        {isSuperior 
                          ? "Nenhum curso cadastrado. Cadastre cursos em Gestão Acadêmica → Cursos."
                          : "Nenhum curso encontrado para sua instituição."
                        }
                      </div>
                    ) : (
                      cursos.map((curso: any) => (
                        <SelectItem key={curso.id} value={curso.id}>
                          {curso.nome} ({curso.codigo})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!isLoadingCursos && cursos.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    {isSuperior 
                      ? "Não há cursos cadastrados para Ensino Superior. Cadastre cursos em Gestão Acadêmica → Cursos."
                      : "Nenhum curso encontrado. Verifique se há cursos cadastrados para sua instituição."
                    }
                  </p>
                )}
              </div>
            ) : isSecundario ? (
              /* CRÍTICO: ENSINO SECUNDÁRIO - APENAS Classe, NUNCA Curso */
              <div className="space-y-2">
                <Label>Classe *</Label>
                <Select 
                  value={selectedClasseId} 
                  onValueChange={(value) => {
                    setSelectedClasseId(value);
                    // CRÍTICO: Limpar cursoId se estiver selecionado (não deve acontecer, mas garantir)
                    if (selectedCursoId) {
                      setSelectedCursoId("");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a classe" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.length === 0 ? (
                      <div className="p-2 text-center text-sm text-muted-foreground">
                        Nenhuma classe cadastrada. Cadastre classes em Configuração de Ensino → Classes.
                      </div>
                    ) : (
                      classes.map((classe: any) => (
                        <SelectItem key={classe.id} value={classe.id}>
                          {classe.nome} ({classe.codigo})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {classes.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Não há classes cadastradas. Cadastre classes em Configuração de Ensino → Classes.
                  </p>
                )}
              </div>
            ) : (
              /* CRÍTICO: Tipo de instituição não detectado - mostrar mensagem de erro */
              <div className="space-y-2">
                <Label className="text-destructive">Tipo de Instituição *</Label>
                <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800 font-medium">
                    Tipo de instituição não detectado
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Não foi possível determinar se a instituição é de Ensino Superior ou Secundário. 
                    Configure o tipo acadêmico da instituição em Configurações → Instituição.
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
                  (isSuperior && !selectedCursoId) || 
                  (isSecundario && !selectedClasseId) || 
                  validarMutation.isPending
                }
                className="w-full"
                title={
                  !selectedAlunoId 
                    ? "Selecione um estudante" 
                    : isSuperior && !selectedCursoId 
                    ? "Selecione um curso (obrigatório para Ensino Superior)" 
                    : isSecundario && !selectedClasseId 
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
                      {validacao.checklist.cargaHoraria.percentual.toFixed(2)}%)
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
                      Média: {validacao.checklist.frequencia.media.toFixed(2)}% (Mínimo:{" "}
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

                {validacao.checklist.mediaGeral && (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium">Média Geral</p>
                      <p className="text-sm text-muted-foreground">
                        {validacao.checklist.mediaGeral.toFixed(2)}
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estudante</TableHead>
                    <TableHead>{isSuperior ? 'Curso' : 'Classe'}</TableHead>
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
                          <Badge variant="outline">
                            <FileText className="h-3 w-3 mr-1" />
                            Certificado
                          </Badge>
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
                          {conclusao.status === 'CONCLUIDO' && isSuperior && !conclusao.colacaoGrau && (
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
                          {conclusao.status === 'CONCLUIDO' && !isSuperior && !conclusao.certificado && (
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
    </div>
  );
}

