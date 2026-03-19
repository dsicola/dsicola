/**
 * Taxas e Serviços - Aba independente para configurar itens cobráveis
 * 
 * REGRAS OBRIGATÓRIAS:
 * - Multi-tenant: apenas dados da instituição do utilizador
 * - Isolamento por tipo: Ensino Superior vê APENAS Cursos | Ensino Secundário vê APENAS Classes
 * - Nenhuma informação de Ensino Superior aparece no Ensino Secundário e vice-versa
 * - Separação clara: Taxa matrícula, Mensalidade, Bata, Passe, Emissão Declaração, Emissão Certificado
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useSafeDialog } from "@/hooks/useSafeDialog";
import {
  configuracoesInstituicaoApi,
  cursosApi,
  classesApi,
} from "@/services/api";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "@/hooks/use-toast";
import {
  Receipt,
  GraduationCap,
  School,
  Pencil,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(value);

export default function TaxasServicos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { config, tipoAcademico, isSuperior, isSecundario } = useInstituicao();
  const [editConfigDialogOpen, setEditConfigDialogOpen] = useSafeDialog(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useSafeDialog(false);
  const [editItem, setEditItem] = useState<
    | { type: "curso"; id: string; nome: string; data: Record<string, unknown> }
    | { type: "classe"; id: string; nome: string; data: Record<string, unknown> }
    | null
  >(null);

  // Valores do formulário de config institucional
  const [configForm, setConfigForm] = useState({
    taxaMatriculaPadrao: "",
    mensalidadePadrao: "",
    valorEmissaoDeclaracao: "",
    valorEmissaoCertificado: "",
    valorPasse: "",
  });

  // Formulário de edição de item (curso/classe)
  const [itemForm, setItemForm] = useState({
    taxaMatricula: "" as string | number,
    valorMensalidade: "" as string | number,
    valorBata: "" as string | number,
    exigeBata: false,
    valorPasse: "" as string | number,
    exigePasse: false,
    valorEmissaoDeclaracao: "" as string | number,
    valorEmissaoCertificado: "" as string | number,
  });

  // Fetch cursos (APENAS Ensino Superior)
  const { data: cursos = [], refetch: refetchCursos } = useQuery({
    queryKey: ["cursos-taxas-servicos"],
    queryFn: () => cursosApi.getAll({ excludeTipo: "classe" }),
    enabled: isSuperior,
  });

  // Fetch classes (APENAS Ensino Secundário)
  const { data: classes = [], refetch: refetchClasses } = useQuery({
    queryKey: ["classes-taxas-servicos"],
    queryFn: () => classesApi.getAll({ ativo: true }),
    enabled: isSecundario,
  });

  // Mutation: atualizar config institucional
  const updateConfigMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      configuracoesInstituicaoApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configuracao"] });
      setEditConfigDialogOpen(false);
      toast({ title: "Valores actualizados", description: "Os valores padrão foram gravados." });
    },
    onError: (err: unknown) => {
      toast({ title: "Erro", description: (err as Error)?.message || "Falha ao actualizar." });
    },
  });

  // Mutation: atualizar curso
  const updateCursoMutation = useMutation({
    mutationFn: ({ id, data, expectedUpdatedAt }: { id: string; data: Record<string, unknown>; expectedUpdatedAt?: string }) =>
      cursosApi.update(id, data, expectedUpdatedAt ? { expectedUpdatedAt } : undefined),
    onSuccess: () => {
      refetchCursos();
      setEditItemDialogOpen(false);
      setEditItem(null);
      toast({ title: "Curso actualizado" });
    },
    onError: (err: unknown) => {
      toast({ title: "Erro", description: (err as Error)?.message || "Falha ao actualizar curso." });
    },
  });

  // Mutation: atualizar classe
  const updateClasseMutation = useMutation({
    mutationFn: ({ id, data, expectedUpdatedAt }: { id: string; data: Record<string, unknown>; expectedUpdatedAt?: string }) =>
      classesApi.update(id, data, expectedUpdatedAt ? { expectedUpdatedAt } : undefined),
    onSuccess: () => {
      refetchClasses();
      setEditItemDialogOpen(false);
      setEditItem(null);
      toast({ title: "Classe actualizada" });
    },
    onError: (err: unknown) => {
      toast({ title: "Erro", description: (err as Error)?.message || "Falha ao actualizar classe." });
    },
  });

  const openEditConfig = () => {
    const c = config;
    setConfigForm({
      taxaMatriculaPadrao: String(c?.taxaMatriculaPadrao ?? c?.taxa_matricula_padrao ?? ""),
      mensalidadePadrao: String(c?.mensalidadePadrao ?? c?.mensalidade_padrao ?? ""),
      valorEmissaoDeclaracao: String(c?.valorEmissaoDeclaracao ?? c?.valor_emissao_declaracao ?? ""),
      valorEmissaoCertificado: String(c?.valorEmissaoCertificado ?? c?.valor_emissao_certificado ?? ""),
      valorPasse: String(c?.valorPasse ?? c?.valor_passe ?? ""),
    });
    setEditConfigDialogOpen(true);
  };

  const saveConfig = () => {
    const payload: Record<string, unknown> = {};
    const vTaxa = parseFloat(String(configForm.taxaMatriculaPadrao).trim());
    const vMens = parseFloat(String(configForm.mensalidadePadrao).trim());
    const v1 = parseFloat(String(configForm.valorEmissaoDeclaracao).trim());
    const v2 = parseFloat(String(configForm.valorEmissaoCertificado).trim());
    const v3 = parseFloat(String(configForm.valorPasse).trim());
    if (!isNaN(vTaxa) && vTaxa >= 0) payload.taxaMatriculaPadrao = vTaxa;
    else payload.taxaMatriculaPadrao = null;
    if (!isNaN(vMens) && vMens >= 0) payload.mensalidadePadrao = vMens;
    else payload.mensalidadePadrao = null;
    if (!isNaN(v1) && v1 >= 0) payload.valorEmissaoDeclaracao = v1;
    else payload.valorEmissaoDeclaracao = null;
    if (!isNaN(v2) && v2 >= 0) payload.valorEmissaoCertificado = v2;
    else payload.valorEmissaoCertificado = null;
    if (!isNaN(v3) && v3 >= 0) payload.valorPasse = v3;
    else payload.valorPasse = null;
    updateConfigMutation.mutate(payload);
  };

  const openEditItem = (
    type: "curso" | "classe",
    id: string,
    nome: string,
    data: Record<string, unknown>
  ) => {
    setEditItem({ type, id, nome, data });
    setItemForm({
      taxaMatricula: data.taxaMatricula != null ? Number(data.taxaMatricula) : "",
      valorMensalidade: data.valorMensalidade != null ? Number(data.valorMensalidade) : "",
      valorBata: data.valorBata != null ? Number(data.valorBata) : "",
      exigeBata: Boolean(data.exigeBata),
      valorPasse: data.valorPasse != null ? Number(data.valorPasse) : "",
      exigePasse: Boolean(data.exigePasse),
      valorEmissaoDeclaracao: data.valorEmissaoDeclaracao != null ? Number(data.valorEmissaoDeclaracao) : "",
      valorEmissaoCertificado: data.valorEmissaoCertificado != null ? Number(data.valorEmissaoCertificado) : "",
    });
    setEditItemDialogOpen(true);
  };

  const saveItem = () => {
    if (!editItem) return;
    const data: Record<string, unknown> = {};
    const vTaxa = itemForm.taxaMatricula !== "" ? parseFloat(String(itemForm.taxaMatricula)) : null;
    const vMens = itemForm.valorMensalidade !== "" ? parseFloat(String(itemForm.valorMensalidade)) : null;
    const vBata = itemForm.valorBata !== "" ? parseFloat(String(itemForm.valorBata)) : null;
    const vPasse = itemForm.valorPasse !== "" ? parseFloat(String(itemForm.valorPasse)) : null;
    const vDecl = itemForm.valorEmissaoDeclaracao !== "" ? parseFloat(String(itemForm.valorEmissaoDeclaracao)) : null;
    const vCert = itemForm.valorEmissaoCertificado !== "" ? parseFloat(String(itemForm.valorEmissaoCertificado)) : null;

    if (editItem.type === "curso") {
      if (vTaxa !== null) data.taxaMatricula = vTaxa;
      if (vMens !== null) data.valorMensalidade = vMens;
    }
    if (editItem.type === "classe") {
      if (vTaxa !== null) data.taxaMatricula = vTaxa;
      if (vMens !== null) data.valorMensalidade = vMens;
    }
    data.valorBata = vBata;
    data.exigeBata = itemForm.exigeBata;
    data.valorPasse = vPasse;
    data.exigePasse = itemForm.exigePasse;
    data.valorEmissaoDeclaracao = vDecl;
    data.valorEmissaoCertificado = vCert;

    if (editItem.type === "curso") {
      updateCursoMutation.mutate({ id: editItem.id, data, expectedUpdatedAt: (editItem as any)?.updatedAt });
    } else {
      updateClasseMutation.mutate({ id: editItem.id, data, expectedUpdatedAt: (editItem as any)?.updatedAt });
    }
  };

  const tipoLabel = isSuperior ? "Ensino Superior" : isSecundario ? "Ensino Secundário" : "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              Taxas e Serviços
            </h1>
            <p className="text-muted-foreground">
              Configure os valores cobráveis por matrícula, emissão de documentos e itens obrigatórios.
              {tipoLabel && (
                <span className="ml-2 font-medium text-primary">
                  {tipoLabel}
                </span>
              )}
            </p>
          </div>
          <Button variant="outline" onClick={() => navigate("/admin-dashboard")}>
            Voltar
          </Button>
        </div>

        {/* Card: Valores padrão institucionais - visível para AMBOS os tipos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Valores padrão da instituição
            </CardTitle>
            <CardDescription>
              Valores usados quando o curso ou classe não define um valor específico. Taxa e mensalidade aplicam-se à matrícula; emissão de declarações e certificados sob pedido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div>
                <Label>Taxa matrícula (Kz)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      configForm.taxaMatriculaPadrao || config?.taxaMatriculaPadrao || config?.taxa_matricula_padrao || ""
                    }
                    onChange={(e) =>
                      setConfigForm((p) => ({ ...p, taxaMatriculaPadrao: e.target.value }))
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={openEditConfig}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Mensalidade (Kz)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      configForm.mensalidadePadrao || config?.mensalidadePadrao || config?.mensalidade_padrao || ""
                    }
                    onChange={(e) =>
                      setConfigForm((p) => ({ ...p, mensalidadePadrao: e.target.value }))
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={openEditConfig}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Emissão declaração (Kz)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      configForm.valorEmissaoDeclaracao || config?.valorEmissaoDeclaracao || config?.valor_emissao_declaracao || ""
                    }
                    onChange={(e) =>
                      setConfigForm((p) => ({ ...p, valorEmissaoDeclaracao: e.target.value }))
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={openEditConfig}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Emissão certificado (Kz)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={
                      configForm.valorEmissaoCertificado || config?.valorEmissaoCertificado || config?.valor_emissao_certificado || ""
                    }
                    onChange={(e) =>
                      setConfigForm((p) => ({ ...p, valorEmissaoCertificado: e.target.value }))
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={openEditConfig}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Passe institucional (Kz)</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    min="0"
                    value={
                      configForm.valorPasse || config?.valorPasse || config?.valor_passe || ""
                    }
                    onChange={(e) =>
                      setConfigForm((p) => ({ ...p, valorPasse: e.target.value }))
                    }
                    disabled
                    className="flex-1"
                  />
                  <Button size="sm" variant="outline" onClick={openEditConfig}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            <Button variant="secondary" className="mt-4" onClick={openEditConfig}>
              Editar valores padrão
            </Button>
          </CardContent>
        </Card>

        {/* Card: Cursos (APENAS Ensino Superior) */}
        {isSuperior && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5" />
                Valores por curso
              </CardTitle>
              <CardDescription>
                Configure taxas, mensalidade, bata e passe para cada curso. Valores em branco usam o padrão institucional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Curso</TableHead>
                      <TableHead>Taxa matrícula</TableHead>
                      <TableHead>Mensalidade</TableHead>
                      <TableHead>Bata</TableHead>
                      <TableHead>Passe</TableHead>
                      <TableHead>Emissão decl.</TableHead>
                      <TableHead>Emissão cert.</TableHead>
                      <TableHead className="w-12">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Array.isArray(cursos) ? cursos : []).map((c: Record<string, unknown>) => (
                      <TableRow key={String(c.id)}>
                        <TableCell className="font-medium">{String(c.nome)}</TableCell>
                        <TableCell>{c.taxaMatricula != null ? formatCurrency(Number(c.taxaMatricula)) : "—"}</TableCell>
                        <TableCell>{c.valorMensalidade != null ? formatCurrency(Number(c.valorMensalidade)) : "—"}</TableCell>
                        <TableCell>
                          {c.exigeBata ? (
                            <span>{formatCurrency(Number(c.valorBata ?? 0))} (obrig.)</span>
                          ) : (
                            c.valorBata != null && Number(c.valorBata) > 0
                              ? formatCurrency(Number(c.valorBata))
                              : "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {c.exigePasse ? (
                            <span>{formatCurrency(Number(c.valorPasse ?? 0))} (obrig.)</span>
                          ) : (
                            c.valorPasse != null && Number(c.valorPasse) > 0
                              ? formatCurrency(Number(c.valorPasse))
                              : "—"
                          )}
                        </TableCell>
                        <TableCell>{c.valorEmissaoDeclaracao != null ? formatCurrency(Number(c.valorEmissaoDeclaracao)) : "—"}</TableCell>
                        <TableCell>{c.valorEmissaoCertificado != null ? formatCurrency(Number(c.valorEmissaoCertificado)) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              openEditItem("curso", String(c.id), String(c.nome), c as Record<string, unknown>)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(Array.isArray(cursos) ? cursos : []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhum curso cadastrado. Adicione cursos em Gestão Académica.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Card: Classes (APENAS Ensino Secundário) */}
        {isSecundario && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <School className="h-5 w-5" />
                Valores por classe
              </CardTitle>
              <CardDescription>
                Configure taxas, mensalidade, bata e passe para cada classe (10ª, 11ª, 12ª). Valores em branco usam o padrão institucional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Classe</TableHead>
                      <TableHead>Taxa matrícula</TableHead>
                      <TableHead>Mensalidade</TableHead>
                      <TableHead>Bata</TableHead>
                      <TableHead>Passe</TableHead>
                      <TableHead>Emissão decl.</TableHead>
                      <TableHead>Emissão cert.</TableHead>
                      <TableHead className="w-12">Acções</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Array.isArray(classes) ? classes : []).map((c: Record<string, unknown>) => (
                      <TableRow key={String(c.id)}>
                        <TableCell className="font-medium">{String(c.nome)}</TableCell>
                        <TableCell>{c.taxaMatricula != null ? formatCurrency(Number(c.taxaMatricula)) : "—"}</TableCell>
                        <TableCell>{c.valorMensalidade != null ? formatCurrency(Number(c.valorMensalidade)) : "—"}</TableCell>
                        <TableCell>
                          {c.exigeBata ? (
                            <span>{formatCurrency(Number(c.valorBata ?? 0))} (obrig.)</span>
                          ) : (
                            c.valorBata != null && Number(c.valorBata) > 0
                              ? formatCurrency(Number(c.valorBata))
                              : "—"
                          )}
                        </TableCell>
                        <TableCell>
                          {c.exigePasse ? (
                            <span>{formatCurrency(Number(c.valorPasse ?? 0))} (obrig.)</span>
                          ) : (
                            c.valorPasse != null && Number(c.valorPasse) > 0
                              ? formatCurrency(Number(c.valorPasse))
                              : "—"
                          )}
                        </TableCell>
                        <TableCell>{c.valorEmissaoDeclaracao != null ? formatCurrency(Number(c.valorEmissaoDeclaracao)) : "—"}</TableCell>
                        <TableCell>{c.valorEmissaoCertificado != null ? formatCurrency(Number(c.valorEmissaoCertificado)) : "—"}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              openEditItem("classe", String(c.id), String(c.nome), c as Record<string, unknown>)
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {(Array.isArray(classes) ? classes : []).length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nenhuma classe cadastrada. Adicione classes em Gestão Académica.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sem tipo definido */}
        {!isSuperior && !isSecundario && (
          <Card>
            <CardContent className="py-8">
              <p className="text-muted-foreground text-center">
                O tipo de instituição (Ensino Superior ou Secundário) ainda não foi identificado. Configure a estrutura académica em Gestão Académica.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialog: Editar valores padrão */}
      <Dialog open={editConfigDialogOpen} onOpenChange={setEditConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Valores padrão institucionais</DialogTitle>
            <DialogDescription>
              Valores usados quando curso ou classe não define valor específico.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Taxa matrícula (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={configForm.taxaMatriculaPadrao}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, taxaMatriculaPadrao: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
              <div>
                <Label>Mensalidade (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={configForm.mensalidadePadrao}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, mensalidadePadrao: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
            </div>
            <div>
              <Label>Emissão declaração (Kz)</Label>
              <Input
                type="number"
                min="0"
                value={configForm.valorEmissaoDeclaracao}
                onChange={(e) =>
                  setConfigForm((p) => ({ ...p, valorEmissaoDeclaracao: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Emissão certificado (Kz)</Label>
              <Input
                type="number"
                min="0"
                value={configForm.valorEmissaoCertificado}
                onChange={(e) =>
                  setConfigForm((p) => ({ ...p, valorEmissaoCertificado: e.target.value }))
                }
              />
            </div>
            <div>
              <Label>Passe institucional (Kz)</Label>
              <Input
                type="number"
                min="0"
                value={configForm.valorPasse}
                onChange={(e) =>
                  setConfigForm((p) => ({ ...p, valorPasse: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConfigDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveConfig} disabled={updateConfigMutation.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar item (curso/classe) */}
      <Dialog open={editItemDialogOpen} onOpenChange={setEditItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Editar {editItem?.type === "curso" ? "Curso" : "Classe"}: {editItem?.nome}
            </DialogTitle>
            <DialogDescription>
              Configure os valores cobráveis. Deixe em branco para usar o padrão institucional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Taxa matrícula (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.taxaMatricula}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, taxaMatricula: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
              <div>
                <Label>Mensalidade (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.valorMensalidade}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, valorMensalidade: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Bata (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.valorBata}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, valorBata: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Checkbox
                  id="exigeBata"
                  checked={itemForm.exigeBata}
                  onCheckedChange={(c) =>
                    setItemForm((p) => ({ ...p, exigeBata: c === true }))
                  }
                />
                <Label htmlFor="exigeBata">Exige bata</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Passe (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.valorPasse}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, valorPasse: e.target.value }))
                  }
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Checkbox
                  id="exigePasse"
                  checked={itemForm.exigePasse}
                  onCheckedChange={(c) =>
                    setItemForm((p) => ({ ...p, exigePasse: c === true }))
                  }
                />
                <Label htmlFor="exigePasse">Exige passe</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Emissão declaração (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.valorEmissaoDeclaracao}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, valorEmissaoDeclaracao: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
              <div>
                <Label>Emissão certificado (Kz)</Label>
                <Input
                  type="number"
                  min="0"
                  value={itemForm.valorEmissaoCertificado}
                  onChange={(e) =>
                    setItemForm((p) => ({ ...p, valorEmissaoCertificado: e.target.value }))
                  }
                  placeholder="Padrão"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditItemDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={saveItem}
              disabled={
                updateCursoMutation.isPending || updateClasseMutation.isPending
              }
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
