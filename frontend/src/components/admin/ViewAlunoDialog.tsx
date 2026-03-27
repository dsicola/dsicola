import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  User,
  Mail,
  Phone,
  IdCard,
  Calendar,
  MapPin,
  Users,
  Loader2,
  Pencil,
} from "lucide-react";
import { EncarregadosAlunoSection } from "./EncarregadosAlunoSection";
import { AlunoAcessoAba } from "./AlunoAcessoAba";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { profilesApi } from "@/services/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AlunoDocumentosHub } from "@/components/admin/AlunoDocumentosHub";
import { getApiErrorMessage } from "@/utils/apiErrors";

interface ViewAlunoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alunoId: string | null;
  /** Base path para edição (ex: /admin-dashboard ou /secretaria-dashboard) */
  editBasePath?: string;
  /** Fallback para exibição imediata enquanto carrega (dados da lista) */
  alunoFallback?: {
    id: string;
    nome_completo?: string;
    nomeCompleto?: string;
    email?: string;
    status_aluno?: string;
    statusAluno?: string;
  } | null;
}

/** Normaliza resposta da API (camelCase ou snake_case) para formato consistente */
function normalizeAluno(raw: any) {
  if (!raw) return null;
  return {
    id: raw.id,
    nome_completo: raw.nome_completo ?? raw.nomeCompleto ?? "",
    email: raw.email ?? "",
    telefone: raw.telefone ?? null,
    numero_identificacao: raw.numero_identificacao ?? raw.numeroIdentificacao ?? null,
    numero_identificacao_publica: raw.numero_identificacao_publica ?? raw.numeroIdentificacaoPublica ?? null,
    avatar_url: raw.avatar_url ?? raw.avatarUrl ?? null,
    genero: raw.genero ?? null,
    data_nascimento: raw.data_nascimento ?? raw.dataNascimento ?? null,
    cidade: raw.cidade ?? null,
    pais: raw.pais ?? null,
    provincia: raw.provincia ?? null,
    morada: raw.morada ?? null,
    tipo_sanguineo: raw.tipo_sanguineo ?? raw.tipoSanguineo ?? null,
    nome_pai: raw.nome_pai ?? raw.nomePai ?? null,
    nome_mae: raw.nome_mae ?? raw.nomeMae ?? null,
    profissao: raw.profissao ?? null,
    status_aluno: raw.status_aluno ?? raw.statusAluno ?? null,
  };
}

export function ViewAlunoDialog({
  open,
  onOpenChange,
  alunoId,
  editBasePath = "/admin-dashboard",
  alunoFallback,
}: ViewAlunoDialogProps) {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const staffDocRoles = ["ADMIN", "SUPER_ADMIN", "SECRETARIA", "COORDENADOR", "DIRECAO"] as const;
  const userRoles = ((user as { roles?: string[] })?.roles ?? []) as string[];
  const canSeeDocumentosHub =
    staffDocRoles.includes(role as (typeof staffDocRoles)[number]) ||
    userRoles.some((r) => staffDocRoles.includes(r as (typeof staffDocRoles)[number]));
  const isSecretariaPanel = editBasePath.includes("secretaria");

  const { data: rawAluno, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["profile", alunoId],
    queryFn: () => profilesApi.getById(alunoId!),
    enabled: open && !!alunoId,
  });

  const aluno = rawAluno ? normalizeAluno(rawAluno) : alunoFallback ? normalizeAluno(alunoFallback) : null;

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return Number.isNaN(d.getTime()) ? "—" : format(d, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "—";
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Ativo":
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>;
      case "Inativo":
        return <Badge variant="secondary">Inativo</Badge>;
      case "Inativo por inadimplência":
        return <Badge variant="destructive">Inadimplente</Badge>;
      default:
        return <Badge className="bg-emerald-600 hover:bg-emerald-600">Ativo</Badge>;
    }
  };

  const InfoItem = ({
    icon: Icon,
    label,
    value,
  }: {
    icon: React.ElementType;
    label: string;
    value: string | null | undefined;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 rounded-md bg-muted/80 p-1.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="font-medium text-foreground">{value || "—"}</p>
      </div>
    </div>
  );

  if (!alunoId && !alunoFallback) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {isLoading && !alunoFallback ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">A carregar dados do aluno...</p>
          </div>
        ) : aluno ? (
          <>
            {isError && !rawAluno && !!alunoFallback && (
              <div className="mx-6 mt-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span>
                  Não foi possível atualizar os dados completos. A mostrar a informação disponível na listagem.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-amber-600/50"
                  onClick={() => refetch()}
                >
                  Tentar novamente
                </Button>
              </div>
            )}
            <DialogHeader className="px-6 pt-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 border-2 border-primary/20 shadow-md">
                    <AvatarImage src={aluno.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
                      {getInitials(aluno.nome_completo)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Detalhes do Estudante</p>
                    <DialogTitle className="text-xl font-bold tracking-tight mt-0">
                      {aluno.nome_completo}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{aluno.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {getStatusBadge(aluno.status_aluno)}
                      {aluno.numero_identificacao_publica && (
                        <Badge variant="outline" className="font-mono">
                          Nº {aluno.numero_identificacao_publica}
                        </Badge>
                      )}
                      {aluno.genero && (
                        <Badge variant="outline">{aluno.genero}</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`${editBasePath}/editar-aluno/${aluno.id}`);
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
            </DialogHeader>

            <Separator />

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {/* Dados Pessoais */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados Pessoais
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoItem icon={User} label="Nome Completo" value={aluno.nome_completo} />
                  <InfoItem icon={Mail} label="Email" value={aluno.email} />
                  <InfoItem icon={Phone} label="Telefone" value={aluno.telefone} />
                  <InfoItem icon={IdCard} label="Número de Identificação (BI)" value={aluno.numero_identificacao} />
                  <InfoItem icon={Calendar} label="Data de Nascimento" value={formatDate(aluno.data_nascimento)} />
                  {aluno.tipo_sanguineo && (
                    <InfoItem icon={User} label="Tipo Sanguíneo" value={aluno.tipo_sanguineo} />
                  )}
                  {aluno.profissao && (
                    <InfoItem icon={User} label="Profissão" value={aluno.profissao} />
                  )}
                </CardContent>
              </Card>

              {/* Endereço */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0">
                  <InfoItem icon={MapPin} label="Morada" value={aluno.morada} />
                  <InfoItem icon={MapPin} label="Cidade" value={aluno.cidade} />
                  {aluno.provincia && (
                    <InfoItem icon={MapPin} label="Província" value={aluno.provincia} />
                  )}
                  <InfoItem icon={MapPin} label="País" value={aluno.pais} />
                </CardContent>
              </Card>

              {/* Dados dos Encarregados (informativos) */}
              {(aluno.nome_pai || aluno.nome_mae) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Dados dos Encarregados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0">
                    <InfoItem icon={Users} label="Nome do Pai" value={aluno.nome_pai} />
                    <InfoItem icon={Users} label="Nome da Mãe" value={aluno.nome_mae} />
                  </CardContent>
                </Card>
              )}

              {/* Encarregados com conta de acesso */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Encarregados com Conta de Acesso</CardTitle>
                </CardHeader>
                <CardContent>
                  <EncarregadosAlunoSection alunoId={aluno.id} readOnly={false} />
                </CardContent>
              </Card>

              {canSeeDocumentosHub ? (
                <AlunoDocumentosHub
                  alunoId={aluno.id}
                  alunoNome={aluno.nome_completo}
                  isSecretaria={isSecretariaPanel}
                  compact
                />
              ) : null}

              <AlunoAcessoAba alunoId={aluno.id} alunoEmail={aluno.email || undefined} />
            </div>
          </>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-4 py-16 px-6">
            <p className="text-sm text-destructive text-center max-w-md">
              {getApiErrorMessage(
                error,
                "Não foi possível carregar os dados do estudante. Verifique a ligação e as permissões.",
              )}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
              Tentar novamente
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
