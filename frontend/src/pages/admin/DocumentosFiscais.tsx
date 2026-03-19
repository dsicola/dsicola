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
  Ban,
  FileDown,
  Zap,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  documentoFinanceiroApi,
  alunosApi,
  agtApi,
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

/** Códigos de isenção AGT (Decreto 312/18) — value nunca pode ser "" (Radix Select reserva para placeholder) */
const CODIGOS_ISENCAO_GLOBAL = [
  { value: "_none", label: "— Nenhum" },
  { value: "M00", label: "M00 - Regime Transitório" },
  { value: "M01", label: "M01 - Isento Art. 12 (geral)" },
  { value: "M02", label: "M02 - Transmissão bens/serviço não sujeita" },
  { value: "M04", label: "M04 - IVA Regime de não sujeição" },
  { value: "M11", label: "M11 - Isento Art. 12º b) CIVA" },
  { value: "M12", label: "M12 - Isento Art. 12º c) CIVA" },
  { value: "M13", label: "M13 - Isento Art. 12º d) CIVA" },
  { value: "M14", label: "M14 - Isento Art. 12º e) CIVA" },
  { value: "M30", label: "M30 - Isento Art. 15º 1 a) CIVA" },
  { value: "M31", label: "M31 - Isento Art. 15º 1 b) CIVA" },
  { value: "M32", label: "M32 - Isento Art. 15º 1 c) CIVA" },
  { value: "M33", label: "M33 - Isento Art. 15º 1 d) CIVA" },
  { value: "M34", label: "M34 - Isento Art. 15º 1 e) CIVA" },
  { value: "M35", label: "M35 - Isento Art. 15º 1 f) CIVA" },
  { value: "M36", label: "M36 - Isento Art. 15º 1 g) CIVA" },
  { value: "M37", label: "M37 - Isento Art. 15º 1 h) CIVA" },
  { value: "M38", label: "M38 - Isento Art. 15º 1 i) CIVA" },
];

export default function DocumentosFiscais() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tipoFiltro, setTipoFiltro] = useState<string>("todos");

  // Form states
  const [entidadeId, setEntidadeId] = useState("");
  const [moeda, setMoeda] = useState<"AOA" | "USD" | "EUR">("AOA");
  const [linhas, setLinhas] = useState<LinhaForm[]>([{ ...LINHA_INICIAL }]);
  const [valorDescontoGlobal, setValorDescontoGlobal] = useState("");
  const [proformaId, setProformaId] = useState("");
  const [faturaId, setFaturaId] = useState("");
  const [valorCredito, setValorCredito] = useState("");
  const [motivoNC, setMotivoNC] = useState("Ajuste de valor");
  const [docToAnular, setDocToAnular] = useState<{ id: string; numeroDocumento: string } | null>(null);

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
        taxaIVA: l.taxaIVA && l.taxaIVA !== "isento" ? Number(l.taxaIVA) : undefined,
        taxExemptionCode: l.taxExemptionCode || undefined,
      }));

  const criarProformaMutation = useMutation({
    mutationFn: () =>
      documentoFinanceiroApi.criarProforma({
        entidadeId,
        linhas: linhasValidas(),
        moeda,
        valorDescontoGlobal: valorDescontoGlobal ? Number(valorDescontoGlobal) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setLinhas([{ ...LINHA_INICIAL }]);
      setEntidadeId("");
      setValorDescontoGlobal("");
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
        valorDescontoGlobal: valorDescontoGlobal ? Number(valorDescontoGlobal) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setLinhas([{ ...LINHA_INICIAL }]);
      setEntidadeId("");
      setValorDescontoGlobal("");
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

  const anularMutation = useMutation({
    mutationFn: (id: string) => documentoFinanceiroApi.anular(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      setDocToAnular(null);
      toast({ title: "Documento anulado", description: "O documento foi marcado como ESTORNADO." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível anular o documento.", variant: "destructive" }),
  });

  const gerarAgtMutation = useMutation({
    mutationFn: () => agtApi.gerarTestesCompleto(),
    onSuccess: (data: { mensagem?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["documentos-financeiros"] });
      toast({ title: "Documentos AGT gerados", description: data?.mensagem || "Todos os documentos exigidos pela AGT foram criados." });
    },
    onError: (e: Error) =>
      toast({ title: "Erro", description: e?.message || "Não foi possível gerar documentos AGT.", variant: "destructive" }),
  });

  const formatCurrency = (v: number | string, m?: string | null) => {
    const cur = m && ["USD", "EUR"].includes(m) ? m : "AOA";
    return new Intl.NumberFormat("pt-AO", { style: "currency", currency: cur }).format(Number(v));
  };

  const tipoLabel = (t: string) => {
    const m: Record<string, string> = { FT: "Fatura", PF: "Pró-forma", GR: "Guia Remessa", NC: "Nota Crédito", RC: "Recibo" };
    return m[t] ?? t;
  };

  // Códigos de isenção AGT (Decreto 312/18) — value nunca pode ser "" (Radix Select reserva isso)
  const CODIGOS_ISENCAO = [
    { value: "_none", label: "—" },
    { value: "M00", label: "M00 (Regime transitório)" },
    { value: "M01", label: "M01" },
    { value: "M02", label: "M02 (Não sujeita)" },
    { value: "M04", label: "M04 (Regime não sujeição)" },
    { value: "M11", label: "M11 (Art. 12º b)" },
    { value: "M12", label: "M12 (Art. 12º c)" },
    { value: "M13", label: "M13 (Art. 12º d)" },
    { value: "M14", label: "M14 (Art. 12º e)" },
    { value: "M15", label: "M15 (Art. 12º f)" },
    { value: "M17", label: "M17 (Art. 12º h)" },
    { value: "M18", label: "M18 (Art. 12º i)" },
    { value: "M19", label: "M19 (Art. 12º j)" },
    { value: "M20", label: "M20 (Art. 12º k)" },
    { value: "M30", label: "M30 (Art. 15º 1a)" },
    { value: "M31", label: "M31 (Art. 15º 1b)" },
    { value: "M32", label: "M32 (Art. 15º 1c)" },
    { value: "M33", label: "M33 (Art. 15º 1d)" },
    { value: "M34", label: "M34 (Art. 15º 1e)" },
    { value: "M35", label: "M35 (Art. 15º 1f)" },
    { value: "M36", label: "M36 (Art. 15º 1g)" },
    { value: "M37", label: "M37 (Art. 15º 1h)" },
    { value: "M38", label: "M38 (Art. 15º 1i)" },
  ];

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
        <div key={i} className="space-y-2 p-3 rounded border bg-muted/30">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-12 sm:col-span-4">
              <Label>Descrição</Label>
              <Input
                placeholder="Ex: Serviço educacional"
                value={l.descricao}
                onChange={(e) => updateLinha(i, "descricao", e.target.value)}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Label>Qtd</Label>
              <Input
                type="number"
                min={0}
                value={l.quantidade}
                onChange={(e) => updateLinha(i, "quantidade", e.target.value)}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Label>Preço unit.</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={l.precoUnitario}
                onChange={(e) => updateLinha(i, "precoUnitario", e.target.value)}
              />
            </div>
            <div className="col-span-4 sm:col-span-2">
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
            <div className="col-span-6 sm:col-span-1">
              <Label>IVA %</Label>
              <Select
                value={l.taxaIVA === "5" || l.taxaIVA === "14" ? l.taxaIVA : "isento"}
                onValueChange={(v) => updateLinha(i, "taxaIVA", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Isento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="isento">Isento</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="14">14</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6 sm:col-span-2">
              <Label>Cód. Isenção</Label>
              <Select
                value={l.taxExemptionCode || "_none"}
                onValueChange={(v) => updateLinha(i, "taxExemptionCode", v === "_none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CODIGOS_ISENCAO.map((c) => (
                    <SelectItem key={c.value || "vazio"} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12 sm:col-span-1 flex justify-end">
              {linhas.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeLinha(i)} className="mt-6">
                  ✕
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
          <Button
            variant="default"
            onClick={() => gerarAgtMutation.mutate()}
            disabled={gerarAgtMutation.isPending}
          >
            <Zap className="h-4 w-4 mr-2" />
            {gerarAgtMutation.isPending ? "A gerar…" : "Gerar todos AGT"}
          </Button>
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
                        {estudantes.filter((e) => e.id).map((e) => (
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
                <div className="flex flex-wrap items-end gap-4">
                  <div className="w-full sm:w-48">
                    <Label className="text-muted-foreground text-sm">Desconto global (opcional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0"
                      value={valorDescontoGlobal}
                      onChange={(e) => setValorDescontoGlobal(e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">SettlementAmount — conformidade AGT ponto 7</p>
                  </div>
                </div>
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label>Cliente (Estudante)</Label>
                    <Select value={entidadeId} onValueChange={setEntidadeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o estudante" />
                      </SelectTrigger>
                      <SelectContent>
                        {estudantes.filter((e) => e.id).map((e) => (
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
                  <div>
                    <Label>Desconto global (opcional)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      placeholder="0"
                      value={valorDescontoGlobal}
                      onChange={(e) => setValorDescontoGlobal(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Aplicado ao total — conformidade AGT</p>
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
                      {proformas.filter((p) => p.id).map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.numeroDocumento} — {formatCurrency(p.valorTotal, p.moeda)} — {p.entidade?.nomeCompleto ?? "N/A"}
                        </SelectItem>
                      ))}
                      {proformas.filter((p) => p.id).length === 0 && (
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
                      {faturas.filter((f) => f.id).map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.numeroDocumento} — {formatCurrency(f.valorTotal, f.moeda)} — {f.entidade?.nomeCompleto ?? "N/A"}
                        </SelectItem>
                      ))}
                      {faturas.filter((f) => f.id).length === 0 && (
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
                          <TableHead className="text-right">Ações</TableHead>
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
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={async () => {
                                    try {
                                      const blob = await documentoFinanceiroApi.downloadPdf(d.id);
                                      const url = URL.createObjectURL(blob);
                                      window.open(url, "_blank");
                                      setTimeout(() => URL.revokeObjectURL(url), 5000);
                                    } catch (e) {
                                      toast({ title: "Erro", description: (e as Error)?.message || "Não foi possível abrir o PDF.", variant: "destructive" });
                                    }
                                  }}
                                >
                                  <FileDown className="h-4 w-4 mr-1" />
                                  Ver PDF
                                </Button>
                                {d.estado !== "ESTORNADO" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setDocToAnular({ id: d.id, numeroDocumento: d.numeroDocumento })}
                                  >
                                    <Ban className="h-4 w-4 mr-1" />
                                    Anular
                                  </Button>
                                )}
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
          </TabsContent>
        </Tabs>

        <AlertDialog open={!!docToAnular} onOpenChange={(open) => !open && setDocToAnular(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Anular documento</AlertDialogTitle>
              <AlertDialogDescription>
                O documento <strong>{docToAnular?.numeroDocumento}</strong> passará a constar como ANULADO (ESTORNADO).
                Esta ação é irreversível. Confirma?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => docToAnular && anularMutation.mutate(docToAnular.id)}
                disabled={anularMutation.isPending}
              >
                {anularMutation.isPending ? "A anular..." : "Anular"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
