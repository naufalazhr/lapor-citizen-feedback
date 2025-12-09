import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Building2, ArrowRight, RefreshCw, FileInput } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import type { TimelineEntry } from "@/hooks/use-public-tracking";

interface TrackingTimelineProps {
  entries: TimelineEntry[];
  reportCreatedAt: string;
}

const getStatusLabel = (status: string | null): string => {
  const labels: Record<string, string> = {
    pending: "Menunggu",
    in_progress: "Diproses",
    resolved: "Selesai",
    rejected: "Ditolak",
  };
  return status ? labels[status] || status : "";
};

const getStatusVariant = (status: string | null): "default" | "secondary" | "destructive" => {
  const variants: Record<string, "default" | "secondary" | "destructive"> = {
    pending: "secondary",
    in_progress: "default",
    resolved: "default",
    rejected: "destructive",
  };
  return status ? variants[status] || "secondary" : "secondary";
};

const getActionLabel = (actionType: string): string => {
  const labels: Record<string, string> = {
    disposition: "Disposisi",
    status_change: "Perubahan Status",
    return_to_member: "Dikembalikan",
  };
  return labels[actionType] || actionType;
};

export function TrackingTimeline({ entries, reportCreatedAt }: TrackingTimelineProps) {
  // Add the report creation as the first timeline entry
  const allEntries = [
    {
      id: "report-created",
      timestamp: reportCreatedAt,
      action_type: "report_created",
      status_before: null,
      status_after: "pending",
      opd: null,
      previous_opd: null,
    },
    ...entries,
  ];

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d MMM yyyy, HH:mm", { locale: idLocale });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Clock className="h-5 w-5" />
          Riwayat Laporan
        </CardTitle>
        <CardDescription>Perjalanan status laporan Anda</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 pl-3">
          {allEntries.map((entry, index) => (
            <div
              key={entry.id}
              className="relative pl-6 pb-4 border-l-2 border-border last:border-l-0 last:pb-0"
            >
              {/* Timeline dot */}
              <div className="absolute left-[-9px] top-[6px] w-4 h-4 rounded-full bg-primary border-4 border-background" />

              <div className="space-y-2">
                {/* Timestamp */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(entry.timestamp)}</span>
                  {index === allEntries.length - 1 && (
                    <Badge variant="outline" className="text-xs">
                      Terbaru
                    </Badge>
                  )}
                </div>

                {/* Entry content */}
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  {entry.action_type === "report_created" ? (
                    <div className="flex items-center gap-2">
                      <FileInput className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Laporan Diterima</span>
                    </div>
                  ) : entry.action_type === "status_change" ? (
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-blue-600" />
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        {getActionLabel(entry.action_type)}
                      </Badge>
                    </div>
                  ) : entry.action_type === "return_to_member" ? (
                    <div className="flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-orange-600" />
                      <span className="text-sm font-medium">
                        Laporan dikembalikan untuk ditinjau ulang
                      </span>
                    </div>
                  ) : entry.opd ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.previous_opd ? (
                        <>
                          <span className="text-sm text-muted-foreground">
                            Dialihkan dari
                          </span>
                          <Badge variant="outline">
                            {entry.previous_opd.name}
                          </Badge>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Ditugaskan ke
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <Badge variant="default">{entry.opd.name}</Badge>
                      </div>
                    </div>
                  ) : null}

                  {/* Status change indicator */}
                  {entry.status_before !== entry.status_after &&
                    entry.status_after &&
                    entry.action_type !== "report_created" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                        <span className="text-sm text-muted-foreground">Status:</span>
                        {entry.status_before && (
                          <>
                            <Badge variant={getStatusVariant(entry.status_before)}>
                              {getStatusLabel(entry.status_before)}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          </>
                        )}
                        <Badge variant={getStatusVariant(entry.status_after)}>
                          {getStatusLabel(entry.status_after)}
                        </Badge>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
