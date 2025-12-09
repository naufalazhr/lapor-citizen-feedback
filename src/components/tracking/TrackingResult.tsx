import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { TrackingStatusSteps } from "./TrackingStatusSteps";
import { TrackingTimeline } from "./TrackingTimeline";
import type { PublicReportData } from "@/hooks/use-public-tracking";

interface TrackingResultProps {
  data: PublicReportData;
}

export function TrackingResult({ data }: TrackingResultProps) {
  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d MMMM yyyy, HH:mm", { locale: idLocale });
  };

  const getTypeLabel = (type: string): string => {
    return type === "lapor" ? "Laporan" : "Aspirasi";
  };

  const getTypeVariant = (type: string): "default" | "secondary" => {
    return type === "lapor" ? "destructive" : "default";
  };

  return (
    <div className="space-y-6">
      {/* Report Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">ID Tiket</p>
              <p className="text-2xl font-mono font-bold text-primary">
                {data.ticket_id}
              </p>
            </div>
            <Badge variant={getTypeVariant(data.type)} className="w-fit">
              <FileText className="h-3 w-3 mr-1" />
              {getTypeLabel(data.type)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status Steps */}
          <TrackingStatusSteps currentStatus={data.status} />

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            {/* Current OPD */}
            {data.current_opd && (
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ditangani oleh</p>
                  <p className="font-medium">{data.current_opd.name}</p>
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tanggal Laporan</p>
                <p className="font-medium">{formatDate(data.created_at)}</p>
              </div>
            </div>
          </div>

          {/* Last updated */}
          <div className="text-sm text-muted-foreground text-center pt-2 border-t">
            Terakhir diperbarui: {formatDate(data.updated_at)}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <TrackingTimeline
        entries={data.timeline}
        reportCreatedAt={data.created_at}
      />
    </div>
  );
}
