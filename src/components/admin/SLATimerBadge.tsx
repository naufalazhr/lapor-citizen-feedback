import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SLATimerState, SLAUrgency } from "@/utils/sla-timer";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SLATimerBadgeProps {
  state: SLATimerState;
  variant: "compact" | "detailed";
  slaWindowMinutes: number;
  className?: string;
}

const URGENCY_CONFIG: Record<
  SLAUrgency,
  { dot: string; text: string; bg: string; border: string; label: string }
> = {
  green: {
    dot: "bg-green-500",
    text: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    label: "Normal",
  },
  yellow: {
    dot: "bg-yellow-400",
    text: "text-yellow-700",
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    label: "Perlu Perhatian",
  },
  red: {
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
    label: "Segera Ditangani",
  },
  breached: {
    dot: "bg-red-600",
    text: "text-red-800",
    bg: "bg-red-100",
    border: "border-red-400",
    label: "Melewati Batas SLA",
  },
};

const URGENCY_BAR: Record<SLAUrgency, string> = {
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  red: "bg-red-500",
  breached: "bg-red-600",
};

/**
 * Compact variant — for conversation list items (active conversations only).
 * Shows: colored pulsing dot + idle time in monospace.
 */
function CompactBadge({
  state,
  slaWindowMinutes,
  className,
}: Omit<SLATimerBadgeProps, "variant">) {
  const cfg = URGENCY_CONFIG[state.urgency];
  const pulse = state.urgency === "red" || state.urgency === "breached";

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs",
              cfg.bg,
              cfg.border,
              className
            )}
          >
            <span
              className={cn(
                "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
                cfg.dot,
                pulse && "animate-pulse"
              )}
            />
            <span className={cn("font-mono leading-none", cfg.text)}>
              {state.isBreached ? "Habis" : state.remainingFormatted}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p>
            {state.isBreached
              ? "SLA sudah terlampaui"
              : `Sisa SLA: ${state.remainingFormatted} · Batas: ${slaWindowMinutes} menit`}
          </p>
          <p className="text-muted-foreground">{cfg.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Detailed variant — for the chat header (all conversation statuses).
 * Shows: idle time + total duration + SLA progress bar.
 */
function DetailedBadge({
  state,
  slaWindowMinutes,
  className,
}: Omit<SLATimerBadgeProps, "variant">) {
  const cfg = URGENCY_CONFIG[state.urgency];
  const isEnded = !state.isLive;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex flex-col gap-0.5 px-2 py-1 rounded border min-w-0",
              isEnded ? "bg-muted/40 border-border" : cn(cfg.bg, cfg.border),
              className
            )}
          >
            {/* Timer rows — stacked to avoid overflow in narrow containers */}
            <div className="flex flex-col gap-0.5 text-xs">
              <div className="flex items-center gap-1">
                <Clock
                  className={cn(
                    "h-3 w-3 flex-shrink-0",
                    isEnded ? "text-muted-foreground" : cfg.text
                  )}
                />
                <span
                  className={cn(
                    "font-mono font-medium",
                    isEnded ? "text-muted-foreground" : cfg.text
                  )}
                >
                  {isEnded
                    ? `Waktu tunggu: ${state.idleFormatted}`
                    : state.isBreached
                      ? "SLA Terlampaui"
                      : `Sisa SLA: ${state.remainingFormatted}`}
                </span>
              </div>
              <span className="text-muted-foreground font-mono pl-4">
                Durasi: {state.totalFormatted}
              </span>
            </div>

            {/* SLA progress bar — only for live conversations */}
            {state.isLive && (
              <div className="h-1 w-full rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    URGENCY_BAR[state.urgency]
                  )}
                  style={{ width: `${state.remainingPercent}%` }}
                />
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>SLA: {slaWindowMinutes} menit · {cfg.label}</p>
          {state.isLive && (
            <p className="text-muted-foreground">
              {state.isBreached
                ? "SLA sudah terlampaui"
                : `Sisa: ${state.remainingFormatted} dari ${slaWindowMinutes} menit`}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SLATimerBadge({ variant, ...props }: SLATimerBadgeProps) {
  if (variant === "compact") {
    return <CompactBadge {...props} />;
  }
  return <DetailedBadge {...props} />;
}
