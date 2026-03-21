import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matriculasApi, api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, MessageSquare, Check, Clock, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface MensagensResponsavelTabProps {
  alunoId: string;
}

// API methods for mensagens_responsavel
const mensagensResponsavelApi = {
  getAll: async (params?: { responsavelId?: string; alunoId?: string }) => {
    const response = await api.get('/mensagens-responsavel', { params });
    return response.data;
  },
  create: async (data: {
    responsavelId: string;
    professorId: string;
    alunoId: string;
    assunto: string;
    mensagem: string;
  }) => {
    const response = await api.post('/mensagens-responsavel', data);
    return response.data;
  },
};

export function MensagensResponsavelTab({ alunoId }: MensagensResponsavelTabProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedMensagem, setSelectedMensagem] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    professor_id: "",
    assunto: "",
    mensagem: "",
  });

  // Buscar professores do aluno (via turmas)
  const { data: professores } = useQuery({
    queryKey: ["professores-aluno", alunoId],
    queryFn: async () => {
      const res = await matriculasApi.getAll({ alunoId });
      const matriculas = res?.data ?? [];

      // Extrair professores únicos das turmas
      const professoresMap = new Map();
      matriculas?.forEach((m: any) => {
        const prof = m.turma?.professor;
        if (prof && !professoresMap.has(prof.id)) {
          professoresMap.set(prof.id, {
            id: prof.id,
            nome_completo: prof.nomeCompleto || prof.nome_completo,
            email: prof.email,
            turma: m.turma?.nome,
          });
        }
      });

      return Array.from(professoresMap.values());
    },
    enabled: !!alunoId,
  });

  // Buscar mensagens
  const { data: mensagens, isLoading, isError, refetch } = useQuery({
    queryKey: ["mensagens-responsavel", user?.id, alunoId],
    queryFn: async () => {
      const data = await mensagensResponsavelApi.getAll({
        responsavelId: user?.id,
        alunoId,
      });
      return data;
    },
    enabled: !!user?.id && !!alunoId,
  });

  // Criar mensagem
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await mensagensResponsavelApi.create({
        responsavelId: user?.id || '',
        professorId: data.professor_id,
        alunoId,
        assunto: data.assunto,
        mensagem: data.mensagem,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mensagens-responsavel"] });
      setShowDialog(false);
      setFormData({ professor_id: "", assunto: "", mensagem: "" });
      toast({
        title: t("pages.responsavel.mensagens.toastSent"),
        description: t("pages.responsavel.mensagens.toastSentDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("pages.responsavel.mensagens.toastError"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.professor_id || !formData.assunto || !formData.mensagem) {
      toast({
        title: t("pages.responsavel.mensagens.fieldsRequired"),
        description: t("pages.responsavel.mensagens.fieldsRequiredDesc"),
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("pages.responsavel.mensagens.loading")}
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert variant="destructive" className="border-destructive/50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{t("pages.responsavel.mensagens.loadError")}</AlertTitle>
        <AlertDescription className="pt-2">
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
            {t("pages.responsavel.retry")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">{t("pages.responsavel.mensagens.title")}</h3>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              {t("pages.responsavel.mensagens.newMessage")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("pages.responsavel.mensagens.dialogTitle")}</DialogTitle>
              <DialogDescription>{t("pages.responsavel.mensagens.dialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t("pages.responsavel.mensagens.professor")}</Label>
                <Select
                  value={formData.professor_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, professor_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("pages.responsavel.mensagens.selectProfessor")} />
                  </SelectTrigger>
                  <SelectContent>
                    {professores?.map((prof) => (
                      <SelectItem key={prof.id} value={prof.id}>
                        {prof.nome_completo} ({prof.turma})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("pages.responsavel.mensagens.subject")}</Label>
                <Input
                  value={formData.assunto}
                  onChange={(e) => setFormData((prev) => ({ ...prev, assunto: e.target.value }))}
                  placeholder={t("pages.responsavel.mensagens.subjectPlaceholder")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("pages.responsavel.mensagens.body")}</Label>
                <Textarea
                  value={formData.mensagem}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mensagem: e.target.value }))}
                  placeholder={t("pages.responsavel.mensagens.bodyPlaceholder")}
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                {t("pages.responsavel.mensagens.cancel")}
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {createMutation.isPending
                  ? t("pages.responsavel.mensagens.sending")
                  : t("pages.responsavel.mensagens.send")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista de Mensagens */}
      <div className="space-y-4">
        {mensagens && mensagens.length > 0 ? (
          mensagens.map((msg: any) => (
            <Card 
              key={msg.id} 
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${selectedMensagem?.id === msg.id ? "ring-2 ring-primary" : ""}`}
              onClick={() => setSelectedMensagem(selectedMensagem?.id === msg.id ? null : msg)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{msg.assunto}</CardTitle>
                    <CardDescription>
                      {t("pages.responsavel.mensagens.toProfessor")}:{" "}
                      {msg.professor?.nomeCompleto || msg.professor?.nome_completo || t("pages.responsavel.mensagens.professor")}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {msg.respondida ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        {t("pages.responsavel.mensagens.replied")}
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {t("pages.responsavel.mensagens.waiting")}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {format(new Date(msg.createdAt || msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </p>
                
                {selectedMensagem?.id === msg.id && (
                  <div className="mt-4 space-y-4">
                    <div className="bg-muted p-3 rounded-lg">
                      <p className="text-sm font-medium mb-1">{t("pages.responsavel.mensagens.yourMessage")}</p>
                      <p className="text-sm">{msg.mensagem}</p>
                    </div>
                    
                    {msg.respondida && msg.resposta && (
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">{t("pages.responsavel.mensagens.teacherReply")}</p>
                        <p className="text-sm">{msg.resposta}</p>
                        {(msg.dataResposta || msg.data_resposta) && (
                          <p className="text-xs text-muted-foreground mt-2">
                            {t("pages.responsavel.mensagens.repliedAt", {
                              date: format(new Date(msg.dataResposta || msg.data_resposta), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              }),
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">{t("pages.responsavel.mensagens.empty")}</p>
              <p className="text-sm text-muted-foreground">{t("pages.responsavel.mensagens.emptyHint")}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
