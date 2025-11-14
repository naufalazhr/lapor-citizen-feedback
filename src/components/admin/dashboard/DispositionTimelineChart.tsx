import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DashboardDisposition } from "@/hooks/use-dashboard-data";
import { format } from "date-fns";

interface DispositionTimelineChartProps {
  dispositions: DashboardDisposition[];
}

export const DispositionTimelineChart = ({ dispositions }: DispositionTimelineChartProps) => {
  const monthlyData = new Map<string, {
    month: string;
    dispositions: number;
    status_changes: number;
    returns: number;
    total: number;
  }>();

  dispositions.forEach(d => {
    const month = format(new Date(d.assigned_at), 'MMM yyyy');
    
    if (!monthlyData.has(month)) {
      monthlyData.set(month, {
        month,
        dispositions: 0,
        status_changes: 0,
        returns: 0,
        total: 0,
      });
    }

    const data = monthlyData.get(month)!;
    data.total++;

    if (d.action_type === 'disposition') data.dispositions++;
    else if (d.action_type === 'status_change') data.status_changes++;
    else if (d.action_type === 'return_to_member') data.returns++;
  });

  const data = Array.from(monthlyData.values())
    .sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    })
    .slice(-6); // Last 6 months

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timeline Aktivitas Disposisi</CardTitle>
          <CardDescription>Tren disposisi dan perubahan status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Belum ada data disposisi
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline Aktivitas Disposisi</CardTitle>
        <CardDescription>Tren disposisi dan perubahan status</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis 
              dataKey="month" 
              stroke="hsl(var(--muted-foreground))"
              style={{ fontSize: '12px' }}
            />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="dispositions" 
              stroke="hsl(var(--primary))" 
              name="Disposisi Baru"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="status_changes" 
              stroke="hsl(var(--info))" 
              name="Perubahan Status"
              strokeWidth={2}
            />
            <Line 
              type="monotone" 
              dataKey="returns" 
              stroke="hsl(var(--destructive))" 
              name="Kembali ke Member"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
