import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TodayStats } from "@/hooks/use-executive-dashboard";

interface TodaySnapshotCardProps {
  data: TodayStats;
}

export function TodaySnapshotCard({ data }: TodaySnapshotCardProps) {
  const getChangeIndicator = (today: number, yesterday: number) => {
    if (today > yesterday) {
      return { icon: TrendingUp, color: "text-red-500", label: `+${today - yesterday}` };
    } else if (today < yesterday) {
      return { icon: TrendingDown, color: "text-green-500", label: `${today - yesterday}` };
    }
    return { icon: Minus, color: "text-gray-400", label: "0" };
  };

  const totalChange = getChangeIndicator(data.totalToday, data.totalYesterday);
  const pendingChange = getChangeIndicator(data.pendingToday, data.pendingYesterday);
  const resolvedChange = getChangeIndicator(data.resolvedToday, data.resolvedYesterday);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Snapshot Hari Ini
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Total Today */}
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.totalToday}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Laporan Masuk</div>
            <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${totalChange.color}`}>
              <totalChange.icon className="h-3 w-3" />
              <span>{totalChange.label} dari kemarin</span>
            </div>
          </div>

          {/* Pending Today */}
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {data.pendingToday}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending Baru</div>
            <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${pendingChange.color}`}>
              <pendingChange.icon className="h-3 w-3" />
              <span>{pendingChange.label}</span>
            </div>
          </div>

          {/* Resolved Today */}
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data.resolvedToday}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Diselesaikan</div>
            <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${resolvedChange.color}`}>
              <resolvedChange.icon className="h-3 w-3" />
              <span>{resolvedChange.label}</span>
            </div>
          </div>
        </div>

        {/* In Progress indicator */}
        <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            <span className="text-muted-foreground">Dalam proses hari ini:</span>
          </div>
          <span className="font-semibold text-orange-600 dark:text-orange-400">
            {data.inProgressToday}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
