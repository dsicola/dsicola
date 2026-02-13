import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { CertificadosTab } from "@/components/admin/CertificadosTab";

export default function CertificadosPage() {
  return (
    <DashboardLayout>
      <CertificadosTab />
    </DashboardLayout>
  );
}
