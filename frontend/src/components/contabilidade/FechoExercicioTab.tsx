import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contabilidadeApi } from '@/services/api';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Lock, AlertTriangle, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const FechoExercicioTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [ano, setAno] = useState(new Date().getFullYear() - 1);

  const { data: fechos = [], isLoading } = useQuery({
    queryKey: ['fechos-exercicio', instituicaoId],
    queryFn: () => contabilidadeApi.listFechosExercicio(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const { data: bloqueio } = useQuery({
    queryKey: ['bloqueio-periodo', instituicaoId],
    queryFn: () => contabilidadeApi.getBloqueioPeriodo(),
    enabled: !!instituicaoId || isSuperAdmin,
  });

  const fecharMutation = useMutation({
    mutationFn: (anoFechar: number) => contabilidadeApi.fecharExercicio(anoFechar),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fechos-exercicio'] });
      queryClient.invalidateQueries({ queryKey: ['bloqueio-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['lancamentos'] });
      toast.success(data?.message || 'Exercício fechado com sucesso');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e.response?.data?.message || 'Erro ao fechar exercício');
    },
  });

  const handleFechar = () => {
    if (fechos.some((f: { ano: number }) => f.ano === ano)) {
      toast.error(`Exercício ${ano} já está fechado.`);
      return;
    }
    if (!window.confirm(`Fechar o exercício ${ano}? Esta ação irá:\n\n• Criar o lançamento de encerramento (Receitas e Despesas → PL)\n• Bloquear o período para edições futuras\n\nEsta ação não pode ser desfeita.`)) {
      return;
    }
    fecharMutation.mutate(ano);
  };

  const anoJaFechado = fechos.some((f: { ano: number }) => f.ano === ano);
  const dataFimBloqueio = bloqueio?.dataFimBloqueio ? new Date(bloqueio.dataFimBloqueio) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Fecho de Exercício
        </CardTitle>
        <CardDescription>
          Feche o exercício contabilístico para bloquear edições em períodos anteriores. O sistema cria automaticamente o lançamento de encerramento (Receitas e Despesas → PL).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {dataFimBloqueio && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
            <Calendar className="h-4 w-4" />
            <span>
              <strong>Período bloqueado até:</strong>{' '}
              {format(dataFimBloqueio, "dd/MM/yyyy", { locale: ptBR })} — não é possível criar, editar ou excluir lançamentos nesta data ou anterior.
            </span>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="font-semibold">Fechar exercício</h3>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input
                type="number"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value, 10) || new Date().getFullYear())}
                min={2000}
                max={2100}
                className="w-28"
              />
            </div>
            <Button
              onClick={handleFechar}
              disabled={anoJaFechado || fecharMutation.isPending}
              variant={anoJaFechado ? 'secondary' : 'default'}
            >
              {fecharMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              {anoJaFechado ? 'Exercício já fechado' : 'Fechar exercício'}
            </Button>
          </div>
          {anoJaFechado && (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              O exercício {ano} já foi fechado. Selecione outro ano.
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="font-semibold">Exercícios fechados</h3>
          {isLoading ? (
            <div className="py-4 text-center text-muted-foreground">Carregando...</div>
          ) : fechos.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum exercício fechado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ano</TableHead>
                  <TableHead>Fechado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fechos.map((f: { id: string; ano: number; fechadoEm: string }) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.ano}</TableCell>
                    <TableCell>{format(new Date(f.fechadoEm), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
