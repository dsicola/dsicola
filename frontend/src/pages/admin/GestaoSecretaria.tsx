import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { POSTab } from "@/components/admin/POSTab";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function GestaoSecretaria() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-6">
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
            <h1 className="text-3xl font-bold tracking-tight">Gestão POS (Ponto de Venda)</h1>
            <p className="text-muted-foreground">
              Gerencie os funcionários com acesso ao módulo de pagamentos rápidos
            </p>
          </div>
        </div>

        <POSTab />
      </div>
    </DashboardLayout>
  );
}
