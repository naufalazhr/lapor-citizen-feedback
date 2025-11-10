# Superadmin Portal - Technical Architecture

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Purpose:** Technical design and implementation specifications for the Superadmin Portal

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Database Schema Extensions](#3-database-schema-extensions)
4. [RLS Policies for Superadmin](#4-rls-policies-for-superadmin)
5. [Authentication Strategy](#5-authentication-strategy)
6. [Security Architecture](#6-security-architecture)
7. [API Layer Design](#7-api-layer-design)
8. [State Management](#8-state-management)
9. [Performance Considerations](#9-performance-considerations)

---

## 1. Technology Stack

### 1.1 Frontend Stack (Recommended)

**Core Framework:**
```json
{
  "build-tool": "Vite 5.x",
  "framework": "React 18",
  "language": "TypeScript 5.x",
  "styling": "Tailwind CSS",
  "ui-components": "ShadCN UI (reuse from main app)"
}
```

**Routing:**
```json
{
  "recommended": "TanStack Router v1",
  "alternative": "React Router v6",
  "reasoning": "TanStack Router has better TypeScript support and type-safe routing"
}
```

**Data Fetching & State:**
```json
{
  "server-state": "TanStack Query (React Query) v5",
  "client-state": "React Context + hooks (no Zustand needed for V1)",
  "forms": "React Hook Form + Zod",
  "reasoning": "TanStack Query handles caching, invalidation, and optimistic updates excellently"
}
```

**Charts & Visualization:**
```json
{
  "recommended": "Recharts v2.12",
  "alternative": "Tremor (built on Recharts, better DX)",
  "for-advanced": "D3.js (if custom visualizations needed)",
  "reasoning": "Recharts integrates well with React, responsive, and handles performance metrics well"
}
```

**Date Handling:**
```json
{
  "library": "date-fns v4",
  "reasoning": "Tree-shakeable, TypeScript-friendly, already used in main app"
}
```

**HTTP Client:**
```json
{
  "client": "@supabase/supabase-js v2",
  "reasoning": "Direct database access via Supabase client, no custom API needed"
}
```

### 1.2 Backend & Infrastructure

**Database:**
```json
{
  "database": "Supabase PostgreSQL",
  "instance": "Shared with main app (same database)",
  "schema": "public (extend existing schema)",
  "auth": "Supabase Auth (separate user pool or role-based)"
}
```

**Storage:**
```json
{
  "storage": "Supabase Storage (same instance)",
  "buckets": "No new buckets needed (read from existing)"
}
```

**Edge Functions:**
```json
{
  "functions": "Reuse existing fonnte-webhook (add instrumentation)",
  "new-functions": "Optional: aggregation functions for performance analytics"
}
```

**Deployment:**
```json
{
  "platform": "Vercel",
  "project": "Separate Vercel project",
  "domain": "admin.pimpinan.com",
  "protection": "Vercel Password Protection enabled",
  "analytics": "Vercel Analytics (built-in)"
}
```

### 1.3 Development Tools

**Package Manager:**
```json
{
  "manager": "npm or pnpm",
  "reasoning": "pnpm is faster and more efficient, but npm works fine too"
}
```

**Code Quality:**
```json
{
  "linting": "ESLint",
  "formatting": "Prettier",
  "type-checking": "TypeScript strict mode",
  "pre-commit": "Husky + lint-staged (optional)"
}
```

**Testing:**
```json
{
  "unit-tests": "Vitest (Vite-native)",
  "integration-tests": "Vitest + MSW (Mock Service Worker)",
  "e2e-tests": "Playwright (optional for V1)"
}
```

### 1.4 Monitoring & Observability

**Application Monitoring:**
```json
{
  "analytics": "Vercel Analytics (free tier)",
  "error-tracking": "Sentry (recommended for V2)",
  "logging": "Console logs (Vercel captures)"
}
```

**Performance Monitoring:**
```json
{
  "web-vitals": "Built into Vercel",
  "custom-metrics": "Tracked in performance_metrics table"
}
```

### 1.5 Key Dependencies (package.json)

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.47.10",
    "@tanstack/react-query": "^5.59.16",
    "@tanstack/react-router": "^1.58.0",
    "@tanstack/react-table": "^8.20.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.53.0",
    "recharts": "^2.12.7",
    "date-fns": "^4.1.0",
    "zod": "^3.23.8",
    "lucide-react": "^0.454.0",
    "tailwindcss": "^3.4.1",
    "@radix-ui/react-*": "Various Radix primitives",
    "sonner": "^1.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react-swc": "^3.5.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "vitest": "^2.0.0",
    "eslint": "^9.0.0",
    "prettier": "^3.3.0"
  }
}
```

---

## 2. Project Structure

### 2.1 Recommended Directory Structure

```
lapor-superadmin-portal/
├── public/
│   └── favicon.ico
│
├── src/
│   ├── components/
│   │   ├── ui/                          # ShadCN UI components (copied from main app)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   └── ... (40+ components)
│   │   │
│   │   ├── charts/                      # Recharts wrapper components
│   │   │   ├── line-chart.tsx
│   │   │   ├── bar-chart.tsx
│   │   │   ├── area-chart.tsx
│   │   │   └── histogram.tsx
│   │   │
│   │   ├── layout/                      # Shell components
│   │   │   ├── app-shell.tsx           # Main layout wrapper
│   │   │   ├── sidebar.tsx             # Navigation sidebar
│   │   │   ├── header.tsx              # Top header with user menu
│   │   │   └── breadcrumbs.tsx
│   │   │
│   │   ├── organizations/               # Org-specific components
│   │   │   ├── org-list-table.tsx
│   │   │   ├── org-create-modal.tsx
│   │   │   ├── org-detail-card.tsx
│   │   │   └── org-status-badge.tsx
│   │   │
│   │   ├── users/                       # User-specific components
│   │   │   ├── user-list-table.tsx
│   │   │   ├── user-detail-card.tsx
│   │   │   ├── role-assignment-dialog.tsx
│   │   │   └── user-activity-log.tsx
│   │   │
│   │   ├── performance/                 # Performance monitoring components
│   │   │   ├── metrics-card.tsx
│   │   │   ├── response-time-chart.tsx
│   │   │   ├── component-breakdown.tsx
│   │   │   ├── slow-requests-table.tsx
│   │   │   ├── percentile-chart.tsx
│   │   │   └── timeline-visualization.tsx
│   │   │
│   │   └── shared/                      # Shared components
│   │       ├── data-table.tsx          # Generic sortable table
│   │       ├── filter-bar.tsx
│   │       ├── search-input.tsx
│   │       ├── date-range-picker.tsx
│   │       └── export-button.tsx
│   │
│   ├── pages/                           # Page components
│   │   ├── auth/
│   │   │   └── login.tsx
│   │   │
│   │   ├── dashboard.tsx                # Main dashboard/overview
│   │   │
│   │   ├── organizations/
│   │   │   ├── index.tsx               # Organization list
│   │   │   └── [id]/
│   │   │       ├── index.tsx           # Org detail tabs wrapper
│   │   │       ├── overview.tsx
│   │   │       ├── users.tsx
│   │   │       ├── performance.tsx
│   │   │       ├── usage.tsx
│   │   │       └── settings.tsx
│   │   │
│   │   ├── users/
│   │   │   ├── index.tsx               # User list (all orgs)
│   │   │   └── [id].tsx                # User detail
│   │   │
│   │   ├── performance/
│   │   │   ├── index.tsx               # Main performance dashboard
│   │   │   ├── realtime.tsx            # Live monitoring
│   │   │   ├── historical.tsx          # Historical analysis
│   │   │   ├── component/[name].tsx    # Component detail
│   │   │   ├── compare.tsx             # Comparison tool
│   │   │   └── alerts.tsx              # Alert configuration
│   │   │
│   │   ├── usage.tsx                    # Usage analytics
│   │   │
│   │   ├── audit-logs.tsx               # Audit log viewer
│   │   │
│   │   └── settings.tsx                 # System settings
│   │
│   ├── hooks/                           # Custom React hooks
│   │   ├── use-organizations.ts        # Org CRUD operations
│   │   ├── use-users.ts                # User management
│   │   ├── use-performance-metrics.ts  # Perf data fetching
│   │   ├── use-auth.ts                 # Authentication
│   │   ├── use-audit-log.ts            # Audit logging
│   │   └── use-debounce.ts             # Utility hooks
│   │
│   ├── lib/                             # Utility libraries
│   │   ├── supabase.ts                 # Supabase client setup
│   │   ├── api.ts                      # API helper functions
│   │   ├── utils.ts                    # General utilities
│   │   ├── date-utils.ts               # Date formatting
│   │   ├── chart-utils.ts              # Chart data transformations
│   │   └── constants.ts                # App constants
│   │
│   ├── types/                           # TypeScript types
│   │   ├── database.ts                 # Supabase generated types
│   │   ├── api.ts                      # API types
│   │   ├── organization.ts
│   │   ├── user.ts
│   │   ├── performance.ts
│   │   └── index.ts                    # Re-exports
│   │
│   ├── styles/
│   │   └── globals.css                 # Tailwind directives
│   │
│   ├── App.tsx                          # Root component
│   ├── main.tsx                         # Entry point
│   └── vite-env.d.ts                    # Vite types
│
├── docs/                                # This documentation
│   └── superadmin/
│       ├── 00-EXECUTIVE-SUMMARY.md
│       ├── 01-CURRENT-SYSTEM-REFERENCE.md
│       ├── 02-SUPERADMIN-REQUIREMENTS.md
│       ├── 03-TECHNICAL-ARCHITECTURE.md (this file)
│       └── 04-IMPLEMENTATION-GUIDE.md
│
├── .env.example                         # Example environment variables
├── .env.local                           # Local env vars (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── components.json                      # ShadCN UI config
├── vercel.json                          # Vercel deployment config
├── README.md
└── LICENSE
```

### 2.2 Routing Structure (TanStack Router)

**Route Tree:**
```
/                                    → Redirect to /dashboard
/login                               → Login page
/dashboard                           → Main dashboard
/organizations                       → Organization list
/organizations/create                → Create org (modal route)
/organizations/$id                   → Org detail (tabs)
/organizations/$id/overview          → Tab: Overview
/organizations/$id/users             → Tab: Users
/organizations/$id/performance       → Tab: Performance
/organizations/$id/usage             → Tab: Usage
/organizations/$id/settings          → Tab: Settings
/users                               → User list (all orgs)
/users/$id                           → User detail
/performance                         → Performance dashboard
/performance/realtime                → Real-time monitoring
/performance/historical              → Historical analysis
/performance/component/$name         → Component detail
/performance/compare                 → Comparison tool
/performance/alerts                  → Alert config
/usage                               → Usage analytics
/audit-logs                          → Audit log viewer
/settings                            → System settings
```

**Route Protection:**
```typescript
// src/router.tsx
import { createRouter } from '@tanstack/react-router';
import { rootRoute } from './routes/__root';

const router = createRouter({
  routeTree: rootRoute,
  defaultPreload: 'intent',
  defaultPreloadDelay: 100,
});

// Each route has beforeLoad hook to check auth
const organizationsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/organizations',
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: '/login' });

    // Check superadmin role
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .single();

    if (role?.role !== 'superadmin') {
      throw new Error('Unauthorized');
    }
  },
  component: OrganizationsPage,
});
```

### 2.3 Component Architecture Patterns

**Container/Presenter Pattern:**
```typescript
// Container (pages/organizations/index.tsx)
export function OrganizationsPage() {
  const { data, isLoading } = useOrganizations();
  const createMutation = useCreateOrganization();

  return (
    <div>
      <OrganizationListTable
        organizations={data}
        isLoading={isLoading}
        onCreateClick={() => /* open modal */}
      />
    </div>
  );
}

// Presenter (components/organizations/org-list-table.tsx)
export function OrganizationListTable({
  organizations,
  isLoading,
  onCreateClick,
}) {
  // Pure UI logic
  return <Table>{/* render */}</Table>;
}
```

**Compound Components for Complex UI:**
```typescript
// Usage
<PerformanceChart>
  <PerformanceChart.Header>
    <PerformanceChart.Title>Response Times</PerformanceChart.Title>
    <PerformanceChart.TimeRangeSelector />
  </PerformanceChart.Header>
  <PerformanceChart.Body>
    <PerformanceChart.LineChart data={data} />
  </PerformanceChart.Body>
  <PerformanceChart.Footer>
    <PerformanceChart.Legend />
  </PerformanceChart.Footer>
</PerformanceChart>
```

---

## 3. Database Schema Extensions

### 3.1 New Tables Required

#### **organizations** (Multi-tenancy core)

```sql
CREATE TYPE organization_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status organization_status NOT NULL DEFAULT 'trial',
  subscription_tier TEXT,  -- 'trial', 'basic', 'pro', 'enterprise'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,  -- Org-specific config overrides
  metadata JSONB DEFAULT '{}'::jsonb,  -- Additional metadata
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT valid_status_dates CHECK (
    (status = 'active' AND activated_at IS NOT NULL) OR
    (status != 'active')
  )
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_created ON organizations(created_at DESC);

COMMENT ON TABLE organizations IS 'Multi-tenant organizations/clients';
COMMENT ON COLUMN organizations.slug IS 'URL-friendly identifier, immutable';
COMMENT ON COLUMN organizations.settings IS 'JSON: flowise_config, fonnte_config, rate_limits';
```

#### **performance_metrics** (Performance monitoring)

```sql
CREATE TABLE performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  duration_ms INTEGER NOT NULL CHECK (duration_ms >= 0),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance (critical!)
CREATE INDEX idx_perf_org_type_time ON performance_metrics(organization_id, metric_type, created_at DESC);
CREATE INDEX idx_perf_type_time ON performance_metrics(metric_type, created_at DESC);
CREATE INDEX idx_perf_created ON performance_metrics(created_at DESC);
CREATE INDEX idx_perf_duration ON performance_metrics(duration_ms DESC) WHERE duration_ms > 5000;  -- Slow requests

COMMENT ON TABLE performance_metrics IS 'Performance timing data for all requests';
COMMENT ON COLUMN performance_metrics.metric_type IS 'webhook_total, flowise_api, db_query_*, attachment_*, fonnte_send';
COMMENT ON COLUMN performance_metrics.metadata IS 'JSON: http_status, error, retry_count, file_size, message_count';

-- Metric types:
-- 'webhook_total'            - Total webhook processing time
-- 'flowise_api'              - Flowise API call duration
-- 'flowise_api_ttfb'         - Time to first byte from Flowise
-- 'db_query_get_config'      - Get config query
-- 'db_query_find_conversation' - Find/create conversation
-- 'db_query_get_history'     - Get conversation history
-- 'db_query_save_message'    - Save message
-- 'db_query_update_session'  - Update session ID
-- 'attachment_download'      - Download from Fonnte
-- 'attachment_upload'        - Upload to Supabase Storage
-- 'attachment_convert'       - Base64 conversion
-- 'fonnte_send'              - Send message via Fonnte
```

#### **audit_logs** (Audit trail)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,  -- Who did it
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- Which org affected
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,  -- What changed
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action_type, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS 'Audit trail for all administrative actions';

-- Action types:
-- 'organization.create', 'organization.update', 'organization.delete'
-- 'user.create', 'user.update', 'user.delete', 'user.role_change'
-- 'config.update', 'alert.create', 'alert.update', 'alert.delete'

-- Example details JSON:
-- {"old_status": "active", "new_status": "suspended", "reason": "non-payment"}
-- {"old_role": "member", "new_role": "admin"}
```

#### **usage_metrics** (Billing/analytics)

```sql
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  messages_sent INTEGER DEFAULT 0,
  conversations_created INTEGER DEFAULT 0,
  attachments_processed INTEGER DEFAULT 0,
  api_calls INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  active_users INTEGER DEFAULT 0,  -- Unique users active this day
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, metric_date)
);

CREATE INDEX idx_usage_org_date ON usage_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_usage_date ON usage_metrics(metric_date DESC);

COMMENT ON TABLE usage_metrics IS 'Daily usage aggregates per organization for billing';

-- Populated by background job (run daily at midnight)
-- Aggregates from messages, conversations, attachments tables
```

#### **performance_alerts** (Alert configuration)

```sql
CREATE TYPE alert_condition_type AS ENUM ('response_time', 'error_rate', 'component_slow', 'org_comparison');

CREATE TABLE performance_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  condition_type alert_condition_type NOT NULL,
  threshold_value NUMERIC NOT NULL,
  duration_minutes INTEGER NOT NULL,  -- Sustained for X minutes
  organization_id UUID REFERENCES organizations(id),  -- NULL = all orgs
  metric_type TEXT,  -- Which metric to monitor
  enabled BOOLEAN NOT NULL DEFAULT true,
  notification_channels JSONB DEFAULT '{"email": true}'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_alerts_enabled ON performance_alerts(enabled);
CREATE INDEX idx_alerts_org ON performance_alerts(organization_id);

-- Example alert:
-- name: "Flowise API Slow"
-- condition_type: 'component_slow'
-- metric_type: 'flowise_api'
-- threshold_value: 8000 (ms)
-- duration_minutes: 5
-- notification_channels: {"email": true, "slack": false}
```

### 3.2 Updates to Existing Tables

**Add organization_id to existing tables:**

```sql
-- profiles table
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- Make organization_id required after migration
-- (first create default org and assign all existing users)
-- ALTER TABLE profiles ALTER COLUMN organization_id SET NOT NULL;

-- reports table
ALTER TABLE reports ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_reports_org ON reports(organization_id);

-- conversations table
ALTER TABLE conversations ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_conversations_org ON conversations(organization_id);

-- api_keys table
ALTER TABLE api_keys ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);

-- flowise_config table
ALTER TABLE flowise_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
-- NULL organization_id = system default

-- fonnte_config table
ALTER TABLE fonnte_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
-- NULL organization_id = system default
```

**Add superadmin role to enum:**

```sql
-- Add superadmin to app_role enum
ALTER TYPE app_role ADD VALUE 'superadmin';

-- Now enum values are: 'superadmin', 'owner', 'admin', 'member', 'viewer'
```

### 3.3 Migration Strategy

**Migration 1: Create organizations table**
```sql
-- File: supabase/migrations/20251110_create_organizations.sql
CREATE TYPE organization_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TABLE organizations (...);
-- (Full SQL above)
```

**Migration 2: Add organization_id columns (nullable)**
```sql
-- File: supabase/migrations/20251110_add_organization_id.sql
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE reports ADD COLUMN organization_id UUID REFERENCES organizations(id);
-- ... etc
```

**Migration 3: Create default organization and assign existing data**
```sql
-- File: supabase/migrations/20251110_migrate_to_multi_tenant.sql
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default organization
  INSERT INTO organizations (name, slug, status, contact_email)
  VALUES ('Default Organization', 'default', 'active', 'admin@example.com')
  RETURNING id INTO default_org_id;

  -- Assign all existing users to default org
  UPDATE profiles SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Assign all existing reports to default org
  UPDATE reports SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Assign all existing conversations to default org
  UPDATE conversations SET organization_id = default_org_id WHERE organization_id IS NULL;

  -- Assign all existing API keys to default org
  UPDATE api_keys SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;
```

**Migration 4: Make organization_id NOT NULL**
```sql
-- File: supabase/migrations/20251110_enforce_organization_id.sql
ALTER TABLE profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reports ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN organization_id SET NOT NULL;
-- api_keys can remain nullable (for system-wide keys)
```

**Migration 5: Add superadmin role**
```sql
-- File: supabase/migrations/20251110_add_superadmin_role.sql
ALTER TYPE app_role ADD VALUE 'superadmin';

-- Assign superadmin to yourself
INSERT INTO user_roles (user_id, role)
VALUES ('<your-user-id>', 'superadmin');
```

**Migration 6: Create performance_metrics table**
```sql
-- File: supabase/migrations/20251110_create_performance_metrics.sql
CREATE TABLE performance_metrics (...);
-- (Full SQL above)
```

**Migration 7: Create audit_logs table**
```sql
-- File: supabase/migrations/20251110_create_audit_logs.sql
CREATE TABLE audit_logs (...);
```

**Migration 8: Create usage_metrics table**
```sql
-- File: supabase/migrations/20251110_create_usage_metrics.sql
CREATE TABLE usage_metrics (...);
```

**Migration 9: Create performance_alerts table**
```sql
-- File: supabase/migrations/20251110_create_performance_alerts.sql
CREATE TABLE performance_alerts (...);
```

---

## 4. RLS Policies for Superadmin

### 4.1 Organizations Table

```sql
-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Superadmin full access
CREATE POLICY "Superadmin full access to organizations"
ON organizations FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Organization owners/admins can view their own org
CREATE POLICY "Users can view own organization"
ON organizations FOR SELECT
USING (
  id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
```

### 4.2 Performance Metrics Table

```sql
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all metrics
CREATE POLICY "Superadmin can view all performance metrics"
ON performance_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can insert metrics (for manual testing)
CREATE POLICY "Superadmin can insert performance metrics"
ON performance_metrics FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Edge functions can insert metrics (using service role key)
-- No policy needed for service role

-- Organization users can view their own org's metrics (future)
CREATE POLICY "Users can view own organization metrics"
ON performance_metrics FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
```

### 4.3 Audit Logs Table

```sql
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all audit logs
CREATE POLICY "Superadmin can view all audit logs"
ON audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can insert audit logs
CREATE POLICY "Superadmin can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

-- Users can view audit logs for their own organization (future)
CREATE POLICY "Users can view own organization audit logs"
ON audit_logs FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  AND public.has_role(auth.uid(), 'admin')  -- Only admins
);
```

### 4.4 Usage Metrics Table

```sql
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all usage metrics
CREATE POLICY "Superadmin can view all usage metrics"
ON usage_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Edge function can insert (using service role)
-- No policy needed for service role

-- Organization admins can view their own usage (future)
CREATE POLICY "Admins can view own organization usage"
ON usage_metrics FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  AND public.has_role(auth.uid(), 'admin')
);
```

### 4.5 Updated Policies for Existing Tables

**profiles table:**

```sql
-- Superadmin can view all profiles across organizations
CREATE POLICY "Superadmin can view all profiles"
ON profiles FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can update all profiles
CREATE POLICY "Superadmin can update all profiles"
ON profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'superadmin'));

-- Update existing policy to filter by organization
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
CREATE POLICY "Users can view own organization profiles"
ON profiles FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  OR id = auth.uid()  -- Can always see own profile
);
```

**reports table:**

```sql
-- Superadmin can view all reports across organizations
CREATE POLICY "Superadmin can view all reports"
ON reports FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Update existing policy to filter by organization
DROP POLICY IF EXISTS "Users can view all reports" ON reports;
CREATE POLICY "Users can view own organization reports"
ON reports FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
```

**conversations table:**

```sql
-- Superadmin can view all conversations
CREATE POLICY "Superadmin can view all conversations"
ON conversations FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Filter by organization
DROP POLICY IF EXISTS "Users can view conversations" ON conversations;
CREATE POLICY "Users can view own organization conversations"
ON conversations FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);
```

**messages table:**

```sql
-- Superadmin can view all messages
CREATE POLICY "Superadmin can view all messages"
ON messages FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Filter by organization via conversation
DROP POLICY IF EXISTS "Users can view messages" ON messages;
CREATE POLICY "Users can view own organization messages"
ON messages FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
);
```

### 4.6 Helper Functions

**get_user_organization()** - Get user's organization ID

```sql
CREATE OR REPLACE FUNCTION public.get_user_organization(user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  org_id UUID;
BEGIN
  SELECT organization_id INTO org_id
  FROM profiles
  WHERE id = user_id;

  RETURN org_id;
END;
$$;
```

**is_superadmin()** - Check if user is superadmin

```sql
CREATE OR REPLACE FUNCTION public.is_superadmin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN public.has_role(user_id, 'superadmin');
END;
$$;
```

**log_audit()** - Create audit log entry

```sql
CREATE OR REPLACE FUNCTION public.log_audit(
  p_action_type TEXT,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_details JSONB,
  p_organization_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id UUID;
BEGIN
  INSERT INTO audit_logs (
    actor_id,
    organization_id,
    action_type,
    resource_type,
    resource_id,
    details,
    ip_address,
    user_agent
  ) VALUES (
    auth.uid(),
    p_organization_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_details,
    current_setting('request.headers')::json->>'x-forwarded-for',
    current_setting('request.headers')::json->>'user-agent'
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Usage:
-- SELECT public.log_audit('organization.update', 'organization', org_id,
--   '{"old_status": "active", "new_status": "suspended"}'::jsonb, org_id);
```

---

## 5. Authentication Strategy

### 5.1 Option A: Separate Superadmin Auth (Recommended)

**Approach:**
- Create superadmin users manually in Supabase Auth dashboard
- Assign superadmin role in user_roles table
- Superadmin portal checks for superadmin role on login
- Completely isolated from organization users

**Pros:**
- Clear separation
- No risk of organization users accessing superadmin
- Simpler to audit

**Cons:**
- Users need separate credentials
- No SSO with main app

**Implementation:**

```typescript
// src/lib/auth.ts
export async function checkSuperadminAccess() {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  // Check for superadmin role
  const { data: role, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .single();

  if (roleError || role?.role !== 'superadmin') {
    throw new Error('Unauthorized: Superadmin access required');
  }

  return session;
}

// In every protected route
const session = await checkSuperadminAccess();
```

**Manual Superadmin Creation:**

1. Create user in Supabase Auth dashboard
2. Run SQL to assign role:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<new-user-id>', 'superadmin');
```

### 5.2 Option B: Shared Auth with Role Check

**Approach:**
- Same Supabase Auth as main app
- Check for superadmin role on every request
- Redirect non-superadmin users

**Pros:**
- Single credential
- Easier for users

**Cons:**
- Organization users might discover superadmin portal URL
- Need robust protection

**Implementation:**

Same as Option A, but users can use same credentials as main app.

### 5.3 Recommendation

**Use Option A (Separate Superadmin Auth)** because:
- Better security (organization users never see superadmin portal)
- Clearer audit trail
- Professional separation
- Can add IP whitelisting or VPN later

---

## 6. Security Architecture

### 6.1 Authentication & Authorization

**Multi-Layer Security:**

```
Layer 1: Vercel Password Protection
  ↓
Layer 2: Supabase Auth (JWT token)
  ↓
Layer 3: Superadmin Role Check (client-side)
  ↓
Layer 4: RLS Policies (database-side)
  ↓
Layer 5: Audit Logging (all actions tracked)
```

### 6.2 Vercel Deployment Protection

**vercel.json configuration:**

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "geolocation=(), microphone=(), camera=()"
        }
      ]
    }
  ]
}
```

**Enable Password Protection:**
- In Vercel dashboard, go to project settings
- Enable "Deployment Protection"
- Set password (share with superadmin team only)
- All preview deployments protected by default

### 6.3 Session Management

**Session Configuration:**

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      flowType: 'pkce',  // More secure than implicit flow
    },
  }
);

// Session timeout: 8 hours (configured in Supabase dashboard)
// JWT expiry: 1 hour (auto-refreshed)
```

**Session Validation:**

```typescript
// src/hooks/use-auth.ts
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

### 6.4 API Security

**Supabase RLS Enforcement:**
- All database access goes through Supabase client
- RLS policies enforced at database level
- No way to bypass policies from client
- Service role key never exposed to frontend

**CORS Configuration:**
- Supabase handles CORS automatically
- Only allow requests from admin.pimpinan.com (production)
- Allow localhost for development

### 6.5 Audit Logging

**Log Every Action:**

```typescript
// src/lib/audit.ts
export async function logAudit(params: {
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  organizationId?: string;
}) {
  const { data, error } = await supabase.rpc('log_audit', {
    p_action_type: params.action,
    p_resource_type: params.resource,
    p_resource_id: params.resourceId,
    p_details: params.details || {},
    p_organization_id: params.organizationId,
  });

  if (error) {
    console.error('Failed to log audit:', error);
  }

  return data;
}

// Usage
await logAudit({
  action: 'organization.update',
  resource: 'organization',
  resourceId: orgId,
  details: { old_status: 'active', new_status: 'suspended' },
  organizationId: orgId,
});
```

**Audit in React Query Mutations:**

```typescript
const updateOrgMutation = useMutation({
  mutationFn: async ({ id, updates }) => {
    const { data } = await supabase
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .single();

    // Log audit
    await logAudit({
      action: 'organization.update',
      resource: 'organization',
      resourceId: id,
      details: updates,
      organizationId: id,
    });

    return data;
  },
});
```

### 6.6 Environment Variables

**.env.example:**

```env
# Supabase
VITE_SUPABASE_URL=https://ykaawgnggvwleiyzvilf.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=your-project-id

# App
VITE_APP_URL=https://admin.pimpinan.com

# Optional: Analytics
VITE_SENTRY_DSN=your-sentry-dsn
```

**Security Notes:**
- ANON_KEY is safe to expose (public key)
- Service role key NEVER in frontend
- Use Vercel environment variables for secrets
- Different .env for dev/staging/production

---

## 7. API Layer Design

### 7.1 Data Fetching with TanStack Query

**Query Configuration:**

```typescript
// src/lib/query-client.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      gcTime: 1000 * 60 * 10,     // 10 minutes (formerly cacheTime)
      retry: 3,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

**Query Hooks Pattern:**

```typescript
// src/hooks/use-organizations.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

// Fetch all organizations
export function useOrganizations(filters?: OrganizationFilters) {
  return useQuery({
    queryKey: ['organizations', filters],
    queryFn: async () => {
      let query = supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.in('status', filters.status);
      }

      if (filters?.search) {
        query = query.ilike('name', `%${filters.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Fetch single organization
export function useOrganization(id: string) {
  return useQuery({
    queryKey: ['organization', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,  // Only run if ID provided
  });
}

// Create organization
export function useCreateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newOrg: CreateOrganizationInput) => {
      const { data, error } = await supabase
        .from('organizations')
        .insert(newOrg)
        .select()
        .single();

      if (error) throw error;

      // Log audit
      await logAudit({
        action: 'organization.create',
        resource: 'organization',
        resourceId: data.id,
        details: newOrg,
        organizationId: data.id,
      });

      return data;
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}

// Update organization
export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Organization> }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      await logAudit({
        action: 'organization.update',
        resource: 'organization',
        resourceId: id,
        details: updates,
        organizationId: id,
      });

      return data;
    },
    onSuccess: (data) => {
      // Invalidate both list and detail queries
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
      queryClient.invalidateQueries({ queryKey: ['organization', data.id] });
    },
  });
}

// Delete organization
export function useDeleteOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logAudit({
        action: 'organization.delete',
        resource: 'organization',
        resourceId: id,
        organizationId: id,
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] });
    },
  });
}
```

**Performance Metrics Hooks:**

```typescript
// src/hooks/use-performance-metrics.ts

interface PerformanceMetricsFilters {
  timeRange: 'hour' | '24h' | '7d' | '30d';
  organizationId?: string;
  metricType?: string;
}

// Fetch aggregated metrics (P50, P95, P99)
export function usePerformanceMetrics(filters: PerformanceMetricsFilters) {
  return useQuery({
    queryKey: ['performance-metrics', filters],
    queryFn: async () => {
      const interval = getIntervalFromTimeRange(filters.timeRange);

      const { data, error } = await supabase.rpc('get_performance_stats', {
        p_interval: interval,
        p_organization_id: filters.organizationId,
        p_metric_type: filters.metricType,
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,  // Refresh every 30 seconds
  });
}

// Fetch performance trends (time series)
export function usePerformanceTrends(filters: PerformanceMetricsFilters) {
  return useQuery({
    queryKey: ['performance-trends', filters],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_performance_trends', {
        p_interval: getIntervalFromTimeRange(filters.timeRange),
        p_organization_id: filters.organizationId,
      });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000,  // Refresh every minute
  });
}

// Fetch slow requests
export function useSlowRequests(threshold: number, limit: number = 50) {
  return useQuery({
    queryKey: ['slow-requests', threshold, limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('performance_metrics')
        .select(`
          *,
          conversations (phone_number),
          organizations (name)
        `)
        .eq('metric_type', 'webhook_total')
        .gte('duration_ms', threshold)
        .order('duration_ms', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    },
  });
}
```

### 7.2 Database Functions (RPC)

**Performance Statistics Function:**

```sql
CREATE OR REPLACE FUNCTION public.get_performance_stats(
  p_interval TEXT,
  p_organization_id UUID DEFAULT NULL,
  p_metric_type TEXT DEFAULT 'webhook_total'
)
RETURNS TABLE (
  p50 NUMERIC,
  p90 NUMERIC,
  p95 NUMERIC,
  p99 NUMERIC,
  avg_duration NUMERIC,
  min_duration INTEGER,
  max_duration INTEGER,
  total_requests BIGINT,
  error_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration_ms) as p90,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99,
    AVG(duration_ms) as avg_duration,
    MIN(duration_ms) as min_duration,
    MAX(duration_ms) as max_duration,
    COUNT(*) as total_requests,
    COUNT(*) FILTER (WHERE (metadata->>'error') IS NOT NULL) as error_count
  FROM performance_metrics
  WHERE metric_type = p_metric_type
    AND created_at > NOW() - CAST(p_interval AS INTERVAL)
    AND (p_organization_id IS NULL OR organization_id = p_organization_id);
END;
$$;

-- Usage:
-- SELECT * FROM get_performance_stats('1 hour', null, 'webhook_total');
```

**Performance Trends Function:**

```sql
CREATE OR REPLACE FUNCTION public.get_performance_trends(
  p_interval TEXT,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  time_bucket TIMESTAMPTZ,
  p50 NUMERIC,
  p95 NUMERIC,
  avg_duration NUMERIC,
  request_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE_TRUNC('minute', created_at) as time_bucket,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
    AVG(duration_ms) as avg_duration,
    COUNT(*) as request_count
  FROM performance_metrics
  WHERE metric_type = 'webhook_total'
    AND created_at > NOW() - CAST(p_interval AS INTERVAL)
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
  GROUP BY time_bucket
  ORDER BY time_bucket;
END;
$$;
```

---

## 8. State Management

### 8.1 Server State (TanStack Query)

**All data from database managed by React Query:**
- Organizations
- Users
- Performance metrics
- Audit logs
- Usage metrics

**Benefits:**
- Automatic caching
- Background refetching
- Optimistic updates
- Loading/error states
- Retry logic

### 8.2 Client State (React Context + Hooks)

**Auth Context:**

```typescript
// src/contexts/auth-context.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  return (
    <AuthContext.Provider value={{ session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

**Filter State (URL State):**

```typescript
// src/hooks/use-filter-state.ts
import { useSearchParams } from '@tanstack/react-router';

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = {
    search: searchParams.get('search') || '',
    status: searchParams.getAll('status'),
    dateFrom: searchParams.get('from') || '',
    dateTo: searchParams.get('to') || '',
  };

  const setFilters = (newFilters: Partial<typeof filters>) => {
    const params = new URLSearchParams(searchParams);

    Object.entries(newFilters).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        params.delete(key);
        value.forEach(v => params.append(key, v));
      } else if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    setSearchParams(params);
  };

  return { filters, setFilters };
}
```

### 8.3 No Global State Needed

For V1, no need for Zustand/Redux because:
- Server state handled by React Query
- Auth state in Context
- Filter state in URL
- UI state local to components

**Keep it simple!**

---

## 9. Performance Considerations

### 9.1 Database Query Optimization

**Indexes (Already Defined):**
- Organizations: slug, status, created_at
- Performance metrics: (org_id, metric_type, created_at), duration
- Audit logs: actor_id, org_id, action_type, created_at
- All foreign keys indexed

**Query Patterns:**

**Efficient:**
```typescript
// Good: Indexed query
const { data } = await supabase
  .from('organizations')
  .select('*')
  .eq('status', 'active')  // Uses idx_organizations_status
  .order('created_at', { ascending: false });  // Uses idx_organizations_created
```

**Inefficient:**
```typescript
// Bad: Unindexed LIKE query
const { data } = await supabase
  .from('organizations')
  .select('*')
  .like('metadata', '%something%');  // Full table scan!
```

**Solution: Use full-text search or specific JSON queries**

### 9.2 Chart Data Aggregation

**Server-Side Aggregation (Recommended):**
```typescript
// Use database function for heavy computation
const { data } = await supabase.rpc('get_performance_trends', {
  p_interval: '24 hours',
});
```

**Client-Side Aggregation (Only for small datasets):**
```typescript
// Okay for < 1000 rows
const aggregated = useMemo(() => {
  return data.reduce((acc, item) => {
    // ... aggregation logic
  }, {});
}, [data]);
```

### 9.3 Pagination

**Server-Side Pagination:**
```typescript
export function useOrganizations(page: number, pageSize: number = 20) {
  return useQuery({
    queryKey: ['organizations', page, pageSize],
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await supabase
        .from('organizations')
        .select('*', { count: 'exact' })
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return { data, totalPages: Math.ceil(count! / pageSize) };
    },
  });
}
```

### 9.4 Code Splitting

**Route-Based Splitting:**
```typescript
// src/router.tsx
import { lazy } from 'react';

const DashboardPage = lazy(() => import('./pages/dashboard'));
const OrganizationsPage = lazy(() => import('./pages/organizations'));
const PerformancePage = lazy(() => import('./pages/performance'));

// TanStack Router automatically code-splits
```

**Component-Level Splitting (Heavy components):**
```typescript
const HeavyChart = lazy(() => import('./components/charts/advanced-chart'));

function PerformanceDashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <HeavyChart data={data} />
    </Suspense>
  );
}
```

### 9.5 Bundle Size Optimization

**Analyze Bundle:**
```bash
npm run build
npm run preview

# Use rollup-plugin-visualizer
npm install -D rollup-plugin-visualizer
```

**Tree-Shaking:**
- Use named imports: `import { Button } from '@/components/ui/button'`
- Avoid `import * as Everything from 'lib'`

**Lazy Load Charts:**
- Recharts is heavy (~200kb)
- Only load when needed

---

**Document Complete ✅**

**Next:** See [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md) for step-by-step implementation plan.
