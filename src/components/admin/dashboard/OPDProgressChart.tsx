import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardReport } from "@/hooks/use-dashboard-data";

interface OPDProgressChartProps {
  reports: DashboardReport[];
}

export const OPDProgressChart = ({ reports }: OPDProgressChartProps) => {
  const opdMap = new Map<string, {
    opd_name: string;
    pending: number;
    in_progress: number;
    resolved: number;
    rejected: number;
    total: number;
    completion_rate: number;
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
        completion_rate: 0,
      });
    }

    const opd = opdMap.get(key)!;
    opd[report.status]++;
    opd.total++;
  });

  const data = Array.from(opdMap.values())
    .map(opd => ({
      ...opd,
      completion_rate: opd.total > 0 ? Math.round((opd.resolved / opd.total) * 100) : 0,
    }))
    .sort((a, b) => b.completion_rate - a.completion_rate)
    .slice(0, 8); // Top 8 OPDs

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Progress Penyelesaian per OPD</CardTitle>
          <CardDescription>Status breakdown untuk setiap OPD</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Belum ada data progress OPD
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Progress Penyelesaian per OPD</CardTitle>
        <CardDescription>Status breakdown untuk setiap OPD</CardDescription>
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
            <Bar dataKey="pending" stackId="a" fill="hsl(var(--warning))" name="Pending" />
            <Bar dataKey="in_progress" stackId="a" fill="hsl(var(--info))" name="Dalam Progress" />
            <Bar dataKey="resolved" stackId="a" fill="hsl(var(--success))" name="Selesai" />
            <Bar dataKey="rejected" stackId="a" fill="hsl(var(--destructive))" name="Ditolak" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
