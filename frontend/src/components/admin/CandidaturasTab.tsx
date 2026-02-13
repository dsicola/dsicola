import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeMutation } from "@/hooks/useSafeMutation";
import { candidaturasApi, cursosApi } from "@/services/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  User,
  Mail,
  Phone,
  FileText,
  RefreshCw,
  Link2,
  Copy,
  ExternalLink
} from "lucide-react";
import { useTenant } from "@/contexts/TenantContext";
import { useTenantFilter } from "@/hooks/useTenantFilter";

interface Candidatura {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string | null;
  numeroIdentificacao: string;
  dataNascimento: string | null;
  genero: string | null;
  morada: string | null;
  cidade: string | null;
  pais: string | null;
  cursoPretendido: string | null;
  turnoPreferido: string | null;
  status: string;
  observacoes: string | null;
  dataCandidatura: string;
  dataAnalise: string | null;
  curso?: {
    nome: string;
    codigo: string;
  };
}

export function CandidaturasTab() {
  const queryClient = useQueryClient();
  const { instituicao } = useTenant();
  const { instituicaoId, isSuperAdmin } = useTenantFilter();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [selectedCandidatura, setSelectedCandidatura] = useState<Candidatura | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [novoStatus, setNovoStatus] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Generate the public inscription URL
  const getInscricaoUrl = () => {
    const baseUrl = window.location.origin;
    if (instituicao?.subdominio) {
      return `${baseUrl}/inscricao/${instituicao.subdominio}`;
    }
    return `${baseUrl}/inscricao`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInscricaoUrl());
    toast({
      title: "Link copiado!",
      description: "O link de inscrição foi copiado para a área de transferência.",
    });
  };

  const handleOpenLink = () => {
    window.open(getInscricaoUrl(), '_blank');
  };

  // Enable query if user has instituicaoId OR is SUPER_ADMIN
  // Backend will filter by JWT token's instituicaoId anyway, so we can always enable it
  const { 
    data: candidaturas = [], 
    isLoading, 
    isError,
    error,
    refetch 
  } = useQuery({
    queryKey: ["candidaturas", instituicaoId, isSuperAdmin],
    queryFn: async () => {
      try {
        // Only pass instituicaoId if it's explicitly set and user is SUPER_ADMIN
        // Otherwise, backend will use JWT token's instituicaoId
        const params = isSuperAdmin && instituicaoId ? { instituicaoId } : {};
        const data = await candidaturasApi.getAll(params);
        return data as Candidatura[];
      } catch (err: any) {
        // Log error for debugging
        console.error('Erro ao carregar candidaturas:', err);
        throw err;
      }
    },
    enabled: true, // Always enabled - backend handles filtering via JWT token
    retry: 1, // Retry once on failure
  });

  const { data: cursos = [] } = useQuery({
    queryKey: ["cursos-candidaturas", instituicaoId, isSuperAdmin],
    queryFn: async () => {
      const params = isSuperAdmin && instituicaoId ? { instituicaoId } : {};
      return await cursosApi.getAll(params);
    },
    enabled: true, // Always enabled - backend handles filtering via JWT token
  });

  const updateMutation = useSafeMutation({
    mutationFn: async ({ id, status, observacoes }: { id: string; status: string; observacoes: string }) => {
      await candidaturasApi.update(id, { status, observacoes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidaturas"] });
      setShowDialog(false);
      setSelectedCandidatura(null);
      toast({
        title: "Candidatura atualizada",
        description: "O status da candidatura foi atualizado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getCursoNome = (cursoId: string | null) => {
    if (!cursoId) return "-";
    const curso = cursos.find((c: any) => c.id === cursoId);
    return curso?.nome || "-";
  };

  // Normalizar status para comparação (aceitar tanto lowercase quanto title case)
  const normalizeStatus = (status: string) => status.toLowerCase();

  const filteredCandidaturas = candidaturas.filter((c) => {
    const matchesSearch =
      c.nomeCompleto.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.numeroIdentificacao.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "todos" || normalizeStatus(c.status) === normalizeStatus(statusFilter);

    return matchesSearch && matchesStatus;
  });
  
  const stats = {
    total: candidaturas.length,
    pendentes: candidaturas.filter(c => normalizeStatus(c.status) === "pendente").length,
    aprovadas: candidaturas.filter(c => normalizeStatus(c.status) === "aprovada").length,
    rejeitadas: candidaturas.filter(c => normalizeStatus(c.status) === "rejeitada").length,
  };

  const getStatusBadge = (status: string) => {
    const statusNormalizado = normalizeStatus(status);
    switch (statusNormalizado) {
      case "aprovada":
        return <Badge className="bg-green-500/10 text-green-500"><CheckCircle className="h-3 w-3 mr-1" /> Aprovada</Badge>;
      case "rejeitada":
        return <Badge className="bg-destructive/10 text-destructive"><XCircle className="h-3 w-3 mr-1" /> Rejeitada</Badge>;
      case "em análise":
        return <Badge className="bg-blue-500/10 text-blue-500"><Clock className="h-3 w-3 mr-1" /> Em Análise</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  const handleView = (candidatura: Candidatura) => {
    setSelectedCandidatura(candidatura);
    // Normalizar status para garantir lowercase
    setNovoStatus(normalizeStatus(candidatura.status));
    setObservacoes(candidatura.observacoes || "");
    setShowDialog(true);
  };

  const handleUpdate = () => {
    if (!selectedCandidatura) return;
    
    // Normalizar status para lowercase
    const statusNormalizado = normalizeStatus(novoStatus);
    
    updateMutation.mutate({
      id: selectedCandidatura.id,
      status: statusNormalizado,
      observacoes,
    });
  };

  // Mutations para aprovar e rejeitar
  const aprovarMutation = useSafeMutation({
    mutationFn: async (id: string) => {
      return await candidaturasApi.aprovar(id);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["candidaturas"] });
      setShowDialog(false);
      setSelectedCandidatura(null);
      toast({
        title: "Candidatura aprovada!",
        description: data.message || "Aluno criado e matriculado com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rejeitarMutation = useSafeMutation({
    mutationFn: async ({ id, observacoes }: { id: string; observacoes?: string }) => {
      return await candidaturasApi.rejeitar(id, observacoes);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidaturas"] });
      setShowDialog(false);
      setSelectedCandidatura(null);
      toast({
        title: "Candidatura rejeitada",
        description: "A candidatura foi rejeitada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAprovar = () => {
    if (!selectedCandidatura) return;
    aprovarMutation.mutate(selectedCandidatura.id);
  };

  const handleRejeitar = () => {
    if (!selectedCandidatura) return;
    rejeitarMutation.mutate({
      id: selectedCandidatura.id,
      observacoes: observacoes || undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Link de Inscrição Pública */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Link de Inscrição Online</h3>
                <p className="text-sm text-muted-foreground">
                  Compartilhe este link com candidatos para se inscreverem
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 md:flex-none">
                <Input 
                  value={getInscricaoUrl()} 
                  readOnly 
                  className="bg-background text-sm md:w-80"
                />
              </div>
              <Button variant="outline" size="icon" onClick={handleCopyLink} title="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleOpenLink} title="Abrir em nova aba">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total de Candidaturas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-500">{stats.pendentes}</div>
            <p className="text-sm text-muted-foreground">Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{stats.aprovadas}</div>
            <p className="text-sm text-muted-foreground">Aprovadas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-destructive">{stats.rejeitadas}</div>
            <p className="text-sm text-muted-foreground">Rejeitadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Candidaturas</CardTitle>
              <CardDescription>Gerencie as candidaturas recebidas</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou BI..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em análise">Em Análise</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="rejeitada">Rejeitada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>BI</TableHead>
                  <TableHead>Curso</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Carregando candidaturas...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-3">
                        <div className="text-destructive">
                          <XCircle className="h-8 w-8 mx-auto mb-2" />
                          <p className="font-medium">Erro ao carregar candidaturas</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {error instanceof Error ? error.message : 'Ocorreu um erro inesperado'}
                          </p>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Tentar novamente
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredCandidaturas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground font-medium">Nenhuma candidatura encontrada</p>
                        <p className="text-sm text-muted-foreground">
                          {searchTerm || statusFilter !== "todos" 
                            ? "Tente ajustar os filtros de busca"
                            : "Ainda não há candidaturas cadastradas"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCandidaturas.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nomeCompleto}</TableCell>
                      <TableCell>{c.email}</TableCell>
                      <TableCell>{c.numeroIdentificacao}</TableCell>
                      <TableCell>{c.curso?.nome || getCursoNome(c.cursoPretendido)}</TableCell>
                      <TableCell>{format(new Date(c.dataCandidatura), "dd/MM/yyyy")}</TableCell>
                      <TableCell>{getStatusBadge(c.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleView(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Candidatura</DialogTitle>
            <DialogDescription>
              Visualize e atualize o status da candidatura
            </DialogDescription>
          </DialogHeader>

          {selectedCandidatura && (
            <div className="space-y-6">
              {/* Personal Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedCandidatura.nomeCompleto}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedCandidatura.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{selectedCandidatura.telefone || "-"}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">BI</p>
                    <p className="font-medium">{selectedCandidatura.numeroIdentificacao}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Curso Pretendido</p>
                    <p className="font-medium">{selectedCandidatura.curso?.nome || getCursoNome(selectedCandidatura.cursoPretendido)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Turno</p>
                    <p className="font-medium">{selectedCandidatura.turnoPreferido || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cidade</p>
                    <p className="font-medium">{selectedCandidatura.cidade || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Nascimento</p>
                    <p className="font-medium">
                      {selectedCandidatura.dataNascimento 
                        ? format(new Date(selectedCandidatura.dataNascimento), "dd/MM/yyyy")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Update */}
              <div className="border-t pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select value={novoStatus} onValueChange={setNovoStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="em análise">Em Análise</SelectItem>
                      <SelectItem value="aprovada">Aprovada</SelectItem>
                      <SelectItem value="rejeitada">Rejeitada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Observações</label>
                  <Textarea
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Adicione observações sobre a candidatura..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            {selectedCandidatura && normalizeStatus(selectedCandidatura.status) === "pendente" && (
              <>
                <Button 
                  variant="destructive" 
                  onClick={handleRejeitar} 
                  disabled={rejeitarMutation.isPending}
                >
                  {rejeitarMutation.isPending ? "Rejeitando..." : "Rejeitar"}
                </Button>
                <Button 
                  onClick={handleAprovar} 
                  disabled={aprovarMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {aprovarMutation.isPending ? "Aprovando..." : "Aprovar Candidatura"}
                </Button>
              </>
            )}
            {selectedCandidatura && normalizeStatus(selectedCandidatura.status) !== "pendente" && (
              <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Salvando..." : "Salvar Observações"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}