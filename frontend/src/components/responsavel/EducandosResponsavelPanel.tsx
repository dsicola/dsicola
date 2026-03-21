import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Mail, TrendingUp, Calendar, MessageSquare } from "lucide-react";

export interface EducandoListaItem {
  id: string;
  nome_completo: string;
  email: string;
  parentesco: string;
}

type DestinoEducando = "notas" | "frequencia" | "mensagens";

interface EducandosResponsavelPanelProps {
  alunos: EducandoListaItem[];
  selectedId: string | null;
  onNavigate: (aluno: EducandoListaItem, dest: DestinoEducando) => void;
}

export function EducandosResponsavelPanel({
  alunos,
  selectedId,
  onNavigate,
}: EducandosResponsavelPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">
          {t("pages.responsavel.myDependents")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("pages.responsavel.myDependentsDesc")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {alunos.map((aluno) => {
          const isActive = selectedId === aluno.id;
          return (
            <Card
              key={aluno.id}
              className={isActive ? "border-primary/50 shadow-sm ring-1 ring-primary/20" : ""}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg leading-tight flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="line-clamp-2">{aluno.nome_completo}</span>
                  </CardTitle>
                  <Badge variant={isActive ? "default" : "secondary"} className="shrink-0">
                    {aluno.parentesco}
                  </Badge>
                </div>
                {aluno.email ? (
                  <CardDescription className="flex items-center gap-1.5 pt-1">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{aluno.email}</span>
                  </CardDescription>
                ) : null}
              </CardHeader>
              <CardContent className="flex flex-col gap-2 pt-0">
                {isActive ? (
                  <p className="text-xs text-muted-foreground mb-1">
                    {t("pages.responsavel.activeSelection")}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="flex-1 min-w-[8rem]"
                    onClick={() => onNavigate(aluno, "notas")}
                  >
                    <TrendingUp className="h-4 w-4 mr-1.5" />
                    {t("pages.responsavel.openGrades")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[8rem]"
                    onClick={() => onNavigate(aluno, "frequencia")}
                  >
                    <Calendar className="h-4 w-4 mr-1.5" />
                    {t("pages.responsavel.openAttendance")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1 min-w-[8rem]"
                    onClick={() => onNavigate(aluno, "mensagens")}
                  >
                    <MessageSquare className="h-4 w-4 mr-1.5" />
                    {t("pages.responsavel.openMessages")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
