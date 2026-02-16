import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { alocacoesAlojamentoApi, alojamentosApi, alunosApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { SmartSearch } from "@/components/common/SmartSearch";
import { useAlunoSearch, useAlojamentoSearch } from "@/hooks/useSmartSearch";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Trash2, Search, Users, Home, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Alocacao {
  id: string;
  aluno_id: string;
  alojamento_id: string;
  data_entrada: string;
  data_saida: string | null;
  status: "Ativo" | "Inativo";
  aluno: { id: string; nome_completo: string; email: string } | null;
  alojamento: { id: string; nome_bloco: string; numero_quarto: string; capacidade: number } | null;
}

interface Alojamento {
  id: string;
  nome_bloco: string;
  numero_quarto: string;
  tipo_quarto: string;
  capacidade: number;
  genero: string;
  status: string;
}

interface Aluno {
  id: string;
  nome_completo: string;
  email: string;
}

export function AlocacoesTab() {
  const [isDialogOpen, setIsDialogOpen] = useSafeDialog(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useSafeDialog(false);
  const [selectedAlocacao, setSelectedAlocacao] = useState<Alocacao | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [alojamentoFilter, setAlojamentoFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [formData, setFormData] = useState({
    aluno_id: "",
    alojamento_id: "",
    data_entrada: new Date().toISOString().split("T")[0],
    status: "Ativo" as "Ativo" | "Inativo",
  });

  const queryClient = useQueryClient();
  const { instituicaoId, shouldFilter } = useTenantFilter();
  const { searchAlunos } = useAlunoSearch();
  const { searchAlojamentos } = useAlojamentoSearch();

  // Fetch allocations
  const { data: alocacoes, isLoading } = useQuery({
    queryKey: ["alocacoes-alojamento", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const data = await alocacoesAlojamentoApi.getAll(params);
      return data as Alocacao[];
    },
  });

  // Fetch available rooms
  const { data: alojamentos } = useQuery({
    queryKey: ["alojamentos-disponiveis", instituicaoId],
    queryFn: async () => {
      const params: any = {};
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const data = await alojamentosApi.getAll(params);
      return (data as Alojamento[]).filter(a => a.status !== "Em manutenção");
    },
  });

  // Fetch students
  const { data: alunos } = useQuery({
    queryKey: ["alunos-alocacao", instituicaoId],
    queryFn: async () => {
      const params: any = { role: 'ALUNO' };
      if (shouldFilter && instituicaoId) {
        params.instituicaoId = instituicaoId;
      }
      const data = await alunosApi.getAll(params);
      return data as Aluno[];
    },
  });

  // Count active allocations per room
  const getActiveAllocationsCount = (alojamentoId: string) => {
    return alocacoes?.filter(
      (a) => a.alojamento_id === alojamentoId && a.status === "Ativo"
    ).length || 0;
  };

  // Check if room has available capacity
  const hasAvailableCapacity = (alojamento: Alojamento) => {
    const activeCount = getActiveAllocationsCount(alojamento.id);
    return activeCount < alojamento.capacidade;
  };

  // Get available rooms only
  const availableRooms = alojamentos?.filter(hasAvailableCapacity) || [];

  // Check if student is already allocated
  const isStudentAllocated = (alunoId: string) => {
    return alocacoes?.some(
      (a) => a.aluno_id === alunoId && a.status === "Ativo"
    ) || false;
  };

  // Get available students (not already allocated)
  const availableStudents = alunos?.filter((a) => !isStudentAllocated(a.id)) || [];

  const createMutation = useSafeMutation({
    mutationFn: async (data: typeof formData) => {
      await alocacoesAlojamentoApi.create({
        alunoId: data.aluno_id,
        alojamentoId: data.alojamento_id,
        dataEntrada: data.data_entrada,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alocacoes-alojamento"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Aluno alocado com sucesso!");
      resetForm();
    },
    onError: (error: any) => {
      toast.error("Erro ao alocar aluno: " + (error.response?.data?.error || error.message));
    },
  });

  const updateStatusMutation = useSafeMutation({
    mutationFn: async ({ id, status }: { id: string; status: "Ativo" | "Inativo" }) => {
      const updateData: { status: "Ativo" | "Inativo"; dataSaida?: string } = { status };
      if (status === "Inativo") {
        updateData.dataSaida = new Date().toISOString().split("T")[0];
      }
      await alocacoesAlojamentoApi.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alocacoes-alojamento"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Status atualizado com sucesso!");
    },
    onError: (error: any) => {
      toast.error("Erro ao atualizar status: " + (error.response?.data?.error || error.message));
    },
  });

  const deleteMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      await alocacoesAlojamentoApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alocacoes-alojamento"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos-disponiveis"] });
      queryClient.invalidateQueries({ queryKey: ["alojamentos"] });
      toast.success("Alocação excluída com sucesso!");
      setDeleteDialogOpen(false);
      setSelectedAlocacao(null);
    },
    onError: (error: any) => {
      toast.error("Erro ao excluir alocação: " + (error.response?.data?.error || error.message));
    },
  });

  const resetForm = () => {
    setFormData({
      aluno_id: "",
      alojamento_id: "",
      data_entrada: new Date().toISOString().split("T")[0],
      status: "Ativo",
    });
    setIsDialogOpen(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const filteredAlocacoes = alocacoes?.filter((a) => {
    const matchesSearch = a.aluno?.nome_completo
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesAlojamento =
      alojamentoFilter === "all" || a.alojamento_id === alojamentoFilter;
    const matchesStatus = statusFilter === "all" || a.status === statusFilter;
    return matchesSearch && matchesAlojamento && matchesStatus;
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Alocações de Alunos
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm} disabled={availableRooms.length === 0}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Alocação
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nova Alocação</DialogTitle>
                <DialogDescription>
                  Alocar um aluno em um quarto disponível
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="aluno_id">Aluno *</Label>
                  <SmartSearch
                    placeholder="Digite nome, email ou BI do aluno..."
                    value={alunos?.find((a) => a.id === formData.aluno_id)?.nome_completo || ""}
                    selectedId={formData.aluno_id || undefined}
                    onSelect={(item) =>
                      setFormData((prev) => ({ ...prev, aluno_id: item ? item.id : "" }))
                    }
                    onClear={() => setFormData((prev) => ({ ...prev, aluno_id: "" }))}
                    searchFn={async (term) => {
                      const results = await searchAlunos(term);
                      return results.filter((r) => !isStudentAllocated(r.id));
                    }}
                    minSearchLength={1}
                    emptyMessage={
                      availableStudents.length === 0
                        ? "Nenhum aluno disponível (todos já alocados)"
                        : "Nenhum aluno encontrado"
                    }
                    silent
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alojamento_id">Quarto *</Label>
                  <SmartSearch
                    placeholder="Digite bloco ou número do quarto..."
                    value={
                      availableRooms.find((a) => a.id === formData.alojamento_id)
                        ? `${availableRooms.find((a) => a.id === formData.alojamento_id)?.nome_bloco} - ${availableRooms.find((a) => a.id === formData.alojamento_id)?.numero_quarto}`
                        : ""
                    }
                    selectedId={formData.alojamento_id || undefined}
                    onSelect={(item) =>
                      setFormData((prev) => ({ ...prev, alojamento_id: item ? item.id : "" }))
                    }
                    onClear={() => setFormData((prev) => ({ ...prev, alojamento_id: "" }))}
                    searchFn={async (term) => {
                      const results = await searchAlojamentos(term);
                      return results.filter((r) =>
                        availableRooms.some((ar) => ar.id === r.id)
                      );
                    }}
                    minSearchLength={1}
                    emptyMessage={
                      availableRooms.length === 0
                        ? "Nenhum quarto disponível no momento"
                        : "Nenhum quarto encontrado"
                    }
                    silent
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_entrada">Data de Entrada *</Label>
                  <Input
                    id="data_entrada"
                    type="date"
                    value={formData.data_entrada}
                    onChange={(e) =>
                      setFormData({ ...formData, data_entrada: e.target.value })
                    }
                    required
                  />
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
                    disabled={
                      createMutation.isPending ||
                      !formData.aluno_id ||
                      !formData.alojamento_id
                    }
                  >
                    {createMutation.isPending ? "Alocando..." : "Alocar"}
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
              placeholder="Buscar por nome do aluno..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="w-full sm:w-[220px]">
            <SmartSearch
              placeholder="Buscar quarto por bloco ou número..."
              value={
                alojamentoFilter === "all"
                  ? ""
                  : (() => {
                      const a = alojamentos?.find((x) => x.id === alojamentoFilter);
                      return a ? `${a.nome_bloco || ""} - ${a.numero_quarto || ""}` : "";
                    })()
              }
              selectedId={alojamentoFilter === "all" ? undefined : alojamentoFilter}
              onSelect={(item) => setAlojamentoFilter(item ? item.id : "all")}
              onClear={() => setAlojamentoFilter("all")}
              searchFn={async (term) => {
                const search = term.toLowerCase().trim();
                return (alojamentos || [])
                  .filter(
                    (a) =>
                      (a.nome_bloco || "").toLowerCase().includes(search) ||
                      (a.numero_quarto || "").toLowerCase().includes(search)
                  )
                  .slice(0, 15)
                  .map((a) => ({
                    id: a.id,
                    nome: `${a.nome_bloco || ""} - ${a.numero_quarto || ""}`,
                    nomeCompleto: `${a.nome_bloco || ""} - ${a.numero_quarto || ""}`,
                    complemento: a.capacidade ? `Capacidade: ${a.capacidade}` : "",
                  }));
              }}
              minSearchLength={1}
              emptyMessage="Nenhum quarto encontrado"
              silent
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Ativo">Ativo</SelectItem>
              <SelectItem value="Inativo">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {availableRooms.length === 0 && alojamentos && alojamentos.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 dark:text-yellow-200 text-sm flex items-center gap-2">
              <Home className="h-4 w-4" />
              Nenhum quarto disponível no momento. Todos os quartos estão ocupados ou em manutenção.
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : filteredAlocacoes?.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground">
              Nenhuma alocação encontrada
            </h3>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {searchTerm || alojamentoFilter !== "all" || statusFilter !== "all"
                ? "Não existem registos que correspondam aos critérios selecionados. Sugerimos que ajuste os filtros aplicados."
                : "Não existem alocações registadas. Utilize o botão \"Nova Alocação\" para efectuar a primeira alocação."}
            </p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto -mx-1 sm:mx-0 max-w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Quarto</TableHead>
                  <TableHead>Data Entrada</TableHead>
                  <TableHead>Data Saída</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlocacoes?.map((alocacao) => (
                  <TableRow key={alocacao.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{alocacao.aluno?.nome_completo}</p>
                        <p className="text-sm text-muted-foreground">
                          {alocacao.aluno?.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {alocacao.alojamento?.nome_bloco} - {alocacao.alojamento?.numero_quarto}
                    </TableCell>
                    <TableCell>
                      {format(new Date(alocacao.data_entrada), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {alocacao.data_saida
                        ? format(new Date(alocacao.data_saida), "dd/MM/yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          alocacao.status === "Ativo"
                            ? "bg-green-500 hover:bg-green-600"
                            : "bg-gray-500 hover:bg-gray-600"
                        }
                      >
                        {alocacao.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {alocacao.status === "Ativo" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              id: alocacao.id,
                              status: "Inativo",
                            })
                          }
                          disabled={updateStatusMutation.isPending}
                        >
                          Encerrar
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-2"
                        onClick={() => {
                          setSelectedAlocacao(alocacao);
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
              <AlertDialogTitle>Excluir Alocação</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta alocação? Esta ação não pode
                ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  selectedAlocacao && deleteMutation.mutate(selectedAlocacao.id)
                }
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