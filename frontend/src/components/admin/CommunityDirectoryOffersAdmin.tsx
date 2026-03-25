import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Globe, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { communityAdminApi } from '@/services/communityApi';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Ofertas publicadas no diretório Comunidade (dsicola.com/comunidade → página da escola).
 * Cursos académicos do sistema são outra coisa.
 */
export function CommunityDirectoryOffersAdmin() {
  const queryClient = useQueryClient();
  const { instituicaoId } = useInstituicao();
  const { role } = useAuth();
  const canEdit = role && ['ADMIN', 'DIRECAO', 'SUPER_ADMIN'].includes(role);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');

  const { data: courses, isLoading } = useQuery({
    queryKey: ['community-admin-courses'],
    queryFn: async () => {
      const res = await communityAdminApi.listCourses();
      return res.data.data;
    },
    enabled: Boolean(instituicaoId && canEdit),
  });

  const createMut = useMutation({
    mutationFn: () =>
      communityAdminApi.createCourse({
        name: name.trim(),
        price: price.trim() === '' ? null : Number(price.replace(',', '.')),
        description: description.trim() || null,
      }),
    onSuccess: () => {
      toast.success('Oferta adicionada ao diretório.');
      setName('');
      setPrice('');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['community-admin-courses'] });
    },
    onError: () => toast.error('Não foi possível guardar.'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => communityAdminApi.deleteCourse(id),
    onSuccess: () => {
      toast.success('Oferta removida.');
      queryClient.invalidateQueries({ queryKey: ['community-admin-courses'] });
    },
    onError: () => toast.error('Não foi possível remover.'),
  });

  if (!instituicaoId || !canEdit) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Globe className="h-5 w-5 shrink-0" aria-hidden />
          Comunidade (dsicola.com) — ofertas no diretório
        </CardTitle>
        <CardDescription>
          Visitantes em <span className="font-mono text-xs">dsicola.com/comunidade</span> veem isto na
          página da sua escola (junto com posts <strong>públicos</strong> do Social e respetivos
          comentários). Isto não substitui cursos ou classes académicos no DSICOLA.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <h3 className="text-sm font-medium">Nova oferta</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cd-offer-name">Nome</Label>
              <Input
                id="cd-offer-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Curso de verão — Robótica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cd-offer-price">Preço (opcional, AOA)</Label>
              <Input
                id="cd-offer-price"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Deixe vazio se for sob consulta"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cd-offer-desc">Descrição (opcional)</Label>
              <Textarea
                id="cd-offer-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Breve texto para o diretório público"
              />
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={createMut.isPending || !name.trim()}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Adicionar oferta
          </Button>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Ofertas publicadas</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A carregar…
            </p>
          ) : !courses?.length ? (
            <p className="text-sm text-muted-foreground">Ainda não há ofertas no diretório.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {courses.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.description ? (
                      <p className="text-muted-foreground text-xs line-clamp-2">{c.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      {c.price != null && c.price > 0
                        ? `${c.price.toLocaleString('pt-AO')} AOA`
                        : 'Sob consulta'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    disabled={deleteMut.isPending}
                    onClick={() => deleteMut.mutate(c.id)}
                    aria-label={`Remover ${c.name}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
