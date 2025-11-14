import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardReport } from "@/hooks/use-dashboard-data";

interface OPDDistributionChartProps {
  reports: DashboardReport[];
}

export const OPDDistributionChart = ({ reports }: OPDDistributionChartProps) => {
  const opdMap = new Map<string, {
    opd_name: string;
    pending: number;
    in_progress: number;
    resolved: number;
    rejected: number;
    total: number;
  }>();

  reports.forEach(report => {
    if (!report.opds || !report.assigned_opd_id) return;
    
    const key = report.opds.name;
    if (!opdMap.has(key)) {
      opdMap.set(key, {
        opd_name: report.opds.name,
        pending: 0,
        in_progress: 0,
        resolved: 0,
        rejected: 0,
        total: 0,
      });
    }

    const opd = opdMap.get(key)!;
    opd[report.status]++;
    opd.total++;
  });

  const data = Array.from(opdMap.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 10); // Top 10 OPDs

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribusi Laporan per OPD</CardTitle>
          <CardDescription>Jumlah laporan yang ditugaskan ke setiap OPD</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Belum ada data laporan dengan OPD yang ditugaskan
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribusi Laporan per OPD</CardTitle>
        <CardDescription>Jumlah laporan yang ditugaskan ke setiap OPD</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
            <YAxis 
              dataKey="opd_name" 
              type="category" 
              width={150}
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Bar dataKey="total" fill="hsl(var(--primary))" name="Total Laporan" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
