import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { 
  Bell, 
  Mail, 
  GraduationCap, 
  DollarSign, 
  Calendar, 
  Megaphone,
  Save,
  Loader2,
  Send,
  AlertTriangle,
  FileText
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface NotificationSettings {
  notificar_notas: boolean;
  notificar_inadimplencia: boolean;
  notificar_frequencia: boolean;
  notificar_comunicados: boolean;
  enviar_boletim_automatico: boolean;
}

export function NotificacoesConfigTab() {
  const { user } = useAuth();
  const { config } = useInstituicao();
  
  const [settings, setSettings] = useState<NotificationSettings>({
    notificar_notas: true,
    notificar_inadimplencia: true,
    notificar_frequencia: true,
    notificar_comunicados: true,
    enviar_boletim_automatico: false,
  });
  const [enviandoTeste, setEnviandoTeste] = useState<string | null>(null);

  // Fetch notification settings from localStorage (simplified - in production use DB)
  const { isLoading } = useQuery({
    queryKey: ["notification-settings"],
    queryFn: async () => {
      const saved = localStorage.getItem("dsicola_notification_settings");
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        return parsed;
      }
      return settings;
    },
  });

  const saveSettings = () => {
    localStorage.setItem("dsicola_notification_settings", JSON.stringify(settings));
    toast({
      title: "Configurações salvas",
      description: "As preferências de notificação foram atualizadas.",
    });
  };

  const enviarEmailTeste = async (tipo: string) => {
    if (!user?.email) {
      toast({
        title: "Erro",
        description: "Email do usuário não encontrado.",
        variant: "destructive",
      });
      return;
    }

    setEnviandoTeste(tipo);

    try {
      let endpoint = "";
      let payload = {};
      const instituicaoNome = config?.nome_instituicao || "DSICOLA";

      switch (tipo) {
        case "nota":
          endpoint = "/notifications/test-nota";
          payload = {
            alunoId: user.id,
            alunoNome: "Usuário Teste",
            alunoEmail: user.email,
            disciplina: "Matemática",
            turma: "Turma Teste",
            tipoAvaliacao: "1ª Prova",
            nota: 15.5,
            instituicaoNome,
            professorNome: "Professor Teste",
          };
          break;
        case "frequencia":
          endpoint = "/notifications/test-frequencia";
          payload = {
            alunoId: user.id,
            alunoNome: "Usuário Teste",
            alunoEmail: user.email,
            disciplina: "Português",
            turma: "Turma Teste",
            percentualPresenca: 68.5,
            totalAulas: 30,
            aulasPresentes: 20,
            instituicaoNome,
          };
          break;
        case "pagamento":
          endpoint = "/notifications/test-pagamento";
          payload = {
            nome: "Usuário Teste",
            email: user.email,
            valor: 50000,
            mesReferencia: "Dezembro/2024",
            instituicaoNome,
            portalUrl: window.location.origin,
          };
          break;
        case "boletim":
          endpoint = "/notifications/test-boletim";
          payload = {
            alunoId: user.id,
            alunoNome: "Usuário Teste",
            alunoEmail: user.email,
            instituicaoNome,
            anoLetivo: "2024",
          };
          break;
        default:
          throw new Error("Tipo de notificação desconhecido");
      }

      await api.post(endpoint, payload);

      toast({
        title: "Email de teste enviado",
        description: `Um email de teste foi enviado para ${user.email}`,
      });
    } catch (error: any) {
      console.error("Erro ao enviar email de teste:", error);
      toast({
        title: "Erro ao enviar email",
        description: error.message || "Não foi possível enviar o email de teste.",
        variant: "destructive",
      });
    } finally {
      setEnviandoTeste(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Configurações de Notificações</h2>
        <p className="text-muted-foreground">
          Configure os alertas automáticos por e-mail do sistema
        </p>
      </div>

      {/* Notification Types */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              Notificações Acadêmicas
            </CardTitle>
            <CardDescription>
              Alertas relacionados a notas e frequência
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notificar_notas" className="font-medium">
                  Notas Lançadas
                </Label>
                <p className="text-sm text-muted-foreground">
                  Notificar alunos quando novas notas forem lançadas
                </p>
              </div>
              <Switch
                id="notificar_notas"
                checked={settings.notificar_notas}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notificar_notas: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notificar_frequencia" className="font-medium flex items-center gap-2">
                  Frequência Crítica
                  <Badge variant="secondary" className="text-xs">
                    &lt; 75%
                  </Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Alertar quando a presença estiver abaixo de 75%
                </p>
              </div>
              <Switch
                id="notificar_frequencia"
                checked={settings.notificar_frequencia}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notificar_frequencia: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enviar_boletim" className="font-medium">
                  Boletim Automático
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enviar boletim por email ao final do período
                </p>
              </div>
              <Switch
                id="enviar_boletim"
                checked={settings.enviar_boletim_automatico}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, enviar_boletim_automatico: checked })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Notificações Financeiras
            </CardTitle>
            <CardDescription>
              Alertas relacionados a pagamentos e mensalidades
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notificar_inadimplencia" className="font-medium flex items-center gap-2">
                  Inadimplência
                  <Badge variant="destructive" className="text-xs">
                    Importante
                  </Badge>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enviar lembrete quando mensalidade estiver vencida
                </p>
              </div>
              <Switch
                id="notificar_inadimplencia"
                checked={settings.notificar_inadimplencia}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notificar_inadimplencia: checked })
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notificar_comunicados" className="font-medium">
                  Comunicados Gerais
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enviar comunicados da instituição por email
                </p>
              </div>
              <Switch
                id="notificar_comunicados"
                checked={settings.notificar_comunicados}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notificar_comunicados: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveSettings}>
          <Save className="h-4 w-4 mr-2" />
          Salvar Configurações
        </Button>
      </div>

      {/* Test Emails */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Testar Envio de Emails
          </CardTitle>
          <CardDescription>
            Envie emails de teste para verificar se as notificações estão funcionando corretamente.
            Os emails serão enviados para: <strong>{user?.email}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button
              variant="outline"
              onClick={() => enviarEmailTeste("nota")}
              disabled={enviandoTeste !== null}
              className="h-auto py-4 flex-col gap-2"
            >
              {enviandoTeste === "nota" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <GraduationCap className="h-5 w-5" />
              )}
              <span>Nota Lançada</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => enviarEmailTeste("frequencia")}
              disabled={enviandoTeste !== null}
              className="h-auto py-4 flex-col gap-2"
            >
              {enviandoTeste === "frequencia" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
              <span>Frequência Crítica</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => enviarEmailTeste("pagamento")}
              disabled={enviandoTeste !== null}
              className="h-auto py-4 flex-col gap-2"
            >
              {enviandoTeste === "pagamento" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <DollarSign className="h-5 w-5" />
              )}
              <span>Lembrete Pagamento</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => enviarEmailTeste("boletim")}
              disabled={enviandoTeste !== null}
              className="h-auto py-4 flex-col gap-2"
            >
              {enviandoTeste === "boletim" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="h-5 w-5" />
              )}
              <span>Boletim Email</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provider Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Provedor de Email
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Email Service</p>
                <p className="text-sm text-muted-foreground">
                  Serviço de envio de emails transacionais
                </p>
              </div>
            </div>
            <Badge className="bg-green-500/10 text-green-600">Configurado</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
