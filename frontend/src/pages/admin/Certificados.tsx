import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CertificadosTab } from "@/components/admin/CertificadosTab";
import { ModelosDocumentosTab } from "@/components/admin/ModelosDocumentosTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, FileText } from "lucide-react";

export default function CertificadosPage() {
  return (
    <DashboardLayout>
      <Tabs defaultValue="certificados" className="space-y-4">
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
