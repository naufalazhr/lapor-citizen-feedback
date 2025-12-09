import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, FileText } from "lucide-react";
import { TrackingSearchForm } from "@/components/tracking/TrackingSearchForm";
import { TrackingResult } from "@/components/tracking/TrackingResult";
import { usePublicTracking } from "@/hooks/use-public-tracking";

const TrackReport = () => {
  const { ticketId } = useParams<{ ticketId?: string }>();
  const { data, loading, error, trackReport, reset } = usePublicTracking();

  // Auto-search if ticketId is provided in URL
  useEffect(() => {
    if (ticketId) {
      trackReport(ticketId);
    }
  }, [ticketId, trackReport]);

  const handleSearch = (searchTicketId: string) => {
    // Update URL when searching (optional - for shareable links)
    window.history.pushState({}, "", `/lacak/${searchTicketId}`);
    trackReport(searchTicketId);
  };

  const handleNewSearch = () => {
    reset();
    window.history.pushState({}, "", "/lacak");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent">
            Lapor
          </h1>
          <div className="flex gap-2">
            <Link to="/lapor">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Buat Laporan
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-2" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Search Form */}
          <TrackingSearchForm
            initialTicketId={ticketId || ""}
            onSearch={handleSearch}
            loading={loading}
            error={error}
          />

          {/* Results */}
          {data && (
            <>
              <TrackingResult data={data} />

              {/* Search Another Button */}
              <div className="text-center">
                <Button variant="outline" onClick={handleNewSearch}>
                  Lacak Laporan Lain
                </Button>
              </div>
            </>
          )}

          {/* Footer text */}
          {!data && (
            <div className="text-center text-sm text-muted-foreground">
              <p>
                Belum punya ID Tiket?{" "}
                <Link to="/lapor" className="text-primary hover:underline">
                  Buat laporan baru
                </Link>
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default TrackReport;
