import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { comunicadosApi, turmasApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Megaphone, CheckCircle2, Circle, Plus, X, Paperclip, Download, FileAudio, FileText, Image } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

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
  data_publicacao?: string;
  dataPublicacao?: string;
  lido?: boolean;
  dataLeitura?: string | null;
  anexos?: Anexo[];
}

export default function MuralComunicados() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isProfessor = user?.roles?.includes("PROFESSOR");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    titulo: "",
    conteudo: "",
    tipo: "Geral" as "Geral" | "Urgente" | "Academico" | "Financeiro",
    tipoEnvio: "TURMA" as "TURMA" | "CURSO",
    destinatariosDetalhe: [] as Array<{ tipo: "TURMA" | "CURSO"; referenciaId: string; label?: string }>,
    anexos: [] as Anexo[],
  });
  const [uploading, setUploading] = useState(false);

  const { data: turmasData } = useQuery({
    queryKey: ["professor-turmas-comunicados", user?.id],
    queryFn: async () => {
      const data = await turmasApi.getTurmasProfessor({ incluirPendentes: true });
      return data || { turmas: [] };
    },
    enabled: isProfessor && dialogOpen,
  });

  const turmas = turmasData?.turmas || [];
  const cursos = [...new Map(
    turmas
      .filter((t: any) => t.cursoId || t.curso?.id)
      .map((t: any) => {
        const id = t.curso?.id || t.cursoId;
        const nome = t.curso?.nome || t.cursoNome || `Curso ${id}`;
        return [id, { id, nome }];
      })
  ).values()];

  const { data: comunicados = [], isLoading } = useQuery({
    queryKey: ["comunicados-mural", user?.id],
    queryFn: async () => {
      const data = await comunicadosApi.getUserComunicados();
      return (data || []).sort((a: any, b: any) => 
        new Date(b.data_publicacao || b.dataPublicacao || 0).getTime() - 
        new Date(a.data_publicacao || a.dataPublicacao || 0).getTime()
      ) as Comunicado[];
    },
    enabled: !!user?.id
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await comunicadosApi.markAsRead(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicados-mural"] });
    },
    onError: () => {
      toast.error("Erro ao marcar comunicado como lido");
    },
  });

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

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const destinatariosDetalhe = data.destinatariosDetalhe
        .filter((d) => d.referenciaId)
        .map((d) => ({ tipo: d.tipo, referenciaId: d.referenciaId }));
      await comunicadosApi.create({
        titulo: data.titulo,
        conteudo: data.conteudo,
        tipo: data.tipo,
        tipoEnvio: data.tipoEnvio,
        destinatarios: data.tipoEnvio === "TURMA" ? "Turma(s)" : "Curso(s)",
        destinatariosDetalhe: destinatariosDetalhe.length > 0 ? destinatariosDetalhe : undefined,
        anexos: data.anexos.length > 0 ? data.anexos : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comunicados-mural"] });
      toast.success("Aviso publicado com sucesso!");
      setDialogOpen(false);
      setFormData({
        titulo: "",
        conteudo: "",
        tipo: "Geral",
        tipoEnvio: "TURMA",
        destinatariosDetalhe: [],
        anexos: [],
      });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || "Erro ao publicar aviso");
    },
  });

  const handleAddDestinatario = (tipo: "TURMA" | "CURSO", referenciaId: string, label?: string) => {
    if (formData.destinatariosDetalhe.some((d) => d.tipo === tipo && d.referenciaId === referenciaId)) {
      toast.warning("Destinatário já adicionado");
      return;
    }
    setFormData({
      ...formData,
      destinatariosDetalhe: [...formData.destinatariosDetalhe, { tipo, referenciaId, label }],
    });
  };

  const handleRemoveDestinatario = (index: number) => {
    setFormData({
      ...formData,
      destinatariosDetalhe: formData.destinatariosDetalhe.filter((_, i) => i !== index),
    });
  };

  const canSubmit =
    formData.titulo &&
    formData.conteudo &&
    formData.destinatariosDetalhe.filter((d) => d.referenciaId).length > 0;

  const handleCardClick = (comunicado: Comunicado) => {
    if (!comunicado.lido && comunicado.id) {
      markAsReadMutation.mutate(comunicado.id);
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

  const unreadCount = comunicados.filter(c => !c.lido).length;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center p-8">Carregando...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t('pages.muralComunicados')}</h1>
            <p className="text-muted-foreground">
              {t('pages.muralComunicadosDesc')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isProfessor && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Publicar aviso
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Publicar aviso para turma ou curso</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={formData.titulo}
                        onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                        placeholder="Título do aviso"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select
                          value={formData.tipo}
                          onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
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
                        <Label>Destinar a *</Label>
                        <Select
                          value={formData.tipoEnvio}
                          onValueChange={(v: any) =>
                            setFormData({ ...formData, tipoEnvio: v, destinatariosDetalhe: [] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="TURMA">Turma(s)</SelectItem>
                            <SelectItem value="CURSO">Curso(s)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Selecione {formData.tipoEnvio === "TURMA" ? "turma(s)" : "curso(s)"} *</Label>
                      {formData.tipoEnvio === "TURMA" && (
                        <Select
                          onValueChange={(value) => {
                            const t = turmas.find((x: any) => x.id === value);
                            handleAddDestinatario("TURMA", value, t?.nome);
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
                            const c = cursos.find((x: any) => x.id === value);
                            handleAddDestinatario("CURSO", value, c?.nome);
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
                    <div className="space-y-2">
                      <Label>Conteúdo *</Label>
                      <Textarea
                        value={formData.conteudo}
                        onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                        placeholder="Escreva o aviso..."
                        rows={5}
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
                      disabled={!canSubmit || createMutation.isPending}
                      onClick={() => createMutation.mutate(formData)}
                    >
                      {createMutation.isPending ? "Publicando..." : "Publicar aviso"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            {unreadCount > 0 && (
              <Badge variant="default" className="text-sm">
                {unreadCount} não lido{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>

        {comunicados?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Megaphone className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum comunicado disponível</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {comunicados?.map((comunicado) => (
              <Card 
                key={comunicado.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  !comunicado.lido ? "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => handleCardClick(comunicado)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-lg">{comunicado.titulo}</CardTitle>
                        {getTipoBadge(comunicado.tipo)}
                        {!comunicado.lido && (
                          <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                            <Circle className="h-3 w-3 mr-1" />
                            Não lido
                          </Badge>
                        )}
                        {comunicado.lido && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Lido
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Publicado em {format(
                          new Date(comunicado.data_publicacao || comunicado.dataPublicacao || new Date()),
                          "dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                          { locale: ptBR }
                        )}
                        {comunicado.lido && comunicado.dataLeitura && (
                          <span className="ml-2">
                            • Lido em {format(
                              new Date(comunicado.dataLeitura),
                              "dd/MM/yyyy 'às' HH:mm",
                              { locale: ptBR }
                            )}
                          </span>
                        )}
                      </p>
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
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}