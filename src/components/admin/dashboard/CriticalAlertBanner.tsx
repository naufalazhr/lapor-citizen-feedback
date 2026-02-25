import { AlertTriangle, ArrowRight, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface CriticalAlertBannerProps {
  count: number;
  onDismissAll: () => void;
}

export function CriticalAlertBanner({ count, onDismissAll }: CriticalAlertBannerProps) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-red-600 text-white rounded-lg shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm font-medium truncate">
          Ada {count} laporan kritis belum diproses lebih dari 24 jam
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <Button
          asChild
          size="sm"
          variant="ghost"
          className="h-7 px-3 text-white hover:bg-red-700 hover:text-white text-xs"
        >
          <Link to="/admin/reports?urgency=critical">
            Lihat Laporan
            <ArrowRight className="h-3 w-3 ml-1" />
          </Link>
        </Button>
        <button
          onClick={onDismissAll}
          className="hover:bg-red-700 rounded p-1 transition-colors"
          title="Tutup notifikasi"
          aria-label="Tutup notifikasi"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
