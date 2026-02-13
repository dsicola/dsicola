import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CalendarioAcademicoTab } from '@/components/admin/CalendarioAcademicoTab';

const CalendarioAcademico: React.FC = () => {
  return (
    <DashboardLayout>
      <CalendarioAcademicoTab />
    </DashboardLayout>
  );
};

export default CalendarioAcademico;
