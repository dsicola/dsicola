import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { videoAulasApi } from '@/services/api';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { toast } from '@/hooks/use-toast';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { VideoPlayer } from '@/components/videoaulas/VideoPlayer';
import { Plus, Edit, Trash2, Video, Loader2, Eye } from 'lucide-react';

type TipoVideo = 'YOUTUBE' | 'VIMEO' | 'UPLOAD' | 'BUNNY';
type ModuloVideoAula = 'ACADEMICO' | 'FINANCEIRO' | 'CONFIGURACOES' | 'GERAL';
type PerfilAlvoVideoAula = 'ADMIN' | 'PROFESSOR' | 'SECRETARIA' | 'TODOS';
type TipoInstituicaoVideoAula = 'SUPERIOR' | 'SECUNDARIO' | 'AMBOS';

interface VideoAula {
  id: string;
  titulo: string;
  descricao?: string | null;
  urlVideo: string;
  tipoVideo: TipoVideo;
  modulo: ModuloVideoAula;
  perfilAlvo: PerfilAlvoVideoAula | string;
  tipoInstituicao?: TipoInstituicaoVideoAula | null;
  ordem: number;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
}

export function GestaoVideoAulasTab() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useSafeDialog(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [previewVideoAula, setPreviewVideoAula] = useState<VideoAula | null>(null);

  const [formData, setFormData] = useState({
    titulo: '',
    descricao: '',
    urlVideo: '',
    tipoVideo: 'YOUTUBE' as TipoVideo,
    modulo: 'GERAL' as ModuloVideoAula,
    perfilAlvo: 'TODOS' as PerfilAlvoVideoAula,
    tipoInstituicao: 'AMBOS' as TipoInstituicaoVideoAula,
    ordem: 0,
    ativo: true,
  });

  // Buscar todas as videoaulas (SUPER_ADMIN vê tudo, sem filtros)
  const { data: videoAulas = [], isLoading } = useQuery({
    queryKey: ['video-aulas-admin'],
    queryFn: async () => {
      return await videoAulasApi.getAllAdmin();
    },
  });

  // Create mutation - protegida contra unmount
  const createMutation = useSafeMutation({
    mutationFn: videoAulasApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-aulas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['video-aulas'] });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      resetForm();
      toast({
        title: 'Videoaula criada',
        description: 'A videoaula foi criada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao criar videoaula',
        description: error?.response?.data?.message || 'Erro ao criar videoaula',
        variant: 'destructive',
      });
    },
  });

  // Update mutation - protegida contra unmount
  const updateMutation = useSafeMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => videoAulasApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-aulas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['video-aulas'] });
      // Fechamento explícito após sucesso
      setDialogOpen(false);
      resetForm();
      toast({
        title: 'Videoaula atualizada',
        description: 'A videoaula foi atualizada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao atualizar videoaula',
        description: error?.response?.data?.message || 'Erro ao atualizar videoaula',
        variant: 'destructive',
      });
    },
  });

  // Delete mutation - protegida contra unmount
  const deleteMutation = useSafeMutation({
    mutationFn: videoAulasApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['video-aulas-admin'] });
      queryClient.invalidateQueries({ queryKey: ['video-aulas'] });
      // Fechamento explícito após sucesso
      setDeleteDialogOpen(false);
      setDeletingId(null);
      toast({
        title: 'Videoaula deletada',
        description: 'A videoaula foi deletada com sucesso.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao deletar videoaula',
        description: error?.response?.data?.message || 'Erro ao deletar videoaula',
        variant: 'destructive',
      });
    },
  });

  const resetForm = () => {
    setFormData({
      titulo: '',
      descricao: '',
      urlVideo: '',
      tipoVideo: 'YOUTUBE',
      modulo: 'GERAL',
      perfilAlvo: 'TODOS',
      tipoInstituicao: 'AMBOS',
      ordem: 0,
      ativo: true,
    });
    setEditingId(null);
  };

  const handleCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleEdit = (videoAula: VideoAula) => {
    setFormData({
      titulo: videoAula.titulo,
      descricao: videoAula.descricao || '',
      urlVideo: videoAula.urlVideo,
      tipoVideo: videoAula.tipoVideo,
      modulo: videoAula.modulo,
      perfilAlvo: (videoAula.perfilAlvo as PerfilAlvoVideoAula) || 'TODOS',
      tipoInstituicao: (videoAula.tipoInstituicao as TipoInstituicaoVideoAula) || 'AMBOS',
      ordem: videoAula.ordem,
      ativo: videoAula.ativo,
    });
    setEditingId(videoAula.id);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handlePreview = (videoAula: VideoAula) => {
    setPreviewVideoAula(videoAula);
    setPreviewDialogOpen(true);
  };

  // Cleanup é gerenciado automaticamente pelo useSafeDialog

  const handleSubmit = () => {
    if (!formData.titulo.trim()) {
      toast({
        title: 'Erro',
        description: 'Título é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.urlVideo.trim()) {
      toast({
        title: 'Erro',
        description: 'URL do vídeo é obrigatória',
        variant: 'destructive',
      });
      return;
    }

    // Transformar valores do frontend para valores válidos do Prisma
    const dataToSend: any = {
      titulo: formData.titulo,
      descricao: formData.descricao,
      urlVideo: formData.urlVideo,
      tipoVideo: formData.tipoVideo,
      modulo: formData.modulo,
      ordem: formData.ordem,
      ativo: formData.ativo,
    };

    dataToSend.perfilAlvo = formData.perfilAlvo;

    // Converter 'AMBOS' para null (que representa "ambos" no schema Prisma)
    if (formData.tipoInstituicao === 'AMBOS') {
      dataToSend.tipoInstituicao = null;
    } else if (formData.tipoInstituicao) {
      dataToSend.tipoInstituicao = formData.tipoInstituicao;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: dataToSend });
    } else {
      createMutation.mutate(dataToSend);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
    }
  };

  const getModuloLabel = (modulo: ModuloVideoAula) => {
    switch (modulo) {
      case 'ACADEMICO':
        return 'Acadêmico';
      case 'FINANCEIRO':
        return 'Financeiro';
      case 'CONFIGURACOES':
        return 'Configurações';
      case 'GERAL':
        return 'Geral';
      default:
        return modulo;
    }
  };

  const getPerfilLabel = (perfil: PerfilAlvoVideoAula | string | null | undefined) => {
    if (!perfil) return 'Todos';
    switch (String(perfil)) {
      case 'ADMIN':
        return 'Admin';
      case 'PROFESSOR':
        return 'Professor';
      case 'SECRETARIA':
        return 'Secretaria';
      case 'TODOS':
        return 'Todos';
      default:
        return perfil;
    }
  };

  const getTipoInstituicaoLabel = (tipo: TipoInstituicaoVideoAula | null | undefined) => {
    if (!tipo) return 'Ambos';
    switch (tipo) {
      case 'SUPERIOR':
        return 'Superior';
      case 'SECUNDARIO':
        return 'Secundário';
      case 'AMBOS':
        return 'Ambos';
      default:
        return tipo;
    }
  };

  const getTipoVideoLabel = (tipo: TipoVideo) => {
    switch (tipo) {
      case 'YOUTUBE':
        return 'YouTube';
      case 'VIMEO':
        return 'Vimeo';
      case 'UPLOAD':
        return 'Upload';
      case 'BUNNY':
        return 'Bunny.net';
      default:
        return tipo;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Gestão de Videoaulas
              </CardTitle>
              <CardDescription>
                Gerencie as videoaulas explicativas de treinamento do sistema
              </CardDescription>
            </div>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Videoaula
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : videoAulas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma videoaula cadastrada
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordem</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Perfil Alvo</TableHead>
                    <TableHead>Tipo Instituição</TableHead>
                    <TableHead>Tipo Vídeo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {videoAulas.map((videoAula: VideoAula) => (
                    <TableRow key={videoAula.id}>
                      <TableCell>{videoAula.ordem}</TableCell>
                      <TableCell className="font-medium">{videoAula.titulo}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getModuloLabel(videoAula.modulo)}</Badge>
                      </TableCell>
                      <TableCell>{getPerfilLabel(videoAula.perfilAlvo)}</TableCell>
                      <TableCell>{getTipoInstituicaoLabel(videoAula.tipoInstituicao)}</TableCell>
                      <TableCell>{getTipoVideoLabel(videoAula.tipoVideo)}</TableCell>
                      <TableCell>
                        <Badge variant={videoAula.ativo ? 'default' : 'secondary'}>
                          {videoAula.ativo ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handlePreview(videoAula)}
                            title="Visualizar videoaula"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(videoAula)}
                            title="Editar videoaula"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(videoAula.id)}
                            title="Excluir videoaula"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Criação/Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Editar Videoaula' : 'Nova Videoaula'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Atualize as informações da videoaula'
                : 'Cadastre uma nova videoaula explicativa'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="titulo"
                value={formData.titulo}
                onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                placeholder="Ex: Como cadastrar um aluno"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Descrição opcional da videoaula"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoVideo">
                  Tipo de Vídeo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.tipoVideo}
                  onValueChange={(value) =>
                    setFormData({ ...formData, tipoVideo: value as TipoVideo })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="YOUTUBE">YouTube</SelectItem>
                    <SelectItem value="VIMEO">Vimeo</SelectItem>
                    <SelectItem value="UPLOAD">Upload</SelectItem>
                    <SelectItem value="BUNNY">Bunny.net</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urlVideo">
                  URL do Vídeo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="urlVideo"
                  value={formData.urlVideo}
                  onChange={(e) => setFormData({ ...formData, urlVideo: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="modulo">
                  Módulo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.modulo}
                  onValueChange={(value) =>
                    setFormData({ ...formData, modulo: value as ModuloVideoAula })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACADEMICO">Acadêmico</SelectItem>
                    <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
                    <SelectItem value="CONFIGURACOES">Configurações</SelectItem>
                    <SelectItem value="GERAL">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="perfilAlvo">
                  Perfil Alvo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.perfilAlvo}
                  onValueChange={(value) =>
                    setFormData({ ...formData, perfilAlvo: value as PerfilAlvoVideoAula })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="PROFESSOR">Professor</SelectItem>
                    <SelectItem value="SECRETARIA">Secretaria</SelectItem>
                    <SelectItem value="TODOS">Todos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoInstituicao">
                  Tipo de Instituição <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.tipoInstituicao || 'AMBOS'}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      tipoInstituicao: value as TipoInstituicaoVideoAula,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SUPERIOR">Superior</SelectItem>
                    <SelectItem value="SECUNDARIO">Secundário</SelectItem>
                    <SelectItem value="AMBOS">Ambos (Secundário + Superior)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  value={formData.ordem}
                  onChange={(e) =>
                    setFormData({ ...formData, ordem: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                className="rounded border-gray-300"
              />
              <Label htmlFor="ativo" className="cursor-pointer">
                Ativo
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingId ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta videoaula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Preview de Videoaula */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewVideoAula?.titulo || 'Preview de Videoaula'}
            </DialogTitle>
            <DialogDescription>
              Visualização administrativa - Não marca progresso
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {previewVideoAula && (
              <>
                {previewVideoAula.descricao && (
                  <p className="text-sm text-muted-foreground">
                    {previewVideoAula.descricao}
                  </p>
                )}
                <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                  <VideoPlayer 
                    videoAula={{
                      id: previewVideoAula.id,
                      titulo: previewVideoAula.titulo,
                      urlVideo: previewVideoAula.urlVideo,
                      tipoVideo: previewVideoAula.tipoVideo,
                    }}
                    // NÃO passar onProgressUpdate - preview não marca progresso
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

