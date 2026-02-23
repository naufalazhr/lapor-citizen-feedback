# PII Data Masking — Implementation Reference

**Lapor Civic Platform | Reporter Privacy System**
**Standard**: RBAC-Based L0/L1/L2/L3 Masking (aligned with `docs/masking-plan.md`)

---

## 1. Objective

Protect citizen reporters' Personally Identifiable Information (PII) from unnecessary exposure to government staff, following the principle of least privilege. Each staff role receives only the level of PII data they genuinely need to perform their function.

**Core Principles:**
- Least Privilege Access — default to the lowest level of disclosure
- Data Classification First — categorize fields before assigning masking rules
- Risk-Based Masking — mask more aggressively for higher-sensitivity fields
- Auditability & Traceability — log all PII access events
- Separation of Duties — operational staff (OPD) cannot access reporter identity

---

## 2. PII Classification (Lapor-Specific)

| PII Level | Description | Lapor Fields |
|-----------|-------------|-------------|
| **Level A** – Basic PII | General, low-sensitivity | `ticket_id`, `type` (lapor/aspirasi), `status`, `created_at` |
| **Level B** – Moderate PII | Identity-bearing data | `reporter_name` (full name), `phone` |
| **Level C** – Sensitive PII | Location & contact details | `address` (full address), `geo_location` (GPS coordinates) |
| **Level D** – Critical PII | Context-dependent sensitive content | `description` (may contain abuse, health, financial data) |

> **Note on Level D (`description`)**: The report description is the core content officials must read to process the report. It is NOT masked. Level D risk is mitigated by RLS scope — OPD members only see reports assigned to their department.

---

## 3. Masking Levels (L0–L3)

| Level | Name | Description | Applied To |
|-------|------|-------------|-----------|
| **L0** | Full Access | No masking applied | `superadmin`, `owner`, `admin` |
| **L1** | Partial Mask | Limited identity visibility | `member`, `opd_member` |
| **L2** | De-identified | Minimal identity clues | `viewer` |
| **L3** | Anonymous | No PII at all | Public (`/lacak` tracking page) — already implemented |

### Field-Level Masking Rules

#### `reporter_name` — Level B PII
| Level | Example Output |
|-------|---------------|
| L0 | `Ahmad Fauzi Ramadhan` |
| L1 | `Ahmad F.` |
| L2 | `A***` |
| L3 | `—` |

**Logic**: L1 = first name + last name initial. L2 = first letter + stars. Single-name reporters at L1 are shown as-is.

#### `phone` — Level B PII
| Level | Example Output |
|-------|---------------|
| L0 | `08123456789` |
| L1 | `0812****789` |
| L2 | `—` |
| L3 | `—` |

**Logic**: L1 = first 4 digits + stars + last 3 digits.

#### `address` — Level C PII
| Level | Example Output |
|-------|---------------|
| L0 | `Jl. Sudirman No.5, Kel. Menteng, Kec. Menteng, Jakarta Pusat` |
| L1 | `Kel. Menteng, Kec. Menteng, Jakarta Pusat` |
| L2 | `Jakarta Pusat` |
| L3 | `—` |

**Logic**: Comma-segment based. L1 = remove first segment (street + house number). L2 = last segment only (city/kabupaten). Fail-safe: if no commas, returns full address (never over-masks).

#### `geo_location` — Level C PII
| Level | Map Pin Accuracy |
|-------|-----------------|
| L0 | `{lat: -6.175392, lng: 106.827153}` (6 decimal places, meter-level) |
| L1 | `{lat: -6.18, lng: 106.83}` (2 decimal places, ±500m neighborhood) |
| L2 | `null` (no pin shown on map) |
| L3 | `null` |

---

## 4. RBAC Baseline Mapping

### Role → Default Masking Level

| Role | Default Level | Access Description |
|------|--------------|-------------------|
| `superadmin` | **L0** | Full access — SaaS platform owner |
| `owner` | **L0** | Full access — tenant owner |
| `admin` | **L0** | Full access — government administrator |
| `member` | **L1** | Partial mask — operational staff (handles comms) |
| `opd_member` | **L1** | Partial mask — department staff (processes content) |
| `viewer` | **L2** | De-identified — analytics/read-only staff |
| Public | **L3** | Anonymous — no PII (public `/lacak` tracking) ✓ |

### RBAC Verification Findings (Audit)

The following RLS SELECT policies exist on the `reports` table:

| Role | Policy | Migration |
|------|--------|-----------|
| `admin` | ✅ "Admins can view all reports" | `20251024130105` |
| `member` | ✅ "Members can view all reports" | `20251030051438` |
| `opd_member` | ✅ "OPD Members can view assigned OPD reports" | `20251111172547` |
| `superadmin` / `owner` | ✅ Tenant infrastructure | `20251111000000` |
| `viewer` | ⚠️ **Gap found — missing** | Fixed in `20260224000001` |

**Gap resolved**: `viewer` role had SELECT policies for conversations/messages/attachments but NOT for reports. Fixed by migration `20260224000001_add_viewer_reports_policy.sql`.

---

## 5. System Architecture

```
User Request (Admin Dashboard)
        ↓
Authentication (Supabase Auth + JWT)
        ↓
RLS Policies (tenant isolation + role scope)
        ↓
Data fetched: raw PII from DB (admin roles only see their tenant's data)
        ↓
RBAC Engine — getDefaultMaskingLevel(role) → L0 / L1 / L2
        ↓
Masking Engine (frontend display layer: pii-masking.ts)
        ↓
Rendered Component (masked PII in UI)
        +
pii_access_logs INSERT (fire-and-forget audit trail)
```

**Design decision**: Masking is applied at the **frontend display layer**, not at the database level. The data is already secured by RLS + auth. The threat model addressed here is preventing casual PII exposure on-screen to lower-privilege staff — not preventing direct API access.

---

## 6. Database Schema

### `pii_access_logs` (audit table)

```sql
CREATE TABLE public.pii_access_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  accessed_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_at_time  TEXT NOT NULL,    -- snapshot of role when access occurred
  masking_level TEXT NOT NULL,    -- L0/L1/L2 applied to this access
  action        TEXT NOT NULL DEFAULT 'view',  -- 'view' | 'export'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id     UUID REFERENCES public.tenants(id) ON DELETE CASCADE
);
```

**RLS Policies:**
- `admin`, `owner`, `superadmin` can SELECT (read audit logs for their tenant)
- Any authenticated user can INSERT their own access logs (`WITH CHECK (accessed_by = auth.uid())`)
- No UPDATE or DELETE for regular users — audit logs are **immutable**
- Service role can manage for GDPR/data erasure scenarios

---

## 7. Frontend Masking Engine

### `src/utils/pii-masking.ts`

Pure utility module — no React, no Supabase, fully synchronous.

```typescript
// Types
type MaskingLevel = 'L0' | 'L1' | 'L2' | 'L3';
type UserRole = 'superadmin' | 'owner' | 'admin' | 'member' | 'opd_member' | 'viewer' | null;

// RBAC engine
getDefaultMaskingLevel(role: UserRole): MaskingLevel

// Field-level masking
maskName(name: string, level: MaskingLevel): string
maskPhone(phone: string | null | undefined, level: MaskingLevel): string
maskAddress(address: string | null | undefined, level: MaskingLevel): string
maskGeoLocation(geo: {lat, lng} | null, level: MaskingLevel): {lat, lng} | null

// Composite: apply all PII masking to a report object
applyMasking<T extends PIIMaskable>(report: T, level: MaskingLevel): T
```

### `src/hooks/use-pii-masking.tsx`

React hook for components. Wraps `pii-masking.ts` + audit logging.

```typescript
const { level, maskReport, logAccess } = usePIIMasking();

// level: MaskingLevel — current user's level
// maskReport(report): returns masked copy of report
// logAccess(reportId, action?): fire-and-forget audit log INSERT
```

---

## 8. Component Changes

| File | Change |
|------|--------|
| `src/pages/admin/Reports.tsx` | Table rows show masked `reporter_name`; phone search restricted to L0 roles |
| `src/pages/admin/ReportDetail.tsx` | "Informasi Pelapor" card shows masked fields + masking level badge; geo_location uses `displayReport.geo_location`; audit log on page load |
| `src/utils/dashboard-pdf-export.ts` | Accepts `exporterRole`; masks `reporter_name` in "Isu Mendesak" PDF section |
| `src/pages/admin/DashboardOverview.tsx` | Passes `exporterRole` and `maskingLevel` to PDF export + RegionalHeatmap |
| `src/components/admin/dashboard/executive/RegionalHeatmap.tsx` | Accepts `maskingLevel` prop; popup shows masked reporter name |

---

## 9. Environment Strategy

Following the standard defined in `docs/masking-plan.md` Section 11:

| Environment | Masking Policy | Notes |
|------------|---------------|-------|
| Production | L1–L2 based on role | Default RBAC as above |
| Staging | Consider L3 for all | Test with anonymized data |
| Development | Fully anonymized | Use seeded fake data |

---

## 10. Governance & Controls

### Audit Logging
Every `ReportDetail` page load triggers a `pii_access_logs` INSERT recording:
- Who accessed (user ID + role snapshot)
- Which report (report_id)
- What masking level was applied
- When (timestamp)
- Which tenant

Audit log failures are non-blocking — logged to console only.

### Least Privilege Enforcement
- Default masking level is determined purely by RBAC role
- Phone number search is disabled for L1/L2 roles (can't search by phone if you can't see the phone)
- Map pins are degraded to ±500m precision for L1 roles
- AI Insight Section receives masked reporter data (AI prompts don't contain full PII for L1/L2 users)

### Search Restrictions
In the Reports list (`Reports.tsx`):
- L0 (admin+): can search by ticket ID, name, **phone**, address
- L1/L2 (member, opd_member, viewer): can search by ticket ID, name, address only (phone search disabled)

---

## 11. Future: Dynamic Policy Override System

**Deferred to next iteration.** The full design (per `docs/masking-plan.md` Section 7) includes:

- `pii_policy_overrides` table: time-bound access escalation
- Approval workflow: admin grants override with reason + expiry
- Policy engine: checked before RBAC default

**Implementation path when ready:**
1. Create `pii_policy_overrides` migration
2. Add async `getEffectiveMaskingLevel()` to `pii-masking.ts`
3. Update `use-pii-masking.tsx` to call the async policy check
4. Add override management UI in admin settings

---

## 12. Verification Test Cases

1. **`opd_member` login** → Reports list shows `Ahmad F.` + `0812****789`; phone field in search not functional; detail page shows "Data Disamarkan" badge; map pin at neighborhood accuracy
2. **`member` login** → L1 masking in list; "Data Disamarkan" badge on detail page; phone shows `0812****789` even if conversation.device_number exists
3. **`admin` login** → L0 everywhere; "Akses Penuh" badge; full coordinates in map
4. **`viewer` login** → Reports now accessible (RBAC gap fixed); L2 masking — `A***` name, `—` phone, city-only address, no map pin
5. **PDF export** → Reporter names masked per exporter's role level
6. **`pii_access_logs`** → After opening ReportDetail, a row exists with correct `role_at_time` + `masking_level`
7. **Map popup** → `opd_member` sees `Ahmad F.` in marker popup; `admin` sees full name
8. **TypeScript** → `npx tsc --noEmit` returns zero errors
