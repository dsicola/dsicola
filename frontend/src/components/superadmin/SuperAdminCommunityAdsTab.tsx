import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  communityAdApi,
  type CommunityAdBookingDto,
  type CommunityAdScope,
} from '@/services/communityApi';
import { storageApi } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Megaphone, Loader2, ExternalLink, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SCOPE_LABEL: Record<CommunityAdScope, string> = {
  VITRINE_SOCIAL: 'Vitrine Social',
  DESTAQUE_DIRETORIO: 'Destaque diretório',
  BOTH: 'Ambos',
};

const STATUS_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'AGUARDANDO_ANALISE', label: 'Em análise' },
  { value: 'APROVADA', label: 'Aprovadas' },
  { value: 'REJEITADA', label: 'Rejeitadas' },
  { value: 'CANCELADA', label: 'Canceladas' },
];

/**
 * Fila global de pedidos de publicidade. Apenas SUPER_ADMIN.
 * Regra de negócio: aprovar só com `pagamentoVerificado` explícito no payload (espelha confiança operacional).
 */
export function SuperAdminCommunityAdsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('AGUARDANDO_ANALISE');
  const [selected, setSelected] = useState<CommunityAdBookingDto | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'APROVAR' | 'REJEITAR'>('APROVAR');
  const [pagamentoVerificado, setPagamentoVerificado] = useState(false);
  const [startsAtIso, setStartsAtIso] = useState('');
  const [duracaoDiasEfetiva, setDuracaoDiasEfetiva] = useState('');
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [notasInternasAdmin, setNotasInternasAdmin] = useState('');
  /** Pré-visualização alinhada a PagamentosLicencaTab (URL assinada para `/uploads/comprovativos/`). */
  const [signedComprovativoUrl, setSignedComprovativoUrl] = useState<string | null>(null);
  const [comprovativoUrlError, setComprovativoUrlError] = useState(false);

  useEffect(() => {
    if (!dialogOpen || !selected?.comprovativoUrl) {
      setSignedComprovativoUrl(null);
      setComprovativoUrlError(false);
      return;
    }
    const url = selected.comprovativoUrl;
    if (!url.includes('/uploads/comprovativos/')) {
      setSignedComprovativoUrl(url);
      setComprovativoUrlError(false);
      return;
    }
    setComprovativoUrlError(false);
    storageApi
      .getComprovativoSignedUrl(url)
      .then((signed) => {
        setSignedComprovativoUrl(signed);
        setComprovativoUrlError(false);
      })
      .catch(() => {
        setSignedComprovativoUrl(null);
        setComprovativoUrlError(true);
        toast({
          title: 'Erro ao carregar comprovativo',
          description: 'Não foi possível obter o link seguro.',
          variant: 'destructive',
        });
      });
  }, [dialogOpen, selected?.comprovativoUrl, toast]);

  const { data, isLoading } = useQuery({
    queryKey: ['community-ad-super', statusFilter],
    queryFn: async () => {
      const res = await communityAdApi.superList({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        pageSize: 100,
      });
      return res.data;
    },
  });

  const reviewMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error('Nenhum pedido');
      return communityAdApi.superReview(selected.id, {
        action: reviewAction,
        pagamentoVerificado: reviewAction === 'APROVAR' ? pagamentoVerificado : false,
        startsAtIso:
          reviewAction === 'APROVAR' && startsAtIso.trim()
            ? new Date(startsAtIso.trim()).toISOString()
            : null,
        duracaoDiasEfetiva:
          reviewAction === 'APROVAR' && duracaoDiasEfetiva.trim() !== ''
            ? Number(duracaoDiasEfetiva)
            : null,
        motivoRejeicao: reviewAction === 'REJEITAR' ? motivoRejeicao : null,
        notasInternasAdmin: notasInternasAdmin.trim() || null,
      });
    },
    onSuccess: () => {
      toast({ title: reviewAction === 'APROVAR' ? 'Campanha aprovada' : 'Pedido rejeitado' });
      setDialogOpen(false);
      setSelected(null);
      setPagamentoVerificado(false);
      setStartsAtIso('');
      setDuracaoDiasEfetiva('');
      setMotivoRejeicao('');
      setNotasInternasAdmin('');
      queryClient.invalidateQueries({ queryKey: ['community-ad-super'] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : 'Operação falhou.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    },
  });

  function openReview(row: CommunityAdBookingDto, action: 'APROVAR' | 'REJEITAR') {
    setSelected(row);
    setReviewAction(action);
    setPagamentoVerificado(false);
    setStartsAtIso('');
    setDuracaoDiasEfetiva(String(row.duracaoDiasSolicitada));
    setMotivoRejeicao('');
    setNotasInternasAdmin('');
    setDialogOpen(true);
  }

  const rows = data?.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="border-primary/15 shadow-sm">
        <CardHeader className="border-b border-border/60 bg-gradient-to-r from-primary/[0.06] to-transparent">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Megaphone className="h-5 w-5 text-primary" />
            Publicidade — Comunidade / vitrine
          </CardTitle>
          <CardDescription className="max-w-3xl">
            Analise pedidos das instituições. Na <strong>aprovação</strong>, confirme explicitamente que o pagamento
            foi verificado; caso contrário, <strong>rejeite</strong> com motivo claro. A vigência efectiva é calculada a
            partir da data de início (opcional) e da duração em dias.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-2 flex-1 max-w-xs">
              <Label>Filtrar estado</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_FILTER.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> A carregar…
            </p>
          ) : !rows.length ? (
            <p className="text-sm text-muted-foreground">Nenhum registo para este filtro.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Instituição</TableHead>
                    <TableHead>Âmbito</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Valor declarado</TableHead>
                    <TableHead>Data pedido</TableHead>
                    <TableHead className="text-right">Analisar</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.institutionName ?? r.instituicaoId}
                      </TableCell>
                      <TableCell className="text-sm">{SCOPE_LABEL[r.scope]}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'AGUARDANDO_ANALISE' ? 'secondary' : 'outline'}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.valorPagoDeclarado != null
                          ? `${r.valorPagoDeclarado.toLocaleString('pt-AO')} AOA`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(r.createdAt), 'd MMM yyyy HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        {r.status === 'AGUARDANDO_ANALISE' ? (
                          <>
                            <Button type="button" size="sm" variant="default" onClick={() => openReview(r, 'APROVAR')}>
                              Aprovar
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => openReview(r, 'REJEITAR')}>
                              Rejeitar
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === 'APROVAR' ? 'Aprovar campanha' : 'Rejeitar pedido'}
            </DialogTitle>
            <DialogDescription>
              Pedido de {selected?.institutionName ?? selected?.instituicaoId} · {selected ? SCOPE_LABEL[selected.scope] : ''}
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p>
                  <span className="text-muted-foreground">Referência: </span>
                  {selected.referenciaPagamento || '—'}
                </p>
                <p>
                  <span className="text-muted-foreground">Notas instituição: </span>
                  {selected.notasInstituicao || '—'}
                </p>
                {selected.comprovativoUrl ? (
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs text-muted-foreground">Comprovativo de pagamento</Label>
                    <div className="rounded-md border overflow-hidden bg-background">
                      {signedComprovativoUrl ? (
                        <>
                          <a
                            href={signedComprovativoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 text-sm hover:bg-muted/50 border-b"
                          >
                            <FileText className="h-4 w-4 shrink-0" />
                            <span>Abrir em nova aba</span>
                            <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0 opacity-70" />
                          </a>
                          {/\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(
                            (selected.comprovativoUrl || '').split('?')[0] || '',
                          ) ? (
                            <img
                              src={signedComprovativoUrl}
                              alt="Comprovativo"
                              className="max-h-56 w-full object-contain bg-muted/20"
                            />
                          ) : (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                              PDF ou outro documento — use «Abrir em nova aba» para visualizar com a sua sessão.
                            </div>
                          )}
                        </>
                      ) : comprovativoUrlError ? (
                        <div className="p-4 text-center text-sm text-destructive">Erro ao obter link seguro.</div>
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" /> A carregar pré-visualização…
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-500/10 border border-amber-500/20 rounded-md px-2 py-1.5">
                    Instituição ainda não anexou comprovativo. Pode rejeitar ou aguardar o envio (como no fluxo da
                    licença).
                  </p>
                )}
              </div>

              {reviewAction === 'APROVAR' ? (
                <>
                  <div className="flex items-start space-x-2 rounded-md border p-3">
                    <Checkbox
                      id="pv"
                      checked={pagamentoVerificado}
                      onCheckedChange={(c) => setPagamentoVerificado(c === true)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="pv" className="cursor-pointer font-medium">
                        Pagamento verificado
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Obrigatório para concluir a aprovação. Se não consta, rejeite o pedido.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-iso">Início (ISO local opcional)</Label>
                    <Input
                      id="start-iso"
                      type="datetime-local"
                      value={startsAtIso}
                      onChange={(e) => setStartsAtIso(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Vazio = imediato (momento da aprovação).</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dias-ef">Duração efectiva (dias)</Label>
                    <Input
                      id="dias-ef"
                      type="number"
                      min={1}
                      max={366}
                      value={duracaoDiasEfetiva}
                      onChange={(e) => setDuracaoDiasEfetiva(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="motivo">Motivo da rejeição</Label>
                  <Textarea
                    id="motivo"
                    rows={3}
                    value={motivoRejeicao}
                    onChange={(e) => setMotivoRejeicao(e.target.value)}
                    placeholder="Ex.: Pagamento não encontrado na conta indicada."
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="notas-admin">Notas internas (opcional)</Label>
                <Textarea
                  id="notas-admin"
                  rows={2}
                  value={notasInternasAdmin}
                  onChange={(e) => setNotasInternasAdmin(e.target.value)}
                  placeholder="Visível só na operação interna (não mostrado à instituição na API actual)."
                />
              </div>
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
            <Button type="button" disabled={reviewMut.isPending} onClick={() => reviewMut.mutate()}>
              {reviewMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirmar {reviewAction === 'APROVAR' ? 'aprovação' : 'rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
