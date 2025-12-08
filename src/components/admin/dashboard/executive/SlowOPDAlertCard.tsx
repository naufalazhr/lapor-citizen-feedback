import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, CheckCircle2, Building2 } from "lucide-react";
import { SlowOPD } from "@/hooks/use-executive-dashboard";

interface SlowOPDAlertCardProps {
  slowOPDs: SlowOPD[];
}

export function SlowOPDAlertCard({ slowOPDs }: SlowOPDAlertCardProps) {
  if (slowOPDs.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-green-500" />
            Performa OPD
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">
                Semua OPD Berkinerja Baik
              </p>
              <p className="text-xs text-muted-foreground">
                Tidak ada OPD yang memerlukan perhatian khusus
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getResponseTimeColor = (hours: number) => {
    if (hours > 48) return "text-red-600 dark:text-red-400";
    if (hours > 24) return "text-yellow-600 dark:text-yellow-400";
    return "text-green-600 dark:text-green-400";
  };

  const getCompletionColor = (rate: number) => {
    if (rate < 40) return "bg-red-500";
    if (rate < 60) return "bg-yellow-500";
    return "bg-green-500";
  };

  const formatHours = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} menit`;
    if (hours < 24) return `${Math.round(hours)} jam`;
    const days = Math.floor(hours / 24);
    const remainingHours = Math.round(hours % 24);
    return `${days} hari ${remainingHours} jam`;
  };

  return (
    <Card className="border-orange-200 dark:border-orange-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-500" />
            OPD Perlu Perhatian
            <Badge variant="outline" className="ml-2 bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800">
              {slowOPDs.length} OPD
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted-foreground border-b">
                <th className="text-left pb-2 font-medium">OPD</th>
                <th className="text-center pb-2 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Rata-rata Respons
                  </div>
                </th>
                <th className="text-center pb-2 font-medium">Pending</th>
                <th className="text-center pb-2 font-medium">Penyelesaian</th>
              </tr>
            </thead>
            <tbody>
              {slowOPDs.map((opd, index) => (
                <tr
                  key={opd.opd_id}
                  className={`${
                    index % 2 === 0 ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''
                  }`}
                >
                  <td className="py-2 pr-4">
                    <div className="font-medium text-sm">{opd.opd_name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {opd.total_assigned} total laporan
                    </div>
                  </td>
                  <td className="py-2 text-center">
                    <span className={`font-semibold text-sm ${getResponseTimeColor(opd.avg_response_hours)}`}>
                      {formatHours(opd.avg_response_hours)}
                    </span>
                  </td>
                  <td className="py-2 text-center">
                    <Badge
                      variant="outline"
                      className={`${
                        opd.pending_count > 10
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200'
                          : opd.pending_count > 5
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {opd.pending_count}
                    </Badge>
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Progress
                        value={opd.completion_rate}
                        className="h-2 flex-1"
                        style={{
                          ['--progress-background' as string]: opd.completion_rate < 40
                            ? 'rgb(239 68 68)'
                            : opd.completion_rate < 60
                            ? 'rgb(234 179 8)'
                            : 'rgb(34 197 94)'
                        }}
                      />
                      <span className="text-xs font-medium w-10 text-right">
                        {opd.completion_rate}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          <span className="font-medium">Kriteria:</span> Respons &gt; 24 jam, Pending &gt; 5, atau Penyelesaian &lt; 60%
        </div>
      </CardContent>
    </Card>
  );
}
