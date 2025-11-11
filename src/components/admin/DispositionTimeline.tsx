import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, Building2, User, FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DispositionEntry {
  id: string;
  assigned_at: string;
  notes: string | null;
  status_before: string | null;
  status_after: string | null;
  action_type: string;
  opd: {
    id: string;
    name: string;
    code: string;
  } | null;
  previous_opd: {
    id: string;
    name: string;
    code: string;
  } | null;
  assigner: {
    id: string;
    full_name: string;
    email: string;
  } | null;
}

interface DispositionTimelineProps {
  reportId: string;
}

export function DispositionTimeline({ reportId }: DispositionTimelineProps) {
  const [dispositions, setDispositions] = useState<DispositionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDispositions();
  }, [reportId]);

  const fetchDispositions = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("report_dispositions")
        .select(`
          id,
          assigned_at,
          assigned_by,
          notes,
          status_before,
          status_after,
          action_type,
          opd:opds!opd_id (
            id,
            name,
            code
          ),
          previous_opd:opds!previous_opd_id (
            id,
            name,
            code
          )
        `)
        .eq("report_id", reportId)
        .order("assigned_at", { ascending: false });

      if (error) throw error;

      // Fetch assigner details separately
      const dispositionsWithAssigners = await Promise.all(
        (data || []).map(async (disposition) => {
          let assigner = null;
          if (disposition.assigned_by) {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("id, full_name, email")
              .eq("id", disposition.assigned_by)
              .maybeSingle();
            
            assigner = profileData;
          }
          return { ...disposition, assigner };
        })
      );

      setDispositions(dispositionsWithAssigners as any);
    } catch (error: any) {
      console.error("Error fetching dispositions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      in_progress: "default",
      resolved: "default",
      rejected: "destructive",
    };

    const labels: Record<string, string> = {
      pending: "Pending",
      in_progress: "Dalam Proses",
      resolved: "Selesai",
      rejected: "Ditolak",
    };

    return (
      <Badge variant={variants[status] || "secondary"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline Disposisi
          </CardTitle>
          <CardDescription>Riwayat disposisi laporan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Memuat timeline...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (dispositions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline Disposisi
          </CardTitle>
          <CardDescription>Riwayat disposisi laporan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Belum ada riwayat disposisi
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline Disposisi
        </CardTitle>
        <CardDescription>
          Riwayat disposisi dan perubahan status laporan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {dispositions.map((entry, index) => (
              <div
                key={entry.id}
                className="relative pl-6 pb-4 border-l-2 border-border last:border-l-0 last:pb-0"
              >
                {/* Timeline dot */}
                <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-background" />

                <div className="space-y-3">
                  {/* Header with timestamp */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>
                        {formatDistanceToNow(new Date(entry.assigned_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {index === 0 && (
                      <Badge variant="outline" className="text-xs">
                        Terbaru
                      </Badge>
                    )}
                  </div>

                  {/* OPD Transfer */}
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {entry.action_type === "return_to_member" ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">
                              {entry.opd?.code}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {entry.opd?.name}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-primary">
                            Dikembalikan ke Member
                          </span>
                        </>
                      ) : entry.previous_opd ? (
                        <>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">
                              {entry.previous_opd.code}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {entry.previous_opd.name}
                            </span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <Badge variant="default">{entry.opd?.code}</Badge>
                            <span className="text-sm font-medium">
                              {entry.opd?.name}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-sm text-muted-foreground">
                            Disposisi Awal
                          </span>
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-primary" />
                            <Badge variant="default">{entry.opd?.code}</Badge>
                            <span className="text-sm font-medium">
                              {entry.opd?.name}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Status change */}
                    {entry.status_before !== entry.status_after && (
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <span className="text-sm text-muted-foreground">
                          Status:
                        </span>
                        {getStatusBadge(entry.status_before)}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        {getStatusBadge(entry.status_after)}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {entry.notes && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Catatan:
                          </p>
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            {entry.notes}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Assigner */}
                  {entry.assigner && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <User className="h-3 w-3" />
                      <span>
                        Oleh: {entry.assigner.full_name || entry.assigner.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
