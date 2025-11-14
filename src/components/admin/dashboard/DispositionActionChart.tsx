import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { DashboardDisposition } from "@/hooks/use-dashboard-data";

interface DispositionActionChartProps {
  dispositions: DashboardDisposition[];
}

const ACTION_LABELS: Record<string, string> = {
  disposition: "Disposisi Baru",
  status_change: "Perubahan Status",
  return_to_member: "Kembali ke Member",
};

const ACTION_COLORS: Record<string, string> = {
  disposition: "hsl(var(--primary))",
  status_change: "hsl(var(--info))",
  return_to_member: "hsl(var(--destructive))",
};

export const DispositionActionChart = ({ dispositions }: DispositionActionChartProps) => {
  const actionCounts = new Map<string, number>();

  dispositions.forEach(d => {
    const current = actionCounts.get(d.action_type) || 0;
    actionCounts.set(d.action_type, current + 1);
  });

  const data = Array.from(actionCounts.entries()).map(([action, count]) => ({
    name: ACTION_LABELS[action] || action,
    value: count,
    color: ACTION_COLORS[action] || "hsl(var(--muted))",
  }));

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Tipe Aksi Disposisi</CardTitle>
          <CardDescription>Distribusi jenis aktivitas disposisi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Belum ada data aksi disposisi
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tipe Aksi Disposisi</CardTitle>
        <CardDescription>Distribusi jenis aktivitas disposisi</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
