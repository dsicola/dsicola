import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Activity, Loader2, Play, TrendingUp, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { useAuth } from '@/contexts/AuthContext';
import { anoLetivoApi } from '@/services/api';
import type { SimulacaoProgressaoResponse, TaxaAprovacaoCursoRow } from '@/services/api';
import { academicProgressionApi } from '@/modules/academic/services/academicModule.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Alinhado ao backend: `podeMarcarDesistentes` (sem COORDENADOR nem SECRETARIA). */
const ROLES_MARCAR_DESISTENTES = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'];
/** Override sequencial só é honrado para estes perfis (ver `validarProgressaoSequencialSemSaltos`). */
const ROLES_OVERRIDE_SEQUENCIAL = ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'];

type AnoLetivoRow = { id: string; ano: number; status?: string };

function AnoLetivoSelect(props: {
  value: string;
  onValueChange: (v: string) => void;
  anos: AnoLetivoRow[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const { value, onValueChange, anos, placeholder = 'Selecione', disabled } = props;
  return (
    <Select value={value || '__none__'} onValueChange={(v) => onValueChange(v === '__none__' ? '' : v)} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">{placeholder}</SelectItem>
        {[...anos]
          .sort((a, b) => b.ano - a.ano)
          .map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.ano}
              {a.status ? ` · ${a.status}` : ''}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

function ResumoSimulacao({ sim }: { sim: SimulacaoProgressaoResponse }) {
  const { avaliacao } = sim;
  const statusOk = avaliacao.statusFinal === 'APROVADO';
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground">Parecer do ano:</span>
        <Badge variant={statusOk ? 'default' : 'destructive'}>{avaliacao.statusFinal}</Badge>
        {avaliacao.mediaGeral != null && (
          <span className="text-muted-foreground">
            Média geral: <strong className="text-foreground">{avaliacao.mediaGeral}</strong>
          </span>
        )}
      </div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        <li>
          Disciplinas reprovadas: <strong className="text-foreground">{avaliacao.disciplinasReprovadas}</strong> de{' '}
          {avaliacao.disciplinasTotal} (limite permitido: {avaliacao.disciplinasNegativasPermitidas})
        </li>
        <li>
          Pode progredir (regra de negócio):{' '}
          <strong className="text-foreground">{sim.podeProgredir ? 'Sim' : 'Não'}</strong>
        </li>
        {sim.proximaClasse && (
          <li>
            Próxima classe sugerida:{' '}
            <strong className="text-foreground">{sim.proximaClasse.nome}</strong>
          </li>
        )}
        {!sim.proximaClasse && sim.podeProgredir && (
          <li className="italic">Última classe do percurso ou fim de ciclo — ver mensagem abaixo.</li>
        )}
      </ul>
      {sim.mensagem && <p className="text-foreground border-l-2 border-primary/40 pl-3 py-1">{sim.mensagem}</p>}
      {avaliacao.motivosExtras && avaliacao.motivosExtras.length > 0 && (
        <div className="text-amber-800 dark:text-amber-200 text-xs space-y-1">
          <span className="font-medium">Critérios institucionais:</span>
          <ul className="list-disc pl-4">
            {avaliacao.motivosExtras.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Detalhe técnico (JSON)</summary>
        <pre className="mt-2 p-2 rounded bg-muted overflow-x-auto font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(sim, null, 2)}
        </pre>
      </details>
    </div>
  );
}

export const ProgressaoOperacoesTab: React.FC = () => {
  const { role } = useAuth();
  const podeMarcarDesistentes = ROLES_MARCAR_DESISTENTES.includes(role || '');
  const podeOverrideSequencial = ROLES_OVERRIDE_SEQUENCIAL.includes(role || '');

  const [maIdSimular, setMaIdSimular] = useState('');
  const [anoDestinoId, setAnoDestinoId] = useState('');
  const [overrideSeq, setOverrideSeq] = useState(false);
  const [simulacao, setSimulacao] = useState<SimulacaoProgressaoResponse | null>(null);

  const [anoTaxaId, setAnoTaxaId] = useState('');
  const [taxas, setTaxas] = useState<TaxaAprovacaoCursoRow[] | null>(null);

  const [anoAnteriorDesis, setAnoAnteriorDesis] = useState('');
  const [anoNovoDesis, setAnoNovoDesis] = useState('');
  const [confirmDesis, setConfirmDesis] = useState(false);

  const { data: anosRaw, isLoading: loadingAnos } = useQuery({
    queryKey: ['anos-letivos-progressao-tab'],
    queryFn: async () => {
      const data = await anoLetivoApi.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  const anos: AnoLetivoRow[] = ((anosRaw ?? []) as AnoLetivoRow[]).map((a) => ({
    id: a.id,
    ano: a.ano,
    status: a.status,
  }));

  const simularMut = useMutation({
    mutationFn: () =>
      academicProgressionApi.simularProgressao({
        matriculaAnualId: maIdSimular.trim(),
        ...(anoDestinoId.trim() ? { anoLetivoDestinoId: anoDestinoId.trim() } : {}),
        ...(overrideSeq && podeOverrideSequencial ? { overrideSequencial: true } : {}),
      }),
    onSuccess: (data) => {
      setSimulacao(data);
      toast.success('Simulação concluída (nada foi gravado).');
    },
    onError: (e) => {
      setSimulacao(null);
      toast.error(getApiErrorMessage(e, 'Erro ao simular progressão.'));
    },
  });

  const taxaMut = useMutation({
    mutationFn: () => academicProgressionApi.taxaAprovacaoPorCurso(anoTaxaId.trim()),
    onSuccess: (data) => {
      setTaxas(data);
      toast.success('Dados atualizados.');
    },
    onError: (e) => {
      setTaxas(null);
      toast.error(getApiErrorMessage(e, 'Erro ao carregar taxas.'));
    },
  });

  const desistentesMut = useMutation({
    mutationFn: () =>
      academicProgressionApi.detectarDesistentes({
        anoLetivoAnteriorId: anoAnteriorDesis.trim(),
        anoLetivoNovoId: anoNovoDesis.trim(),
      }),
    onSuccess: (data) => {
      toast.success(`Atualizadas: ${data.atualizados} matrícula(s) como desistente.`);
      setConfirmDesis(false);
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Erro ao marcar desistentes.')),
  });

  const validarUuid = (id: string) => UUID_RE.test(id.trim());

  const runSimular = () => {
    if (!validarUuid(maIdSimular)) {
      toast.error('ID da matrícula anual inválido (formato UUID).');
      return;
    }
    if (anoDestinoId.trim() && !validarUuid(anoDestinoId)) {
      toast.error('Ano letivo de destino inválido.');
      return;
    }
    simularMut.mutate();
  };

  const runTaxa = () => {
    if (!validarUuid(anoTaxaId)) {
      toast.error('Selecione um ano letivo.');
      return;
    }
    taxaMut.mutate();
  };

  const openConfirmDesistentes = () => {
    if (!validarUuid(anoAnteriorDesis) || !validarUuid(anoNovoDesis)) {
      toast.error('Selecione dois anos letivos válidos.');
      return;
    }
    if (anoAnteriorDesis === anoNovoDesis) {
      toast.error('O ano anterior e o novo devem ser diferentes.');
      return;
    }
    setConfirmDesis(true);
  };

  return (
    <div className="space-y-4">
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertTitle>O que este separador faz</AlertTitle>
        <AlertDescription className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Simular</strong> chama o mesmo motor de aprovação e progressão usado no encerramento, mas não cria
            nem altera matrículas. É por <strong>matrícula anual</strong> (UUID): ideal para antecipar passa/reprova por
            estudante. <strong>Taxa</strong> agrega por curso depois do encerramento, quando o{' '}
            <strong>status final</strong> já estiver gravado nas matrículas.
          </p>
          {!podeMarcarDesistentes && (
            <p className="text-xs">
              A marcação de <strong>desistentes</strong> está reservada a Administração/Direção (conforme permissões da
              API).
            </p>
          )}
        </AlertDescription>
      </Alert>

      <Accordion type="multiple" defaultValue={['simular', 'taxa']} className="w-full space-y-2">
        <AccordionItem value="simular" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-base font-medium">
              <Play className="h-4 w-4 text-primary" />
              Simular progressão (inclui parecer do ano)
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Use o identificador da matrícula anual (por exemplo na ficha do estudante ou no separador de matrículas).
              O resultado mostra aprovação/reprovação, eventual próxima classe e se a progressão seria permitida.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ma-sim">Matrícula anual (UUID) *</Label>
                <Input
                  id="ma-sim"
                  value={maIdSimular}
                  onChange={(e) => setMaIdSimular(e.target.value)}
                  placeholder="cole o UUID"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Ano letivo de destino (opcional)</Label>
                <AnoLetivoSelect
                  value={anoDestinoId}
                  onValueChange={setAnoDestinoId}
                  anos={anos}
                  placeholder="— opcional —"
                  disabled={loadingAnos}
                />
              </div>
            </div>
            {podeOverrideSequencial && (
              <div className="flex items-center space-x-2">
                <Checkbox id="ov-seq" checked={overrideSeq} onCheckedChange={(v) => setOverrideSeq(v === true)} />
                <Label htmlFor="ov-seq" className="font-normal cursor-pointer text-sm">
                  Ignorar bloqueio de sequência (equivalências / exceções administrativas)
                </Label>
              </div>
            )}
            <Button type="button" onClick={runSimular} disabled={simularMut.isPending}>
              {simularMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Executar simulação
            </Button>
            {simulacao && <ResumoSimulacao sim={simulacao} />}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="taxa" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-base font-medium">
              <TrendingUp className="h-4 w-4 text-primary" />
              Taxa de aprovação por curso
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-1 space-y-4">
            <p className="text-sm text-muted-foreground">
              Apenas matrículas anuais com <strong>curso</strong> e <strong>status final</strong> (APROVADO/REPROVADO)
              preenchidos entram neste cálculo.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="space-y-2 flex-1 max-w-sm">
                <Label>Ano letivo</Label>
                <AnoLetivoSelect
                  value={anoTaxaId}
                  onValueChange={setAnoTaxaId}
                  anos={anos}
                  placeholder="Selecione"
                  disabled={loadingAnos}
                />
              </div>
              <Button type="button" onClick={runTaxa} disabled={taxaMut.isPending || !anoTaxaId}>
                {taxaMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Carregar
              </Button>
            </div>
            {taxas && taxas.length > 0 && (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead className="text-right">Aprovados</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Taxa %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taxas.map((row) => (
                      <TableRow key={row.cursoId}>
                        <TableCell>{row.cursoNome}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.aprovados}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.total}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.taxa}%</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {taxas && taxas.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nenhuma matrícula anual elegível encontrada para este ano (curso + status final).
              </p>
            )}
          </AccordionContent>
        </AccordionItem>

        {podeMarcarDesistentes && (
          <AccordionItem value="desistentes" className="border rounded-lg px-4 border-destructive/30">
            <AccordionTrigger className="hover:no-underline">
              <span className="flex items-center gap-2 text-base font-medium">
                <UserX className="h-4 w-4 text-destructive" />
                Marcar desistentes (altera dados)
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 pt-1 space-y-4">
              <p className="text-sm text-muted-foreground">
                Matrícula anual do ano anterior em <strong>ATIVA</strong> ou <strong>FINALIZADA</strong> (após
                encerramento com rollforward), sem MA no ano novo, passa a <strong>DESISTENTE</strong> nesse registo
                do ano anterior. Confirme os calendários antes de executar.
              </p>
              <div className="grid gap-4 md:grid-cols-2 max-w-2xl">
                <div className="space-y-2">
                  <Label>Ano letivo anterior</Label>
                  <AnoLetivoSelect
                    value={anoAnteriorDesis}
                    onValueChange={setAnoAnteriorDesis}
                    anos={anos}
                    disabled={loadingAnos}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ano letivo novo</Label>
                  <AnoLetivoSelect
                    value={anoNovoDesis}
                    onValueChange={setAnoNovoDesis}
                    anos={anos}
                    disabled={loadingAnos}
                  />
                </div>
              </div>
              <Button type="button" variant="destructive" onClick={openConfirmDesistentes} disabled={desistentesMut.isPending}>
                Continuar…
              </Button>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>

      <AlertDialog open={confirmDesis} onOpenChange={setConfirmDesis}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Marcar desistentes?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação atualiza o estado de matrículas anuais reais. Verifique os dois anos letivos selecionados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => desistentesMut.mutate()}
            >
              {desistentesMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
