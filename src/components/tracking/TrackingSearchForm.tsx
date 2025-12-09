import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TrackingSearchFormProps {
  initialTicketId?: string;
  onSearch: (ticketId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function TrackingSearchForm({
  initialTicketId = "",
  onSearch,
  loading = false,
  error = null,
}: TrackingSearchFormProps) {
  const [ticketId, setTicketId] = useState(initialTicketId);

  useEffect(() => {
    if (initialTicketId) {
      setTicketId(initialTicketId);
    }
  }, [initialTicketId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketId.trim()) {
      onSearch(ticketId.trim());
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Lacak Laporan Anda</CardTitle>
        <CardDescription>
          Masukkan ID Tiket untuk melihat status laporan
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="RPRT-202512-00001"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value.toUpperCase())}
              className="font-mono text-lg"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !ticketId.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <span className="ml-2">{loading ? "Mencari..." : "Lacak"}</span>
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <p className="text-sm text-muted-foreground text-center">
            ID Tiket dapat ditemukan pada konfirmasi laporan yang Anda terima
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
