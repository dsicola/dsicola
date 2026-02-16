import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { alojamentosApi } from "@/services/api";
import { useTenantFilter, useCurrentInstituicaoId } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Home, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Alojamento {
  id: string;
  nome_bloco: string;
  numero_quarto: string;
  tipo_quarto: "Individual" | "Duplo" | "Triplo" | "Coletivo";
  capacidade: number;
  genero: "Masculino" | "Feminino" | "Misto";
  status: "Livre" | "Ocupado" | "Manutencao";
}

export function AlojamentosTab() {
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [editingAlojamento, setEditingAlojamento] = useState<Alojamento | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [selectedAlojamento, setSelectedAlojamento] = useState<Alojamento | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    nome_bloco: "",
    numero_quarto: "",
    tipo_quarto: "Individual" as "Individual" | "Duplo" | "Triplo" | "Coletivo",
    capacidade: 1,
    genero: "Misto" as "Masculino" | "Feminino" | "Misto",
    status: "Livre" as "Livre" | "Ocupado" | "Manutencao",
  });

  const queryClient = useQueryClient();
  const { instituicaoId, shouldFilter } = useTenantFilter();
  const currentInstituicaoId = useCurrentInstituicaoId();

  const { data: alojamentos, isLoading } = useQuery({
    queryKey: ["alojamentos", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const data = await alojamentosApi.getAll(params);
      // Transform camelCase from API to snake_case for interface
      return (data as any[]).map((item: any) => ({
        id: item.id,
        nome_bloco: item.nomeBloco || item.nome_bloco,
        numero_quarto: item.numeroQuarto || item.numero_quarto,
        tipo_quarto: item.tipoQuarto || item.tipo_quarto,
        capacidade: item.capacidade,
        genero: item.genero,
        status: item.status,
      })) as Alojamento[];
    },
  });

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      await alojamentosApi.create({
        nomeBloco: data.nome_bloco,
        numeroQuarto: data.numero_quarto,
        tipoQuarto: data.tipo_quarto,
        capacidade: data.capacidade,
        genero: data.genero,
        status: data.status,
        instituicaoId: currentInstituicaoId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Quarto cadastrado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao cadastrar quarto: " + (error.response?.data?.error || error.message));
    },
  });

  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      await alojamentosApi.update(id, {
        nomeBloco: data.nome_bloco,
        numeroQuarto: data.numero_quarto,
        tipoQuarto: data.tipo_quarto,
        capacidade: data.capacidade,
        genero: data.genero,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Quarto atualizado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar quarto: " + (error.response?.data?.error || error.message));
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await alojamentosApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Quarto excluído com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedAlojamento(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir quarto: " + (error.response?.data?.error || error.message));
    },
  });

  const resetForm = () => {
    setFormData({
      nome_bloco: "",
      numero_quarto: "",
      tipo_quarto: "Individual",
      capacidade: 1,
      genero: "Misto",
      status: "Livre",
    });
    setEditingAlojamento(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (alojamento: Alojamento) => {
    setEditingAlojamento(alojamento);
    setFormData({
      nome_bloco: alojamento.nome_bloco,
      numero_quarto: alojamento.numero_quarto,
      tipo_quarto: alojamento.tipo_quarto,
      capacidade: alojamento.capacidade,
      genero: alojamento.genero,
      status: alojamento.status,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingAlojamento) {
      updateMutation.mutate({ id: editingAlojamento.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleTipoQuartoChange = (value: "Individual" | "Duplo" | "Triplo" | "Coletivo") => {
    const capacidades = { Individual: 1, Duplo: 2, Triplo: 3, Coletivo: 4 };
    setFormData({
      ...formData,
      tipo_quarto: value,
      capacidade: capacidades[value] || 1,
    });
  };

  const filteredAlojamentos = alojamentos?.filter((a) => {
    const matchesSearch =
      a.nome_bloco.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.numero_quarto.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Livre":
        return <Badge className="bg-green-500 hover:bg-green-600">Livre</Badge>;
      case "Ocupado":
        return <Badge className="bg-red-500 hover:bg-red-600">Ocupado</Badge>;
      case "Manutencao":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Em manutenção</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTipoQuartoLabel = (tipo: string) => {
    switch (tipo) {
      case "Individual":
        return "Solteiro";
      default:
        return tipo;
    }
  };

  const getGeneroBadge = (genero: string) => {
    switch (genero) {
      case "Masculino":
        return <Badge variant="outline" className="border-blue-500 text-blue-500">Masculino</Badge>;
      case "Feminino":
        return <Badge variant="outline" className="border-pink-500 text-pink-500">Feminino</Badge>;
      default:
        return <Badge variant="outline">Misto</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Quartos
            </CardTitle>
            <CardDescription>
              Gerencie os quartos e alojamentos
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Quarto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingAlojamento ? "Editar Quarto" : "Novo Quarto"}
                </DialogTitle>
                <DialogDescription>
                  {editingAlojamento
                    ? "Atualize os dados do quarto"
                    : "Preencha os dados para cadastrar um novo quarto"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nome_bloco">Bloco *</Label>
                    <Input
                      id="nome_bloco"
                      value={formData.nome_bloco}
                      onChange={(e) =>
                        setFormData({ ...formData, nome_bloco: e.target.value })
                      }
                      placeholder="Ex: Bloco A"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="numero_quarto">Nº Quarto *</Label>
                    <Input
                      id="numero_quarto"
                      value={formData.numero_quarto}
                      onChange={(e) =>
                        setFormData({ ...formData, numero_quarto: e.target.value })
                      }
                      placeholder="Ex: 101"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo_quarto">Tipo de Quarto</Label>
                    <Select
                      value={formData.tipo_quarto}
                      onValueChange={handleTipoQuartoChange}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Individual">Solteiro (1 vaga)</SelectItem>
                        <SelectItem value="Duplo">Duplo (2 vagas)</SelectItem>
                        <SelectItem value="Triplo">Triplo (3 vagas)</SelectItem>
                        <SelectItem value="Coletivo">Coletivo (4+ vagas)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="capacidade">Capacidade</Label>
                    <Input
                      id="capacidade"
                      type="number"
                      min={1}
                      max={10}
                      value={formData.capacidade}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          capacidade: parseInt(e.target.value) || 1,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="genero">Gênero</Label>
                    <Select
                      value={formData.genero}
                      onValueChange={(value: "Masculino" | "Feminino" | "Misto") =>
                        setFormData({ ...formData, genero: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Masculino">Masculino</SelectItem>
                        <SelectItem value="Feminino">Feminino</SelectItem>
                        <SelectItem value="Misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: "Livre" | "Ocupado" | "Manutencao") =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Livre">Livre</SelectItem>
                        <SelectItem value="Ocupado">Ocupado</SelectItem>
                        <SelectItem value="Manutencao">Em manutenção</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? "Salvando..."
                      : editingAlojamento
                      ? "Salvar"
                      : "Cadastrar"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por bloco ou número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Livre">Livre</SelectItem>
              <SelectItem value="Ocupado">Ocupado</SelectItem>
              <SelectItem value="Manutencao">Em manutenção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : filteredAlojamentos?.length === 0 ? (
          <div className="text-center py-12">
            <Home className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhum quarto encontrado
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {searchTerm || statusFilter !== "all"
                ? "Não existem registos que correspondam aos critérios selecionados. Sugerimos que ajuste os filtros aplicados."
                : "Não existem quartos registados. Utilize o botão \"Novo Quarto\" para adicionar o primeiro registo."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bloco</TableHead>
                  <TableHead>Quarto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">
                    <Users className="h-4 w-4 mx-auto" />
                  </TableHead>
                  <TableHead>Gênero</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlojamentos?.map((alojamento) => (
                  <TableRow key={alojamento.id}>
                    <TableCell className="font-medium">{alojamento.nome_bloco}</TableCell>
                    <TableCell>{alojamento.numero_quarto}</TableCell>
                    <TableCell>{getTipoQuartoLabel(alojamento.tipo_quarto)}</TableCell>
                    <TableCell className="text-center">{alojamento.capacidade}</TableCell>
                    <TableCell>{getGeneroBadge(alojamento.genero)}</TableCell>
                    <TableCell>{getStatusBadge(alojamento.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(alojamento)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setSelectedAlojamento(alojamento);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Quarto</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o quarto{" "}
                <strong>
                  {selectedAlojamento?.nome_bloco} - {selectedAlojamento?.numero_quarto}
                </strong>
                ? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => selectedAlojamento && deleteMutation.mutate(selectedAlojamento.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}