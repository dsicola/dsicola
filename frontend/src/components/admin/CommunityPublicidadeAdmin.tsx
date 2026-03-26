import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  communityAdApi,
  type CommunityAdBookingDto,
  type CommunityAdBookingStatus,
  type CommunityAdScope,
} from '@/services/communityApi';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Megaphone, Loader2, Info, ExternalLink, Upload } from 'lucide-react';
import { storageApi } from '@/services/api';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SCOPE_LABEL: Record<CommunityAdScope, string> = {
  VITRINE_SOCIAL: 'Posts públicos na vitrine (Social)',
  DESTAQUE_DIRETORIO: 'Destaque no diretório /comunidade',
  BOTH: 'Vitrine + destaque no diretório',
};

function statusBadge(status: CommunityAdBookingStatus) {
  const map: Record<CommunityAdBookingStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    AGUARDANDO_ANALISE: { label: 'Em análise', variant: 'secondary' },
    APROVADA: { label: 'Aprovada', variant: 'default' },
    REJEITADA: { label: 'Rejeitada', variant: 'destructive' },
    CANCELADA: { label: 'Cancelada', variant: 'outline' },
  };
  const m = map[status];
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

/**
 * Fluxo alinhado a «Minha licença»: pode anexar PDF/imagem já no pedido inicial ou **depois** (pedido em análise)
 * via `PATCH .../comprovativo`. O Super Admin pré-visualiza no painel global e aprova/rejeita.
 * Documentação técnica: `backend/src/modules/community-ad/communityAd.config.ts` (env `COMMUNITY_PUBLICIDADE_OBRIGATORIA`).
 */
export function CommunityPublicidadeAdmin() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useInstituicao();
  const { role } = useAuth();
  const canEdit = role && ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(role);

  const [scope, setScope] = useState<CommunityAdScope>('BOTH');
  const [duracaoDias, setDuracaoDias] = useState('30');
  const [valorPago, setValorPago] = useState('');
  const [comprovativoUrl, setComprovativoUrl] = useState('');
  const [comprovativoFile, setComprovativoFile] = useState<File | null>(null);
  const [referenciaPagamento, setReferenciaPagamento] = useState('');
  const [notasInstituicao, setNotasInstituicao] = useState('');
  const [socialPostId, setSocialPostId] = useState('');

  /** Diálogo «enviar comprovativo» para pedido já criado (paridade com licença PENDING). */
  const [comprovDialogOpen, setComprovDialogOpen] = useState(false);
  const [comprovBookingId, setComprovBookingId] = useState<string | null>(null);
  const [comprovExtraFile, setComprovExtraFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['community-ad-bookings-mine'],
    queryFn: async () => (await communityAdApi.getMine()).data,
    enabled: Boolean(instituicaoId && canEdit),
  });

  const createMut = useMutation({
    mutationFn: async () => {
      let finalUrl: string | null = comprovativoUrl.trim() || null;
      if (comprovativoFile) {
        const ext = comprovativoFile.name.split('.').pop() || 'pdf';
        const safeBase = instituicaoId!.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24) || 'inst';
        const fileName = `comunidade-ad_${safeBase}_${Date.now()}.${ext}`;
        const uploadResult = await storageApi.upload('comprovativos', fileName, comprovativoFile);
        finalUrl = uploadResult.url ?? null;
        if (!finalUrl) {
          throw new Error('Upload não devolveu URL.');
        }
      }
      return communityAdApi.create({
        scope,
        duracaoDiasSolicitada: Number(duracaoDias),
        valorPagoDeclarado: valorPago.trim() === '' ? null : Number(valorPago.replace(',', '.')),
        comprovativoUrl: finalUrl,
        referenciaPagamento: referenciaPagamento.trim() || null,
        notasInstituicao: notasInstituicao.trim() || null,
        socialPostId: socialPostId.trim() || null,
      });
    },
    onSuccess: () => {
      toast.success('Pedido enviado. O Super Admin analisará após verificar o pagamento.');
      setValorPago('');
      setComprovativoUrl('');
      setComprovativoFile(null);
      setReferenciaPagamento('');
      setNotasInstituicao('');
      setSocialPostId('');
      queryClient.invalidateQueries({ queryKey: ['community-ad-bookings-mine'] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : 'Não foi possível enviar.';
      toast.error(msg || 'Não foi possível enviar.');
    },
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => communityAdApi.cancel(id),
    onSuccess: () => {
      toast.success('Pedido cancelado.');
      queryClient.invalidateQueries({ queryKey: ['community-ad-bookings-mine'] });
    },
    onError: () => toast.error('Não foi possível cancelar.'),
  });

  const attachComprovMut = useMutation({
    mutationFn: async () => {
      if (!comprovBookingId || !instituicaoId) throw new Error('Pedido inválido.');
      if (!comprovExtraFile) throw new Error('Seleccione um ficheiro.');
      const ext = comprovExtraFile.name.split('.').pop() || 'pdf';
      const safeBase = instituicaoId.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 24) || 'inst';
      const fileName = `comunidade-ad_${safeBase}_${Date.now()}.${ext}`;
      const uploadResult = await storageApi.upload('comprovativos', fileName, comprovExtraFile);
      const url = uploadResult.url;
      if (!url) throw new Error('Upload não devolveu URL.');
      return communityAdApi.attachComprovativo(comprovBookingId, url);
    },
    onSuccess: () => {
      toast.success('Comprovativo enviado. O Super Admin poderá visualizar na área de aprovação.');
      setComprovDialogOpen(false);
      setComprovBookingId(null);
      setComprovExtraFile(null);
      queryClient.invalidateQueries({ queryKey: ['community-ad-bookings-mine'] });
    },
    onError: (e: unknown) => {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : e instanceof Error
            ? e.message
            : 'Falha ao enviar.';
      toast.error(msg || 'Falha ao enviar.');
    },
  });

  function openComprovDialog(bookingId: string) {
    setComprovBookingId(bookingId);
    setComprovExtraFile(null);
    setComprovDialogOpen(true);
  }

  if (!instituicaoId || !canEdit) {
    return null;
  }

  const summary = data?.summary;
  const bookings = data?.bookings ?? [];

  return (
    <Card className="border-primary/15 shadow-sm">
      <CardHeader className="space-y-1 border-b border-border/60 bg-gradient-to-r from-primary/[0.06] to-transparent pb-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg font-semibold tracking-tight">
          <Megaphone className="h-5 w-5 text-primary shrink-0" aria-hidden />
          Publicidade na Comunidade
        </CardTitle>
        <CardDescription className="text-sm leading-relaxed max-w-3xl">
          Solicite visibilidade paga no diretório <span className="font-mono text-xs">/comunidade</span> e na vitrine
          de posts públicos do Social. A plataforma só activa a campanha após o{' '}
          <strong className="text-foreground">Super Admin</strong> confirmar o pagamento e definir o período efectivo
          de vigência.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {isLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar estado da publicidade…
          </p>
        ) : summary ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Exigência de campanha</p>
              <p className="mt-1 font-semibold text-foreground">
                {summary.publicidadeObrigatoria ? 'Activada no servidor' : 'Desactivada no servidor'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {summary.publicidadeObrigatoria
                  ? 'Sem campanha aprovada em vigência, posts públicos na vitrine são bloqueados.'
                  : 'Env opcional: peça campanha para destacar; vitrine não exige campanha até o operador ligar a flag.'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Vitrine Social</p>
              <p className="mt-1 font-semibold text-foreground">
                {summary.vitrineAtiva ? 'Campanha activa' : 'Sem campanha activa'}
              </p>
            </div>
            <div className="rounded-lg border bg-card p-3 text-sm">
              <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Diretório</p>
              <p className="mt-1 font-semibold text-foreground">
                {summary.destaqueDiretorioAtivo ? 'Destaque activo' : 'Sem destaque pago'}
              </p>
            </div>
          </div>
        ) : null}

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como o comprovativo chega ao Super Admin</AlertTitle>
          <AlertDescription className="text-sm leading-relaxed">
            <strong>Como na assinatura (licença):</strong> pode anexar PDF ou fotos já no formulário abaixo ou enviar o
            pedido só com referência e, em seguida, usar <strong>«Enviar comprovativo»</strong> na tabela — enquanto
            estiver «Em análise». O ficheiro vai para o bucket <span className="font-mono text-xs">comprovativos</span>.
            No separador <strong>Publicidade</strong> do Super Admin, o documento é pré-visualizado (imagens) ou aberto
            (PDF) para decisão de aprovação.
          </AlertDescription>
        </Alert>

        <div className="rounded-xl border border-dashed border-primary/25 bg-muted/20 p-4 sm:p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Novo pedido</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Âmbito</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as CommunityAdScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SCOPE_LABEL) as CommunityAdScope[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SCOPE_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-duracao">Duração desejada (dias)</Label>
              <Input
                id="ad-duracao"
                type="number"
                min={7}
                max={366}
                value={duracaoDias}
                onChange={(e) => setDuracaoDias(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Entre 7 e 366 dias. O Super Admin pode ajustar na aprovação.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ad-valor">Valor pago (opcional, AOA)</Label>
              <Input
                id="ad-valor"
                value={valorPago}
                onChange={(e) => setValorPago(e.target.value)}
                placeholder="Ex.: 50000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-ref">Referência / N.º de operação</Label>
              <Input
                id="ad-ref"
                value={referenciaPagamento}
                onChange={(e) => setReferenciaPagamento(e.target.value)}
                placeholder="Referência Multicaixa, IBAN, etc."
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-comprov-file">Comprovativo de pagamento (recomendado)</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <Input
                  id="ad-comprov-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf"
                  className="cursor-pointer"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setComprovativoFile(f);
                    if (f) setComprovativoUrl('');
                  }}
                />
                {comprovativoFile ? (
                  <span className="text-xs text-muted-foreground truncate">{comprovativoFile.name}</span>
                ) : (
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Upload className="h-3.5 w-3.5" aria-hidden />
                    PDF, JPG ou PNG
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-comprov">Ou URL do comprovativo (opcional)</Label>
              <Input
                id="ad-comprov"
                value={comprovativoUrl}
                onChange={(e) => {
                  setComprovativoUrl(e.target.value);
                  if (e.target.value.trim()) setComprovativoFile(null);
                }}
                placeholder="https://… apenas se não anexar ficheiro acima"
                disabled={Boolean(comprovativoFile)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-post">ID do post Social (opcional)</Label>
              <Input
                id="ad-post"
                value={socialPostId}
                onChange={(e) => setSocialPostId(e.target.value)}
                placeholder="UUID de um post da sua instituição a associar ao pedido"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ad-notas">Notas para a plataforma</Label>
              <Textarea
                id="ad-notas"
                rows={2}
                value={notasInstituicao}
                onChange={(e) => setNotasInstituicao(e.target.value)}
                placeholder="Detalhes do pacote contratado, contacto comercial, etc."
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={createMut.isPending || !duracaoDias}
            onClick={() => createMut.mutate()}
            className="w-full sm:w-auto"
          >
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar pedido
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Histórico de pedidos</h3>
          {!bookings.length ? (
            <p className="text-sm text-muted-foreground">Ainda não existem pedidos de publicidade.</p>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Estado</TableHead>
                    <TableHead>Âmbito</TableHead>
                    <TableHead>Comprovativo</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead>Vigência</TableHead>
                    <TableHead className="text-right">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b: CommunityAdBookingDto) => (
                    <TableRow key={b.id}>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-sm">{SCOPE_LABEL[b.scope]}</TableCell>
                      <TableCell className="text-sm">
                        {b.comprovativoUrl ? (
                          <Badge variant="outline" className="font-normal">
                            Anexado
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(b.createdAt), "d MMM yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm">
                        {b.startsAt && b.endsAt ? (
                          <>
                            {format(new Date(b.startsAt), 'd MMM yyyy', { locale: ptBR })} —{' '}
                            {format(new Date(b.endsAt), 'd MMM yyyy', { locale: ptBR })}
                          </>
                        ) : (
                          '—'
                        )}
                        {b.motivoRejeicao ? (
                          <span className="block text-destructive text-xs mt-1">{b.motivoRejeicao}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        {b.status === 'AGUARDANDO_ANALISE' ? (
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => openComprovDialog(b.id)}
                            >
                              {b.comprovativoUrl ? 'Alterar comprovativo' : 'Enviar comprovativo'}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={cancelMut.isPending}
                              onClick={() => cancelMut.mutate(b.id)}
                            >
                              Cancelar pedido
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <ExternalLink className="h-3 w-3" />
          Visitantes vêem o diretório em <span className="font-mono">/comunidade</span>; a vitrine Social segue as regras
          de público/privado definidas no backend.
        </p>
      </CardContent>

      <Dialog open={comprovDialogOpen} onOpenChange={setComprovDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar comprovativo</DialogTitle>
            <DialogDescription>
              Anexe PDF ou imagem do pagamento. O ficheiro é enviado de forma segura e associado a este pedido na fila
              do Super Admin — o mesmo princípio do comprovativo da assinatura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <Label htmlFor="comprov-extra">Ficheiro (PDF, JPG ou PNG)</Label>
            <Input
              id="comprov-extra"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf"
              className="cursor-pointer"
              onChange={(e) => setComprovExtraFile(e.target.files?.[0] ?? null)}
            />
            {comprovExtraFile ? (
              <p className="text-xs text-muted-foreground">{comprovExtraFile.name}</p>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setComprovDialogOpen(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              disabled={attachComprovMut.isPending || !comprovExtraFile}
              onClick={() => attachComprovMut.mutate()}
            >
              {attachComprovMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
