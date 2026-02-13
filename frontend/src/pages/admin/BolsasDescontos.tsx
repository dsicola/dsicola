import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import { bolsasApi, alunoBolsasApi, userRolesApi, profilesApi } from "@/services/api";
import { useTenantFilter } from "@/hooks/useTenantFilter";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Plus, Pencil, Trash2, Percent, DollarSign, Users, Gift } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Bolsa {
  id: string;
  nome: string;
  tipo: string;
  valor: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

interface AlunoBolsa {
  id: string;
  aluno_id: string;
  bolsa_id: string;
  data_inicio: string;
  data_fim: string | null;
  ativo: boolean;
  observacao: string | null;
  aluno: { nome_completo: string; email: string };
  bolsa: { nome: string; tipo: string; valor: number };
}

export default function BolsasDescontos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { instituicaoId, shouldFilter } = useTenantFilter();
  
  const [showBolsaDialog, setShowBolsaDialog] = useSafeDialog(false);
  const [showAplicarDialog, setShowAplicarDialog] = useSafeDialog(false);
  const [showDeleteDialog, setShowDeleteDialog] = useSafeDialog(false);
  const [editingBolsa, setEditingBolsa] = useState<Bolsa | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nome: "",
    tipo: "percentual",
    valor: "",
    descricao: "",
    ativo: true,
  });

  const [aplicarData, setAplicarData] = useState({
    aluno_id: "",
    bolsa_id: "",
    data_inicio: new Date().toISOString().split("T")[0],
    data_fim: "",
    observacao: "",
  });

  // Buscar bolsas
  const { data: bolsas, isLoading: loadingBolsas } = useQuery({
    queryKey: ["bolsas"],
    queryFn: async () => {
      return await bolsasApi.getAll();
    },
  });

  // Buscar alunos da instituição atual
  const { data: alunosInstituicao } = useQuery({
    queryKey: ["alunos-instituicao", instituicaoId],
    queryFn: async () => {
      if (!shouldFilter || !instituicaoId) return [];
      
      const rolesData = await userRolesApi.getByRole("ALUNO", instituicaoId);
      return rolesData.map((r: any) => r.user_id);
    },
    enabled: shouldFilter && !!instituicaoId,
  });

  // Buscar aplicações de bolsas filtradas por alunos da instituição
  const { data: aplicacoes, isLoading: loadingAplicacoes } = useQuery({
    queryKey: ["aluno-bolsas", instituicaoId, alunosInstituicao, shouldFilter],
    queryFn: async () => {
      const allAplicacoes = await alunoBolsasApi.getAll();
      
      // Se não deve filtrar (ex: SUPER_ADMIN), retornar todas as aplicações
      if (!shouldFilter) {
        return allAplicacoes as AlunoBolsa[];
      }

      // Se deve filtrar, filtrar por alunos da instituição
      if (!alunosInstituicao || alunosInstituicao.length === 0) {
        return [] as AlunoBolsa[];
      }

      return allAplicacoes.filter((ap: any) => {
        const alunoId = ap.alunoId || ap.aluno_id;
        return alunoId && alunosInstituicao.includes(alunoId);
      });
    },
    enabled: !shouldFilter || !!alunosInstituicao,
  });

  // Buscar alunos para seleção (apenas da instituição atual)
  const { data: alunos } = useQuery({
    queryKey: ["alunos-selecao", instituicaoId],
    queryFn: async () => {
      if (!shouldFilter || !instituicaoId) return [];
      
      const rolesData = await userRolesApi.getByRole("ALUNO", instituicaoId);
      const alunoIds = rolesData.map((r: any) => r.user_id);
      
      if (alunoIds.length === 0) return [];

      const profiles = await Promise.all(
        alunoIds.map((id: string) => profilesApi.getById(id).catch(() => null))
      );
      
      return profiles.filter((p: any) => p && p.status_aluno === "Ativo");
    },
    enabled: !!instituicaoId,
  });

  // Criar/Atualizar bolsa
  const bolsaMutation = useMutation({
    mutationFn: async (data: typeof formData & { id?: string }) => {
      // Converter tipo para maiúsculas
      const tipoUpper = data.tipo === 'percentual' ? 'PERCENTUAL' : 'VALOR';
      const valorNum = Number(data.valor);
      
      // O schema do Prisma só tem campo 'valor', então armazenamos percentual ou valor fixo em 'valor'
      const payload: any = {
        nome: data.nome,
        tipo: tipoUpper,
        valor: valorNum, // Sempre enviar como 'valor', o tipo indica se é percentual ou valor fixo
        descricao: data.descricao || null,
        ativo: data.ativo,
      };
      
      if (data.id) {
        await bolsasApi.update(data.id, payload);
      } else {
        await bolsasApi.create(payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bolsas"] });
      setShowBolsaDialog(false);
      resetBolsaForm();
      toast({
        title: editingBolsa ? "Bolsa atualizada" : "Bolsa criada",
        description: editingBolsa ? "A bolsa foi atualizada com sucesso." : "A bolsa foi criada com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Aplicar bolsa a aluno
  const aplicarMutation = useMutation({
    mutationFn: async (data: typeof aplicarData) => {
      await alunoBolsasApi.create({
        alunoId: data.aluno_id,
        bolsaId: data.bolsa_id,
        dataInicio: data.data_inicio,
        dataFim: data.data_fim || undefined,
        observacao: data.observacao || undefined,
        ativo: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-bolsas"] });
      setShowAplicarDialog(false);
      resetAplicarForm();
      toast({
        title: "Bolsa aplicada",
        description: "A bolsa foi aplicada ao aluno com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Deletar bolsa
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await bolsasApi.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bolsas"] });
      setShowDeleteDialog(false);
      setDeletingId(null);
      toast({ title: "Bolsa excluída", description: "A bolsa foi excluída com sucesso." });
    },
    onError: (error: Error) => {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    },
  });

  // Toggle ativo de aplicação
  const toggleAplicacaoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      await alunoBolsasApi.update(id, { ativo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aluno-bolsas"] });
    },
  });

  const resetBolsaForm = () => {
    setFormData({ nome: "", tipo: "percentual", valor: "", descricao: "", ativo: true });
    setEditingBolsa(null);
  };

  const resetAplicarForm = () => {
    setAplicarData({
      aluno_id: "",
      bolsa_id: "",
      data_inicio: new Date().toISOString().split("T")[0],
      data_fim: "",
      observacao: "",
    });
  };

  const handleEditBolsa = (bolsa: Bolsa) => {
    setEditingBolsa(bolsa);
    // Converter tipo de maiúsculas para minúsculas para o formulário
    const tipoForm = bolsa.tipo.toLowerCase() === 'percentual' ? 'percentual' : 'fixo';
    setFormData({
      nome: bolsa.nome,
      tipo: tipoForm,
      valor: bolsa.valor.toString(),
      descricao: bolsa.descricao || "",
      ativo: bolsa.ativo,
    });
    setShowBolsaDialog(true);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value);
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "-";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Gift className="h-8 w-8" />
              Gestão de Bolsas e Descontos
            </h1>
            <p className="text-muted-foreground">Cadastre e aplique bolsas/descontos aos alunos</p>
          </div>
        </div>

        <Tabs defaultValue="bolsas" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bolsas">
              <Percent className="h-4 w-4 mr-2" />
              Tipos de Bolsas
            </TabsTrigger>
            <TabsTrigger value="aplicacoes">
              <Users className="h-4 w-4 mr-2" />
              Bolsas Aplicadas
            </TabsTrigger>
          </TabsList>

          {/* Tipos de Bolsas */}
          <TabsContent value="bolsas">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tipos de Bolsas/Descontos</CardTitle>
                    <CardDescription>Cadastre os tipos de bolsas disponíveis</CardDescription>
                  </div>
                  <Button onClick={() => setShowBolsaDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Bolsa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingBolsas ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : bolsas && bolsas.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bolsas.map((bolsa: Bolsa) => (
                          <TableRow key={bolsa.id}>
                            <TableCell className="font-medium">{bolsa.nome}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {bolsa.tipo === "percentual" ? (
                                  <><Percent className="h-3 w-3 mr-1" />Percentual</>
                                ) : (
                                  <><DollarSign className="h-3 w-3 mr-1" />Valor Fixo</>
                                )}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {bolsa.tipo === "percentual" ? `${bolsa.valor}%` : formatCurrency(bolsa.valor)}
                            </TableCell>
                            <TableCell>
                              <Badge variant={bolsa.ativo ? "outline" : "destructive"} className={bolsa.ativo ? "border-green-500 bg-green-50 text-green-700" : ""}>
                                {bolsa.ativo ? "Ativa" : "Inativa"}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground">
                              {bolsa.descricao || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleEditBolsa(bolsa)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() => {
                                    setDeletingId(bolsa.id);
                                    setShowDeleteDialog(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma bolsa cadastrada</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Bolsas Aplicadas */}
          <TabsContent value="aplicacoes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bolsas Aplicadas aos Alunos</CardTitle>
                    <CardDescription>Gerencie as bolsas atribuídas aos alunos</CardDescription>
                  </div>
                  <Button onClick={() => setShowAplicarDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Aplicar Bolsa
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAplicacoes ? (
                  <p className="text-center text-muted-foreground py-8">Carregando...</p>
                ) : aplicacoes && aplicacoes.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aluno</TableHead>
                          <TableHead>Bolsa</TableHead>
                          <TableHead>Desconto</TableHead>
                          <TableHead>Período</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ativo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aplicacoes.map((ap: AlunoBolsa) => (
                          <TableRow key={ap.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{ap.aluno?.nome_completo}</p>
                                <p className="text-sm text-muted-foreground">{ap.aluno?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>{ap.bolsa?.nome}</TableCell>
                            <TableCell>
                              {ap.bolsa?.tipo === "percentual"
                                ? `${ap.bolsa?.valor}%`
                                : formatCurrency(ap.bolsa?.valor || 0)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {formatDate(ap.data_inicio)}
                              {ap.data_fim && ` - ${formatDate(ap.data_fim)}`}
                            </TableCell>
                            <TableCell>
                              <Badge variant={ap.ativo ? "outline" : "destructive"} className={ap.ativo ? "border-green-500 bg-green-50 text-green-700" : ""}>
                                {ap.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Switch
                                checked={ap.ativo}
                                onCheckedChange={(checked) => {
                                  toggleAplicacaoMutation.mutate({ id: ap.id, ativo: checked });
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">Nenhuma bolsa aplicada</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialog Criar/Editar Bolsa */}
      <Dialog open={showBolsaDialog} onOpenChange={(open) => { if (!open) resetBolsaForm(); setShowBolsaDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBolsa ? "Editar Bolsa" : "Nova Bolsa"}</DialogTitle>
            <DialogDescription>
              {editingBolsa ? "Atualize os dados da bolsa" : "Cadastre um novo tipo de bolsa/desconto"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Bolsa *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData((prev) => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: Bolsa Mérito"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Desconto</Label>
              <Select value={formData.tipo} onValueChange={(v) => setFormData((prev) => ({ ...prev, tipo: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="!z-[9999]">
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="fixo">Valor Fixo (Kz)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor *</Label>
              <Input
                type="number"
                value={formData.valor}
                onChange={(e) => setFormData((prev) => ({ ...prev, valor: e.target.value }))}
                placeholder={formData.tipo === "percentual" ? "Ex: 50" : "Ex: 25000"}
              />
              <p className="text-xs text-muted-foreground">
                {formData.tipo === "percentual" ? "Percentual de desconto" : "Valor fixo do desconto em Kwanzas"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={formData.descricao}
                onChange={(e) => setFormData((prev) => ({ ...prev, descricao: e.target.value }))}
                placeholder="Descrição opcional..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, ativo: checked }))}
              />
              <Label>Bolsa Ativa</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { resetBolsaForm(); setShowBolsaDialog(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => bolsaMutation.mutate({ ...formData, id: editingBolsa?.id })}
              disabled={!formData.nome || !formData.valor || bolsaMutation.isPending}
            >
              {editingBolsa ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Aplicar Bolsa */}
      <Dialog open={showAplicarDialog} onOpenChange={(open) => { if (!open) resetAplicarForm(); setShowAplicarDialog(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar Bolsa a Aluno</DialogTitle>
            <DialogDescription>Selecione o aluno e a bolsa a ser aplicada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Aluno *</Label>
              <Select value={aplicarData.aluno_id} onValueChange={(v) => setAplicarData((prev) => ({ ...prev, aluno_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o aluno" />
                </SelectTrigger>
                <SelectContent className="!z-[9999]">
                  {alunos?.filter((aluno: any) => {
                    const id = aluno?.id;
                    return id && typeof id === 'string' && id.trim() !== "" && aluno?.nome_completo;
                  }).map((aluno: any) => {
                    const id = String(aluno.id).trim();
                    return id ? (
                      <SelectItem key={id} value={id}>
                        {aluno.nome_completo}
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bolsa *</Label>
              <Select value={aplicarData.bolsa_id} onValueChange={(v) => setAplicarData((prev) => ({ ...prev, bolsa_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a bolsa" />
                </SelectTrigger>
                <SelectContent className="!z-[9999]">
                  {bolsas?.filter((b: Bolsa) => {
                    const id = b?.id;
                    return b && b.ativo && id && typeof id === 'string' && id.trim() !== "" && b.nome;
                  }).map((bolsa: Bolsa) => {
                    const id = String(bolsa.id).trim();
                    return id ? (
                      <SelectItem key={id} value={id}>
                        {bolsa.nome} ({bolsa.tipo === "percentual" ? `${bolsa.valor}%` : formatCurrency(bolsa.valor)})
                      </SelectItem>
                    ) : null;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início *</Label>
                <Input
                  type="date"
                  value={aplicarData.data_inicio}
                  onChange={(e) => setAplicarData((prev) => ({ ...prev, data_inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim (opcional)</Label>
                <Input
                  type="date"
                  value={aplicarData.data_fim}
                  onChange={(e) => setAplicarData((prev) => ({ ...prev, data_fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={aplicarData.observacao}
                onChange={(e) => setAplicarData((prev) => ({ ...prev, observacao: e.target.value }))}
                placeholder="Observação opcional..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { resetAplicarForm(); setShowAplicarDialog(false); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => aplicarMutation.mutate(aplicarData)}
              disabled={!aplicarData.aluno_id || !aplicarData.bolsa_id || aplicarMutation.isPending}
            >
              Aplicar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta bolsa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
