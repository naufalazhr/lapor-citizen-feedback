import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Clock, User } from "lucide-react";
import { ReturnRequestApprovalDialog } from "./ReturnRequestApprovalDialog";
import { format } from "date-fns";

interface ReturnRequest {
  id: string;
  report_id: string;
  requested_by: string;
  requested_at: string;
  notes: string;
  status: string;
  reports: {
    ticket_id: string;
    reporter_name: string;
    description: string;
    type: string;
    status: string;
  };
  profiles: {
    full_name: string;
    email: string;
  };
}

export function ReturnRequestCard() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchRequests = async () => {
    try {
      setLoading(true);

      // Step 1: fetch return requests with joined report fields.
      // profiles is intentionally NOT joined here: report_return_requests.requested_by
      // references auth.users, not public.profiles, so PostgREST cannot resolve the
      // relationship and returns a 400 PGRST200 error.
      const { data, error } = await supabase
        .from("report_return_requests")
        .select(`
          *,
          reports!report_return_requests_report_id_fkey (
            ticket_id,
            reporter_name,
            description,
            type,
            status
          )
        `)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      const rows = data || [];

      // Step 2: fetch profiles for unique requesters in one round-trip
      const uniqueUserIds = [...new Set(rows.map((r: any) => r.requested_by as string))];
      let profileMap: Record<string, { full_name: string; email: string }> = {};

      if (uniqueUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", uniqueUserIds);

        profileMap = Object.fromEntries(
          (profilesData || []).map((p: any) => [p.id, { full_name: p.full_name, email: p.email }])
        );
      }

      // Step 3: merge profiles back into each request row
      const merged = rows.map((r: any) => ({
        ...r,
        profiles: profileMap[r.requested_by] ?? { full_name: "—", email: "" },
      }));

      setRequests(merged as any);
    } catch (error) {
      console.error("Error fetching return requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('return_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_return_requests'
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleReviewClick = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setDialogOpen(true);
  };

  const handleSuccess = () => {
    fetchRequests();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Permintaan Pengembalian</CardTitle>
          <CardDescription>Memuat permintaan...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <>
      <Card className="border-orange-300 bg-orange-50 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-orange-900">
                <ArrowLeft className="h-5 w-5 text-orange-600" />
                Permintaan Pengembalian Laporan
              </CardTitle>
              <CardDescription className="text-orange-700 font-medium">
                {requests.length} laporan menunggu persetujuan pengembalian dari Anda
              </CardDescription>
            </div>
            <Badge className="bg-orange-600 text-white border-orange-700 text-base px-3 py-1">
              {requests.length} Pending
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{request.reports.ticket_id}</span>
                        <Badge variant="outline" className="text-xs">
                          {request.reports.type}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {request.reports.description}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{request.profiles.full_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{format(new Date(request.requested_at), 'dd MMM yyyy HH:mm')}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm italic text-muted-foreground">
                        "{request.notes}"
                      </p>
                    </div>
                    
                    <div className="flex gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReviewClick(request)}
                      >
                        Detail
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setDialogOpen(true);
                        }}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Setujui
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ReturnRequestApprovalDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        request={selectedRequest}
        onSuccess={handleSuccess}
      />
    </>
  );
}
