import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { SocialPostDTO } from '@/services/socialApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, Pencil } from 'lucide-react';

type Comment = NonNullable<SocialPostDTO['comments']>[number];

interface CommentListProps {
  comments: Comment[];
  currentUserId: string | null;
  onCreate: (body: string) => Promise<void>;
  onUpdate: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  canModerate?: boolean;
  /** Quem não pertence à instituição da publicação só vê comentários; não cria. */
  allowCreate?: boolean;
}

export function CommentList({
  comments,
  currentUserId,
  onCreate,
  onUpdate,
  onDelete,
  canModerate,
  allowCreate = true,
}: CommentListProps) {
  const [newText, setNewText] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const submitNew = async () => {
    const t = newText.trim();
    if (!t || sending) return;
    setSending(true);
    try {
      await onCreate(t);
      setNewText('');
    } finally {
      setSending(false);
    }
  };

  const startEdit = (c: Comment) => {
    setEditingId(c.id);
    setEditText(c.body);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const t = editText.trim();
    if (!t) return;
    await onUpdate(editingId, t);
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      {allowCreate ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Escrever comentário…"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <Button type="button" size="sm" onClick={submitNew} disabled={sending || !newText.trim()}>
            Comentar
          </Button>
        </div>
      ) : (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          Só utilizadores da mesma instituição desta publicação podem comentar. Pode reagir (gosto) se tiver sessão
          iniciada.
        </p>
      )}

      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium">{c.author.nomeCompleto}</span>
                <span className="text-muted-foreground text-xs ml-2">
                  {format(new Date(c.createdAt), "d MMM yyyy, HH:mm", { locale: ptBR })}
                </span>
              </div>
              {(c.authorId === currentUserId || canModerate) && (
                <div className="flex gap-1 shrink-0">
                  {c.authorId === currentUserId && (
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => onDelete(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {editingId === c.id ? (
              <div className="mt-2 space-y-2">
                <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
                <div className="flex gap-2">
                  <Button size="sm" onClick={saveEdit}>
                    Guardar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-2 whitespace-pre-wrap">{c.body}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
