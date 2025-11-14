import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { DashboardReport } from "@/hooks/use-dashboard-data";

interface TopOPDsCardProps {
  reports: DashboardReport[];
}

export const TopOPDsCard = ({ reports }: TopOPDsCardProps) => {
  const opdMap = new Map<string, {
    name: string;
    resolved: number;
    total: number;
    rate: number;
  }>();

  reports.forEach(report => {
    if (!report.opds || !report.assigned_opd_id) return;
    
    const key = report.opds.name;
    if (!opdMap.has(key)) {
      opdMap.set(key, {
        name: report.opds.name,
        resolved: 0,
        total: 0,
        rate: 0,
      });
    }

    const opd = opdMap.get(key)!;
    if (report.status === 'resolved') opd.resolved++;
    opd.total++;
  });

  const topOPDs = Array.from(opdMap.values())
    .map(opd => ({
      ...opd,
      rate: opd.total > 0 ? Math.round((opd.resolved / opd.total) * 100) : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  if (topOPDs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Top 5 OPD Terbaik
          </CardTitle>
          <CardDescription>Berdasarkan tingkat penyelesaian laporan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[260px] text-muted-foreground">
            Belum ada data OPD
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          Top 5 OPD Terbaik
        </CardTitle>
        <CardDescription>Berdasarkan tingkat penyelesaian laporan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {topOPDs.map((opd, index) => (
            <div key={opd.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-muted-foreground">#{index + 1}</span>
                  <span className="font-medium truncate max-w-[200px]">{opd.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{opd.resolved}/{opd.total}</span>
                  <span className="font-semibold text-primary">{opd.rate}%</span>
                </div>
              </div>
              <Progress value={opd.rate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
