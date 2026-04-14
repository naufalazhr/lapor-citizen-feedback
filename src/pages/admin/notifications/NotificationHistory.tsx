import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "../Dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { History, RefreshCw, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface NotificationLogRow {
  id: string;
  recipient_user_id: string | null;
  recipient_opd_id: string | null;
  channel: string;
  recipient_address: string | null;
  report_ids: string[];
  report_count: number;
  status: string;
  skip_reason: string | null;
  error_message: string | null;
  provider: string | null;
  created_at: string;
  sent_at: string | null;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

/**
 * Compute which page numbers to show in the paginator.
 * Pattern: 1 ... (current-1) current (current+1) ... last
 * Shows at most 7 slots (including ellipses).
 */
function buildPageList(current: number, total: number): Array<number | "..."> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3)
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

const NotificationHistoryPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [rows, setRows] = useState<NotificationLogRow[]>([]);
  const [recipientNameMap, setRecipientNameMap] = useState<Map<string, string>>(new Map());

  // Pagination + filter state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading) return;
    fetchLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page, pageSize]);

  // Reset to page 1 when filter or page size changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, pageSize]);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .in("role", ["admin", "owner", "superadmin"])
      .maybeSingle();

    if (!roleData) {
      toast({
        title: "Akses Ditolak",
        description: "Hanya admin yang dapat melihat riwayat notifikasi.",
        variant: "destructive",
      });
      navigate("/admin/dashboard");
      return;
    }

    await fetchLog();
    setLoading(false);
  };

  const fetchLog = async () => {
    setFetching(true);
    try {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("notification_log" as any)
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query;

      if (error) {
        toast({
          title: "Gagal memuat riwayat",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const logRows = (data ?? []) as unknown as NotificationLogRow[];
      setRows(logRows);
      // Fallback: if count is missing for any reason, infer a minimum from the
      // current page so the UI can still show the range summary.
      const resolvedCount =
        typeof count === "number" && count >= 0
          ? count
          : (page - 1) * pageSize + logRows.length;
      setTotalCount(resolvedCount);

      // Resolve recipient OPD names for this page
      const opdIds = Array.from(
        new Set(logRows.map((r) => r.recipient_opd_id).filter(Boolean))
      ) as string[];
      const map = new Map<string, string>();
      if (opdIds.length > 0) {
        const { data: opds } = await supabase
          .from("opds")
          .select("id, name")
          .in("id", opdIds);
        for (const o of opds ?? []) {
          map.set(o.id, o.name ?? "Unknown");
        }
      }
      setRecipientNameMap(map);
    } finally {
      setFetching(false);
    }
  };

  const renderStatusBadge = (row: NotificationLogRow) => {
    switch (row.status) {
      case "sent":
        return (
          <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Terkirim
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Gagal
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="outline" className="border-gray-300 text-gray-600">
            <Clock className="h-3 w-3 mr-1" />
            Dilewati
          </Badge>
        );
      default:
        return <Badge variant="outline">{row.status}</Badge>;
    }
  };

  const skipReasonLabel = (reason: string | null): string => {
    if (!reason) return "";
    const map: Record<string, string> = {
      no_phone: "Tanpa nomor HP",
      contact_not_synced: "Kontak belum disinkron",
      cooldown: "Dalam periode cooldown",
      daily_cap_reached: "Batas harian tercapai",
    };
    return map[reason] ?? reason;
  };

  if (loading) {
    return (
      <Dashboard>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">Memuat...</span>
        </div>
      </Dashboard>
    );
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const pageList = buildPageList(page, totalPages);

  return (
    <Dashboard>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Riwayat Notifikasi
          </h1>
          <p className="text-muted-foreground mt-1">
            Log pengiriman notifikasi SLA
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-base">Aktivitas</CardTitle>
                <CardDescription>
                  Semua upaya pengiriman, termasuk yang dilewati
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Status</SelectItem>
                    <SelectItem value="sent">Terkirim</SelectItem>
                    <SelectItem value="failed">Gagal</SelectItem>
                    <SelectItem value="skipped">Dilewati</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={String(pageSize)}
                  onValueChange={(v) => setPageSize(Number(v))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} per halaman
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={fetchLog} disabled={fetching}>
                  {fetching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Range summary */}
            <div className="text-sm text-muted-foreground">
              {totalCount === 0
                ? "Belum ada riwayat"
                : `Menampilkan ${rangeStart}–${rangeEnd} dari ${totalCount} entri`}
            </div>

            <div className={fetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>OPD</TableHead>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Laporan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Catatan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Belum ada riwayat
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="font-medium">
                          {row.recipient_opd_id
                            ? recipientNameMap.get(row.recipient_opd_id) ?? "Unknown"
                            : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.recipient_address ?? "—"}
                        </TableCell>
                        <TableCell className="text-sm">{row.report_count}</TableCell>
                        <TableCell>{renderStatusBadge(row)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs">
                          {row.status === "skipped" && skipReasonLabel(row.skip_reason)}
                          {row.status === "failed" && (
                            <span
                              className="text-red-600 truncate block"
                              title={row.error_message ?? undefined}
                            >
                              {row.error_message ?? "Error tidak diketahui"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination — always visible when there are rows, even for single-page results */}
            {totalCount > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-4 pt-2 border-t">
                <div className="text-xs text-muted-foreground">
                  Halaman <span className="font-medium text-foreground">{page}</span> dari{" "}
                  <span className="font-medium text-foreground">{totalPages}</span>
                </div>
                <Pagination className="mx-0 w-auto justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        className={
                          page === 1 || fetching
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          if (page > 1 && !fetching) setPage(page - 1);
                        }}
                      />
                    </PaginationItem>

                    {pageList.map((p, idx) =>
                      p === "..." ? (
                        <PaginationItem key={`ellipsis-${idx}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={p}>
                          <PaginationLink
                            className={fetching ? "pointer-events-none" : "cursor-pointer"}
                            isActive={p === page}
                            onClick={(e) => {
                              e.preventDefault();
                              if (!fetching) setPage(p);
                            }}
                          >
                            {p}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    )}

                    <PaginationItem>
                      <PaginationNext
                        className={
                          page === totalPages || fetching
                            ? "pointer-events-none opacity-50"
                            : "cursor-pointer"
                        }
                        onClick={(e) => {
                          e.preventDefault();
                          if (page < totalPages && !fetching) setPage(page + 1);
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Dashboard>
  );
};

export default NotificationHistoryPage;
