import { Check, Clock, FileCheck, XCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportStatus = "pending" | "in_progress" | "resolved" | "rejected";

interface TrackingStatusStepsProps {
  currentStatus: ReportStatus;
}

interface StatusStep {
  id: ReportStatus;
  label: string;
  description: string;
}

const statusSteps: StatusStep[] = [
  { id: "pending", label: "Diterima", description: "Laporan telah diterima" },
  { id: "in_progress", label: "Diproses", description: "Sedang ditangani" },
  { id: "resolved", label: "Selesai", description: "Laporan telah diselesaikan" },
];

const statusOrder: Record<ReportStatus, number> = {
  pending: 0,
  in_progress: 1,
  resolved: 2,
  rejected: -1, // Special case
};

export function TrackingStatusSteps({ currentStatus }: TrackingStatusStepsProps) {
  const currentIndex = statusOrder[currentStatus];
  const isRejected = currentStatus === "rejected";

  // If rejected, show a different UI
  if (isRejected) {
    return (
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              Laporan Ditolak
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              Laporan ini telah ditolak. Silakan hubungi layanan untuk informasi lebih lanjut.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-lg p-6">
      <div className="flex items-center justify-between">
        {statusSteps.map((step, index) => {
          const isCompleted = currentIndex > index;
          const isCurrent = currentIndex === index;
          const isPending = currentIndex < index;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isCompleted && "bg-green-500 text-white",
                    isCurrent && "bg-primary text-primary-foreground animate-pulse",
                    isPending && "bg-muted text-muted-foreground border-2 border-muted-foreground/30"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5" />
                  ) : isCurrent ? (
                    step.id === "pending" ? (
                      <Clock className="h-5 w-5" />
                    ) : step.id === "in_progress" ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <FileCheck className="h-5 w-5" />
                    )
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isCompleted && "text-green-600 dark:text-green-400",
                      isCurrent && "text-primary",
                      isPending && "text-muted-foreground"
                    )}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {index < statusSteps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-1 mx-2 rounded",
                    isCompleted ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
