/**
 * Documentos Fiscais AGT - Pró-forma, Guia de Remessa, Nota de Crédito, Fatura a partir de Pró-forma
 * Conformidade Decreto 312/18
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  FileText,
  Package,
  Receipt,
  CreditCard,
  List,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  documentoFinanceiroApi,
  alunosApi,
} from "@/services/api";

interface LinhaForm {
  descricao: string;
  quantidade: string;
  precoUnitario: string;
  valorDesconto?: string;
  taxaIVA?: string;
  taxExemptionCode?: string;
}

const LINHA_INICIAL: LinhaForm = {
  descricao: "",
  quantidade: "1",
  precoUnitario: "0",
};

export default function DocumentosFiscais() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  // Form states
  const [entidadeId, setEntidadeId] = useState("");
  const [moeda, setMoeda] = useState<"AOA" | "USD" | "EUR">("AOA");
  const [linhas, setLinhas] = useState<LinhaForm[]>([{ ...LINHA_INICIAL }]);
  const [proformaId, setProformaId] = useState("");
  const [faturaId, setFaturaId] = useState("");
  const [valorCredito, setValorCredito] = useState("");
  const [motivoNC, setMotivoNC] = useState("Ajuste de valor");

  // Estudantes (alunos) para seleção
  const { data: estudantesData } = useQuery({
    queryKey: ["estudantes-docs-fiscais"],
    queryFn: () => alunosApi.getList({ page: 1, pageSize: 500 }),
  });
  const estudantes = ((estudantesData as { data?: unknown[] })?.data ?? []) as {
    id: string;
    nomeCompleto?: string;
    email?: string;
    numeroIdentificacaoPublica?: string;
  }[];

  // Documentos
  const { data: documentos, isLoading } = useQuery({
    queryKey: ["documentos-financeiros", tipoFiltro],
    queryFn: () =>
      documentoFinanceiroApi.listar({
        tipo: tipoFiltro !== "todos" ? (tipoFiltro as "FT" | "PF" | "GR" | "NC") : undefined,
        limit: 200,
      }),
  });
  const listaDocs = (Array.isArray(documentos) ? documentos : []) as Array<{
    id: string;
    tipoDocumento: string;
    numeroDocumento: string;
    dataDocumento: string;
    valorTotal: number | string;
    moeda?: string | null;
    estado?: string;
    entidade?: { nomeCompleto?: string; email?: string };
  }>;

  const proformas = listaDocs.filter((d) => d.tipoDocumento === "PF");
  const faturas = listaDocs.filter((d) => d.tipoDocumento === "FT" && d.estado !== "ESTORNADO");

  const addLinha = () => setLinhas((prev) => [...prev, { ...LINHA_INICIAL }]);
  const removeLinha = (i: number) => setLinhas((prev) => prev.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, field: keyof LinhaForm, value: string) =>
    setLinhas((prev) => prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)));

  const linhasValidas = () =>
    linhas
      .filter((l) => l.descricao.trim() && Number(l.quantidade) > 0 && Number(l.precoUnitario) >= 0)
      .map((l) => ({
        descricao: l.descricao.trim(),
        quantidade: Number(l.quantidade) || 1,
        precoUnitario: Number(l.precoUnitario) || 0,
        valorDesconto: l.valorDesconto ? Number(l.valorDesconto) : undefined,
        taxaIVA: l.taxaIVA ? Number(l.taxaIVA) : undefined,
        taxExemptionCode: l.taxExemptionCode || undefined,
      }));

  const criarProformaMutation = useMutation({
    mutationFn: () =>
      documentoFinanceiroApi.criarProforma({
        entidadeId,
        linhas: linhasValidas(),
        moeda,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setLinhas([{ ...LINHA_INICIAL }]);
      setEntidadeId("");
      toast({ title: "Pró-forma emitida", description: "Documento criado com sucesso." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível emitir pró-forma.", variant: "destructive" }),
  });

  const criarGRMutation = useMutation({
    mutationFn: () =>
      documentoFinanceiroApi.criarGuiaRemessa({
        entidadeId,
        linhas: linhasValidas(),
        moeda,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setLinhas([{ ...LINHA_INICIAL }]);
      setEntidadeId("");
      toast({ title: "Guia de remessa emitida", description: "Documento criado com sucesso." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível emitir guia de remessa.", variant: "destructive" }),
  });

  const criarFTDePFMutation = useMutation({
    mutationFn: () => documentoFinanceiroApi.criarFaturaDeProforma(proformaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setProformaId("");
      toast({ title: "Fatura gerada", description: "Fatura criada a partir da pró-forma." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível gerar fatura.", variant: "destructive" }),
  });

  const criarNCMutation = useMutation({
    mutationFn: () =>
      documentoFinanceiroApi.criarNotaCredito({
        faturaId,
        valorCredito: Number(valorCredito),
        motivo: motivoNC,
        moeda,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setFaturaId("");
      setValorCredito("");
      toast({ title: "Nota de crédito emitida", description: "Documento criado com sucesso." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível emitir nota de crédito.", variant: "destructive" }),
  });

  const formatCurrency = (v: number | string, m?: string | null) => {
    const cur = m && ["USD", "EUR"].includes(m) ? m : "AOA";
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: cur }).format(Number(v));
  };

  const tipoLabel = (t: string) => {
    const m: Record<string, string> = { FT: "Fatura", PF: "Pró-forma", GR: "Guia Remessa", NC: "Nota Crédito", RC: "Recibo" };
    return m[t] ?? t;
  };

  const FormLinhas = ({ onValid }: { onValid: () => boolean }) => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Linhas do documento</Label>
        <Button type="button" variant="outline" size="sm" onClick={addLinha}>
          <Plus className="h-4 w-4 mr-1" />
          Adicionar linha
        </Button>
      </div>
      {linhas.map((l, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded border bg-muted/30">
          <div className="col-span-4">
            <Label>Descrição</Label>
            <Input
              placeholder="Ex: Serviço educacional"
              value={l.descricao}
              onChange={(e) => updateLinha(i, "descricao", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>Qtd</Label>
            <Input
              type="number"
              min={0}
              value={l.quantidade}
              onChange={(e) => updateLinha(i, "quantidade", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>Preço unit.</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={l.precoUnitario}
              onChange={(e) => updateLinha(i, "precoUnitario", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <Label>Desconto (opc.)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={l.valorDesconto ?? ""}
              onChange={(e) => updateLinha(i, "valorDesconto", e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-span-2 flex gap-1">
            {linhas.length > 1 && (
              <Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(i)}>
                ✕
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin-dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documentos Fiscais</h1>
            <p className="text-muted-foreground">
              Pró-forma, Guia de Remessa, Nota de Crédito e Fatura — conformidade AGT
            </p>
          </div>
        </div>

        <Tabs defaultValue="proforma" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="proforma" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pró-forma
            </TabsTrigger>
            <TabsTrigger value="guia" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Guia Remessa
            </TabsTrigger>
            <TabsTrigger value="fatura" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Fatura de PF
            </TabsTrigger>
            <TabsTrigger value="nc" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Nota Crédito
            </TabsTrigger>
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              Lista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="proforma" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emitir Pró-forma</CardTitle>
                <CardDescription>Documento preliminar antes da fatura (orçamento)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Cliente (Estudante)</Label>
                    <Select value={entidadeId} onValueChange={setEntidadeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estudante" />
                      </SelectTrigger>
                      <SelectContent>
                        {estudantes.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nomeCompleto ?? e.email} {e.numeroIdentificacaoPublica ? `(${e.numeroIdentificacaoPublica})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Moeda</Label>
                    <Select value={moeda} onValueChange={(v) => setMoeda(v as "AOA" | "USD" | "EUR")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AOA">AOA</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <FormLinhas onValid={() => linhasValidas().length > 0} />
                <Button
                  onClick={() => criarProformaMutation.mutate()}
                  disabled={!entidadeId || linhasValidas().length === 0 || criarProformaMutation.isPending}
                >
                  {criarProformaMutation.isPending ? "A emitir..." : "Emitir Pró-forma"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="guia" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emitir Guia de Remessa</CardTitle>
                <CardDescription>Documento de envio de bens ou descrição de serviços</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Cliente (Estudante)</Label>
                    <Select value={entidadeId} onValueChange={setEntidadeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estudante" />
                      </SelectTrigger>
                      <SelectContent>
                        {estudantes.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.nomeCompleto ?? e.email} {e.numeroIdentificacaoPublica ? `(${e.numeroIdentificacaoPublica})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Moeda</Label>
                    <Select value={moeda} onValueChange={(v) => setMoeda(v as "AOA" | "USD" | "EUR")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AOA">AOA</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <FormLinhas onValid={() => linhasValidas().length > 0} />
                <Button
                  onClick={() => criarGRMutation.mutate()}
                  disabled={!entidadeId || linhasValidas().length === 0 || criarGRMutation.isPending}
                >
                  {criarGRMutation.isPending ? "A emitir..." : "Emitir Guia de Remessa"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="fatura" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Gerar Fatura a partir da Pró-forma</CardTitle>
                <CardDescription>Converte uma pró-forma em fatura (OrderReferences AGT)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Pró-forma</Label>
                  <Select value={proformaId} onValueChange={setProformaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a pró-forma" />
                    </SelectTrigger>
                    <SelectContent>
                      {proformas.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.numeroDocumento} — {formatCurrency(p.valorTotal, p.moeda)} — {p.entidade?.nomeCompleto ?? "N/A"}
                        </SelectItem>
                      ))}
                      {proformas.length === 0 && (
                        <SelectItem value="_none" disabled>
                          Nenhuma pró-forma disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => criarFTDePFMutation.mutate()}
                  disabled={!proformaId || criarFTDePFMutation.isPending}
                >
                  {criarFTDePFMutation.isPending ? "A gerar..." : "Gerar Fatura"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nc" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emitir Nota de Crédito</CardTitle>
                <CardDescription>Referencia uma fatura e emite crédito</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Fatura de referência</Label>
                  <Select value={faturaId} onValueChange={setFaturaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a fatura" />
                    </SelectTrigger>
                    <SelectContent>
                      {faturas.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.numeroDocumento} — {formatCurrency(f.valorTotal, f.moeda)} — {f.entidade?.nomeCompleto ?? "N/A"}
                        </SelectItem>
                      ))}
                      {faturas.length === 0 && (
                        <SelectItem value="_none" disabled>
                          Nenhuma fatura disponível
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Valor do crédito</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Ex: 10000"
                      value={valorCredito}
                      onChange={(e) => setValorCredito(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Moeda</Label>
                    <Select value={moeda} onValueChange={(v) => setMoeda(v as "AOA" | "USD" | "EUR")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AOA">AOA</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Motivo</Label>
                  <Input
                    placeholder="Ex: Ajuste de valor"
                    value={motivoNC}
                    onChange={(e) => setMotivoNC(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => criarNCMutation.mutate()}
                  disabled={!faturaId || !valorCredito || Number(valorCredito) <= 0 || criarNCMutation.isPending}
                >
                  {criarNCMutation.isPending ? "A emitir..." : "Emitir Nota de Crédito"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lista" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documentos emitidos</CardTitle>
                <CardDescription>
                  Lista de documentos fiscais (FT, PF, GR, NC) da instituição
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="FT">Faturas</SelectItem>
                      <SelectItem value="PF">Pró-formas</SelectItem>
                      <SelectItem value="GR">Guias Remessa</SelectItem>
                      <SelectItem value="NC">Notas Crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                    A carregar...
                  </div>
                ) : listaDocs.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhum documento encontrado. Emita uma pró-forma ou guia de remessa para começar.
                  </p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {listaDocs.map((d) => (
                          <TableRow key={d.id}>
                            <TableCell>{tipoLabel(d.tipoDocumento)}</TableCell>
                            <TableCell className="font-mono">{d.numeroDocumento}</TableCell>
                            <TableCell>{format(new Date(d.dataDocumento), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                            <TableCell>{d.entidade?.nomeCompleto ?? "—"}</TableCell>
                            <TableCell>{formatCurrency(d.valorTotal, d.moeda)}</TableCell>
                            <TableCell>{d.estado === "ESTORNADO" ? "Anulado" : "Emitido"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
