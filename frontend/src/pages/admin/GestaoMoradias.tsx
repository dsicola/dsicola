import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlojamentosTab } from "@/components/admin/AlojamentosTab";
import { AlocacoesTab } from "@/components/admin/AlocacoesTab";
import { Home, Users, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function GestaoMoradias() {
  const navigate = useNavigate();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/admin-dashboard")}
          className="shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Moradias</h1>
          <p className="text-muted-foreground">
            Gerencie alojamentos e alocações de alunos
          </p>
        </div>
      </div>

      <Tabs defaultValue="alojamentos" className="space-y-4">
        <TabsList>
          <TabsTrigger value="alojamentos" className="gap-2">
            <Home className="h-4 w-4" />
            Quartos
          </TabsTrigger>
          <TabsTrigger value="alocacoes" className="gap-2">
            <Users className="h-4 w-4" />
            Alocações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alojamentos">
          <AlojamentosTab />
        </TabsContent>

        <TabsContent value="alocacoes">
          <AlocacoesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
