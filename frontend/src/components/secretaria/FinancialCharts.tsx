import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeToFixed } from "@/lib/utils";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Mensalidade {
  id: string;
  aluno_id: string;
  valor: number;
  status: string;
  mes_referencia: number;
  ano_referencia: number;
  data_pagamento: string | null;
  forma_pagamento: string | null;
}

interface FinancialChartsProps {
  mensalidades: Mensalidade[];
}

const COLORS = {
  Pago: '#22c55e',
  Pendente: '#eab308',
  Atrasado: '#ef4444',
};

const getMesNome = (mes: number) => {
  const meses = [
    "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
    "Jul", "Ago", "Set", "Out", "Nov", "Dez"
  ];
  return meses[mes - 1] || "";
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-AO", {
    style: "currency",
    currency: "AOA",
    notation: "compact",
  }).format(value);
};

export function FinancialCharts({ mensalidades }: FinancialChartsProps) {
  // Status distribution data
  const statusData = [
    { name: 'Pagos', value: mensalidades.filter(m => m.status === 'Pago').length, color: COLORS.Pago },
    { name: 'Pendentes', value: mensalidades.filter(m => m.status === 'Pendente').length, color: COLORS.Pendente },
    { name: 'Atrasados', value: mensalidades.filter(m => m.status === 'Atrasado').length, color: COLORS.Atrasado },
  ].filter(item => item.value > 0);

  // Monthly collection data
  const currentYear = new Date().getFullYear();
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1;
    const mesData = mensalidades.filter(m => m.mes_referencia === mes && m.ano_referencia === currentYear);
    const pago = mesData.filter(m => m.status === 'Pago').reduce((acc, m) => acc + Number(m.valor), 0);
    const pendente = mesData.filter(m => m.status !== 'Pago').reduce((acc, m) => acc + Number(m.valor), 0);
    
    return {
      mes: getMesNome(mes),
      Recebido: pago,
      Pendente: pendente,
    };
  });

  // Payment method distribution
  const paymentMethods = mensalidades
    .filter(m => m.status === 'Pago' && m.forma_pagamento)
    .reduce((acc, m) => {
      const method = m.forma_pagamento || 'Outro';
      acc[method] = (acc[method] || 0) + Number(m.valor);
      return acc;
    }, {} as Record<string, number>);

  const paymentMethodData = Object.entries(paymentMethods).map(([name, value]) => ({
    name,
    value,
  }));

  const PAYMENT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4'];

  return (
    <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full max-w-full min-w-0">
      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Status das Mensalidades</CardTitle>
          <CardDescription>Distribuição por status</CardDescription>
        </CardHeader>
        <CardContent>
          {statusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${safeToFixed(percent != null ? percent * 100 : 0, 0)}%`}
                  labelLine={false}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground">
              Sem dados
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Collection */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg">Arrecadação Mensal</CardTitle>
          <CardDescription>Comparativo recebido vs pendente - {currentYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} className="text-xs" />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="Recebido" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Pendente" fill="#eab308" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      {paymentMethodData.length > 0 && (
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Formas de Pagamento</CardTitle>
            <CardDescription>Distribuição por método</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name }) => name}
                  labelLine={false}
                >
                  {paymentMethodData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PAYMENT_COLORS[index % PAYMENT_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
