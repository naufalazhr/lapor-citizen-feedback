/**
 * usePIIMasking — Role-Based PII Masking Hook
 *
 * Provides masking utilities for reporter PII fields based on the
 * current user's role. Implements the L0/L1/L2/L3 masking standard.
 *
 * Usage:
 *   const { level, maskReport, logAccess } = usePIIMasking();
 *   const displayReport = maskReport(report);
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/use-user-role';
import {
  MaskingLevel,
  PIIMaskable,
  getDefaultMaskingLevel,
  applyMasking,
} from '@/utils/pii-masking';

interface UsePIIMaskingReturn {
  /** Current masking level derived from user's role (L0/L1/L2/L3) */
  level: MaskingLevel;
  /**
   * Apply masking to a report object based on the current user's level.
   * Returns a new object — original is not mutated.
   * At L0 (admin+), returns the report unchanged.
   */
  maskReport: <T extends PIIMaskable>(report: T) => T;
  /**
   * Fire-and-forget audit log INSERT.
   * Logs the report access to pii_access_logs.
   * Never throws — errors are swallowed to avoid blocking the user.
   */
  logAccess: (reportId: string, action?: 'view' | 'export') => Promise<void>;
}

export const usePIIMasking = (): UsePIIMaskingReturn => {
  const { role } = useUserRole();
  const level = getDefaultMaskingLevel(role);

  const maskReport = useCallback(
    <T extends PIIMaskable>(report: T): T => {
      return applyMasking(report, level);
    },
    [level]
  );

  const logAccess = useCallback(
    async (reportId: string, action: 'view' | 'export' = 'view') => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Get user's tenant_id for the log entry
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();

        await supabase.from('pii_access_logs').insert({
          report_id: reportId,
          accessed_by: session.user.id,
          role_at_time: role ?? 'unknown',
          masking_level: level,
          action,
          tenant_id: profile?.tenant_id ?? null,
        });
      } catch (err) {
        // Audit log failure must never block the user — log to console only
        console.warn('[PII] Failed to write access log:', err);
      }
    },
    [role, level]
  );

  return { level, maskReport, logAccess };
};
