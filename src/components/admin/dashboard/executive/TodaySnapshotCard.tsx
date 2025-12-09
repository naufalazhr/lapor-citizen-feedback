import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Clock, CheckCircle, TrendingUp, TrendingDown, Minus, XCircle } from "lucide-react";
import { PeriodStats } from "@/hooks/use-executive-dashboard";

interface TodaySnapshotCardProps {
  data: PeriodStats;
}

export function TodaySnapshotCard({ data }: TodaySnapshotCardProps) {
  const getChangeIndicator = (current: number, previous: number, showComparison: boolean) => {
    if (!showComparison || previous === 0) {
      return { icon: Minus, color: "text-gray-400", label: "" };
    }
    const diff = current - previous;
    if (diff > 0) {
      return { icon: TrendingUp, color: "text-red-500", label: `+${diff}` };
    } else if (diff < 0) {
      return { icon: TrendingDown, color: "text-green-500", label: `${diff}` };
    }
    return { icon: Minus, color: "text-gray-400", label: "0" };
  };

  const showComparison = data.comparisonLabel !== '';
  const totalChange = getChangeIndicator(data.total, data.previousTotal, showComparison);
  const pendingChange = getChangeIndicator(data.pending, data.previousPending, showComparison);
  const resolvedChange = getChangeIndicator(data.resolved, data.previousResolved, showComparison);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-blue-500" />
          Ringkasan {data.periodLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {/* Total Reports */}
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {data.total}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total Laporan</div>
            {showComparison && (
              <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${totalChange.color}`}>
                <totalChange.icon className="h-3 w-3" />
                <span>{totalChange.label} {data.comparisonLabel}</span>
              </div>
            )}
          </div>

          {/* Pending Reports */}
          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">
              {data.pending}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending</div>
            {showComparison && (
              <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${pendingChange.color}`}>
                <pendingChange.icon className="h-3 w-3" />
                <span>{pendingChange.label}</span>
              </div>
            )}
          </div>

          {/* Resolved Reports */}
          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-3xl font-bold text-green-600 dark:text-green-400">
              {data.resolved}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Selesai</div>
            {showComparison && (
              <div className={`flex items-center justify-center gap-1 text-xs mt-1 ${resolvedChange.color}`}>
                <resolvedChange.icon className="h-3 w-3" />
                <span>{resolvedChange.label}</span>
              </div>
            )}
          </div>
        </div>

        {/* Additional Stats Row */}
        <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-500" />
              <span className="text-muted-foreground">Dalam Proses:</span>
            </div>
            <span className="font-semibold text-orange-600 dark:text-orange-400">
              {data.inProgress}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-gray-500" />
              <span className="text-muted-foreground">Ditolak:</span>
            </div>
            <span className="font-semibold text-gray-600 dark:text-gray-400">
              {data.rejected}
            </span>
          </div>
        </div>

        {/* Completion Rate */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Tingkat Penyelesaian</span>
            <span className="font-semibold">
              {data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0}%
            </span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${data.total > 0 ? (data.resolved / data.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
