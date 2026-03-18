import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CertificadosTab } from "@/components/admin/CertificadosTab";
import { ModelosDocumentosTab } from "@/components/admin/ModelosDocumentosTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";

export default function CertificadosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const activeTab = tabFromUrl === "modelos" ? "modelos" : tabFromUrl === "certificados" ? "certificados" : "certificados";

  return (
    <DashboardLayout>
      <Tabs
        value={activeTab}
        onValueChange={(v) => setSearchParams({ tab: v })}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="certificados" className="flex items-center gap-2">
            <Award className="h-4 w-4" />
            Certificados
          </TabsTrigger>
          <TabsTrigger value="modelos" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Modelos de Documentos
          </TabsTrigger>
        </TabsList>
        <TabsContent value="certificados">
          <CertificadosTab />
        </TabsContent>
        <TabsContent value="modelos">
          <ModelosDocumentosTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
