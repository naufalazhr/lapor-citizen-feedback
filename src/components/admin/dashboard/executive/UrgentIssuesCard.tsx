import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, ChevronRight, CheckCircle2 } from "lucide-react";
import { UrgentIssue } from "@/hooks/use-executive-dashboard";
import { formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface UrgentIssuesCardProps {
  issues: UrgentIssue[];
}

export function UrgentIssuesCard({ issues }: UrgentIssuesCardProps) {
  const navigate = useNavigate();

  if (issues.length === 0) {
    return (
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Isu Mendesak
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Tidak Ada Isu Kritis
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Semua laporan dalam kondisi normal
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Isu Mendesak
            <Badge variant="destructive" className="ml-2">
              {issues.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[200px] overflow-y-auto">
          {issues.map((issue) => (
            <div
              key={issue.report_id}
              className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-800 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              onClick={() => navigate(`/admin/reports/${issue.report_id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-red-700 dark:text-red-400">
                      {issue.ticket_id}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400 border-red-200 dark:border-red-800"
                    >
                      KRITIS
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {issue.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(issue.created_at), {
                        addSuffix: true,
                        locale: idLocale
                      })}
                    </span>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            </div>
          ))}
        </div>

        {issues.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
            onClick={() => navigate("/admin/reports")}
          >
            Lihat Semua Laporan
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
