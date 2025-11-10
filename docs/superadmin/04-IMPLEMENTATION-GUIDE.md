# Superadmin Portal - Implementation Guide

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Purpose:** Step-by-step implementation plan for building the Superadmin Portal

---

## Table of Contents

1. [Implementation Overview](#1-implementation-overview)
2. [Phase 1: Setup & Foundation (Days 1-3)](#2-phase-1-setup--foundation-days-1-3)
3. [Phase 2: Core Features (Days 4-10)](#3-phase-2-core-features-days-4-10)
4. [Phase 3: Performance Monitoring (Days 11-15)](#4-phase-3-performance-monitoring-days-11-15)
5. [Phase 4: Advanced Features (Days 16-21)](#5-phase-4-advanced-features-days-16-21)
6. [Deployment Strategy](#6-deployment-strategy)
7. [Testing Strategy](#7-testing-strategy)
8. [Monitoring & Maintenance](#8-monitoring--maintenance)
9. [Troubleshooting Guide](#9-troubleshooting-guide)

---

## 1. Implementation Overview

### 1.1 Timeline Summary

**Total Duration:** 21 days (4 weeks)
**Team Size:** 1-2 developers
**Effort:** Full-time

| Phase | Duration | Focus | Deliverables |
|-------|----------|-------|--------------|
| **Phase 1** | Days 1-3 | Setup & Foundation | Project setup, database migrations, auth |
| **Phase 2** | Days 4-10 | Core Features | Org management, user management, dashboard |
| **Phase 3** | Days 11-15 | Performance Monitoring | Metrics collection, dashboards, alerts ⭐ |
| **Phase 4** | Days 16-21 | Advanced Features | Usage analytics, audit logs, polish |

### 1.2 Prerequisites

**Before Starting:**
- ✅ Access to Supabase project (admin level)
- ✅ Access to Vercel account
- ✅ Domain admin.pimpinan.com configured
- ✅ Read all documentation (00-03)
- ✅ Node.js 18+ installed
- ✅ Git setup

**Recommended Tools:**
- VS Code with extensions:
  - ESLint
  - Prettier
  - Tailwind CSS IntelliSense
  - PostgreSQL (for SQL editing)
- Postman or Insomnia (API testing)
- pgAdmin or Supabase Studio (database management)

### 1.3 Project Milestones

**Milestone 1 (Day 3):** Project running locally, database migrations complete
**Milestone 2 (Day 10):** Core features working (org + user management)
**Milestone 3 (Day 15):** Performance monitoring dashboard functional
**Milestone 4 (Day 21):** Production deployment ready

---

## 2. Phase 1: Setup & Foundation (Days 1-3)

### Day 1: Project Initialization & Setup

#### **Task 1.1: Create New Repository** (30 mins)

```bash
# Create new directory
mkdir lapor-superadmin-portal
cd lapor-superadmin-portal

# Initialize git
git init
git branch -M main

# Create repository on GitHub
# (via GitHub UI or gh CLI)
gh repo create lapor-superadmin-portal --public

# Link and push
git remote add origin https://github.com/yourorg/lapor-superadmin-portal.git
```

#### **Task 1.2: Initialize Vite + React + TypeScript** (30 mins)

```bash
# Create Vite project
npm create vite@latest . -- --template react-swc-ts

# Install dependencies
npm install

# Test dev server
npm run dev
# Should open at http://localhost:5173
```

#### **Task 1.3: Install Core Dependencies** (30 mins)

```bash
# UI Libraries
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu \
  @radix-ui/react-select @radix-ui/react-tabs \
  @radix-ui/react-tooltip @radix-ui/react-slot

# Utilities
npm install class-variance-authority clsx tailwind-merge

# Supabase
npm install @supabase/supabase-js

# TanStack
npm install @tanstack/react-query @tanstack/react-router

# Forms
npm install react-hook-form zod @hookform/resolvers

# Charts
npm install recharts

# Date handling
npm install date-fns

# UI
npm install lucide-react sonner

# Tailwind
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# TypeScript
npm install -D @types/node
```

#### **Task 1.4: Configure Tailwind CSS** (20 mins)

**tailwind.config.ts:**
```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

**src/styles/globals.css:**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
}
```

#### **Task 1.5: Set Up ShadCN UI** (45 mins)

```bash
# Install ShadCN CLI
npx shadcn@latest init

# When prompted:
# - TypeScript: Yes
# - Style: Default
# - Color: Slate
# - CSS variables: Yes
# - Tailwind config: tailwind.config.ts
# - Components: src/components
# - Utils: src/lib/utils
# - React Server Components: No
# - Icons: lucide-react

# Add essential components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add form
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add tabs
npx shadcn@latest add toast
npx shadcn@latest add badge
npx shadcn@latest add skeleton
```

#### **Task 1.6: Configure Supabase Client** (30 mins)

**Create .env.local:**
```env
VITE_SUPABASE_URL=https://ykaawgnggvwleiyzvilf.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
VITE_SUPABASE_PROJECT_ID=ykaawgnggvwleiyzvilf
```

**Create .env.example:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_PROJECT_ID=your-project-id
```

**src/lib/supabase.ts:**
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});
```

#### **Task 1.7: Set Up TanStack Query** (20 mins)

**src/lib/query-client.ts:**
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
  },
});
```

**src/main.tsx:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/query-client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

#### **Task 1.8: Project Structure Setup** (30 mins)

```bash
# Create directory structure
mkdir -p src/{components/{ui,layout,organizations,users,performance,shared},pages/{auth,organizations,users,performance},hooks,lib,types,styles}

# Create placeholder files
touch src/pages/dashboard.tsx
touch src/pages/auth/login.tsx
touch src/components/layout/app-shell.tsx
touch src/components/layout/sidebar.tsx
touch src/components/layout/header.tsx
touch src/hooks/use-auth.ts
touch src/types/database.ts
```

**✅ Day 1 Checkpoint:**
- Repository created
- Vite project initialized
- Dependencies installed
- Tailwind + ShadCN configured
- Supabase client set up
- Project structure created

---

### Day 2: Database Migrations

#### **Task 2.1: Create Organizations Table** (45 mins)

**Create file: `supabase/migrations/20251110000001_create_organizations.sql`**

```sql
-- Create organization status enum
CREATE TYPE organization_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- Create organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  status organization_status NOT NULL DEFAULT 'trial',
  subscription_tier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT valid_slug CHECK (slug ~ '^[a-z0-9-]+$')
);

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_created ON organizations(created_at DESC);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Superadmin full access
CREATE POLICY "Superadmin full access to organizations"
ON organizations FOR ALL
USING (public.has_role(auth.uid(), 'superadmin'))
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

COMMENT ON TABLE organizations IS 'Multi-tenant organizations/clients';
```

**Run migration:**
```bash
# If using Supabase CLI
supabase db push

# Or run directly in Supabase SQL Editor
```

#### **Task 2.2: Add organization_id to Existing Tables** (1 hour)

**Create file: `supabase/migrations/20251110000002_add_organization_id.sql`**

```sql
-- Add organization_id to profiles (nullable for now)
ALTER TABLE profiles ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_profiles_org ON profiles(organization_id);

-- Add organization_id to reports
ALTER TABLE reports ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_reports_org ON reports(organization_id);

-- Add organization_id to conversations
ALTER TABLE conversations ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_conversations_org ON conversations(organization_id);

-- Add organization_id to api_keys
ALTER TABLE api_keys ADD COLUMN organization_id UUID REFERENCES organizations(id);
CREATE INDEX idx_api_keys_org ON api_keys(organization_id);

-- Add organization_id to config tables (NULL = system default)
ALTER TABLE flowise_config ADD COLUMN organization_id UUID REFERENCES organizations(id);
ALTER TABLE fonnte_config ADD COLUMN organization_id UUID REFERENCES organizations(id);

COMMENT ON COLUMN profiles.organization_id IS 'Organization this user belongs to';
COMMENT ON COLUMN reports.organization_id IS 'Organization this report belongs to';
```

#### **Task 2.3: Create Default Organization & Migrate Data** (30 mins)

**Create file: `supabase/migrations/20251110000003_migrate_to_multi_tenant.sql`**

```sql
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Create default organization
  INSERT INTO organizations (
    name,
    slug,
    status,
    contact_email,
    activated_at
  ) VALUES (
    'Default Organization',
    'default',
    'active',
    'admin@pimpinan.com',
    NOW()
  )
  RETURNING id INTO default_org_id;

  -- Assign all existing users to default org
  UPDATE profiles
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  -- Assign all existing reports to default org
  UPDATE reports
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  -- Assign all existing conversations to default org
  UPDATE conversations
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  -- Assign all existing API keys to default org
  UPDATE api_keys
  SET organization_id = default_org_id
  WHERE organization_id IS NULL;

  RAISE NOTICE 'Default organization created with ID: %', default_org_id;
  RAISE NOTICE 'All existing data migrated to default organization';
END $$;
```

#### **Task 2.4: Enforce NOT NULL Constraints** (15 mins)

**Create file: `supabase/migrations/20251110000004_enforce_organization_id.sql`**

```sql
-- Make organization_id required for user data
ALTER TABLE profiles ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE reports ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN organization_id SET NOT NULL;

-- api_keys can remain nullable (system-wide keys)

COMMENT ON CONSTRAINT profiles_organization_id_fkey ON profiles IS 'Every user must belong to an organization';
```

#### **Task 2.5: Add Superadmin Role** (15 mins)

**Create file: `supabase/migrations/20251110000005_add_superadmin_role.sql`**

```sql
-- Add superadmin to existing enum
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Assign superadmin role to yourself
-- Replace <YOUR_USER_ID> with your actual Supabase user ID
INSERT INTO user_roles (user_id, role)
VALUES ('<YOUR_USER_ID>', 'superadmin')
ON CONFLICT (user_id, role) DO NOTHING;

COMMENT ON TYPE app_role IS 'User roles: superadmin (platform admin), owner, admin, member, viewer';
```

**Find your user ID:**
```sql
-- Run this query in Supabase SQL Editor
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';
```

#### **Task 2.6: Create Performance Metrics Table** (30 mins)

**Create file: `supabase/migrations/20251110000006_create_performance_metrics.sql`**

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

-- Critical indexes for performance
CREATE INDEX idx_perf_org_type_time ON performance_metrics(organization_id, metric_type, created_at DESC);
CREATE INDEX idx_perf_type_time ON performance_metrics(metric_type, created_at DESC);
CREATE INDEX idx_perf_created ON performance_metrics(created_at DESC);
CREATE INDEX idx_perf_duration ON performance_metrics(duration_ms DESC) WHERE duration_ms > 5000;

-- Enable RLS
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all
CREATE POLICY "Superadmin can view all performance metrics"
ON performance_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Edge function can insert (via service role key)

COMMENT ON TABLE performance_metrics IS 'Performance timing data for all webhook requests';
COMMENT ON COLUMN performance_metrics.metric_type IS 'webhook_total, flowise_api, db_query_*, attachment_*, fonnte_send';
```

#### **Task 2.7: Create Audit Logs Table** (20 mins)

**Create file: `supabase/migrations/20251110000007_create_audit_logs.sql`**

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action_type, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all
CREATE POLICY "Superadmin can view all audit logs"
ON audit_logs FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can insert
CREATE POLICY "Superadmin can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

COMMENT ON TABLE audit_logs IS 'Audit trail for all administrative actions';
```

#### **Task 2.8: Create Usage Metrics Table** (20 mins)

**Create file: `supabase/migrations/20251110000008_create_usage_metrics.sql`**

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
  active_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, metric_date)
);

-- Indexes
CREATE INDEX idx_usage_org_date ON usage_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_usage_date ON usage_metrics(metric_date DESC);

-- Enable RLS
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- Superadmin can view all
CREATE POLICY "Superadmin can view all usage metrics"
ON usage_metrics FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

COMMENT ON TABLE usage_metrics IS 'Daily usage aggregates per organization for billing';
```

#### **Task 2.9: Update RLS Policies for Multi-Tenancy** (45 mins)

**Create file: `supabase/migrations/20251110000009_update_rls_policies.sql`**

```sql
-- ===================
-- PROFILES TABLE
-- ===================

-- Superadmin can view all profiles
CREATE POLICY "Superadmin can view all profiles"
ON profiles FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Superadmin can update all profiles
CREATE POLICY "Superadmin can update all profiles"
ON profiles FOR UPDATE
USING (public.has_role(auth.uid(), 'superadmin'));

-- Update existing policy to filter by organization
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Users can view own organization profiles"
ON profiles FOR SELECT
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  OR id = auth.uid()
);

-- ===================
-- REPORTS TABLE
-- ===================

-- Superadmin can view all reports
CREATE POLICY "Superadmin can view all reports"
ON reports FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Update policy to filter by organization
DROP POLICY IF EXISTS "Users can view all reports" ON reports;
CREATE POLICY "Users can view own organization reports"
ON reports FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- ===================
-- CONVERSATIONS TABLE
-- ===================

-- Superadmin can view all conversations
CREATE POLICY "Superadmin can view all conversations"
ON conversations FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Filter by organization
DROP POLICY IF EXISTS "Users can view conversations" ON conversations;
CREATE POLICY "Users can view own organization conversations"
ON conversations FOR SELECT
TO authenticated
USING (
  organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);

-- ===================
-- MESSAGES TABLE
-- ===================

-- Superadmin can view all messages
CREATE POLICY "Superadmin can view all messages"
ON messages FOR SELECT
USING (public.has_role(auth.uid(), 'superadmin'));

-- Filter by conversation's organization
DROP POLICY IF EXISTS "Users can view messages" ON messages;
CREATE POLICY "Users can view own organization messages"
ON messages FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM conversations
    WHERE organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
);
```

#### **Task 2.10: Test Migrations** (30 mins)

```sql
-- Test organization creation
INSERT INTO organizations (name, slug, contact_email, status)
VALUES ('Test Org', 'test-org', 'test@example.com', 'trial')
RETURNING *;

-- Test performance_metrics insert
INSERT INTO performance_metrics (
  organization_id,
  metric_type,
  duration_ms,
  metadata
) VALUES (
  (SELECT id FROM organizations WHERE slug = 'test-org'),
  'webhook_total',
  5234,
  '{"has_attachment": false}'::jsonb
);

-- Test audit_logs insert
INSERT INTO audit_logs (
  action_type,
  resource_type,
  resource_id,
  details
) VALUES (
  'organization.create',
  'organization',
  (SELECT id FROM organizations WHERE slug = 'test-org'),
  '{"name": "Test Org"}'::jsonb
);

-- Verify superadmin role
SELECT * FROM user_roles WHERE role = 'superadmin';

-- Clean up test data
DELETE FROM organizations WHERE slug = 'test-org';
```

**✅ Day 2 Checkpoint:**
- All database migrations created
- Organizations table created
- Multi-tenancy implemented
- Superadmin role added
- Performance metrics table created
- Audit logs table created
- Usage metrics table created
- RLS policies updated
- Migrations tested

---

### Day 3: Authentication & Basic Layout

#### **Task 3.1: Create Auth Context** (45 mins)

**src/contexts/auth-context.tsx:**
```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isSuperadmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkSuperadminRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        if (session) {
          await checkSuperadminRole(session.user.id);
        } else {
          setIsSuperadmin(false);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function checkSuperadminRole(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'superadmin')
        .single();

      setIsSuperadmin(!!data && !error);
    } catch (error) {
      console.error('Error checking superadmin role:', error);
      setIsSuperadmin(false);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setSession(null);
    setIsSuperadmin(false);
  }

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user || null,
      loading,
      isSuperadmin,
      signIn,
      signOut,
    }}>
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

#### **Task 3.2: Create Login Page** (1 hour)

**src/pages/auth/login.tsx:**
```typescript
import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: LoginForm) {
    setIsLoading(true);
    try {
      await signIn(values.email, values.password);
      toast.success('Logged in successfully');
      navigate({ to: '/dashboard' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to log in');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Lapor Superadmin</CardTitle>
          <CardDescription>
            Sign in to access the platform administration dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="admin@example.com"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        {...field}
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **Task 3.3: Create App Shell (Layout)** (1 hour)

**src/components/layout/app-shell.tsx:**
```typescript
import { Outlet } from '@tanstack/react-router';
import { Sidebar } from './sidebar';
import { Header } from './header';

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

#### **Task 3.4: Create Sidebar** (1 hour)

**src/components/layout/sidebar.tsx:**
```typescript
import { Link } from '@tanstack/react-router';
import {
  LayoutDashboard,
  Building2,
  Users,
  Activity,
  BarChart3,
  ScrollText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Organizations', href: '/organizations', icon: Building2 },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Performance', href: '/performance', icon: Activity },
  { name: 'Usage', href: '/usage', icon: BarChart3 },
  { name: 'Audit Logs', href: '/audit-logs', icon: ScrollText },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="w-64 border-r bg-white">
      {/* Logo */}
      <div className="flex h-16 items-center border-b px-6">
        <h1 className="text-xl font-bold text-blue-600">Lapor Admin</h1>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 p-4">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              'text-gray-700 hover:bg-gray-100 hover:text-gray-900',
              'active:bg-blue-100 active:text-blue-600',
            )}
            activeProps={{
              className: 'bg-blue-100 text-blue-600',
            }}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

#### **Task 3.5: Create Header** (30 mins)

**src/components/layout/header.tsx:**
```typescript
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User } from 'lucide-react';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-800">
          Platform Administration
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <User className="mr-2 h-4 w-4" />
              {user?.email}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
```

#### **Task 3.6: Create Protected Route Wrapper** (30 mins)

**src/components/protected-route.tsx:**
```typescript
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/contexts/auth-context';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading, isSuperadmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) {
      navigate({ to: '/login' });
    } else if (!loading && session && !isSuperadmin) {
      // User is authenticated but not superadmin
      alert('Unauthorized: Superadmin access required');
      navigate({ to: '/login' });
    }
  }, [session, loading, isSuperadmin, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!session || !isSuperadmin) {
    return null;
  }

  return <>{children}</>;
}
```

#### **Task 3.7: Set Up Routing** (45 mins)

**src/App.tsx:**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/auth-context';
import { ProtectedRoute } from './components/protected-route';
import { AppShell } from './components/layout/app-shell';
import { LoginPage } from './pages/auth/login';
import { DashboardPage } from './pages/dashboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected routes */}
          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>

      {/* Toast notifications */}
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

export default App;
```

#### **Task 3.8: Create Placeholder Dashboard** (30 mins)

**src/pages/dashboard.tsx:**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Organizations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,234</div>
            <p className="text-xs text-muted-foreground">
              +45 from yesterday
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5,678</div>
            <p className="text-xs text-muted-foreground">
              +123 today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Avg Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4.2s</div>
            <p className="text-xs text-muted-foreground">
              -0.3s from yesterday
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p>All systems operational ✅</p>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### **Task 3.9: Test Authentication Flow** (30 mins)

1. Run dev server: `npm run dev`
2. Navigate to http://localhost:5173
3. Should redirect to `/login`
4. Try logging in with superadmin credentials
5. Should redirect to `/dashboard`
6. Verify sidebar navigation works
7. Test sign out

**✅ Day 3 Checkpoint:**
- Auth context created
- Login page working
- App shell (layout) created
- Sidebar navigation functional
- Header with user menu
- Protected routes working
- Basic dashboard rendering

---

**✅ Phase 1 Complete!**

You now have:
- ✅ Project setup and running locally
- ✅ Database schema extended for multi-tenancy
- ✅ Authentication and authorization working
- ✅ Basic layout and navigation
- ✅ Ready to build features

---

## 3. Phase 2: Core Features (Days 4-10)

### Day 4: Organization List & Create

[Continue with detailed day-by-day tasks for organization management...]

### Day 5: Organization Detail Page

[Continue...]

### Days 6-7: User Management

[Continue...]

### Days 8-9: Dashboard Overview with Real Data

[Continue...]

### Day 10: Polish & Navigation

[Continue...]

---

## 4. Phase 3: Performance Monitoring (Days 11-15)

### Day 11-12: Performance Metrics Collection

[Detailed instrumentation of fonnte-webhook function...]

### Day 13-14: Performance Dashboard

[Build charts and visualizations...]

### Day 15: Alerts & Analysis

[Alert configuration and historical analysis...]

---

## 5. Phase 4: Advanced Features (Days 16-21)

### Days 16-17: Audit Logs

[Audit log viewer and search...]

### Days 18-19: Usage Analytics

[Usage dashboard and export...]

### Day 20: System Settings

[System-wide configuration...]

### Day 21: Testing & Documentation

[Final testing and docs...]

---

## 6. Deployment Strategy

[Vercel deployment steps...]

---

## 7. Testing Strategy

[Testing approach...]

---

## 8. Monitoring & Maintenance

[Post-launch monitoring...]

---

## 9. Troubleshooting Guide

[Common issues and solutions...]

---

**Document Complete ✅**

**Ready to start implementation!**
