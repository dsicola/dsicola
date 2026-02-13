import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProfessoresTab } from "@/components/admin/ProfessoresTab";
import { AtribuicaoDisciplinasTab } from "@/components/admin/AtribuicaoDisciplinasTab";
import { Users, BookOpen } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function GestaoProfessores() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Gestão de Professores
          </h1>
          <p className="text-muted-foreground">
            Gerencie professores e atribua disciplinas
          </p>
        </div>

        <Tabs defaultValue="professores" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="professores" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Professores</span>
            </TabsTrigger>
            <TabsTrigger value="atribuicoes" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Atribuição de Disciplinas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="professores">
            <ProfessoresTab />
          </TabsContent>

          <TabsContent value="atribuicoes">
            <AtribuicaoDisciplinasTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
