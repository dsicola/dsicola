/**
 * Secção para gerir encarregados vinculados a um aluno.
 * Usado em ViewAlunoDialog e EditarAluno.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { responsavelAlunosApi, usersApi } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Plus, Trash2, Mail, Loader2 } from "lucide-react";
import { useState } from "react";

const PARENTESCO_OPCOES = [
  { value: "Pai", label: "Pai" },
  { value: "Mãe", label: "Mãe" },
  { value: "Tio", label: "Tio" },
  { value: "Tia", label: "Tia" },
  { value: "Avô", label: "Avô" },
  { value: "Avó", label: "Avó" },
  { value: "Outro", label: "Outro" },
];

interface EncarregadoVinculado {
  id: string;
  responsavelId: string;
  alunoId: string;
  parentesco: string;
  principal?: boolean;
  responsavel?: { id: string; nomeCompleto?: string; email?: string };
}

interface EncarregadosAlunoSectionProps {
  alunoId: string;
  readOnly?: boolean;
}

export function EncarregadosAlunoSection({ alunoId, readOnly = false }: EncarregadosAlunoSectionProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [modoAdd, setModoAdd] = useState<"criar" | "vincular">("criar");
  const [addForm, setAddForm] = useState({
    email: "",
    senha: "",
    nomeCompleto: "",
    parentesco: "Pai",
    responsavelId: "",
  });

  const { data: vinculos = [], isLoading } = useQuery({
    queryKey: ["responsavel-alunos", alunoId],
    queryFn: async () => {
      const res = await responsavelAlunosApi.getAll({ alunoId });
      return Array.isArray(res) ? res : [];
    },
    enabled: !!alunoId,
  });

  const { data: responsaveisExistentes = [] } = useQuery({
    queryKey: ["users-responsavel"],
    queryFn: async () => {
      const res = await usersApi.getAll({ role: "RESPONSAVEL" });
      const data = res?.data ?? res ?? [];
      return Array.isArray(data) ? data : [];
    },
    enabled: showAddDialog && modoAdd === "vincular",
  });

  const createVinculoMutation = useMutation({
    mutationFn: async (data: { responsavelId: string; parentesco: string }) => {
      return responsavelAlunosApi.create({
        responsavelId: data.responsavelId,
        alunoId,
        parentesco: data.parentesco,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsavel-alunos", alunoId] });
      queryClient.invalidateQueries({ queryKey: ["alunos-vinculados"] });
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      setShowAddDialog(false);
      setAddForm({ email: "", senha: "", nomeCompleto: "", parentesco: "Pai", responsavelId: "" });
      toast.success("Encarregado vinculado com sucesso");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erro ao vincular encarregado");
    },
  });

  const createUserAndVinculoMutation = useMutation({
    mutationFn: async () => {
      const userRes = await usersApi.create({
        email: addForm.email.trim().toLowerCase(),
        password: addForm.senha,
        nomeCompleto: addForm.nomeCompleto.trim() || "Encarregado",
        role: "RESPONSAVEL",
      });
      const responsavelId = userRes?.id ?? userRes?.userId;
      if (!responsavelId) throw new Error("Erro ao criar utilizador");
      await responsavelAlunosApi.create({
        responsavelId,
        alunoId,
        parentesco: addForm.parentesco,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsavel-alunos", alunoId] });
      queryClient.invalidateQueries({ queryKey: ["users-responsavel"] });
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      setShowAddDialog(false);
      setAddForm({ email: "", senha: "", nomeCompleto: "", parentesco: "Pai", responsavelId: "" });
      toast.success("Encarregado criado e vinculado com sucesso");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erro ao criar encarregado");
    },
  });

  const deleteVinculoMutation = useMutation({
    mutationFn: (vinculoId: string) => responsavelAlunosApi.delete(vinculoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["responsavel-alunos", alunoId] });
      queryClient.invalidateQueries({ queryKey: ["alunos-vinculados"] });
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      toast.success("Vínculo removido");
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || "Erro ao remover vínculo");
    },
  });

  const handleAddSubmit = () => {
    if (modoAdd === "vincular") {
      if (!addForm.responsavelId) {
        toast.error("Selecione o encarregado");
        return;
      }
      createVinculoMutation.mutate({
        responsavelId: addForm.responsavelId,
        parentesco: addForm.parentesco,
      });
    } else {
      // criar
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!addForm.email?.trim()) {
        toast.error("Email é obrigatório");
        return;
      }
      if (!emailRegex.test(addForm.email.trim())) {
        toast.error("Email inválido");
        return;
      }
      if (!addForm.senha || addForm.senha.length < 6) {
        toast.error("Senha deve ter pelo menos 6 caracteres");
        return;
      }
      createUserAndVinculoMutation.mutate();
    }
  };

  const vinculosList = vinculos as EncarregadoVinculado[];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold border-b pb-2 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Encarregados com Conta de Acesso
        </h4>
        {!readOnly && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : vinculosList.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum encarregado com conta de acesso vinculado.{" "}
          {!readOnly && "Clique em Adicionar para criar ou vincular."}
        </p>
      ) : (
        <div className="space-y-2">
          {vinculosList.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">
                    {v.responsavel?.nomeCompleto || v.responsavel?.nome_completo || "Encarregado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {v.responsavel?.email || ""}
                  </p>
                </div>
                <Badge variant="secondary">{v.parentesco}</Badge>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteVinculoMutation.mutate(v.id)}
                  disabled={deleteVinculoMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Encarregado</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Modo</Label>
              <Select value={modoAdd} onValueChange={(v: "criar" | "vincular") => setModoAdd(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="criar">Criar nova conta</SelectItem>
                  <SelectItem value="vincular">Vincular encarregado existente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {modoAdd === "criar" && (
              <>
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input
                    value={addForm.nomeCompleto}
                    onChange={(e) => setAddForm((f) => ({ ...f, nomeCompleto: e.target.value }))}
                    placeholder="Nome do encarregado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    value={addForm.email}
                    onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="encarregado@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha *</Label>
                  <Input
                    type="password"
                    value={addForm.senha}
                    onChange={(e) => setAddForm((f) => ({ ...f, senha: e.target.value }))}
                    placeholder="Mín. 6 caracteres"
                  />
                </div>
              </>
            )}

            {modoAdd === "vincular" && (
              <div className="space-y-2">
                <Label>Encarregado existente *</Label>
                <Select
                  value={addForm.responsavelId}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, responsavelId: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {responsaveisExistentes
                      .filter((r: any) => !vinculosList.some((v) => v.responsavelId === r.id))
                      .map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nomeCompleto || r.nome_completo || r.email} ({r.email})
                        </SelectItem>
                      ))}
                    {responsaveisExistentes.filter((r: any) => !vinculosList.some((v) => v.responsavelId === r.id)).length === 0 && (
                      <SelectItem value="_" disabled>
                        {responsaveisExistentes.length === 0
                          ? "Nenhum encarregado cadastrado"
                          : "Todos os encarregados já estão vinculados"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Parentesco</Label>
              <Select
                value={addForm.parentesco}
                onValueChange={(v) => setAddForm((f) => ({ ...f, parentesco: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PARENTESCO_OPCOES.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddSubmit}
              disabled={
                createVinculoMutation.isPending || createUserAndVinculoMutation.isPending
              }
            >
              {(createVinculoMutation.isPending || createUserAndVinculoMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {modoAdd === "vincular" ? "Vincular" : "Criar e vincular"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
