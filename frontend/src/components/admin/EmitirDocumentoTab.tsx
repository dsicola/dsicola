/**
 * Aba Emitir Documento Oficial
 *
 * Tela no perfil do estudante para Secretaria/Admin:
 * - Selecionar tipo (Declaração, Histórico, Certificado)
 * - Prévia (dados auto-preenchidos)
 * - Botão Emitir PDF
 * - Lista de documentos emitidos com status e nº
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { documentosOficialApi, profilesApi, matriculasApi } from "@/services/api";
import { useInstituicao } from "@/contexts/InstituicaoContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { FileText, Loader2, Download, Ban, CheckCircle, AlertCircle, User, PenLine } from "lucide-react";
import { downloadFichaCadastralAluno, downloadDeclaracaoPersonalizada, formatAnoFrequenciaSuperior } from "@/utils/pdfGenerator";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPOS_DOCUMENTO = [
  { value: "DECLARACAO_MATRICULA", label: "Declaração de Matrícula" },
  { value: "DECLARACAO_FREQUENCIA", label: "Declaração de Frequência" },
  { value: "HISTORICO", label: "Histórico Escolar" },
  { value: "CERTIFICADO", label: "Certificado de Conclusão" },
];

interface EmitirDocumentoTabProps {
  estudanteId: string;
  estudanteNome?: string;
}

export function EmitirDocumentoTab({ estudanteId, estudanteNome }: EmitirDocumentoTabProps) {
  const queryClient = useQueryClient();
  const { config, isSecundario } = useInstituicao();
  const [tipoDocumento, setTipoDocumento] = useState<string>("");
  const [observacao, setObservacao] = useState("");
  const [declaracaoTexto, setDeclaracaoTexto] = useState("");
  const [declaracaoTitulo, setDeclaracaoTitulo] = useState("Declaração");
  const [anularDialogOpen, setAnularDialogOpen] = useState(false);
  const [documentoAnular, setDocumentoAnular] = useState<{ id: string; numeroDocumento: string } | null>(null);
  const [motivoAnulacao, setMotivoAnulacao] = useState("");

  const { data: documentos = [], isLoading } = useQuery({
    queryKey: ["documentos-oficial", estudanteId],
    queryFn: () => documentosOficialApi.listar({ estudanteId }),
    enabled: !!estudanteId,
  });

  const { data: profileAluno } = useQuery({
    queryKey: ["profile-aluno-doc", estudanteId],
    queryFn: () => profilesApi.getById(estudanteId),
    enabled: !!estudanteId,
  });

  const { data: matriculasAluno = [] } = useQuery({
    queryKey: ["matriculas-aluno-doc", estudanteId],
    queryFn: async () => {
      const res = await matriculasApi.getByAlunoId(estudanteId);
      return res?.data ?? [];
    },
    enabled: !!estudanteId,
  });

  const matriculaAtiva = Array.isArray(matriculasAluno) ? matriculasAluno.find((m: any) => m.status === "Ativa" || m.status === "ativa") : null;
  const turmaInfo = matriculaAtiva?.turmas || matriculaAtiva?.turma;

  const { data: preValidacao, isLoading: isValidando } = useQuery({
    queryKey: ["documentos-pre-validar", estudanteId, tipoDocumento],
    queryFn: () =>
      documentosOficialApi.preValidar({
        tipoDocumento,
        estudanteId,
      }),
    enabled: !!estudanteId && !!tipoDocumento,
  });

  const emitirMutation = useMutation({
    mutationFn: () =>
      documentosOficialApi.emitir({
        tipoDocumento,
        estudanteId,
        observacao: observacao || undefined,
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["documentos-oficial", estudanteId] });
      toast.success(
        `Documento emitido: ${data.numeroDocumento}. Código: ${data.codigoVerificacao}`
      );
    },
    onError: (error: any) => {
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Erro ao emitir documento";
      toast.error(msg);
    },
  });

  const downloadPdfMutation = useMutation({
    mutationFn: (id: string) => documentosOficialApi.downloadPdf(id),
    onSuccess: (blob, id) => {
      const doc = documentos.find((d: any) => d.id === id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `documento-${doc?.numeroDocumento || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erro ao baixar PDF");
    },
  });

  const anularMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      documentosOficialApi.anular(id, motivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-oficial", estudanteId] });
      toast.success("Documento anulado com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Erro ao anular");
    },
  });

  const tipoLabel = TIPOS_DOCUMENTO.find((t) => t.value === tipoDocumento)?.label;

  return (
    <div className="space-y-6">
      {/* Emitir Novo Documento */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Emitir Documento Oficial
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Documentos gerados automaticamente a partir dos dados do sistema. Sem texto livre.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Tipo de Documento</label>
            <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_DOCUMENTO.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {tipoDocumento && (
            <>
              {preValidacao && !preValidacao.valido && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Não é possível emitir</p>
                    <p className="text-sm text-muted-foreground">{preValidacao.erro}</p>
                    {preValidacao.erro?.includes("financeir") && (
                      <p className="text-sm mt-1">Bloqueado por pendência financeira</p>
                    )}
                    {preValidacao.erro?.includes("matrícula") && (
                      <p className="text-sm mt-1">Estudante sem matrícula ativa no ano letivo</p>
                    )}
                    {preValidacao.erro?.includes("concluído") && (
                      <p className="text-sm mt-1">Curso ainda não concluído (certificado)</p>
                    )}
                  </div>
                </div>
              )}

              {preValidacao?.valido && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <p className="text-sm">Prévia OK. Dados serão preenchidos automaticamente.</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => emitirMutation.mutate()}
                  disabled={!preValidacao?.valido || emitirMutation.isPending}
                >
                  {emitirMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Emitindo...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Emitir PDF
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Ficha Cadastral (PDF local - sem registro oficial) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Ficha Cadastral do Aluno
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Imprimir ficha com dados pessoais e académicos do estudante
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const p = profileAluno as any;
                await downloadFichaCadastralAluno({
                  instituicao: {
                    nome: config?.nome_instituicao || "Instituição",
                    nif: (config as { nif?: string })?.nif ?? null,
                    endereco: config?.endereco ?? null,
                    logoUrl: config?.logo_url ?? null,
                    telefone: config?.telefone ?? null,
                    email: config?.email ?? null,
                    tipoAcademico: isSecundario ? 'SECUNDARIO' : 'SUPERIOR',
                  },
                  aluno: {
                    nome: p?.nome_completo || p?.nomeCompleto || estudanteNome || "Aluno",
                    numeroId: p?.numero_identificacao_publica ?? p?.numeroIdentificacaoPublica,
                    numeroIdentificacao: p?.numero_identificacao ?? p?.numeroIdentificacao,
                    dataNascimento: p?.data_nascimento ?? p?.dataNascimento,
                    genero: p?.genero,
                    email: p?.email,
                    telefone: p?.telefone,
                    morada: p?.morada,
                    cidade: p?.cidade,
                    pais: p?.pais,
                    codigoPostal: p?.codigo_postal ?? p?.codigoPostal,
                    nomePai: p?.nome_pai ?? p?.nomePai,
                    nomeMae: p?.nome_mae ?? p?.nomeMae,
                    tipoSanguineo: p?.tipo_sanguineo ?? p?.tipoSanguineo,
                    curso: (turmaInfo as { curso?: { nome: string } })?.curso?.nome ?? (turmaInfo as { classe?: { nome: string } })?.classe?.nome,
                    turma: (turmaInfo as { nome?: string })?.nome,
                    anoFrequencia: formatAnoFrequenciaSuperior(turmaInfo as { ano?: number; classe?: { nome?: string } }),
                    classeFrequencia: (turmaInfo as { classe?: { nome: string } })?.classe?.nome ?? null,
                    statusAluno: p?.status_aluno ?? p?.statusAluno,
                  },
                });
                toast.success("Ficha cadastral gerada");
              } catch (e) {
                toast.error("Erro ao gerar ficha cadastral");
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Gerar Ficha Cadastral (PDF)
          </Button>
        </CardContent>
      </Card>

      {/* Declaração Personalizada (texto livre) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenLine className="h-5 w-5" />
            Declaração Personalizada
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Escreva o texto da declaração e gere um PDF com cabeçalho da instituição
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título da declaração</Label>
            <Input
              placeholder="Ex: Declaração de matrícula, Declaração de frequência..."
              value={declaracaoTitulo}
              onChange={(e) => setDeclaracaoTitulo(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Texto da declaração</Label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1"
              placeholder="Ex: Declaro para os devidos fins que..."
              value={declaracaoTexto}
              onChange={(e) => setDeclaracaoTexto(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            disabled={!declaracaoTexto.trim()}
            onClick={async () => {
              try {
                await downloadDeclaracaoPersonalizada({
                  instituicao: {
                    nome: config?.nome_instituicao || "Instituição",
                    nif: (config as { nif?: string })?.nif ?? null,
                    endereco: config?.endereco ?? null,
                    logoUrl: config?.logo_url ?? null,
                    telefone: config?.telefone ?? null,
                    email: config?.email ?? null,
                  },
                  alunoNome: estudanteNome || (profileAluno as any)?.nome_completo || (profileAluno as any)?.nomeCompleto,
                  titulo: declaracaoTitulo || "Declaração",
                  texto: declaracaoTexto.trim(),
                });
                toast.success("Declaração personalizada gerada");
              } catch (e) {
                toast.error("Erro ao gerar declaração");
              }
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Gerar Declaração (PDF)
          </Button>
        </CardContent>
      </Card>

      {/* Lista de Documentos Emitidos */}
      <Card>
        <CardHeader>
          <CardTitle>Documentos Emitidos</CardTitle>
          <p className="text-sm text-muted-foreground">
            Histórico de documentos oficiais para {estudanteNome || "o estudante"}
          </p>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : documentos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum documento emitido ainda</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documentos.map((doc: any) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-4 rounded-lg border bg-card"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {TIPOS_DOCUMENTO.find((t) => t.value === doc.tipoDocumento)?.label ||
                          doc.tipoDocumento}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Nº {doc.numeroDocumento} •{" "}
                        {format(new Date(doc.dataEmissao), "dd/MM/yyyy", { locale: ptBR })}
                        {doc.codigoVerificacao && (
                          <> • Código: {doc.codigoVerificacao}</>
                        )}
                      </p>
                    </div>
                    <Badge
                      variant={doc.status === "ATIVO" ? "default" : "destructive"}
                    >
                      {doc.status}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    {doc.status === "ATIVO" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadPdfMutation.mutate(doc.id)}
                          disabled={downloadPdfMutation.isPending}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setDocumentoAnular({ id: doc.id, numeroDocumento: doc.numeroDocumento });
                            setMotivoAnulacao("");
                            setAnularDialogOpen(true);
                          }}
                        >
                          <Ban className="h-4 w-4 mr-1" />
                          Anular
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação para anular documento */}
      <AlertDialog open={anularDialogOpen} onOpenChange={setAnularDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular Documento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O documento{" "}
              <strong>{documentoAnular?.numeroDocumento}</strong> passará a constar como ANULADO e
              não poderá mais ser baixado ou utilizado. Recomenda-se informar o motivo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="motivo-anulacao">Motivo (opcional)</Label>
            <Input
              id="motivo-anulacao"
              placeholder="Ex: Erro de digitação, solicitado pelo estudante..."
              value={motivoAnulacao}
              onChange={(e) => setMotivoAnulacao(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDocumentoAnular(null);
                setMotivoAnulacao("");
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (documentoAnular) {
                  anularMutation.mutate(
                    { id: documentoAnular.id, motivo: motivoAnulacao || undefined },
                    {
                      onSettled: () => {
                        setAnularDialogOpen(false);
                        setDocumentoAnular(null);
                        setMotivoAnulacao("");
                      },
                    }
                  );
                }
              }}
              disabled={anularMutation.isPending}
            >
              {anularMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Anulando...
                </>
              ) : (
                "Confirmar Anulação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
