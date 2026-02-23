import { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlunosTab } from "@/components/admin/AlunosTab";
import { MatriculasAlunoTab } from "@/components/admin/MatriculasAlunoTab";
import { MatriculasTurmasTab } from "@/components/admin/MatriculasTurmasTab";
import { MatriculasAnuaisTab } from "@/components/admin/MatriculasAnuaisTab";
import { ConclusaoCursoTab } from "@/components/admin/ConclusaoCursoTab";
import { Users, BookOpen, ArrowLeft, LogOut, GraduationCap, Calendar, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function GestaoAlunos() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut, role } = useAuth();
  const location = useLocation();
  const isSecretaria = role === 'SECRETARIA' || location.pathname.includes('secretaria');
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Ler tab da URL ou usar default
  const tabFromUrl = searchParams.get('tab');
  const validTabs = ['matriculas-anuais', 'alunos', 'matriculas-turmas', 'matriculas-disciplinas', 'conclusao-curso'];
  const defaultTab = validTabs.includes(tabFromUrl || '') ? tabFromUrl : 'matriculas-anuais';
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    // Atualizar tab quando URL mudar
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'matriculas-anuais') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(isSecretaria ? "/secretaria-dashboard" : "/admin-dashboard")}
              className="shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('pages.gestaoEstudantes')}</h1>
            <p className="text-muted-foreground">
              {t('pages.gestaoEstudantesDesc')}
            </p>
            </div>
          </div>
          <Button 
            variant="destructive" 
            onClick={async () => {
              await signOut();
              navigate('/auth');
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('pages.sair')}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="matriculas-anuais" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.matriculasAnuais')}</span>
            </TabsTrigger>
            <TabsTrigger value="alunos" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.estudantes')}</span>
            </TabsTrigger>
            <TabsTrigger value="matriculas-turmas" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.matriculasTurmas')}</span>
            </TabsTrigger>
            <TabsTrigger value="matriculas-disciplinas" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.matriculasDisciplinas')}</span>
            </TabsTrigger>
            <TabsTrigger value="conclusao-curso" className="flex items-center gap-2">
              <Award className="h-4 w-4" />
              <span className="hidden sm:inline">{t('pages.conclusaoCurso')}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="matriculas-anuais">
            <MatriculasAnuaisTab />
          </TabsContent>

          <TabsContent value="alunos">
            <AlunosTab />
          </TabsContent>

          <TabsContent value="matriculas-turmas">
            <MatriculasTurmasTab />
          </TabsContent>

          <TabsContent value="matriculas-disciplinas">
            <MatriculasAlunoTab />
          </TabsContent>

          <TabsContent value="conclusao-curso">
            <ConclusaoCursoTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
