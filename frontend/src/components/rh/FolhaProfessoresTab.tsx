import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, GraduationCap, Plus, Zap, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useTenantFilter } from '@/hooks/useTenantFilter';
import { folhaProfessorApi, professorsApi } from '@/services/api';

const MESES = [
  { value: 1, label: 'Janeiro' }, { value: 2, label: 'Fevereiro' }, { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' }, { value: 5, label: 'Maio' }, { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' }, { value: 11, label: 'Novembro' }, { value: 12, label: 'Dezembro' },
];

export const FolhaProfessoresTab = () => {
  const queryClient = useQueryClient();
  const { instituicaoId } = useTenantFilter();
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const [showFaltaDialog, setShowFaltaDialog] = useSafeDialog(false);
  const [faltaData, setFaltaData] = useState({ professorId: '', data: format(now, 'yyyy-MM-dd'), fracaoFalta: 1, justificada: false });

  const { data: professores = [] } = useQuery({
    queryKey: ['professores'],
    queryFn: () => professorsApi.getAll(),
    enabled: !!instituicaoId && showFaltaDialog,
  });
  const professoresContratados = Array.isArray(professores) ? professores : (professores as any)?.data ?? [];
  const profsFiltrados = professoresContratados.filter((p: any) => p.tipo_vinculo === 'CONTRATADO' || p.tipoVinculo === 'CONTRATADO');

  const { data, isLoading } = useQuery({
    queryKey: ['folha-professor', mes, ano, instituicaoId],
    queryFn: () => folhaProfessorApi.listar({ mes, ano }),
    enabled: !!instituicaoId,
  });

  const calcularTodosMutation = useSafeMutation({
    mutationFn: () => folhaProfessorApi.calcularTodos({ mes, ano }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-professor'] });
      toast.success('Folhas calculadas com sucesso!');
    },
    onError: (e: Error) => toast.error(e?.message ?? 'Erro ao calcular'),
  });

  const processarFaltasMutation = useSafeMutation({
    mutationFn: (dataStr: string) => folhaProfessorApi.processarFaltas({ data: dataStr }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['folha-professor'] });
      queryClient.invalidateQueries({ queryKey: ['folha-professor-faltas'] });
      toast.success(`Faltas processadas: ${res?.criadas ?? 0} criadas`);
    },
    onError: (e: Error) => toast.error(e?.message ?? 'Erro ao processar'),
  });

  const registarFaltaMutation = useSafeMutation({
    mutationFn: (d: typeof faltaData) => folhaProfessorApi.registarFalta({
      professorId: d.professorId,
      data: d.data,
      fracaoFalta: d.fracaoFalta,
      justificada: d.justificada,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-professor'] });
      queryClient.invalidateQueries({ queryKey: ['folha-professor-faltas'] });
      setShowFaltaDialog(false);
      setFaltaData({ professorId: '', data: format(now, 'yyyy-MM-dd'), fracaoFalta: 1, justificada: false });
      toast.success('Falta registada');
    },
    onError: (e: Error) => toast.error(e?.message ?? 'Erro ao registar'),
  });

  const atualizarFaltaMutation = useSafeMutation({
    mutationFn: ({ id, justificada }: { id: string; justificada: boolean }) =>
      folhaProfessorApi.atualizarFalta(id, { justificada }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-professor'] });
      queryClient.invalidateQueries({ queryKey: ['folha-professor-faltas'] });
      toast.success('Falta atualizada');
    },
    onError: (e: Error) => toast.error(e?.message ?? 'Erro ao atualizar'),
  });

  const removerFaltaMutation = useSafeMutation({
    mutationFn: (id: string) => folhaProfessorApi.removerFalta(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['folha-professor'] });
      queryClient.invalidateQueries({ queryKey: ['folha-professor-faltas'] });
      toast.success('Falta removida. Recalcule a folha se necessário.');
    },
    onError: (e: Error) => toast.error(e?.message ?? 'Erro ao remover'),
  });

  const { data: faltasData } = useQuery({
    queryKey: ['folha-professor-faltas', mes, ano, instituicaoId],
    queryFn: () => folhaProfessorApi.listarFaltas({ mes, ano }),
    enabled: !!instituicaoId,
  });
  const faltas = faltasData?.data ?? [];

  const folhas = data?.data ?? [];
  const totalLiquido = folhas.reduce((s: number, f: any) => s + (f.salarioLiquido ?? 0), 0);

  return (
  <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Folha de Pagamento - Professores Contratados
            </CardTitle>
            <CardDescription>
              Professores com vínculo CONTRATADO — salário calculado por aulas ministradas no mês
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Mês</Label>
              <select
                value={mes}
                onChange={(e) => setMes(parseInt(e.target.value, 10))}
                className="h-9 rounded-md border px-3 text-sm"
              >
                {MESES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm">Ano</Label>
              <Input
                type="number"
                value={ano}
                onChange={(e) => setAno(parseInt(e.target.value, 10) || ano)}
                className="w-20 h-9"
              />
            </div>
            <Button
              onClick={() => calcularTodosMutation.mutate()}
              disabled={calcularTodosMutation.isPending}
            >
              <Calculator className="h-4 w-4 mr-2" />
              Calcular todas
            </Button>
            <Button variant="outline" onClick={() => setShowFaltaDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Registar falta
            </Button>
            <Button
              variant="outline"
              onClick={() => processarFaltasMutation.mutate(format(new Date(), 'yyyy-MM-dd'))}
              disabled={processarFaltasMutation.isPending}
            >
              <Zap className="h-4 w-4 mr-2" />
              Processar faltas (hoje)
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : folhas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <GraduationCap className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p>Nenhuma folha calculada para {format(new Date(ano, mes - 1), 'MMMM yyyy', { locale: ptBR })}.</p>
            <p className="text-sm mt-1">Clique em &quot;Calcular todas&quot; para gerar as folhas dos professores contratados.</p>
          </div>
        ) : (
          <>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Professor</TableHead>
                    <TableHead className="text-right">Aulas</TableHead>
                    <TableHead className="text-right">Valor/aula</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">Faltas</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folhas.map((f: any) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.professorNome ?? '-'}</TableCell>
                      <TableCell className="text-right">{f.totalAulas ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {f.valorPorAula != null
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'AOA' }).format(f.valorPorAula)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {f.salarioBruto != null
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'AOA' }).format(f.salarioBruto)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right">{f.faltasNaoJustificadas ?? 0}</TableCell>
                      <TableCell className="text-right">
                        {f.valorDescontoFaltas != null
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'AOA' }).format(f.valorDescontoFaltas)
                          : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {f.salarioLiquido != null
                          ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'AOA' }).format(f.salarioLiquido)
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.status === 'DRAFT' ? 'secondary' : f.status === 'CLOSED' ? 'default' : 'outline'}>
                          {f.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 pt-4 border-t flex justify-end">
              <span className="text-sm font-medium">
                Total líquido:{' '}
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'AOA' }).format(totalLiquido)}
              </span>
            </div>

            {faltas.length > 0 && (
              <div className="mt-6">
                <h3 className="font-medium mb-2">Faltas registadas no mês</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Professor</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Fração</TableHead>
                        <TableHead>Justificada</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead className="w-32">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {faltas.slice(0, 20).map((f: any) => (
                        <TableRow key={f.id}>
                          <TableCell>{f.professorNome ?? '-'}</TableCell>
                          <TableCell>{f.data}</TableCell>
                          <TableCell className="text-right">{f.fracaoFalta ?? 1}</TableCell>
                          <TableCell>
                            {f.justificada ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Sim</Badge>
                            ) : (
                              <Badge variant="secondary">Não</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={f.origem === 'AUTOMATICO' ? 'secondary' : 'outline'}>{f.origem}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {f.justificada ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  title="Desjustificar (passa a descontar)"
                                  onClick={() => atualizarFaltaMutation.mutate({ id: f.id, justificada: false })}
                                  disabled={atualizarFaltaMutation.isPending}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Justificar (não desconta)"
                                  onClick={() => atualizarFaltaMutation.mutate({ id: f.id, justificada: true })}
                                  disabled={atualizarFaltaMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-destructive hover:bg-destructive/10"
                                title="Remover falta (ex: foi engano, professor ministrou)"
                                onClick={() => removerFaltaMutation.mutate(f.id)}
                                disabled={removerFaltaMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    <Dialog open={showFaltaDialog} onOpenChange={setShowFaltaDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registar falta de professor</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Professor (contratado)</Label>
            <Select value={faltaData.professorId} onValueChange={(v) => setFaltaData({ ...faltaData, professorId: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {profsFiltrados.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome_completo ?? p.nomeCompleto ?? p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Data</Label>
            <Input
              type="date"
              value={faltaData.data}
              onChange={(e) => setFaltaData({ ...faltaData, data: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fração da falta</Label>
            <Select
              value={String(faltaData.fracaoFalta)}
              onValueChange={(v) => setFaltaData({ ...faltaData, fracaoFalta: parseFloat(v) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5 — Falta parcial (ex: chegou no 2º tempo)</SelectItem>
                <SelectItem value="1">1 — Falta inteira</SelectItem>
                <SelectItem value="1.5">1.5</SelectItem>
                <SelectItem value="2">2</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="justificada"
              checked={faltaData.justificada}
              onChange={(e) => setFaltaData({ ...faltaData, justificada: e.target.checked })}
            />
            <Label htmlFor="justificada" className="font-normal">Justificada (não desconta)</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowFaltaDialog(false)}>Cancelar</Button>
          <Button
            onClick={() => registarFaltaMutation.mutate(faltaData)}
            disabled={!faltaData.professorId || !faltaData.data || registarFaltaMutation.isPending}
          >
            {registarFaltaMutation.isPending ? 'A guardar...' : 'Registar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>
  );
};
