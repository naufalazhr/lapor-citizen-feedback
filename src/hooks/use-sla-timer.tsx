import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeSLAState, SLATimerState } from "@/utils/sla-timer";

const DEFAULT_SLA_MINUTES = 30;
const TICK_INTERVAL_MS = 1000;

// Module-level cache — avoids re-fetching on every remount (e.g. navigation away and back)
let cachedSlaMinutes: number | null = null;

interface ConvForSLA {
  id: string;
  status: 'active' | 'completed' | 'abandoned';
  last_message_at: string;
  started_at: string;
  completed_at: string | null;
}

interface UseSLATimerReturn {
  getSLAState: (conv: ConvForSLA) => SLATimerState;
  slaWindowMinutes: number;
}

/**
 * Manages SLA timer state with a 1-second heartbeat for active conversations.
 * Fetches session_timeout_minutes from fonnte_config once per session (module-level cache).
 */
export function useSLATimer({
  tenantId,
}: {
  tenantId: string | null;
}): UseSLATimerReturn {
  const [slaWindowMinutes, setSlaWindowMinutes] = useState<number>(
    cachedSlaMinutes ?? DEFAULT_SLA_MINUTES
  );
  const [tick, setTick] = useState(0);

  // Fetch SLA window from fonnte_config once (cached after first load)
  useEffect(() => {
    if (cachedSlaMinutes !== null) {
      setSlaWindowMinutes(cachedSlaMinutes);
      return;
    }
    if (!tenantId) return;

    supabase
      .from("fonnte_config")
      .select("session_timeout_minutes")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle()
      .then(({ data }) => {
        const minutes = data?.session_timeout_minutes ?? DEFAULT_SLA_MINUTES;
        cachedSlaMinutes = minutes;
        setSlaWindowMinutes(minutes);
      });
  }, [tenantId]);

  // 1-second heartbeat — drives live timer re-renders
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // New function reference each tick forces parent to recompute displayed values
  const getSLAState = useCallback(
    (conv: ConvForSLA): SLATimerState => {
      return computeSLAState(conv, slaWindowMinutes);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tick, slaWindowMinutes]
  );

  return { getSLAState, slaWindowMinutes };
}
