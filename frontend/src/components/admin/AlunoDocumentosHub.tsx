import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { conclusaoCursoApi } from "@/services/api";
import {
  BookOpen,
  FileText,
  GraduationCap,
  Printer,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import {
  PATH_VERIFICAR_CERTIFICADO_CONCLUSAO,
  PATH_VERIFICAR_PAUTA,
} from "@/components/common/AutenticidadeVerificacaoCallout";

const PATH_VERIFICAR_DOCUMENTO = "/verificar-documento";

export interface AlunoDocumentosHubProps {
  alunoId: string;
  alunoNome?: string;
  /** Quando o utilizador está no painel da secretaria */
  isSecretaria: boolean;
  /** Diálogo ver estudante: layout mais compacto */
  compact?: boolean;
}

/**
 * Atalhos no perfil do estudante: pautas (por plano), conclusão/certificado,
 * documentos oficiais no mesmo separador; validação pública (links).
 * Não substitui emissões — só orienta o fluxo real (documentos separados).
 */
export function AlunoDocumentosHub({
  alunoId,
  alunoNome,
  isSecretaria,
  compact = false,
}: AlunoDocumentosHubProps) {
  const gestaoConclusaoHref = isSecretaria
    ? "/secretaria-dashboard/matriculas?tab=conclusao-curso"
    : "/admin-dashboard/gestao-alunos?tab=conclusao-curso";
  const certificadosHref = isSecretaria
    ? "/secretaria-dashboard/certificados"
    : "/admin-dashboard/certificados";
  /** Admin e Secretaria usam a mesma rota de impressão (pauta oficial). */
  const relatoriosOficiaisHref = "/secretaria-dashboard/relatorios-oficiais";

  const { data: conclusoesRaw, isLoading: conclusoesLoading } = useQuery({
    queryKey: ["conclusoes-cursos", "hub", alunoId],
    queryFn: () => conclusaoCursoApi.getAll({ alunoId }),
    enabled: !!alunoId,
  });

  const conclusoes = Array.isArray(conclusoesRaw) ? conclusoesRaw : [];
  const comRegisto =
    conclusoes.filter(
      (c: { certificado?: unknown; colacaoGrau?: unknown }) => c.certificado || c.colacaoGrau,
    ).length;
  const pendentes = conclusoes.filter((c: { status?: string }) => c.status === "PENDENTE").length;

  return (
    <Card className={compact ? "border-border" : "border-primary/20 bg-muted/20"}>
      <CardHeader className={compact ? "py-3 px-4" : "pb-2"}>
        <CardTitle className={`flex items-center gap-2 ${compact ? "text-sm" : "text-base"}`}>
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          Documentos do estudante
        </CardTitle>
        <CardDescription className={compact ? "text-xs" : ""}>
          Cada tipo de documento tem o seu fluxo (pauta por disciplina, declarações/histórico aqui em baixo,
          certificado de conclusão após trâmite na gestão).{" "}
          {alunoNome ? <span className="font-medium text-foreground">{alunoNome}</span> : null}
        </CardDescription>
      </CardHeader>
      <CardContent className={`space-y-3 ${compact ? "px-4 pb-4 pt-0" : ""}`}>
        {!conclusoesLoading && conclusoes.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary" className="font-normal">
              {conclusoes.length} conclusão(ões) / processo(s)
            </Badge>
            {comRegisto > 0 ? (
              <Badge variant="outline" className="font-normal text-emerald-700 border-emerald-600/40">
                Certificado ou colação: {comRegisto}
              </Badge>
            ) : null}
            {pendentes > 0 ? (
              <Badge variant="outline" className="font-normal">
                Pendente(s): {pendentes}
              </Badge>
            ) : null}
          </div>
        )}

        <div className={`grid gap-2 ${compact ? "grid-cols-1" : "sm:grid-cols-2"}`}>
          <Button variant="outline" size={compact ? "sm" : "default"} className="justify-between h-auto py-2" asChild>
            <Link to={relatoriosOficiaisHref}>
              <span className="flex items-center gap-2 text-left">
                <Printer className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium block">Relatórios oficiais</span>
                  <span className="text-xs font-normal text-muted-foreground block">
                    Mini pauta por plano de ensino (código próprio)
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          </Button>

          <Button variant="outline" size={compact ? "sm" : "default"} className="justify-between h-auto py-2" asChild>
            <Link to={gestaoConclusaoHref}>
              <span className="flex items-center gap-2 text-left">
                <GraduationCap className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium block">Conclusão de curso</span>
                  <span className="text-xs font-normal text-muted-foreground block">
                    Certificado PDF após conclusão / colação (outro código)
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          </Button>

          <Button variant="outline" size={compact ? "sm" : "default"} className="justify-between h-auto py-2" asChild>
            <Link to={certificadosHref}>
              <span className="flex items-center gap-2 text-left">
                <FileText className="h-4 w-4 shrink-0" />
                <span>
                  <span className="font-medium block">Certificados e modelos</span>
                  <span className="text-xs font-normal text-muted-foreground block">
                    Modelos importados e documentos da instituição
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
            </Link>
          </Button>

          <div
            className={`rounded-md border border-dashed bg-background/80 px-3 py-2 flex items-start gap-2 ${
              compact ? "text-xs" : "text-sm"
            }`}
          >
            <FileText className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
            <p className="text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Neste separador:</span> use{" "}
              <strong>Emitir documento oficial</strong> abaixo para declaração, histórico escolar ou certificado por
              modelo — com código para{" "}
              <code className="text-[10px] rounded bg-muted px-1">{PATH_VERIFICAR_DOCUMENTO}</code>.
            </p>
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 border-t border-border/60 text-muted-foreground ${compact ? "text-[10px]" : "text-xs"}`}>
          <span className="font-medium text-foreground">Validação pública:</span>
          <a
            href={PATH_VERIFICAR_PAUTA}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Pauta <ExternalLink className="h-3 w-3" />
          </a>
          <span aria-hidden>·</span>
          <a
            href={PATH_VERIFICAR_DOCUMENTO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Documento <ExternalLink className="h-3 w-3" />
          </a>
          <span aria-hidden>·</span>
          <a
            href={PATH_VERIFICAR_CERTIFICADO_CONCLUSAO}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-primary hover:underline"
          >
            Certificado conclusão <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
