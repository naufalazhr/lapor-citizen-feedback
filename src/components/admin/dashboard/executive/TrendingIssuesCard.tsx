import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { TrendingItem } from "@/hooks/use-executive-dashboard";

interface TrendingIssuesCardProps {
  byType: TrendingItem[];
  byStatus: TrendingItem[];
  byOPD: TrendingItem[];
}

export function TrendingIssuesCard({ byType, byStatus, byOPD }: TrendingIssuesCardProps) {
  const getTrendIcon = (change: number) => {
    if (change > 0) return { icon: TrendingUp, color: "text-red-500" };
    if (change < 0) return { icon: TrendingDown, color: "text-green-500" };
    return { icon: Minus, color: "text-gray-400" };
  };

  const getTrendBadgeClass = (change: number) => {
    if (change > 0) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    if (change < 0) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
  };

  // Get top trending items (those with positive change, sorted by change percentage)
  const topTrending = [...byType, ...byOPD]
    .filter(item => item.change > 0)
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 5);

  // Get improving items (those with negative change)
  const improving = [...byType, ...byOPD]
    .filter(item => item.change < 0)
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-purple-500" />
          Tren Minggu Ini
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rising Issues */}
        {topTrending.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-3 w-3 text-red-500" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">
                Meningkat
              </span>
            </div>
            <div className="space-y-1.5">
              {topTrending.map((item, index) => {
                const trend = getTrendIcon(item.change);
                return (
                  <div
                    key={`rising-${index}`}
                    className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/10 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <trend.icon className={`h-3 w-3 ${trend.color}`} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.lastWeek} → {item.thisWeek}
                      </span>
                      <Badge className={getTrendBadgeClass(item.change)}>
                        {item.change > 0 ? '+' : ''}{item.changePercent}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Improving Items */}
        {improving.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-3 w-3 text-green-500" />
              <span className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase tracking-wide">
                Membaik
              </span>
            </div>
            <div className="space-y-1.5">
              {improving.map((item, index) => {
                const trend = getTrendIcon(item.change);
                return (
                  <div
                    key={`improving-${index}`}
                    className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/10 rounded-md"
                  >
                    <div className="flex items-center gap-2">
                      <trend.icon className={`h-3 w-3 ${trend.color}`} />
                      <span className="text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {item.lastWeek} → {item.thisWeek}
                      </span>
                      <Badge className={getTrendBadgeClass(item.change)}>
                        {item.changePercent}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No trends */}
        {topTrending.length === 0 && improving.length === 0 && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Minus className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Belum ada data tren minggu ini
            </p>
          </div>
        )}

        {/* Summary footer */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          Perbandingan minggu ini vs minggu lalu
        </div>
      </CardContent>
    </Card>
  );
}
