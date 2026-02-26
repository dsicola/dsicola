import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comunicadosApi, cursosApi, turmasApi, alunosApi, userRolesApi } from "@/services/api";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Send, Megaphone, Trash2, Eye, EyeOff, X, Paperclip, Download, FileAudio, FileText, Image } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useTenantFilter, useCurrentInstituicaoId } from "@/hooks/useTenantFilter";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch } from "@/hooks/useSmartSearch";

interface Anexo {
  filename: string;
  type?: string;
  name?: string;
  size?: number;
}

interface Comunicado {
  id: string;
  titulo: string;
  conteudo: string;
  tipo: string;
  tipoEnvio?: string;
  destinatarios: string;
  destinatariosDetalhe?: Array<{
    tipo: string;
    referenciaId?: string;
  }>;
  data_publicacao?: string;
  dataPublicacao?: string;
  ativo: boolean;
  anexos?: Anexo[];
}

export function ComunicadosTab() {
  const queryClient = useQueryClient();
  const { config } = useInstituicao();
  const { instituicaoId } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();
  const { searchAlunos } = useAlunoSearch();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    conteudo: "",
    tipo: "Geral",
    tipoEnvio: "GERAL" as "GERAL" | "ROLE" | "ALUNO" | "TURMA" | "CURSO",
    destinatarios: "Todos",
    destinatariosDetalhe: [] as Array<{
      tipo: "ROLE" | "ALUNO" | "TURMA" | "CURSO";
      referenciaId?: string;
      label?: string;
    }>,
    anexos: [] as Anexo[],
  });
  const [uploading, setUploading] = useState(false);

  // IMPORTANTE: Multi-tenant - NUNCA enviar instituicaoId do frontend
  // O backend usa req.user.instituicaoId do JWT token automaticamente
  const { data: comunicados = [], isLoading } = useQuery({
    queryKey: ["comunicados"],
    queryFn: async () => {
      const response = await comunicadosApi.getAll();
      return Array.isArray(response) ? response : (response?.data || []);
    },
  });

  // Load data for selects
  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-comunicados"],
    queryFn: async () => {
      return await cursosApi.getAll({ ativo: true });
    },
    enabled: (formData.tipoEnvio === "CURSO" || dialogOpen),
  });

  const { data: turmas = [] } = useQuery({
    queryKey: ["turmas-comunicados"],
    queryFn: async () => {
      return await turmasApi.getAll();
    },
    enabled: (formData.tipoEnvio === "TURMA" || dialogOpen),
  });

  const { data: alunos = [] } = useQuery({
    queryKey: ["alunos-comunicados"],
    queryFn: async () => {
      const res = await alunosApi.getAll();
      return res?.data ?? [];
    },
    enabled: (formData.tipoEnvio === "ALUNO" || dialogOpen),
  });

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      // Filter out destinatarios without referenciaId and only send if not empty
      const destinatariosDetalhe = data.tipoEnvio !== "GERAL" && data.destinatariosDetalhe.length > 0
        ? data.destinatariosDetalhe
            .filter(d => d.referenciaId) // Only include items with referenciaId
            .map(d => ({
              tipo: d.tipo,
              referenciaId: d.referenciaId!,
            }))
        : undefined;

      await comunicadosApi.create({
        titulo: data.titulo,
        conteudo: data.conteudo,
        tipo: data.tipo,
        tipoEnvio: data.tipoEnvio,
        destinatarios: data.destinatarios,
        destinatariosDetalhe: destinatariosDetalhe,
        anexos: data.anexos?.length ? data.anexos : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicados"] });
      toast.success("Comunicado criado com sucesso!");
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      setFormData({
        titulo: "",
        conteudo: "",
        tipo: "Geral",
        tipoEnvio: "GERAL",
        destinatarios: "Todos",
        destinatariosDetalhe: [],
        anexos: [],
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao criar comunicado");
    },
  });

  const toggleAtivoMutation = useSafeMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await comunicadosApi.update(id, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicados"] });
      toast.success("Comunicado atualizado!");
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await comunicadosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicados"] });
      toast.success("Comunicado excluído!");
    },
  });

  const sendEmailMutation = async (comunicado: Comunicado) => {
    setSendingEmail(true);
    try {
      const response = await comunicadosApi.sendEmail({
        comunicadoId: comunicado.id,
        destinatarios: comunicado.destinatarios,
        titulo: comunicado.titulo,
        conteudo: comunicado.conteudo,
        instituicaoNome: config?.nome_instituicao || "Instituição",
        ...(currentInstituicaoId && { instituicaoId: currentInstituicaoId }),
      });
      
      toast.success(`Emails enviados: ${response.sent} de ${response.total}`);
      if (response.failed > 0) {
        toast.warning(`${response.failed} emails falharam`);
      }
    } catch (error) {
      console.error("Error sending emails:", error);
      toast.error("Erro ao enviar emails");
    } finally {
      setSendingEmail(false);
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case "Urgente":
        return <Badge variant="destructive">{tipo}</Badge>;
      case "Academico":
        return <Badge className="bg-blue-500">{tipo}</Badge>;
      case "Financeiro":
        return <Badge className="bg-amber-500">{tipo}</Badge>;
      default:
        return <Badge variant="secondary">{tipo}</Badge>;
    }
  };

  const getTipoEnvioLabel = (tipoEnvio?: string) => {
    switch (tipoEnvio) {
      case "GERAL": return "Geral";
      case "ROLE": return "Por Função";
      case "ALUNO": return "Por Aluno";
      case "TURMA": return "Por Turma";
      case "CURSO": return "Por Curso";
      default: return "Geral";
    }
  };

  const handleAddDestinatario = (tipo: "ROLE" | "ALUNO" | "TURMA" | "CURSO", referenciaId?: string, label?: string) => {
    if (!referenciaId) return;
    
    const exists = formData.destinatariosDetalhe.some(
      d => d.tipo === tipo && d.referenciaId === referenciaId
    );
    
    if (exists) {
      toast.warning("Destinatário já adicionado");
      return;
    }

    setFormData({
      ...formData,
      destinatariosDetalhe: [
        ...formData.destinatariosDetalhe,
        { tipo, referenciaId, label }
      ]
    });
  };

  const handleRemoveDestinatario = (index: number) => {
    setFormData({
      ...formData,
      destinatariosDetalhe: formData.destinatariosDetalhe.filter((_, i) => i !== index)
    });
  };

  const handleAnexoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await comunicadosApi.uploadAnexo(file);
      setFormData((prev) => ({
        ...prev,
        anexos: [...prev.anexos, { filename: result.filename, type: result.type, name: result.name, size: result.size }],
      }));
      toast.success("Anexo adicionado");
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Erro ao enviar anexo");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const removeAnexo = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      anexos: prev.anexos.filter((_, i) => i !== index),
    }));
  };

  const canSubmit = () => {
    if (!formData.titulo || !formData.conteudo) return false;
    if (formData.tipoEnvio !== "GERAL") {
      // Verifica se há pelo menos um destinatário válido (com referenciaId)
      const validDestinatarios = formData.destinatariosDetalhe.filter(d => d.referenciaId);
      if (validDestinatarios.length === 0) return false;
    }
    return true;
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Comunicados</h2>
          <p className="text-muted-foreground">
            Gerencie os comunicados e avisos da instituição
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Comunicado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Comunicado</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Título do comunicado"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Categoria *</Label>
                  <Select
                    value={formData.tipo}
                    onValueChange={(value) => setFormData({ ...formData, tipo: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Geral">Geral</SelectItem>
                      <SelectItem value="Urgente">Urgente</SelectItem>
                      <SelectItem value="Academico">Acadêmico</SelectItem>
                      <SelectItem value="Financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Envio *</Label>
                  <Select
                    value={formData.tipoEnvio}
                    onValueChange={(value: any) => {
                      setFormData({
                        ...formData,
                        tipoEnvio: value,
                        destinatariosDetalhe: [],
                        destinatarios: value === "GERAL" ? "Todos" : formData.destinatarios
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GERAL">Geral (toda instituição)</SelectItem>
                      <SelectItem value="ROLE">Por Função</SelectItem>
                      <SelectItem value="ALUNO">Por Aluno</SelectItem>
                      <SelectItem value="TURMA">Por Turma</SelectItem>
                      <SelectItem value="CURSO">Por Curso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Destinatários específicos */}
              {formData.tipoEnvio !== "GERAL" && (
                <div className="space-y-2">
                  <Label>
                    Destinatários *
                    {formData.destinatariosDetalhe.length > 0 && (
                      <span className="ml-2 text-sm text-muted-foreground">
                        ({formData.destinatariosDetalhe.length} selecionado{formData.destinatariosDetalhe.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </Label>
                  
                  {formData.tipoEnvio === "ROLE" && (
                    <Select
                      onValueChange={(value) => {
                        const labels: Record<string, string> = {
                          ALUNO: "Alunos",
                          PROFESSOR: "Professores",
                          SECRETARIA: "Secretaria",
                          ADMIN: "Administradores",
                          POS: "POS",
                        };
                        handleAddDestinatario("ROLE", value, labels[value] || value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma função" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALUNO">Alunos</SelectItem>
                        <SelectItem value="PROFESSOR">Professores</SelectItem>
                        <SelectItem value="SECRETARIA">Secretaria</SelectItem>
                        <SelectItem value="ADMIN">Administradores</SelectItem>
                        <SelectItem value="POS">POS</SelectItem>
                      </SelectContent>
                    </Select>
                  )}

                  {formData.tipoEnvio === "ALUNO" && (
                    <SmartSearch
                      placeholder="Buscar aluno por nome, email ou BI..."
                      value=""
                      onSelect={(item) => {
                        if (item) {
                          handleAddDestinatario("ALUNO", item.id, item.nomeCompleto || item.nome_completo);
                        }
                      }}
                      searchFn={searchAlunos}
                      emptyMessage="Nenhum aluno encontrado"
                    />
                  )}

                  {formData.tipoEnvio === "TURMA" && (
                    <Select
                      onValueChange={(value) => {
                        const turma = turmas.find((t: any) => t.id === value);
                        handleAddDestinatario("TURMA", value, turma?.nome);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma turma" />
                      </SelectTrigger>
                      <SelectContent>
                        {turmas.map((turma: any) => (
                          <SelectItem key={turma.id} value={turma.id}>
                            {turma.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {formData.tipoEnvio === "CURSO" && (
                    <Select
                      onValueChange={(value) => {
                        const curso = cursos.find((c: any) => c.id === value);
                        handleAddDestinatario("CURSO", value, curso?.nome);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um curso" />
                      </SelectTrigger>
                      <SelectContent>
                        {cursos.map((curso: any) => (
                          <SelectItem key={curso.id} value={curso.id}>
                            {curso.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {/* Lista de destinatários selecionados */}
                  {formData.destinatariosDetalhe.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.destinatariosDetalhe.map((dest, index) => (
                        <Badge key={index} variant="secondary" className="flex items-center gap-1">
                          {dest.label || dest.referenciaId}
                          <button
                            type="button"
                            onClick={() => handleRemoveDestinatario(index)}
                            className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>Conteúdo *</Label>
                <Textarea
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  placeholder="Escreva o conteúdo do comunicado..."
                  rows={6}
                />
              </div>
              <div className="space-y-2">
                <Label>Anexos (imagens, PDF, áudio, vídeo)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,audio/*,video/*"
                    onChange={handleAnexoUpload}
                    disabled={uploading}
                    className="max-w-xs"
                  />
                  {uploading && <span className="text-sm text-muted-foreground">Enviando...</span>}
                </div>
                {formData.anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.anexos.map((a, i) => (
                      <Badge key={i} variant="secondary" className="flex items-center gap-1">
                        <Paperclip className="h-3 w-3" />
                        {a.name || a.filename}
                        <button type="button" onClick={() => removeAnexo(i)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <Button
                className="w-full"
                onClick={() => createMutation.mutate(formData)}
                disabled={!canSubmit() || createMutation.isPending}
              >
                <Megaphone className="h-4 w-4 mr-2" />
                Publicar Comunicado
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {comunicados?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum comunicado publicado</p>
            </CardContent>
          </Card>
        ) : (
          comunicados?.map((comunicado: Comunicado) => (
            <Card key={comunicado.id} className={!comunicado.ativo ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg">{comunicado.titulo}</CardTitle>
                      {getTipoBadge(comunicado.tipo)}
                      <Badge variant="outline">{getTipoEnvioLabel(comunicado.tipoEnvio)}</Badge>
                      {comunicado.destinatarios && (
                        <Badge variant="outline">{comunicado.destinatarios}</Badge>
                      )}
                      {!comunicado.ativo && <Badge variant="secondary">Inativo</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Publicado em {format(
                        new Date(comunicado.data_publicacao || comunicado.dataPublicacao || new Date()),
                        "dd/MM/yyyy 'às' HH:mm",
                        { locale: ptBR }
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendEmailMutation(comunicado)}
                      disabled={sendingEmail}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Enviar Email
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleAtivoMutation.mutate({ id: comunicado.id, ativo: !comunicado.ativo })}
                    >
                      {comunicado.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(comunicado.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="whitespace-pre-wrap">{comunicado.conteudo}</p>
                {comunicado.anexos && Array.isArray(comunicado.anexos) && comunicado.anexos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {comunicado.anexos.map((a: Anexo, i: number) => {
                      const isAudio = (a.type || "").startsWith("audio/");
                      const isImage = (a.type || "").startsWith("image/");
                      const Icon = isAudio ? FileAudio : isImage ? Image : FileText;
                      return (
                        <Button
                          key={i}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={() => comunicadosApi.downloadAnexo(comunicado.id, a.filename, a.name)}
                        >
                          <Icon className="h-4 w-4" />
                          <span className="truncate max-w-[150px]">{a.name || a.filename}</span>
                          <Download className="h-3 w-3 shrink-0" />
                        </Button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}