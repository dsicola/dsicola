import React from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DocumentosAlunoTab } from "@/components/admin/DocumentosAlunoTab";

export default function DocumentosAlunos() {
  return (
    <DashboardLayout>
      <DocumentosAlunoTab />
    </DashboardLayout>
  );
}