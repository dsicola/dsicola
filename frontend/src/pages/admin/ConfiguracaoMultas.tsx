import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { configuracaoMultaApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, AlertCircle, Info, Save } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ConfiguracaoMulta {
  id: string;
  instituicao_id: string;
  multa_percentual: number;
  juros_dia_percentual: number;
  dias_tolerancia: number;
  created_at: string;
  updated_at: string;
}

export default function ConfiguracaoMultas() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    multa_percentual: "2",
    juros_dia_percentual: "0.033",
    dias_tolerancia: "5",
  });

  // Buscar configuração atual
  const { data: config, isLoading } = useQuery({
    queryKey: ["configuracao-multa"],
    queryFn: async () => {
      const data = await configuracaoMultaApi.get();
      return data as ConfiguracaoMulta;
    },
    onSuccess: (data) => {
      if (data) {
        setFormData({
          multa_percentual: data.multa_percentual.toString(),
          juros_dia_percentual: data.juros_dia_percentual.toString(),
          dias_tolerancia: data.dias_tolerancia.toString(),
        });
      }
    },
  });

  // Atualizar configuração
  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await configuracaoMultaApi.update({
        multa_percentual: parseFloat(data.multa_percentual),
        juros_dia_percentual: parseFloat(data.juros_dia_percentual),
        dias_tolerancia: parseInt(data.dias_tolerancia),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao-multa"] });
      toast({
        title: "Configuração atualizada",
        description: "As configurações de multa e juros foram atualizadas com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Ocorreu um erro ao atualizar a configuração.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    const multa = parseFloat(formData.multa_percentual);
    const juros = parseFloat(formData.juros_dia_percentual);
    const tolerancia = parseInt(formData.dias_tolerancia);

    if (isNaN(multa) || multa < 0 || multa > 100) {
      toast({
        title: "Valor inválido",
        description: "O percentual de multa deve ser entre 0 e 100.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(juros) || juros < 0 || juros > 10) {
      toast({
        title: "Valor inválido",
        description: "O percentual de juros por dia deve ser entre 0 e 10.",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(tolerancia) || tolerancia < 0 || tolerancia > 30) {
      toast({
        title: "Valor inválido",
        description: "Os dias de tolerância devem ser entre 0 e 30.",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate(formData);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando configuração...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              Configuração de Multas e Juros
            </h1>
            <p className="text-muted-foreground">
              Configure os percentuais de multa, juros e dias de tolerância para mensalidades em atraso
            </p>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                <strong>Multa:</strong> Percentual aplicado uma única vez sobre o valor base quando a mensalidade está em atraso.
              </li>
              <li>
                <strong>Juros:</strong> Percentual aplicado por dia de atraso sobre o valor base (após os dias de tolerância).
              </li>
              <li>
                <strong>Dias de Tolerância:</strong> Período após o vencimento em que não são aplicados multa nem juros.
              </li>
            </ul>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Parâmetros de Cálculo</CardTitle>
              <CardDescription>
                Defina os valores que serão aplicados automaticamente às mensalidades em atraso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Multa Percentual */}
                <div className="space-y-2">
                  <Label htmlFor="multa_percentual">
                    Percentual de Multa (%)
                  </Label>
                  <Input
                    id="multa_percentual"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.multa_percentual}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        multa_percentual: e.target.value,
                      }))
                    }
                    placeholder="2.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: 2% = R$ 2.000 de multa sobre R$ 100.000
                  </p>
                </div>

                {/* Juros por Dia */}
                <div className="space-y-2">
                  <Label htmlFor="juros_dia_percentual">
                    Juros por Dia (%)
                  </Label>
                  <Input
                    id="juros_dia_percentual"
                    type="number"
                    step="0.001"
                    min="0"
                    max="10"
                    value={formData.juros_dia_percentual}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        juros_dia_percentual: e.target.value,
                      }))
                    }
                    placeholder="0.033"
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: 0.033% ao dia ≈ 1% ao mês
                  </p>
                </div>

                {/* Dias de Tolerância */}
                <div className="space-y-2">
                  <Label htmlFor="dias_tolerancia">
                    Dias de Tolerância
                  </Label>
                  <Input
                    id="dias_tolerancia"
                    type="number"
                    step="1"
                    min="0"
                    max="30"
                    value={formData.dias_tolerancia}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dias_tolerancia: e.target.value,
                      }))
                    }
                    placeholder="5"
                  />
                  <p className="text-xs text-muted-foreground">
                    Período sem multa/juros após vencimento
                  </p>
                </div>
              </div>

              <Alert variant="default" className="bg-blue-50 border-blue-200">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900">Exemplo de Cálculo</AlertTitle>
                <AlertDescription className="text-blue-800">
                  <p className="mt-2">
                    Mensalidade: R$ 100.000 | Vencimento: 01/01/2024 | Hoje: 10/01/2024
                  </p>
                  <p className="mt-1">
                    Dias de atraso: 9 dias | Dentro da tolerância: 5 dias | Dias com juros: 4 dias
                  </p>
                  <p className="mt-1 font-semibold">
                    Multa: R$ 2.000 (2%) | Juros: R$ 132 (0.033% × 4 dias) | Total: R$ 102.132
                  </p>
                </AlertDescription>
              </Alert>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/admin-dashboard")}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "Salvando..." : "Salvar Configuração"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </DashboardLayout>
  );
}

