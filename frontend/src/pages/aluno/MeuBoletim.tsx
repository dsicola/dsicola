import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { matriculasAnuaisApi } from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, BookOpen, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BoletimVisualizacao } from "@/components/relatorios/BoletimVisualizacao";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function MeuBoletim() {
  const { user } = useAuth();
  const [anoLetivoSelecionado, setAnoLetivoSelecionado] = useState<number | null>(null);

  // Fetch anos letivos do aluno
  const { data: anosLetivos = [], isLoading: anosLoading } = useQuery({
    queryKey: ["meu-boletim-anos", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      try {
        const data = await matriculasAnuaisApi.getMeusAnosLetivos();
        return data || [];
      } catch (error) {
        console.error("[MeuBoletim] Erro ao buscar anos letivos:", error);
        return [];
      }
    },
    enabled: !!user?.id,
  });

  // Definir ano letivo padrão (mais recente)
  useEffect(() => {
    if (anosLetivos.length > 0 && anoLetivoSelecionado === null) {
      const anos = anosLetivos
        .map((a: any) => a.anoLetivo ?? a.ano)
        .filter((n: unknown): n is number => typeof n === "number" && !isNaN(n));
      if (anos.length > 0) {
        setAnoLetivoSelecionado(Math.max(...anos));
      }
    }
  }, [anosLetivos, anoLetivoSelecionado]);

  if (anosLoading || !user?.id) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            Meu Boletim
          </h1>
          <p className="text-muted-foreground">
            Visualize suas notas e desempenho acadêmico
          </p>
        </div>

        {anosLetivos.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum ano letivo encontrado</h3>
              <p className="text-muted-foreground text-center">
                Você ainda não está matriculado em nenhum ano letivo. Entre em contato com a secretaria acadêmica para realizar sua matrícula.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              <Label htmlFor="ano-letivo" className="font-medium shrink-0">Ano Letivo:</Label>
              <Select
                value={anoLetivoSelecionado?.toString() ?? ""}
                onValueChange={(v) => setAnoLetivoSelecionado(v ? Number(v) : null)}
              >
                <SelectTrigger id="ano-letivo" className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Selecione o ano" />
                </SelectTrigger>
                <SelectContent>
                  {[...anosLetivos]
                    .sort((a: any, b: any) => (b.anoLetivo ?? b.ano ?? 0) - (a.anoLetivo ?? a.ano ?? 0))
                    .map((a: any) => {
                      const ano = a.anoLetivo ?? a.ano;
                      return (
                        <SelectItem key={ano} value={String(ano)}>
                          {ano}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>

            {anoLetivoSelecionado && (
              <BoletimVisualizacao
                alunoId={user.id}
                anoLetivo={anoLetivoSelecionado}
              />
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
