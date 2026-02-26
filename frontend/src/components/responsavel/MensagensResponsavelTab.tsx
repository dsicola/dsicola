import { useState } from "react";
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
import { Plus, MessageSquare, Check, Clock, Send } from "lucide-react";

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
  const { data: mensagens, isLoading } = useQuery({
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
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!formData.professor_id || !formData.assunto || !formData.mensagem) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos.",
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
          Carregando mensagens...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Comunicação com Professores</h3>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nova Mensagem
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Enviar Mensagem ao Professor</DialogTitle>
              <DialogDescription>
                Envie uma mensagem para o professor do seu educando.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Professor</Label>
                <Select
                  value={formData.professor_id}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, professor_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o professor" />
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
                <Label>Assunto</Label>
                <Input
                  value={formData.assunto}
                  onChange={(e) => setFormData((prev) => ({ ...prev, assunto: e.target.value }))}
                  placeholder="Digite o assunto"
                />
              </div>
              <div className="space-y-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={formData.mensagem}
                  onChange={(e) => setFormData((prev) => ({ ...prev, mensagem: e.target.value }))}
                  placeholder="Digite sua mensagem"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                <Send className="h-4 w-4 mr-2" />
                {createMutation.isPending ? "Enviando..." : "Enviar"}
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
                      Para: {msg.professor?.nomeCompleto || msg.professor?.nome_completo || "Professor"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {msg.respondida ? (
                      <Badge className="bg-green-100 text-green-800">
                        <Check className="h-3 w-3 mr-1" />
                        Respondida
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Aguardando
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
                      <p className="text-sm font-medium mb-1">Sua mensagem:</p>
                      <p className="text-sm">{msg.mensagem}</p>
                    </div>
                    
                    {msg.respondida && msg.resposta && (
                      <div className="bg-primary/10 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">Resposta do professor:</p>
                        <p className="text-sm">{msg.resposta}</p>
                        {(msg.dataResposta || msg.data_resposta) && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Respondido em {format(new Date(msg.dataResposta || msg.data_resposta), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
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
              <p className="text-muted-foreground">Nenhuma mensagem enviada ainda.</p>
              <p className="text-sm text-muted-foreground">
                Clique em "Nova Mensagem" para entrar em contato com os professores.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
