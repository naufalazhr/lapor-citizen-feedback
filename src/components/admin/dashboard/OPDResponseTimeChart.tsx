import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardReport, DashboardDisposition } from "@/hooks/use-dashboard-data";

interface OPDResponseTimeChartProps {
  reports: DashboardReport[];
  dispositions: DashboardDisposition[];
}

export const OPDResponseTimeChart = ({ reports, dispositions }: OPDResponseTimeChartProps) => {
  const opdResponseTimes = new Map<string, {
    total: number;
    count: number;
    name: string;
  }>();

  // Calculate response time for first disposition only
  dispositions
    .filter(d => d.action_type === 'disposition')
    .forEach(disposition => {
      const report = reports.find(r => r.id === disposition.report_id);
      if (!report || !disposition.opds) return;

      const responseHours = 
        (new Date(disposition.assigned_at).getTime() - new Date(report.created_at).getTime()) 
        / (1000 * 60 * 60);

      const opdName = disposition.opds.name;
      if (!opdResponseTimes.has(opdName)) {
        opdResponseTimes.set(opdName, { total: 0, count: 0, name: opdName });
      }

      const stats = opdResponseTimes.get(opdName)!;
      stats.total += responseHours;
      stats.count++;
    });

  const data = Array.from(opdResponseTimes.values())
    .map(stat => ({
      opd_name: stat.name,
      avg_hours: Math.round((stat.total / stat.count) * 10) / 10,
      count: stat.count,
    }))
    .sort((a, b) => a.avg_hours - b.avg_hours) // Best performers first
    .slice(0, 10);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Waktu Respons per OPD</CardTitle>
          <CardDescription>Rata-rata waktu dari laporan dibuat hingga disposisi pertama (jam)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Belum ada data waktu respons
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waktu Respons per OPD</CardTitle>
        <CardDescription>Rata-rata waktu dari laporan dibuat hingga disposisi pertama (jam)</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="opd_name" 
              stroke="hsl(var(--muted-foreground))"
              angle={-45}
              textAnchor="end"
              height={100}
              style={{ fontSize: '11px' }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              label={{ value: 'Jam', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              formatter={(value: number) => [`${value} jam`, 'Avg. Waktu Respons']}
            />
            <Legend />
            <Bar dataKey="avg_hours" fill="hsl(var(--success))" name="Rata-rata Jam" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
