import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** Derrogações válidas apenas com decisão explícita da administração da instituição. */
export const NOTA_PADRAO_EXCECOES_ADMINISTRACAO =
  'Derrogações ou exceções às regras gerais do sistema — prazos, perfis, bloqueios, limites de plano ou fluxos normativos — só produzem efeito quando documentadas e autorizadas pela administração da instituição (ou órgão competente por lei ou estatutos). Na ausência de exceção formalmente válida, aplicam-se integralmente as configurações automáticas e as políticas internas em vigor, com possível registo em auditoria.';

export type ConfirmacaoResponsabilidadeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Texto de destaque institucional (ex.: enquadramento da decisão). */
  avisoInstitucional?: string;
  /** Lista de consequências ou requisitos a considerar antes de confirmar. */
  pontosAtencao?: string[];
  /** Substitui o texto padrão sobre exceções administrativas (opcional). */
  notaExcecoesAdministracao?: string;
  /** Se verdadeiro, não mostra o bloco «Exceções e derrogações». Por omissão é exibido. */
  ocultarNotaExcecaoAdministracao?: boolean;
  checkboxLabel?: string;
  confirmLabel?: string;
  /** Operações irreversíveis ou de risco elevado: realça o botão de confirmação. */
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  isLoading?: boolean;
};

export function ConfirmacaoResponsabilidadeDialog({
  open,
  onOpenChange,
  title,
  description,
  avisoInstitucional,
  pontosAtencao,
  notaExcecoesAdministracao,
  ocultarNotaExcecaoAdministracao = false,
  checkboxLabel = 'Declaro, no exercício das minhas funções nesta instituição, que os dados foram revistos e que autorizo a operação, nos termos aplicáveis.',
  confirmLabel = 'Confirmar e aplicar',
  confirmVariant = 'default',
  onConfirm,
  isLoading = false,
}: ConfirmacaoResponsabilidadeDialogProps) {
  const [aceite, setAceite] = useState(false);

  useEffect(() => {
    if (!open) setAceite(false);
  }, [open]);

  const mostraNotaExcecoes = !ocultarNotaExcecaoAdministracao;
  const temBlocoInstitucional =
    Boolean(avisoInstitucional?.trim()) ||
    (pontosAtencao != null && pontosAtencao.length > 0) ||
    mostraNotaExcecoes;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isLoading) onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn('sm:max-w-md', temBlocoInstitucional && 'sm:max-w-lg')}
      >
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg leading-snug">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            {description ??
              'Esta operação altera registos oficiais ou visíveis no sistema. Confirme apenas após verificação dos dados e em conformidade com as normas internas da instituição.'}
          </DialogDescription>
        </DialogHeader>

        {avisoInstitucional?.trim() ? (
          <div
            className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm text-foreground leading-relaxed"
            role="note"
          >
            {avisoInstitucional.trim()}
          </div>
        ) : null}

        {pontosAtencao && pontosAtencao.length > 0 ? (
          <div className="rounded-md border bg-muted/35 px-3 py-2.5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Pontos a considerar
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-4 leading-relaxed marker:text-muted-foreground/80">
              {pontosAtencao.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {mostraNotaExcecoes ? (
          <div
            className="rounded-md border border-muted-foreground/15 bg-muted/25 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed space-y-1"
            role="note"
          >
            <p className="font-semibold text-foreground/85 uppercase tracking-wide text-[11px]">
              Exceções e derrogações (administração)
            </p>
            <p>{notaExcecoesAdministracao ?? NOTA_PADRAO_EXCECOES_ADMINISTRACAO}</p>
          </div>
        ) : null}

        <div className="flex items-start gap-3 rounded-md border p-3 bg-background">
          <Checkbox
            id="dlg-critico-aceite"
            checked={aceite}
            onCheckedChange={(v) => setAceite(v === true)}
            disabled={isLoading}
          />
          <Label htmlFor="dlg-critico-aceite" className="text-sm font-normal leading-snug cursor-pointer">
            {checkboxLabel}
          </Label>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={confirmVariant === 'destructive' ? 'destructive' : 'default'}
            onClick={() => {
              if (!aceite || isLoading) return;
              onConfirm();
              onOpenChange(false);
            }}
            disabled={!aceite || isLoading}
          >
            {isLoading ? 'A aplicar…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
