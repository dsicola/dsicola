import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { classesApi } from '@/services/api';
import { useInstituicao } from '@/contexts/InstituicaoContext';
import { useSafeMutation } from '@/hooks/useSafeMutation';
import { useSafeDialog } from '@/hooks/useSafeDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Search, ArrowUpDown } from 'lucide-react';
import { ExportButtons } from "@/components/common/ExportButtons";
import { toast } from 'sonner';
import { z } from 'zod';

interface Classe {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  cargaHoraria: number;
  valorMensalidade: number;
  tipo: string | null;
  ativo: boolean;
  createdAt: string;
}

const classeSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres').max(100),
  codigo: z.string().min(2, 'Código deve ter pelo menos 2 caracteres').max(20),
  descricao: z.string().max(500).optional(),
  cargaHoraria: z.number().min(1, 'Carga horária deve ser maior que 0').max(10000),
  valorMensalidade: z.number().min(1, 'Valor da mensalidade é obrigatório e deve ser maior que zero'),
  tipo: z.string().optional(),
  ativo: z.boolean(),
});

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
  }).format(value);
};

/**
 * ClassesTab - Gestão de Classes (10ª, 11ª, 12ª) do Ensino Secundário.
 * Usa classesApi. Visível apenas quando tipoAcademico === 'SECUNDARIO'.
 */
export const ClassesTab: React.FC = () => {
  const queryClient = useQueryClient();
  const { isSecundario, instituicaoId } = useInstituicao();
  const [classes, setClasses] = useState<Classe[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingClasse, setEditingClasse] = useState<Classe | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    cargaHoraria: 60,
    valorMensalidade: 50000,
    tipo: 'classe',
    ativo: true,
  });
  const [filterAtivo, setFilterAtivo] = useState<string>('todos');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const entityLabel = 'Classe';
  const entityLabelPlural = 'Classes';

  const fetchClasses = async () => {
    try {
      setLoading(true);

      if (!isSecundario) {
        setClasses([]);
        return;
      }

      if (!instituicaoId) {
        console.warn('[ClassesTab] Usuário sem instituicaoId - não é possível buscar classes');
        setClasses([]);
        return;
      }

      const response = await classesApi.getAll({ ativo: true });
      let data = Array.isArray(response) ? response : [];

      const sorted = data.sort((a: Classe, b: Classe) =>
        sortOrder === 'asc'
          ? a.nome.localeCompare(b.nome)
          : b.nome.localeCompare(a.nome)
      );
      setClasses(sorted);
    } catch (error: any) {
      console.error('Erro ao buscar classes:', error);
      if (error?.response?.status === 400) {
        setClasses([]);
      } else {
        toast.error('Erro ao carregar classes');
        setClasses([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [sortOrder, isSecundario, instituicaoId]);

  const filteredClasses = classes.filter((classe) => {
    const matchesSearch =
      classe.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classe.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAtivo =
      filterAtivo === 'todos' ||
      (filterAtivo === 'ativo' && classe.ativo) ||
      (filterAtivo === 'inativo' && !classe.ativo);
    return matchesSearch && matchesAtivo;
  });

  const exportData = filteredClasses.map((c) => [
    c.codigo,
    c.nome,
    `${c.cargaHoraria}h`,
    formatCurrency(c.valorMensalidade),
    c.ativo ? 'Ativa' : 'Inativa',
  ]);

  const openDialog = (classe?: Classe) => {
    if (classe) {
      setEditingClasse(classe);
      setFormData({
        nome: classe.nome,
        codigo: classe.codigo,
        descricao: classe.descricao || '',
        cargaHoraria: classe.cargaHoraria,
        valorMensalidade: classe.valorMensalidade,
        tipo: classe.tipo || 'classe',
        ativo: classe.ativo ?? true,
      });
    } else {
      setEditingClasse(null);
      setFormData({ nome: '', codigo: '', descricao: '', cargaHoraria: 60, valorMensalidade: 50000, tipo: 'classe', ativo: true });
    }
    setErrors({});
    setIsDialogOpen(true);
  };

  const saveMutation = useSafeMutation({
    mutationFn: async (data: { isEdit: boolean; id?: string; dataToSave: any }) => {
      if (data.isEdit && data.id) {
        await classesApi.update(data.id, data.dataToSave);
      } else {
        await classesApi.create(data.dataToSave);
      }
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`${entityLabel} ${data.isEdit ? 'atualizada' : 'cadastrada'} com sucesso!`);
      setIsDialogOpen(false);
      fetchClasses();
      setSubmitting(false);
    },
    onError: (error: any) => {
      setSubmitting(false);
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else if (error?.response?.status === 409 || error?.message?.includes('duplicate')) {
        toast.error('Já existe uma classe com este código. Por favor, use um código diferente.');
        setErrors({ codigo: 'Este código já está em uso' });
      } else {
        toast.error('Erro ao salvar classe');
      }
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await classesApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      toast.success(`${entityLabel} excluída com sucesso!`);
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchClasses();
    },
    onError: (error: any) => {
      toast.error('Erro ao excluir classe: ' + (error.response?.data?.error || error.message));
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    try {
      const validatedData = classeSchema.parse({
        ...formData,
        cargaHoraria: Number(formData.cargaHoraria),
        valorMensalidade: Number(formData.valorMensalidade),
        ativo: formData.ativo,
      });

      if (!isSecundario) {
        toast.error('Classes só são permitidas no Ensino Secundário');
        setSubmitting(false);
        return;
      }

      const dataToSave: any = {
        nome: validatedData.nome,
        codigo: validatedData.codigo,
        descricao: validatedData.descricao || null,
        cargaHoraria: validatedData.cargaHoraria,
        valorMensalidade: validatedData.valorMensalidade,
        ativo: validatedData.ativo,
      };

      saveMutation.mutate({
        isEdit: !!editingClasse,
        id: editingClasse?.id,
        dataToSave,
      });
    } catch (error: any) {
      setSubmitting(false);
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Erro de validação');
      }
    }
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(deletingId);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>{entityLabelPlural}</CardTitle>
            <CardDescription>
              Gerencie as classes do sistema (10ª, 11ª, 12ª Classe)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <ExportButtons
              titulo={`Relatório de ${entityLabelPlural}`}
              colunas={['Código', 'Nome', 'Carga Horária', 'Mensalidade', 'Status']}
              dados={exportData}
            />
            <Button onClick={() => openDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Classe
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            <ArrowUpDown className="mr-2 h-4 w-4" />
            {sortOrder === 'asc' ? 'A-Z' : 'Z-A'}
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredClasses.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {searchTerm ? `Nenhuma ${entityLabel.toLowerCase()} encontrada` : `Nenhuma ${entityLabel.toLowerCase()} cadastrada`}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Carga Horária</TableHead>
                  <TableHead>Mensalidade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClasses.map((classe) => (
                  <TableRow key={classe.id} className={!classe.ativo ? 'opacity-60' : ''}>
                    <TableCell className="font-medium">{classe.codigo}</TableCell>
                    <TableCell>{classe.nome}</TableCell>
                    <TableCell>{classe.cargaHoraria}h</TableCell>
                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(classe.valorMensalidade)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={classe.ativo ? 'default' : 'destructive'}>
                        {classe.ativo ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDialog(classe)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(classe.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingClasse ? 'Editar Classe' : 'Nova Classe'}
              </DialogTitle>
              <DialogDescription>
                Preencha os dados da classe (ex: 10ª Classe, 11ª Classe, 12ª Classe).
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código da Classe</Label>
                    <Input
                      id="codigo"
                      value={formData.codigo}
                      onChange={(e) => setFormData({ ...formData, codigo: e.target.value })}
                      placeholder="Ex: 10CL, 11CL, 12CL"
                    />
                    {errors.codigo && <p className="text-sm text-destructive">{errors.codigo}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome da Classe</Label>
                    <Input
                      id="nome"
                      value={formData.nome}
                      onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                      placeholder="Ex: 10ª Classe, 11ª Classe"
                    />
                    {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cargaHoraria">Carga Horária (horas)</Label>
                  <Input
                    id="cargaHoraria"
                    type="number"
                    value={formData.cargaHoraria}
                    onChange={(e) => setFormData({ ...formData, cargaHoraria: parseInt(e.target.value) || 0 })}
                    placeholder="Ex: 3000"
                  />
                  {errors.cargaHoraria && <p className="text-sm text-destructive">{errors.cargaHoraria}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="valorMensalidade">Valor da Mensalidade (Kz)</Label>
                  <Input
                    id="valorMensalidade"
                    type="number"
                    value={formData.valorMensalidade}
                    onChange={(e) => setFormData({ ...formData, valorMensalidade: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 50000"
                  />
                  {errors.valorMensalidade && <p className="text-sm text-destructive">{errors.valorMensalidade}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descricao">Descrição (opcional)</Label>
                  <Textarea
                    id="descricao"
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição da classe..."
                    rows={3}
                  />
                  {errors.descricao && <p className="text-sm text-destructive">{errors.descricao}</p>}
                </div>
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="ativo"
                    checked={formData.ativo}
                    onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked === true })}
                  />
                  <Label htmlFor="ativo" className="text-sm font-normal cursor-pointer">
                    Classe ativa
                  </Label>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta {entityLabel.toLowerCase()}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};
