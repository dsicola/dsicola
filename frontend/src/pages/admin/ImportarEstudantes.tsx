import { useCallback, useMemo, useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  Settings2,
  Upload,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { importacaoEstudantesApi, type ImportacaoEstudanteLinhaPreview } from "@/services/api";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

function csvEscape(cell: string) {
  return `"${String(cell).replace(/"/g, '""')}"`;
}

function buildRelatorioImportacaoCsv(
  detalhes: { linha: number; motivo: string }[],
  detMat: { linha: number; motivo: string }[]
) {
  const rows = [["tipo", "linha", "motivo"].join(",")];
  for (const d of detalhes) {
    rows.push(["linha_ignorada_ou_erro", String(d.linha), csvEscape(d.motivo)].join(","));
  }
  for (const d of detMat) {
    rows.push(["matricula_turma_falhou", String(d.linha), csvEscape(d.motivo)].join(","));
  }
  return `\uFEFF${rows.join("\n")}`;
}

export default function ImportarEstudantes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isSecundario } = useInstituicao();
  const { role } = useAuth();
  const isSecretaria = role === "SECRETARIA";
  const alunosHref = isSecretaria ? "/secretaria-dashboard/alunos" : "/admin-dashboard/gestao-alunos?tab=alunos";

  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<{
    total: number;
    validos: number;
    erros: number;
    dados: ImportacaoEstudanteLinhaPreview[];
    cabecalhos: string[];
    modoImportacao: "seguro" | "flexivel";
    resumoMatriculaSeguro?: {
      foraDoPeriodoLetivo: boolean;
      linhasComAvisoMatricula: number;
      mensagemPeriodo?: string;
    };
  } | null>(null);
  const [done, setDone] = useState<{
    importados: number;
    matriculasEmTurma: number;
    matriculasFalharam: number;
    ignorados: number;
    modoImportacao?: "seguro" | "flexivel";
    detalhes?: { linha: number; motivo: string }[];
    detalhesMatricula?: { linha: number; motivo: string }[];
    orientacaoPrimeiroAcesso?: string;
  } | null>(null);
  const [modoImportacao, setModoImportacao] = useState<"seguro" | "flexivel">("seguro");
  const [flexImportOpen, setFlexImportOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [hints, setHints] = useState<Record<string, string | undefined>>({});

  const previewMutation = useMutation({
    mutationFn: async (input: { file: File; modo: "seguro" | "flexivel" }) =>
      importacaoEstudantesApi.preview(input.file, hints, { modoImportacao: input.modo }),
    onSuccess: (data) => {
      setPreview({
        total: data.total,
        validos: data.validos,
        erros: data.erros,
        dados: data.dados,
        cabecalhos: data.cabecalhos,
        modoImportacao: data.modoImportacao,
        resumoMatriculaSeguro: data.resumoMatriculaSeguro,
      });
      setDone(null);
      toast.success("Ficheiro lido. Revise a pré-visualização.");
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Não foi possível ler o Excel.";
      toast.error(msg);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: () => {
      if (!preview) throw new Error("Sem pré-visualização");
      const linhas = preview.dados
        .filter((d) => d.valido)
        .map((d) => ({
          linha: d.linha,
          nomeCompleto: d.nomeCompleto,
          classe: d.classe,
          turma: d.turma,
          bi: d.bi,
          telefone: d.telefone,
          email: d.email,
        }));
      return importacaoEstudantesApi.confirmar(linhas, { modoImportacao });
    },
    onSuccess: (res) => {
      setDone({
        importados: res.importados,
        matriculasEmTurma: res.matriculasEmTurma ?? 0,
        matriculasFalharam: res.matriculasFalharam ?? 0,
        ignorados: res.ignorados,
        modoImportacao: res.modoImportacao,
        detalhes: res.detalhes ?? [],
        detalhesMatricula: res.detalhesMatricula ?? [],
        orientacaoPrimeiroAcesso: res.orientacaoPrimeiroAcesso,
      });
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      queryClient.invalidateQueries({ queryKey: ["estudantes-list"] });
      queryClient.invalidateQueries({ queryKey: ["matriculas"] });
      toast.success(`${res.importados} aluno(s) importado(s).`);
      const mt = res.matriculasEmTurma ?? 0;
      if (mt > 0) {
        toast.message(`${mt} com matrícula na turma (prontos a usar).`);
      }
      const mf = res.matriculasFalharam ?? 0;
      if (mf > 0 && (res.modoImportacao === 'flexivel' || res.importarMesmoSeMatriculaFalhar)) {
        toast.message(
          `${mf} aluno(s) criado(s), mas a matrícula na turma falhou — complete na secretaria (motivos no resumo).`
        );
      }
      if (res.ignorados > 0) {
        toast.message(`${res.ignorados} linha(s) ignorada(s).`);
      }
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (e as Error)?.message ||
        "Falha na importação.";
      toast.error(msg);
    },
  });

  const runPreview = useCallback(
    (f: File, modo: "seguro" | "flexivel" = modoImportacao) => {
      setFile(f);
      previewMutation.mutate({ file: f, modo });
    },
    [previewMutation, modoImportacao]
  );

  const onFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) runPreview(f);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const ok = /\.xlsx?$/i.test(f.name);
    if (!ok) {
      toast.error("Use um ficheiro .xlsx ou .xls");
      return;
    }
    runPreview(f);
  };

  const classeColLabel = isSecundario ? "Classe" : "Curso";

  const camposMapeamento = useMemo(
    () =>
      [
        { key: "nomeCompleto" as const, label: "Nome completo" },
        { key: "bi" as const, label: "BI / NIF" },
        {
          key: "classe" as const,
          label: isSecundario ? "Classe (nome ou código)" : "Curso (nome ou código) / ano",
        },
        { key: "turma" as const, label: "Turma ou sala" },
        { key: "telefone" as const, label: "Telefone" },
        { key: "email" as const, label: "E-mail" },
      ] as const,
    [isSecundario]
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" className="shrink-0 mt-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Importar estudantes (Excel)</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Escolha o modo de importação, envie o Excel e confirme. O sistema associa as colunas
              automaticamente. {isSecundario ? "A coluna de contexto deve corresponder à classe da turma." : "A coluna de contexto deve corresponder ao curso (superior)."} Com turma identificada no ano letivo ativo, tenta matrícula anual e na turma
              (mensalidade inicial quando aplicável). Linhas sem e-mail válido recebem um contacto técnico —
              atualize depois em gestão de alunos.
            </p>
            <Collapsible open={helpOpen} onOpenChange={setHelpOpen} className="mt-3">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="link" className="h-auto p-0 text-sm gap-2 text-primary">
                  <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
                  Guia: duplicados, primeiro acesso e API
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2 text-sm text-muted-foreground space-y-2 rounded-md border bg-muted/30 p-3">
                <ul className="list-disc pl-4 space-y-1.5">
                  <li>
                    <strong className="text-foreground">BI/NIF</strong> duplicado no ficheiro ou já existente na
                    instituição é ignorado na confirmação; na pré-visualização a linha fica inválida se o BI se repetir
                    no Excel.
                  </li>
                  <li>
                    <strong className="text-foreground">Telefone</strong> com 9 ou mais dígitos: duplicado no ficheiro
                    é ignorado (validação só no Excel).
                  </li>
                  <li>
                    <strong className="text-foreground">Primeiro acesso</strong>: a palavra-passe inicial é aleatória
                    (não vem no Excel). Com e-mail real, o aluno usa recuperação de senha; com e-mail técnico ou sem
                    e-mail, a secretaria redefine a senha em gestão de alunos.
                  </li>
                  <li>
                    Documentação técnica no repositório:{" "}
                    <code className="text-xs bg-muted px-1 rounded">docs/IMPORTACAO_ESTUDANTES_EXCEL.md</code>{" "}
                    (endpoints, limites, auditoria, testes).
                  </li>
                </ul>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onFileInput}
        />

        {!done && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">1. Ficheiro</CardTitle>
              <CardDescription>Clique ou arraste o Excel para aqui.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  "w-full rounded-xl border-2 border-dashed p-10 text-center transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <span className="text-4xl" aria-hidden>
                    📥
                  </span>
                  <span className="text-lg font-medium">Importar Excel</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    ou largue o ficheiro nesta zona
                  </span>
                  {file && (
                    <span className="text-xs text-muted-foreground mt-2">{file.name}</span>
                  )}
                </div>
              </button>

              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium">Modo de importação</p>
                <p className="text-xs text-muted-foreground">
                  A pré-visualização alinha-se ao modo: em <strong>Seguro</strong> vê avisos de matrícula; em{" "}
                  <strong>Flexível</strong> essas regras são indicadas só na confirmação (afrouxadas).
                </p>
                <RadioGroup
                  value={modoImportacao}
                  onValueChange={(v) => {
                    const next = v as "seguro" | "flexivel";
                    setModoImportacao(next);
                    if (file) previewMutation.mutate({ file, modo: next });
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="seguro" id="imp-seguro" className="mt-0.5" />
                    <div className="grid gap-1 leading-snug">
                      <Label htmlFor="imp-seguro" className="font-normal cursor-pointer">
                        Seguro <span className="text-muted-foreground">(regras completas)</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Transação única por linha: se a matrícula na turma falhar, não fica aluno criado. A tabela
                        mostra avisos antes de confirmar.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <RadioGroupItem value="flexivel" id="imp-flexivel" className="mt-0.5" />
                    <div className="grid gap-1 leading-snug">
                      <Label htmlFor="imp-flexivel" className="font-normal cursor-pointer">
                        Flexível <span className="text-muted-foreground">(importar e corrigir depois)</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Só nesta importação: afrouxa período letivo, dívida, capacidade e progressão; o cadastro pode
                        manter-se se a matrícula falhar.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-2">
                    <Settings2 className="h-4 w-4" />
                    Ajustar colunas
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4 rounded-lg border p-4 bg-muted/30">
                  <p className="text-sm text-muted-foreground">
                    Escolha o cabeçalho exato de cada coluna do seu Excel, depois volte a carregar o
                    ficheiro.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {camposMapeamento.map(({ key, label }) => (
                      <div key={key} className="space-y-2">
                        <Label className="text-xs">{label}</Label>
                        <Select
                          value={hints[key] || "__auto__"}
                          onValueChange={(v) =>
                            setHints((h) => ({
                              ...h,
                              [key]: v === "__auto__" ? undefined : v,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Automático" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__auto__">Automático</SelectItem>
                            {(preview?.cabecalhos || [])
                              .map((c, i) => ({ c: String(c), i }))
                              .filter((x) => x.c.trim() !== "")
                              .map(({ c, i }) => (
                                <SelectItem key={`${key}-${i}-${c}`} value={c}>
                                  {c}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!file || previewMutation.isPending}
                    onClick={() => file && previewMutation.mutate({ file, modo: modoImportacao })}
                  >
                    Aplicar e reler ficheiro
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        )}

        {preview && !done && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">2. Pré-visualização</CardTitle>
              <CardDescription className="space-y-1">
                <span className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {preview.validos} aluno(s) prontos para importar
                </span>
                {preview.dados.some((d) => d.valido && d.turmaId) && (
                  <span className="text-sm text-muted-foreground block">
                    {preview.dados.filter((d) => d.valido && d.turmaId).length} com turma identificada — tentativa
                    automática de matrícula na confirmação.
                  </span>
                )}
                {preview.erros > 0 && (
                  <span className="flex items-center gap-2 text-destructive">
                    <XCircle className="h-4 w-4 shrink-0" />
                    {preview.erros} linha(s) com erro (serão ignoradas na confirmação)
                  </span>
                )}
                <span className="text-xs text-muted-foreground block">
                  Modo usado na pré-visualização:{" "}
                  <strong>{preview.modoImportacao === "flexivel" ? "Flexível" : "Seguro"}</strong>
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.modoImportacao === "seguro" && preview.resumoMatriculaSeguro && (
                <Alert
                  variant={
                    preview.resumoMatriculaSeguro.foraDoPeriodoLetivo ||
                    preview.resumoMatriculaSeguro.linhasComAvisoMatricula > 0
                      ? "destructive"
                      : "default"
                  }
                  className={
                    preview.resumoMatriculaSeguro.foraDoPeriodoLetivo ||
                    preview.resumoMatriculaSeguro.linhasComAvisoMatricula > 0
                      ? ""
                      : "border-green-200 bg-green-50/80 dark:bg-green-950/20 dark:border-green-900"
                  }
                >
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Checagem modo seguro</AlertTitle>
                  <AlertDescription className="text-sm space-y-1">
                    {preview.resumoMatriculaSeguro.foraDoPeriodoLetivo && (
                      <p>
                        {preview.resumoMatriculaSeguro.mensagemPeriodo ||
                          "Matrícula fora do período letivo — as linhas com turma podem falhar na confirmação."}
                      </p>
                    )}
                    <p>
                      {preview.resumoMatriculaSeguro.linhasComAvisoMatricula} linha(s) com aviso de matrícula
                      (período, vagas, ano de curso no superior, etc.).
                    </p>
                    {!preview.resumoMatriculaSeguro.foraDoPeriodoLetivo &&
                      preview.resumoMatriculaSeguro.linhasComAvisoMatricula === 0 && (
                        <p>Nenhum bloqueio óbvio detetado para as turmas resolvidas (dívida/progressão não são
                          pré-validadas para alunos novos).</p>
                      )}
                  </AlertDescription>
                </Alert>
              )}

              <div className="rounded-md border max-h-[min(420px,50vh)] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>{classeColLabel}</TableHead>
                      <TableHead>Turma</TableHead>
                      <TableHead>Matrícula turma</TableHead>
                      {preview.modoImportacao === "seguro" && (
                        <TableHead className="min-w-[180px] max-w-[240px]">Avisos (seguro)</TableHead>
                      )}
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.dados.map((row) => (
                      <TableRow key={row.linha}>
                        <TableCell className="font-medium max-w-[200px] truncate" title={row.nomeCompleto}>
                          {row.nomeCompleto || "—"}
                        </TableCell>
                        <TableCell className="max-w-[140px] truncate" title={row.classe}>
                          {row.classe || "—"}
                        </TableCell>
                        <TableCell className="max-w-[120px] truncate" title={row.turma}>
                          {row.turma || row.turmaResolvidaNome || "—"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.valido && row.turmaId ? (
                            <span className="text-green-600 dark:text-green-400">Sim</span>
                          ) : row.valido ? (
                            <span className="text-amber-700 dark:text-amber-400">Turma não encontrada</span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        {preview.modoImportacao === "seguro" && (
                          <TableCell className="text-xs align-top max-w-[240px]">
                            {row.avisosMatriculaSeguro && row.avisosMatriculaSeguro.length > 0 ? (
                              <ul className="list-disc pl-3 space-y-0.5 text-amber-800 dark:text-amber-200">
                                {row.avisosMatriculaSeguro.slice(0, 3).map((a, i) => (
                                  <li key={i} title={a}>
                                    {a.length > 90 ? `${a.slice(0, 90)}…` : a}
                                  </li>
                                ))}
                              </ul>
                            ) : row.valido && row.turmaId ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          {row.valido ? (
                            <span className="text-green-600 dark:text-green-400">✅ válido</span>
                          ) : (
                            <span className="text-destructive" title={row.erro}>
                              ❌ erro
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <p className="text-xs text-muted-foreground">
                Para alterar o modo, use o passo 1 — a pré-visualização será relida automaticamente.
              </p>

              <Button
                size="lg"
                className="w-full sm:w-auto gap-2"
                disabled={preview.validos === 0 || confirmMutation.isPending}
                onClick={() =>
                  modoImportacao === "flexivel" ? setFlexImportOpen(true) : confirmMutation.mutate()
                }
              >
                {confirmMutation.isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    A importar…
                  </>
                ) : (
                  <>🚀 Importar agora</>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {done && (
          <Card className="border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                Importação concluída
              </CardTitle>
              <CardDescription>
                <span className="text-xs text-muted-foreground block mb-1">
                  Modo:{" "}
                  <strong>
                    {done.modoImportacao === "flexivel"
                      ? "Flexível"
                      : done.modoImportacao === "seguro"
                        ? "Seguro"
                        : "—"}
                  </strong>{" "}
                  (registado na auditoria do sistema)
                </span>
                ✅ {done.importados} aluno(s) importado(s) com sucesso
                {done.matriculasEmTurma > 0 && (
                  <span className="block mt-1 text-green-800 dark:text-green-200">
                    ✔ {done.matriculasEmTurma} matriculado(s) na turma (matrícula anual + turma).
                  </span>
                )}
                {done.matriculasFalharam > 0 && (
                  <span className="block mt-1 text-amber-800 dark:text-amber-200 text-sm">
                    ⚠ {done.matriculasFalharam} com cadastro criado, mas matrícula na turma falhou — regularize em
                    Gestão de alunos / matrículas.
                  </span>
                )}
                {(() => {
                  const soCadastro = Math.max(
                    0,
                    done.importados - done.matriculasEmTurma - (done.matriculasFalharam || 0)
                  );
                  return soCadastro > 0 ? (
                    <span className="block mt-1 text-muted-foreground text-sm">
                      {soCadastro} só com cadastro (turma não identificada no ano letivo ou sem tentativa de
                      matrícula).
                    </span>
                  ) : null;
                })()}
                {done.ignorados > 0 && (
                  <span className="block mt-1 text-amber-700 dark:text-amber-400">
                    {done.ignorados} linha(s) ignorada(s) (duplicados, erros ou limite).
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {done.orientacaoPrimeiroAcesso && (
                <Alert className="border-blue-200 bg-blue-50/80 dark:bg-blue-950/25 dark:border-blue-900">
                  <BookOpen className="h-4 w-4 text-blue-700 dark:text-blue-300" />
                  <AlertTitle className="text-blue-900 dark:text-blue-100">Primeiro acesso dos alunos</AlertTitle>
                  <AlertDescription className="text-blue-900/90 dark:text-blue-100/90 text-sm">
                    {done.orientacaoPrimeiroAcesso}
                  </AlertDescription>
                </Alert>
              )}
              {done.detalhes && done.detalhes.length > 0 && (
                <div className="rounded-md border bg-background/80 p-3 text-sm max-h-36 overflow-y-auto">
                  <p className="font-medium text-foreground mb-2">Linhas ignoradas ou erro (amostra)</p>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    {done.detalhes.slice(0, 24).map((d) => (
                      <li key={`ig-${d.linha}-${d.motivo.slice(0, 24)}`}>
                        Linha {d.linha}: {d.motivo}
                      </li>
                    ))}
                  </ul>
                  {done.detalhes.length > 24 && (
                    <p className="text-xs mt-2 text-muted-foreground">Use o CSV para a lista completa.</p>
                  )}
                </div>
              )}
              {done.detalhesMatricula && done.detalhesMatricula.length > 0 && (
                <div className="rounded-md border bg-background/80 p-3 text-sm max-h-40 overflow-y-auto">
                  <p className="font-medium text-foreground mb-2">Motivos de falha na matrícula (amostra)</p>
                  <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                    {done.detalhesMatricula.slice(0, 24).map((d) => (
                      <li key={`mf-${d.linha}-${d.motivo.slice(0, 24)}`}>
                        Linha {d.linha}: {d.motivo}
                      </li>
                    ))}
                  </ul>
                  {done.detalhesMatricula.length > 24 && (
                    <p className="text-xs mt-2 text-muted-foreground">Use o CSV para a lista completa.</p>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {(done.detalhes?.length ?? 0) + (done.detalhesMatricula?.length ?? 0) > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    className="gap-2"
                    onClick={() => {
                      const csv = buildRelatorioImportacaoCsv(
                        done.detalhes ?? [],
                        done.detalhesMatricula ?? []
                      );
                      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `relatorio-importacao-estudantes-${new Date().toISOString().slice(0, 10)}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.message("Relatório CSV descarregado.");
                    }}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    Descarregar relatório (CSV)
                  </Button>
                )}
                <Button onClick={() => navigate(alunosHref)}>Ver alunos / completar matrículas</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDone(null);
                    setPreview(null);
                    setFile(null);
                  }}
                >
                  Importar outro ficheiro
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <AlertDialog open={flexImportOpen} onOpenChange={setFlexImportOpen}>
          <AlertDialogContent aria-describedby="flex-import-desc">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar importação flexível?</AlertDialogTitle>
              <AlertDialogDescription id="flex-import-desc" className="space-y-2 text-left">
                <span className="block">
                  Neste modo as regras de período letivo, dívida, capacidade e progressão são afrouxadas{" "}
                  <strong>só para esta importação</strong>. Os alunos podem ficar criados mesmo que a matrícula na
                  turma falhe.
                </span>
                <span className="block text-amber-700 dark:text-amber-300 text-sm">
                  Use quando precisar de carga em massa e for corrigir dados depois na secretaria.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setFlexImportOpen(false);
                  confirmMutation.mutate();
                }}
              >
                Sim, importar em modo flexível
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
