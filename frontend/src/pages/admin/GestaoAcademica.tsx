import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Layers, Users, ClipboardList, FileCheck, Clock, FileText, Sun, UserPlus, GraduationCap, School, Network } from 'lucide-react';
import { ClassesTab } from '@/components/admin/ClassesTab';
import { CursosProgramaTab } from '@/components/admin/CursosProgramaTab';
import { DisciplinasTab } from '@/components/admin/DisciplinasTab';
import { MatrizCurricularTab } from '@/components/admin/MatrizCurricularTab';
import { TurmasTab } from '@/components/admin/TurmasTab';
import { NotasTab } from '@/components/admin/NotasTab';
import { ExamesTab } from '@/components/admin/ExamesTab';
import { HorariosTab } from '@/components/admin/HorariosTab';
import { PautasTab } from '@/components/admin/PautasTab';
import { TurnosTab } from '@/components/admin/TurnosTab';
import { CandidaturasTab } from '@/components/admin/CandidaturasTab';
import { useInstituicao } from '@/contexts/InstituicaoContext';

const GestaoAcademica: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tipoAcademico, isSecundario, isSuperior } = useInstituicao();
  
  // Default tab será definido dinamicamente baseado no tipo acadêmico
  
  // Valid tabs - ajustar default baseado no tipo acadêmico
  // CORRIGIDO: Cursos existem em ambos, então default pode ser 'cursos' para ambos
  const defaultTabForType = isSecundario ? 'cursos' : isSuperior ? 'cursos' : 'turmas';
  const validTabs = ['cursos', 'classes', 'turmas', 'disciplinas', 'matriz-curricular', 'turnos', 'candidaturas', 'notas', 'exames', 'horarios', 'pautas'];
  
  // Get tab from URL, ensuring it's valid
  const getTabFromUrl = (): string => {
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) {
      // CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO)
      // For 'classes' tab, only show if ensino secundário
      if (tab === 'classes' && !isSecundario) {
        return defaultTabForType;
      }
      // For 'candidaturas' tab, only show if ensino superior
      if (tab === 'candidaturas' && !isSuperior) {
        return defaultTabForType;
      }
      return tab;
    }
    return defaultTabForType;
  };
  
  const [activeTab, setActiveTab] = useState(() => {
    // Initialize from URL on mount
    const tab = searchParams.get('tab');
    if (tab && validTabs.includes(tab)) {
      // CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO)
      if (tab === 'classes' && !isSecundario) {
        return defaultTabForType;
      }
      if (tab === 'candidaturas' && !isSuperior) {
        return defaultTabForType;
      }
      return tab;
    }
    return defaultTabForType;
  });

  useEffect(() => {
    // Update tab when URL changes
    const tab = getTabFromUrl();
    setActiveTab(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isSecundario, isSuperior]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === defaultTabForType) {
      setSearchParams({});
    } else {
      setSearchParams({ tab: value });
    }
  };

  // Labels dinâmicos baseados no tipo acadêmico da instituição
  const labels = {
    turmas: isSecundario ? t('pages.turmasClasses') : t('menu.classes'),
    notas: isSecundario ? t('pages.notasTrimestrais') : t('grades.title'),
    pautas: isSecundario ? t('pages.pautasTrimestrais') : t('pages.pautas'),
    classes: isSecundario ? t('pages.classesAnos') : t('menu.classes'),
    periodoLabel: isSecundario ? t('pages.trimestre') : t('pages.semestre'),
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            {isSecundario ? (
              <School className="h-6 w-6 text-primary" />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
            {t('pages.gestaoAcademica')}
          </h1>
          <p className="text-muted-foreground">
            {t('pages.gestaoAcademicaDesc')}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
              {/* CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO) */}
              {/* Cursos aparecem em AMBOS os tipos (Secundário e Superior) */}
              <TabsTrigger value="cursos" className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.cursos')}</span>
              </TabsTrigger>
              {/* CRITICAL: Classes só aparecem no Ensino Secundário */}
              {isSecundario && (
                <TabsTrigger value="classes" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  <span className="hidden sm:inline">{labels.classes}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="turmas" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">{labels.turmas}</span>
              </TabsTrigger>
              <TabsTrigger value="disciplinas" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.disciplinas')}</span>
              </TabsTrigger>
              <TabsTrigger value="matriz-curricular" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.matrizCurricular')}</span>
              </TabsTrigger>
              <TabsTrigger value="turnos" className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.turnos')}</span>
              </TabsTrigger>
              {isSuperior && (
                <TabsTrigger value="candidaturas" className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">{t('pages.candidaturas')}</span>
                </TabsTrigger>
              )}
              <TabsTrigger value="notas" className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden sm:inline">{labels.notas}</span>
              </TabsTrigger>
              <TabsTrigger value="exames" className="flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                <span className="hidden sm:inline">{t('pages.exames')}</span>
              </TabsTrigger>
              <TabsTrigger value="horarios" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>{t('pages.horarios')}</span>
              </TabsTrigger>
              <TabsTrigger value="pautas" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">{labels.pautas}</span>
              </TabsTrigger>
          </TabsList>

          {/* CORRIGIDO: Cursos EXISTEM no Ensino Secundário (representam ÁREA/OPÇÃO) */}
          {/* Cursos aparecem em AMBOS os tipos (Secundário e Superior) */}
          <TabsContent value="cursos">
            <CursosProgramaTab />
          </TabsContent>

          {isSecundario && (
            <TabsContent value="classes">
              <ClassesTab />
            </TabsContent>
          )}

          <TabsContent value="turmas">
            <TurmasTab />
          </TabsContent>

          <TabsContent value="disciplinas">
            <DisciplinasTab />
          </TabsContent>

          <TabsContent value="matriz-curricular">
            <MatrizCurricularTab />
          </TabsContent>

          <TabsContent value="turnos">
            <TurnosTab />
          </TabsContent>

          {isSuperior && (
            <TabsContent value="candidaturas">
              <CandidaturasTab />
            </TabsContent>
          )}

          <TabsContent value="notas">
            <NotasTab />
          </TabsContent>

          <TabsContent value="exames">
            <ExamesTab />
          </TabsContent>

          <TabsContent value="horarios">
            <HorariosTab />
          </TabsContent>

          <TabsContent value="pautas">
            <PautasTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default GestaoAcademica;
