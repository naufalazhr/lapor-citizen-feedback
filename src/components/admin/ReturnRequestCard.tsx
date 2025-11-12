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
          ),
          profiles!report_return_requests_requested_by_fkey (
            full_name,
            email
          )
        `)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (error) throw error;
      setRequests(data as any || []);
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
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowLeft className="h-5 w-5 text-orange-600" />
                Permintaan Pengembalian Laporan
              </CardTitle>
              <CardDescription>
                {requests.length} laporan menunggu persetujuan pengembalian
              </CardDescription>
            </div>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
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
                    
                    <Button
                      size="sm"
                      onClick={() => handleReviewClick(request)}
                      className="shrink-0"
                    >
                      Tinjau
                    </Button>
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
