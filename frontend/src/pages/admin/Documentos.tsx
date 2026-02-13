import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DocumentosTab } from "@/components/admin/DocumentosTab";

export default function DocumentosPage() {
  return (
    <DashboardLayout>
      <DocumentosTab />
    </DashboardLayout>
  );
}
