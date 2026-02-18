import { useMutation, useQueryClient } from "@tanstack/react-query";
import { planoEnsinoApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Calendar, ClipboardList, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useInstituicao } from "@/contexts/InstituicaoContext";

interface ExecutarTabProps {
  plano: any;
  planoId: string | null;
}

export function ExecutarTab({ plano, planoId }: ExecutarTabProps) {
  const { isSuperior, isSecundario } = useInstituicao();
  const periodoLabel = isSuperior ? "Semestre" : isSecundario ? "Trimestre" : "Período";
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const marcarMinistradaMutation = useMutation({
    mutationFn: async ({ aulaId, dataMinistrada }: { aulaId: string; dataMinistrada?: string }) => {
      return await planoEnsinoApi.marcarAulaMinistrada(aulaId, dataMinistrada);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      toast({
        title: "Aula marcada",
        description: "Aula marcada como ministrada com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao marcar aula",
        variant: "destructive",
      });
    },
  });

  const desmarcarMinistradaMutation = useMutation({
    mutationFn: async (aulaId: string) => {
      return await planoEnsinoApi.desmarcarAulaMinistrada(aulaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plano-ensino"] });
      toast({
        title: "Aula desmarcada",
        description: "Aula desmarcada como ministrada.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Erro ao desmarcar aula",
        variant: "destructive",
      });
    },
  });

  if (!plano || !plano.aulas || plano.aulas.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhuma aula planejada encontrada. Vá para a aba "Planejar" para criar aulas.
        </CardContent>
      </Card>
    );
  }

  const aulasPlanejadas = plano.aulas.filter((aula: any) => aula.status === "PLANEJADA");
  const aulasMinistradas = plano.aulas.filter((aula: any) => aula.status === "MINISTRADA");

  // Bloquear ações se Plano de Ensino não estiver APROVADO
  const planoAtivo = plano.estado === 'APROVADO' && !plano.bloqueado;
  const estadoDescricao = {
    'RASCUNHO': 'em RASCUNHO',
    'EM_REVISAO': 'em REVISÃO',
    'ENCERRADO': 'ENCERRADO',
  }[plano.estado] || plano.estado;

  return (
    <div className="space-y-4">
      {/* Alerta se Plano de Ensino não está APROVADO */}
      {!planoAtivo && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                  Plano de Ensino não está ATIVO
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {plano.bloqueado 
                    ? 'O Plano de Ensino está bloqueado e não permite operações acadêmicas. Entre em contato com a administração para desbloquear o plano.'
                    : `O Plano de Ensino está ${estadoDescricao}. Apenas planos APROVADOS permitem operações acadêmicas (marcar aulas como ministradas). É necessário aprovar o Plano de Ensino na aba "Finalizar" antes de executar aulas.`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Executar Aulas</CardTitle>
              <CardDescription>
                Marque as aulas como ministradas conforme forem sendo executadas
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/admin-dashboard/avaliacoes-notas")}
              disabled={!planoAtivo}
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Avaliações e Notas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Total Planejado</p>
              <p className="text-2xl font-bold">{plano.aulas.length}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">Planejadas</p>
              <p className="text-2xl font-bold text-blue-700">{aulasPlanejadas.length}</p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-700">Ministradas</p>
              <p className="text-2xl font-bold text-green-700">{aulasMinistradas.length}</p>
            </div>
          </div>

          {aulasPlanejadas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Todas as aulas já foram ministradas!
            </div>
          ) : (
            <div className="space-y-2">
              <h3 className="font-medium mb-2">Aulas Planejadas</h3>
              {aulasPlanejadas.map((aula: any) => (
                <div
                  key={aula.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{aula.ordem}.</span>
                      <h4 className="font-medium">{aula.titulo}</h4>
                    </div>
                    {aula.descricao && (
                      <p className="text-sm text-muted-foreground mt-1">{aula.descricao}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline">
                        {aula.tipo === "TEORICA" ? "Teórica" : "Prática"}
                      </Badge>
                      {/* CRÍTICO: Mostrar apenas o período correto baseado no tipo de instituição */}
                      {isSuperior && (
                        <Badge variant="outline">
                          {aula.trimestre}º Semestre
                        </Badge>
                      )}
                      {isSecundario && (
                        <Badge variant="outline">
                          {aula.trimestre}º Trimestre
                        </Badge>
                      )}
                      {/* NUNCA mostrar período se tipo não foi determinado */}
                      <Badge variant="outline">
                        {aula.quantidadeAulas} {aula.quantidadeAulas === 1 ? "aula" : "aulas"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    onClick={() =>
                      marcarMinistradaMutation.mutate({
                        aulaId: aula.id,
                        dataMinistrada: new Date().toISOString(),
                      })
                    }
                    disabled={marcarMinistradaMutation.isPending || !planoAtivo}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Marcar como Ministrada
                  </Button>
                </div>
              ))}
            </div>
          )}

          {aulasMinistradas.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="font-medium mb-2">Aulas Ministradas</h3>
              {aulasMinistradas.map((aula: any) => (
                <div
                  key={aula.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-green-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{aula.ordem}.</span>
                      <h4 className="font-medium">{aula.titulo}</h4>
                      <Badge className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Ministrada
                      </Badge>
                    </div>
                    {aula.dataMinistrada && (
                      <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(aula.dataMinistrada), "dd/MM/yyyy", { locale: ptBR })}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => desmarcarMinistradaMutation.mutate(aula.id)}
                    disabled={desmarcarMinistradaMutation.isPending || !planoAtivo}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Desmarcar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

