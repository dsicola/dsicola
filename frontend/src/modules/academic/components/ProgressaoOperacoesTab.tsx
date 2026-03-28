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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Play, TrendingUp, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/utils/apiErrors';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
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
  const semHistoricoNoAno = avaliacao.disciplinasTotal === 0;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 text-sm">
      {semHistoricoNoAno && (
        <p className="text-xs text-amber-900 dark:text-amber-100 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 leading-snug">
          <strong className="font-medium">Nota:</strong> O motor usa o{' '}
          <span className="font-medium">histórico académico</span> já gravado para o{' '}
          <span className="font-medium">mesmo ano letivo</span> da matrícula. Com <strong>0 disciplinas</strong> nesse
          histórico, o resultado é <strong>REPROVADO</strong> por defeito (não significa «reprovou a zero disciplinas» —
          ainda não há fechos/pautas no histórico para esse ano). Depois de lançar notas e existir histórico, volte a
          simular.
        </p>
      )}
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
          Disciplinas no histórico do ano: <strong className="text-foreground">{avaliacao.disciplinasTotal}</strong>
          {avaliacao.disciplinasTotal > 0 ? (
            <>
              {' '}
              — reprovadas:{' '}
              <strong className="text-foreground">{avaliacao.disciplinasReprovadas}</strong> (limite permitido:{' '}
              {avaliacao.disciplinasNegativasPermitidas})
            </>
          ) : (
            <> (nenhum registo — ver aviso acima)</>
          )}
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
    </div>
  );
}

export const ProgressaoOperacoesTab: React.FC = () => {
  const { role } = useAuth();
  const podeMarcarDesistentes = ROLES_MARCAR_DESISTENTES.includes(role || '');
  const podeOverrideSequencial = ROLES_OVERRIDE_SEQUENCIAL.includes(role || '');
  /** Página «Matrículas anuais» (primeiro separador) — mesmo sítio para copiar o UUID. */
  const hrefMatriculasAnuais =
    role === 'SECRETARIA' ? '/secretaria-dashboard' : '/admin-dashboard/gestao-alunos';

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
      <div className="rounded-md border border-border/80 bg-muted/25 px-3 py-2.5 text-sm text-muted-foreground leading-snug space-y-2">
        <p>
          <span className="text-foreground font-medium">Simular:</span> apenas consulta (não grava). Cole o ID copiado
          em{' '}
          <Link
            to={hrefMatriculasAnuais}
            className="text-primary font-medium underline-offset-4 hover:underline whitespace-nowrap"
          >
            Estudantes → Matrículas anuais
          </Link>{' '}
          (coluna «ID (simulação)» ou ao editar a matrícula).
        </p>
        <p>
          <span className="text-foreground font-medium">Taxa por curso:</span> só conta matrículas já com parecer do ano
          (APROVADO/REPROVADO).{' '}
          {!podeMarcarDesistentes ? (
            <span className="text-xs">Marcar desistentes: perfis de administração/direção.</span>
          ) : null}
        </p>
      </div>

      <Accordion type="multiple" defaultValue={['simular', 'taxa']} className="w-full space-y-2">
        <AccordionItem value="simular" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2 text-base font-medium">
              <Play className="h-4 w-4 text-primary" />
              Simular progressão (inclui parecer do ano)
            </span>
          </AccordionTrigger>
          <AccordionContent className="pb-4 pt-1 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ma-sim">ID da matrícula anual *</Label>
                <Input
                  id="ma-sim"
                  value={maIdSimular}
                  onChange={(e) => setMaIdSimular(e.target.value)}
                  placeholder="Cole o ID (formato UUID)"
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
            <p className="text-xs text-muted-foreground">
              Requer curso na matrícula e parecer do ano já definido.
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
              <p className="text-xs text-muted-foreground leading-snug">
                MA do <strong className="text-foreground">ano anterior</strong> (ATIVA ou FINALIZADA) sem matrícula no{' '}
                <strong className="text-foreground">ano novo</strong> → estado DESISTENTE no registo antigo. Confirme os
                anos antes de gravar.
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
