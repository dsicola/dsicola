import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { EmailsEnviadosTab } from "@/components/admin/EmailsEnviadosTab";

export default function EmailsEnviados() {
  return (
    <DashboardLayout>
      <EmailsEnviadosTab />
    </DashboardLayout>
  );
}
