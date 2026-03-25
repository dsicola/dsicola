import { useEffect, useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { socialApi, type SocialPostDTO } from '@/services/socialApi';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface SocialPostEditDialogProps {
  post: SocialPostDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function SocialPostEditDialog({ post, open, onOpenChange, onSaved }: SocialPostEditDialogProps) {
  const formId = useId();
  const idBody = `${formId}-body`;
  const idPublic = `${formId}-public`;
  const idWa = `${formId}-wa`;
  const idLoc = `${formId}-loc`;
  const idVid = `${formId}-vid`;

  const [editBody, setEditBody] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [eWaShow, setEWaShow] = useState(false);
  const [eWa, setEWa] = useState('');
  const [eLocShow, setELocShow] = useState(false);
  const [eLoc, setELoc] = useState('');
  const [eVidShow, setEVidShow] = useState(false);
  const [eVid, setEVid] = useState('');

  useEffect(() => {
    if (!open || !post) return;
    setEditBody(post.body);
    setEditPublic(post.isPublic);
    setEWaShow(post.contactWhatsappShow);
    setEWa(post.contactWhatsapp ?? '');
    setELocShow(post.contactLocationShow);
    setELoc(post.contactLocation ?? '');
    setEVidShow(post.contactVideoShow);
    setEVid(post.contactVideoUrl ?? '');
  }, [open, post]);

  const editContactInvalid =
    (eWaShow && !eWa.trim()) || (eLocShow && !eLoc.trim()) || (eVidShow && !eVid.trim());

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error('Sem publicação');
      return socialApi.updatePost(post.id, {
        body: editBody.trim(),
        ...(!post.group ? { isPublic: editPublic } : {}),
        contactWhatsappShow: eWaShow,
        contactWhatsapp: eWa.trim() || undefined,
        contactLocationShow: eLocShow,
        contactLocation: eLoc.trim() || undefined,
        contactVideoShow: eVidShow,
        contactVideoUrl: eVid.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Publicação actualizada');
      onOpenChange(false);
      onSaved();
    },
    onError: (err: unknown) => {
      const msg =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : null;
      toast.error(msg || 'Não foi possível guardar');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar publicação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor={idBody}>Texto</Label>
            <Textarea
              id={idBody}
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={5}
              className="resize-none text-sm"
            />
          </div>
          {post && !post.group ? (
            <div className="flex items-start gap-2">
              <Switch
                id={idPublic}
                checked={editPublic}
                onCheckedChange={setEditPublic}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <Label htmlFor={idPublic} className="cursor-pointer text-sm font-medium">
                  {editPublic ? 'Público — Comunidade' : 'Privado — só na escola'}
                </Label>
              </div>
            </div>
          ) : null}

          <div className="space-y-3 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Destaques (opcional)</p>
            <div className="flex items-start gap-2">
              <Switch id={idWa} checked={eWaShow} onCheckedChange={setEWaShow} className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={idWa} className="text-sm font-medium">
                  WhatsApp
                </Label>
                {eWaShow ? (
                  <Input
                    value={eWa}
                    onChange={(e) => setEWa(e.target.value)}
                    placeholder="Telefone ou link wa.me"
                    className="h-9 text-sm"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Switch id={idLoc} checked={eLocShow} onCheckedChange={setELocShow} className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={idLoc} className="text-sm font-medium">
                  Contacto / localidade
                </Label>
                {eLocShow ? (
                  <Textarea
                    value={eLoc}
                    onChange={(e) => setELoc(e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="Morada, horário…"
                  />
                ) : null}
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Switch id={idVid} checked={eVidShow} onCheckedChange={setEVidShow} className="mt-0.5" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={idVid} className="text-sm font-medium">
                  Vídeo (YouTube ou Bunny)
                </Label>
                {eVidShow ? (
                  <Input
                    value={eVid}
                    onChange={(e) => setEVid(e.target.value)}
                    placeholder="URL do vídeo"
                    className="h-9 text-sm"
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={updateMutation.isPending || !editBody.trim() || editContactInvalid || !post}
            onClick={() => updateMutation.mutate()}
          >
            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
