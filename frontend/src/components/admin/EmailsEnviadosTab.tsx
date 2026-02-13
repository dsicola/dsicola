import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { emailsEnviadosApi } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, CheckCircle, XCircle, RefreshCw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTenantFilter } from "@/hooks/useTenantFilter";

interface EmailEnviado {
  id: string;
  destinatario_email: string;
  destinatario_nome: string | null;
  assunto: string;
  tipo: string;
  status: string;
  erro: string | null;
  created_at: string;
  instituicao_id: string | null;
}

export function EmailsEnviadosTab() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { instituicaoId, shouldFilter, isSuperAdmin } = useTenantFilter();

  const { data: emails, isLoading, refetch } = useQuery({
    queryKey: ["emails-enviados", instituicaoId],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const data = await emailsEnviadosApi.getAll(params);
      return data as EmailEnviado[];
    },
  });

  const deleteEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      await emailsEnviadosApi.delete(emailId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails-enviados"] });
      toast({
        title: "Email excluído",
        description: "O registro de email foi removido com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o email.",
        variant: "destructive",
      });
    },
  });

  const deleteAllFailedMutation = useMutation({
    mutationFn: async () => {
      const params: any = {};
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      await emailsEnviadosApi.deleteAllFailed(params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails-enviados"] });
      toast({
        title: "Emails falhados excluídos",
        description: "Todos os registros de emails falhados foram removidos.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir os emails falhados.",
        variant: "destructive",
      });
    },
  });

  const stats = emails?.reduce(
    (acc, email) => {
      acc.total++;
      if (email.status === "Enviado") acc.enviados++;
      else acc.falhas++;
      return acc;
    },
    { total: 0, enviados: 0, falhas: 0 }
  ) || { total: 0, enviados: 0, falhas: 0 };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "boas_vindas": return "Boas-vindas";
      case "lembrete_pagamento": return "Lembrete Pagamento";
      case "comunicado": return "Comunicado";
      case "nota_lancada": return "Nota Lançada";
      case "frequencia_critica": return "Frequência Crítica";
      case "boletim": return "Boletim";
      default: return tipo;
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold">Histórico de Emails</h2>
          <p className="text-muted-foreground">
            Acompanhe todos os emails enviados pelo sistema
          </p>
        </div>
        <div className="flex gap-2">
          {stats.falhas > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir Falhados ({stats.falhas})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir todos os emails falhados?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover permanentemente {stats.falhas} registro(s) de emails que falharam. Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => deleteAllFailedMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir Todos
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total de Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">{stats.total}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Enviados com Sucesso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{stats.enviados}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Falhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              <span className="text-2xl font-bold">{stats.falhas}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Destinatário</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum email enviado ainda
                  </TableCell>
                </TableRow>
              ) : (
                emails?.map((email) => (
                  <TableRow key={email.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{email.destinatario_nome || "-"}</div>
                        <div className="text-sm text-muted-foreground">{email.destinatario_email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate">{email.assunto}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTipoLabel(email.tipo)}</Badge>
                    </TableCell>
                    <TableCell>
                      {email.status === "Enviado" ? (
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Enviado
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Falhou
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {email.created_at && !isNaN(new Date(email.created_at).getTime())
                        ? format(new Date(email.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {email.status !== "Enviado" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir registro de email?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação irá remover permanentemente este registro de email. Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEmailMutation.mutate(email.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}