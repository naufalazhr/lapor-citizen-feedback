# Lapor Superadmin Portal - Executive Summary

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Author:** Platform Team
**Purpose:** Complete context for building the separate Superadmin Portal

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Current System Architecture](#2-current-system-architecture)
3. [The Problem Statement](#3-the-problem-statement)
4. [Solution: Superadmin Portal](#4-solution-superadmin-portal)
5. [Why Separate Project](#5-why-separate-project)
6. [Quick Reference Links](#6-quick-reference-links)

---

## 1. Project Overview

### 1.1 What is Lapor Citizen Feedback Platform?

**Lapor** is an AI-powered citizen feedback and reporting system that enables citizens to submit reports (complaints, suggestions, feedback) through WhatsApp and receive intelligent, conversational responses from an AI agent.

**Current Implementation:**
- **Channel:** WhatsApp (via Fonnte gateway)
- **AI Engine:** Flowise (hosted on Railway) with reasoning agentic framework
- **Backend:** Supabase (Database + Edge Functions)
- **Frontend:** React + TypeScript + Vite (deployed on Vercel)
- **Target Users:** Government institutions, municipalities, citizen service centers

### 1.2 Current State: Single-Tenant Application

**As of November 2025:**
- ✅ Fully functional WhatsApp chatbot
- ✅ Citizen reporting form (web-based alternative)
- ✅ Admin panel for managing reports and conversations
- ✅ Role-based access control (owner, admin, member, viewer)
- ✅ Integration with Flowise AI and Fonnte WhatsApp gateway
- ❌ **Single tenant** - one organization per deployment
- ❌ No platform-level administration
- ❌ No cross-client visibility
- ❌ No performance monitoring dashboard

**Current Users:**
- Citizens (anonymous) - Submit reports via WhatsApp or web form
- Organization staff (authenticated) - Manage reports, view conversations
- Organization admins (authenticated) - Configure integrations, manage users

### 1.3 Evolution: Becoming Multi-Tenant B2B SaaS Platform

**Strategic Direction:**
- Transform from single-tenant app to multi-tenant SaaS platform
- Enable multiple government institutions/organizations to use the platform
- Provide platform-level administration and monitoring
- Offer usage-based insights and analytics
- Support client onboarding and management

**Vision Statement:**
> Lapor will become the leading AI-powered citizen engagement platform for government institutions across Indonesia, enabling efficient, intelligent, and scalable citizen feedback management through WhatsApp.

### 1.4 Product Positioning

**Business Model:** B2B SaaS
**Target Market:** Government institutions, municipalities, citizen service centers
**Pricing (Future):** Per-organization subscription + usage-based (messages, storage)
**Competitive Advantage:**
- WhatsApp-native (most popular messaging app in Indonesia)
- AI-powered conversational interface
- Multi-channel support (WhatsApp + web)
- Complete admin dashboard included

---

## 2. Current System Architecture

### 2.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CITIZEN LAYER                            │
│  ┌──────────────┐              ┌──────────────┐                │
│  │   WhatsApp   │              │  Web Browser │                │
│  │     App      │              │  (Citizen)   │                │
│  └──────┬───────┘              └───────┬──────┘                │
└─────────┼──────────────────────────────┼────────────────────────┘
          │                               │
          │ Message                       │ HTTPS
          │                               │
┌─────────▼──────────────────────────────▼────────────────────────┐
│                     INTEGRATION LAYER                            │
│  ┌──────────────┐              ┌──────────────┐                │
│  │    Fonnte    │              │   Vercel     │                │
│  │   Gateway    │              │ (Frontend)   │                │
│  │              │              │              │                │
│  │ WhatsApp API │              │  React App   │                │
│  └──────┬───────┘              └───────┬──────┘                │
└─────────┼──────────────────────────────┼────────────────────────┘
          │                               │
          │ Webhook POST                  │ Supabase Client
          │                               │
┌─────────▼───────────────────────────────▼────────────────────────┐
│                      BACKEND LAYER                               │
│  ┌───────────────────────────────────────────────────┐          │
│  │              Supabase                             │          │
│  │  ┌─────────────────┐  ┌──────────────────────┐   │          │
│  │  │  Edge Function  │  │    PostgreSQL        │   │          │
│  │  │  fonnte-webhook │  │    Database          │   │          │
│  │  │                 │  │                      │   │          │
│  │  │  - Parse msg    │  │  - reports           │   │          │
│  │  │  - Save to DB   │  │  - conversations     │   │          │
│  │  │  - Call Flowise │  │  - messages          │   │          │
│  │  │  - Send reply   │  │  - profiles          │   │          │
│  │  └────────┬────────┘  │  - user_roles        │   │          │
│  │           │           │  - api_keys          │   │          │
│  │           │           │  - configs           │   │          │
│  │           │           └──────────────────────┘   │          │
│  │           │  ┌──────────────────────┐            │          │
│  │           │  │  Supabase Storage    │            │          │
│  │           │  │  - Attachments       │            │          │
│  │           │  │  - Media files       │            │          │
│  │           │  └──────────────────────┘            │          │
│  └───────────┼───────────────────────────────────────┘          │
└──────────────┼──────────────────────────────────────────────────┘
               │
               │ HTTP POST (Prediction API)
               │
┌──────────────▼──────────────────────────────────────────────────┐
│                         AI LAYER                                 │
│  ┌───────────────────────────────────────────────────┐          │
│  │              Railway Platform                     │          │
│  │  ┌─────────────────────────────────────────────┐  │          │
│  │  │          Flowise Instance                   │  │          │
│  │  │                                             │  │          │
│  │  │  - Conversational AI Agent                 │  │          │
│  │  │  - Reasoning Framework                     │  │          │
│  │  │  - Context Management                      │  │          │
│  │  │  - LLM Integration (OpenAI, etc.)          │  │          │
│  │  │                                             │  │          │
│  │  │  API: /api/v1/prediction/{chatflow_id}    │  │          │
│  │  └─────────────────────────────────────────────┘  │          │
│  └───────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Message Flow Sequence

**When a citizen sends a WhatsApp message:**

```
1. Citizen sends message via WhatsApp
   ↓
2. Fonnte receives message and sends webhook to Supabase Edge Function
   POST https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook
   ↓
3. Edge Function (fonnte-webhook):
   a. Parse and validate payload
   b. Find or create conversation session (30-min timeout)
   c. Get conversation history from database
   d. Process attachments (if any):
      - Download from Fonnte URL
      - Upload to Supabase Storage
      - Convert to base64 for Flowise
   e. Build Flowise API request with context
   f. Call Flowise API (2-5 seconds - PRIMARY BOTTLENECK)
   g. Extract AI response and session ID
   h. Save messages to database (user + assistant)
   ↓
4. Send response back to citizen:
   POST https://api.fonnte.com/send
   ↓
5. Citizen receives AI response in WhatsApp
```

**Total Time:** 4-8 seconds average

### 2.3 Technology Stack

**Frontend:**
- **Framework:** Vite 5.4.21 + React 18 + TypeScript
- **UI Library:** ShadCN UI + Radix UI
- **Styling:** Tailwind CSS
- **Routing:** React Router v6
- **State Management:** React Query + Zustand
- **Forms:** React Hook Form
- **Deployment:** Vercel
- **Domain:** pimpinan.com

**Backend:**
- **Database:** Supabase PostgreSQL
- **Authentication:** Supabase Auth
- **Storage:** Supabase Storage
- **Edge Functions:** Deno runtime on Supabase
- **Real-time:** Supabase Realtime (not currently used)

**AI Layer:**
- **Platform:** Flowise (low-code AI workflow builder)
- **Hosting:** Railway (https://tanya-suhu.up.railway.app)
- **Chatflow ID:** 487749ef-c4cd-4e17-b7a2-ec6376e482ea
- **Timeout:** 30 seconds
- **Retry Logic:** 3 attempts with exponential backoff

**Integration Layer:**
- **WhatsApp Gateway:** Fonnte (https://api.fonnte.com)
- **Token:** XJcZd5ARToBoPgAtEyQp
- **Session Timeout:** 30 minutes

### 2.4 Performance Characteristics (Current Baseline)

**Response Time Breakdown (Average):**

| Component | Duration | Percentage | Status |
|-----------|----------|------------|--------|
| **Flowise API Call** | 2-5 seconds | 50-62% | 🔴 PRIMARY BOTTLENECK |
| **Fonnte Send API** | 1-2 seconds | 12-25% | 🟡 Secondary bottleneck |
| **Attachment Processing** | 0-3 seconds | 0-37% | 🟡 Only when media present |
| **Database Queries** | ~350ms | 4-9% | 🟢 Acceptable |
| **Other Processing** | ~100ms | 1-3% | 🟢 Minimal |
| **TOTAL** | **4-8 seconds** | **100%** | 🟡 Needs optimization |

**Identified Bottlenecks:**
1. **Flowise API** - Synchronous blocking call, AI reasoning requires time
2. **Attachment Download** - Network dependency on Fonnte CDN
3. **Multiple Sequential DB Queries** - 7 queries per message (N+1 pattern)
4. **Fonnte Send** - Could be moved to async queue

**Current Logging:**
- ✅ Console logging with 49 log points across codebase
- ✅ Error logging to `webhook_errors` table
- ✅ Debug mode available (`DEBUG=true` env var)
- ❌ No structured performance metrics collection
- ❌ No real-time monitoring dashboard
- ❌ No percentile-based SLA tracking (P50, P95, P99)
- ❌ No alerting for slow responses

---

## 3. The Problem Statement

### 3.1 Current Limitations

**As a Platform Provider, we cannot:**

1. **Onboard New Clients Easily**
   - Manual database setup required for each new client
   - No self-service onboarding flow
   - Configuration must be done directly in database
   - No organization management interface

2. **Monitor System Performance**
   - No visibility into response time trends
   - Cannot identify which component is slow
   - No per-organization performance comparison
   - Cannot track P50/P95/P99 percentiles
   - No alerting for degraded performance

3. **Track Usage Per Client**
   - No way to see messages per organization
   - Cannot calculate billable metrics
   - No storage usage tracking
   - No API call counting
   - Cannot support usage-based pricing

4. **Manage Users Across Organizations**
   - No cross-client user search
   - Cannot see total user base
   - No central user management
   - Cannot assist users from different clients

5. **Configure System-Wide Settings**
   - No platform-level configuration UI
   - Cannot set default Flowise/Fonnte settings
   - No feature flags or maintenance mode
   - No centralized integration management

6. **Audit and Compliance**
   - No audit trail for administrative actions
   - Cannot track who created/modified organizations
   - No visibility into role assignments
   - Hard to prove compliance for security audits

### 3.2 Business Impact

**Without Superadmin Portal:**

- ⏱️ **Slow Onboarding:** New client setup takes 2-3 hours manually
- 📉 **Poor Visibility:** Cannot identify performance issues proactively
- 💸 **No Usage Tracking:** Cannot implement usage-based pricing
- 🔧 **High Support Burden:** Every config change requires database access
- 🔒 **Security Risk:** Multiple people need production database access
- 📊 **No Business Insights:** Cannot analyze cross-client trends

**Expected After Superadmin Portal:**

- ⚡ **Fast Onboarding:** New client setup in < 10 minutes through UI
- 📈 **Proactive Monitoring:** Real-time dashboard shows performance bottlenecks
- 💰 **Usage-Based Pricing:** Automatic tracking of billable metrics
- 🎯 **Self-Service:** Reduce support requests by 60%
- 🔐 **Better Security:** Only superadmin users access sensitive features
- 📊 **Data-Driven:** Make decisions based on aggregated analytics

### 3.3 User Stories

**As a Platform Administrator, I want to:**

1. Onboard a new client organization in < 10 minutes
2. View system-wide health and performance metrics at a glance
3. Identify which organization or component is causing slowness
4. Search for any user across all organizations
5. View and export usage statistics per organization
6. Configure system-wide settings without touching the database
7. See an audit trail of all administrative actions
8. Receive alerts when performance degrades or errors spike

### 3.4 Success Criteria

The Superadmin Portal will be considered successful when:

- ✅ Onboarding time reduced from 2-3 hours to < 10 minutes
- ✅ Performance issues identified within 2 minutes of occurrence
- ✅ 100% of usage metrics tracked and exportable
- ✅ Zero production database access needed for routine operations
- ✅ All administrative actions logged with full audit trail
- ✅ Dashboard loads in < 2 seconds
- ✅ Support requests reduced by 60%

---

## 4. Solution: Superadmin Portal

### 4.1 What is the Superadmin Portal?

A **separate web application** (admin.pimpinan.com) that provides platform-level administration, monitoring, and management capabilities for the Lapor platform.

**Key Characteristics:**
- ✅ Separate codebase and deployment from client-facing app
- ✅ Shared Supabase database with strict RLS policies
- ✅ Accessible only to platform administrators (your team)
- ✅ Focuses on cross-organization insights and management
- ✅ Real-time performance monitoring and analytics

### 4.2 Core Capabilities

**1. Organization Management**
- Create, edit, delete client organizations
- View organization details (users, reports, conversations)
- Manage organization status (trial, active, suspended, cancelled)
- Configure organization-specific settings

**2. Performance Monitoring** ⭐ PRIMARY FEATURE
- Real-time system health dashboard
- Response time trends (P50, P90, P95, P99)
- Per-component performance breakdown
- Slow request identification
- Historical performance comparison
- Bottleneck detection
- Alert configuration

**3. User Management (Cross-Organization)**
- Search users across all organizations
- View user details with organization context
- Assign/revoke roles
- Suspend/activate users
- View user activity logs

**4. Usage Analytics & Reporting**
- Messages sent per organization
- API call tracking
- Storage usage monitoring
- Active users statistics
- Export usage reports (CSV/JSON)

**5. System Configuration**
- Default Flowise/Fonnte settings
- System-wide timeouts
- Feature flags
- Maintenance mode
- Rate limiting configuration

**6. Audit Logging**
- All administrative actions logged
- User login history
- Configuration changes
- Organization modifications
- Role assignments
- Exportable audit trail

### 4.3 User Interface Concept

**Layout:**
```
┌────────────────────────────────────────────────────────────────┐
│  [Logo]  Lapor Superadmin               [👤 Admin] [Logout]   │
├─────────┬──────────────────────────────────────────────────────┤
│         │  📊 Dashboard Overview                               │
│         │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│ 📊 Dash │  │  12      │  │  1,234  │  │  4.2s   │             │
│ 🏢 Orgs │  │  Clients │  │  Users  │  │  Avg    │             │
│ 👥 Users│  └─────────┘  └─────────┘  └─────────┘             │
│ 📈 Perf │                                                       │
│ 📊 Usage│  Performance Trends (Last 24h)                       │
│ ⚙️ Set  │  ┌───────────────────────────────────────────────┐  │
│ 📋 Logs │  │     [Line chart showing response times]       │  │
│         │  └───────────────────────────────────────────────┘  │
│         │                                                       │
│         │  Recent Activity                                     │
│         │  • Organization "City Hall" created                  │
│         │  • Performance alert: P95 > 10s                      │
│         │  • User "john@gov.id" assigned admin role            │
└─────────┴──────────────────────────────────────────────────────┘
```

**Key Pages:**
1. **Dashboard** - System health, active clients, quick stats
2. **Organizations** - List, create, edit organizations
3. **Organizations > [ID]** - Detailed org view (users, performance, usage)
4. **Users** - Cross-org user search and management
5. **Performance** - Comprehensive monitoring dashboard ⭐
6. **Usage Analytics** - Billable metrics and reports
7. **Settings** - System configuration
8. **Audit Logs** - Complete audit trail

### 4.4 Target Users

**Primary Users:**
- Platform Owner (you)
- Technical Operations Team
- Support Team
- Business Intelligence/Analytics Team

**Access Level:** Superadmin role only (new role type)

**Not Accessible By:**
- Organization administrators
- Organization users
- Citizens

---

## 5. Why Separate Project?

### 5.1 Decision: Separate vs Integrated

We evaluated two approaches:

**Option A: Integrated (Same Project)**
- Add `/superadmin/*` routes to existing app
- Share codebase, single deployment
- ❌ Security risks (code visible in client bundle)
- ❌ Performance impact (larger bundle for clients)
- ❌ Risk of accidental permission leaks

**Option B: Separate Project** ✅ CHOSEN
- New repository: `lapor-superadmin-portal`
- Separate Vercel deployment
- Subdomain: admin.pimpinan.com
- ✅ Security isolation
- ✅ Performance independence
- ✅ Professional positioning

### 5.2 Benefits of Separate Project

**1. Security Isolation** 🔒
- Client app doesn't include superadmin code
- Superadmin routes not discoverable by clients
- Separate domain = separate cookies/storage
- Can add IP whitelisting or VPN access
- Easier to audit for compliance (SOC 2, ISO 27001)

**2. Performance Independence** ⚡
- Client app stays lightweight
- Superadmin can use heavy dashboards without impacting clients
- Independent scaling (if superadmin gets traffic spike)
- Can optimize each app separately

**3. Professional Positioning** 👔
- Shows enterprise-ready architecture
- Demonstrates security consciousness
- Industry standard for B2B SaaS
- Builds trust with enterprise clients

**4. Development Flexibility** 🔧
- Different release schedules possible
- Can experiment with superadmin features without risk
- Easier to maintain separate codebases
- Clear separation of concerns

**5. Scalability** 📈
- Can move superadmin to different infrastructure later
- Can add multiple superadmin instances if needed
- Easier to implement advanced features (e.g., read replicas)

### 5.3 Industry Examples

**Companies Using Separate Admin Portals:**

| Company | Customer App | Admin/Internal Portal |
|---------|-------------|----------------------|
| Stripe | dashboard.stripe.com | admin.stripe.com |
| Auth0 | manage.auth0.com | admin.auth0.com |
| Intercom | app.intercom.com | admin.intercom.com |
| Segment | app.segment.com | platform.segment.com |
| Vercel | vercel.com/dashboard | (Internal only) |

**This is the industry best practice for B2B SaaS platforms.**

### 5.4 Cost-Benefit Analysis

**Costs of Separate Project:**
- Development Time: +2-3 days initial setup
- Infrastructure: +$20-40/month (Vercel Pro for subdomain)
- Maintenance: 2 deployments to manage
- Code Duplication: Some shared UI components need package

**Benefits of Separate Project:**
- Security: Significantly lower breach risk ($$$$)
- Performance: Client app stays fast ($$$)
- Professional Image: Enterprise credibility ($$)
- Scalability: Future-proof architecture ($$$$)

**Net Benefit: 🟢 Positive** - Benefits far outweigh costs, especially for a B2B SaaS product with security requirements.

### 5.5 Migration Path (If Starting Integrated)

If you need to ship quickly, you can use a **hybrid approach**:

**Phase 1 (Week 1-2):** Build integrated
- Add superadmin at `/superadmin/*` in current app
- Get features working and validated
- Learn what you actually need

**Phase 2 (Month 2-3):** Extract to separate
- Create new repository
- Move superadmin code
- Set up subdomain
- Migrate when you have 3-5 clients

**Recommendation:** If you have 2+ weeks, **build separate from day 1** to avoid migration overhead later.

---

## 6. Quick Reference Links

### 6.1 Documentation Files

This documentation is split into 5 files for easier navigation:

1. **[00-EXECUTIVE-SUMMARY.md](./00-EXECUTIVE-SUMMARY.md)** (This file)
   - Overview, problem statement, why separate

2. **[01-CURRENT-SYSTEM-REFERENCE.md](./01-CURRENT-SYSTEM-REFERENCE.md)**
   - Complete database schema
   - Current authentication system
   - Frontend structure
   - API integrations
   - Performance baseline

3. **[02-SUPERADMIN-REQUIREMENTS.md](./02-SUPERADMIN-REQUIREMENTS.md)**
   - Detailed feature requirements
   - Performance monitoring specifications
   - Success metrics
   - User stories

4. **[03-TECHNICAL-ARCHITECTURE.md](./03-TECHNICAL-ARCHITECTURE.md)**
   - Recommended tech stack
   - Database schema extensions
   - Security architecture
   - RLS policies
   - Project structure

5. **[04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md)**
   - Phase-by-phase implementation plan
   - Day-by-day tasks
   - Deployment guide
   - Testing strategy
   - Migration guide

### 6.2 Current Codebase Key Files

**Critical Files to Reference:**

```
Current Project: lapor-citizen-feedback/
├── supabase/
│   ├── migrations/
│   │   └── 20251029191633_create_conversation_system.sql  (Main schema)
│   └── functions/
│       └── fonnte-webhook/
│           ├── index.ts                    (Main webhook handler)
│           ├── conversation-manager.ts     (DB operations)
│           ├── flowise-client.ts          (AI integration)
│           ├── attachment-processor.ts    (Media handling)
│           └── fonnte-client.ts           (WhatsApp sending)
├── src/
│   ├── pages/
│   │   ├── Auth.tsx                       (Login/Register)
│   │   └── admin/
│   │       ├── Dashboard.tsx              (Auth wrapper)
│   │       ├── Reports.tsx                (Report management)
│   │       ├── Conversations.tsx          (Chat history)
│   │       ├── Integration.tsx            (Config management)
│   │       └── Users.tsx                  (User management)
│   ├── components/
│   │   └── admin/
│   │       ├── AppSidebar.tsx            (Navigation)
│   │       ├── UserRoleManager.tsx       (Role assignment)
│   │       ├── FlowiseConfigManager.tsx  (AI settings)
│   │       └── FonnteConfigManager.tsx   (Gateway settings)
│   └── integrations/
│       └── supabase/
│           ├── client.ts                  (Supabase client)
│           └── types.ts                   (DB types)
└── docs/
    └── superadmin/                        (This documentation)
```

### 6.3 Important Database Tables

**Must Understand:**

| Table | Purpose | Superadmin Access |
|-------|---------|------------------|
| `organizations` | ❌ **TO BE CREATED** | Full CRUD |
| `profiles` | User profiles | Read all orgs |
| `user_roles` | Role assignments | Read/Write all |
| `reports` | Citizen reports | Read all orgs |
| `conversations` | WhatsApp sessions | Read all orgs |
| `messages` | Chat history | Read all orgs |
| `performance_metrics` | ❌ **TO BE CREATED** | Full CRUD |
| `audit_logs` | ❌ **TO BE CREATED** | Full CRUD |
| `usage_metrics` | ❌ **TO BE CREATED** | Read only |

### 6.4 API Endpoints to Know

**Flowise API (Railway):**
- URL: `https://tanya-suhu.up.railway.app/api/v1/prediction/{chatflow_id}`
- Method: POST
- Auth: Bearer token
- Timeout: 30 seconds

**Fonnte API:**
- Send: `https://api.fonnte.com/send`
- Method: POST
- Content-Type: multipart/form-data
- Auth: Authorization header

**Supabase Edge Function:**
- Webhook: `https://ykaawgnggvwleiyzvilf.supabase.co/functions/v1/fonnte-webhook`
- Method: POST
- Auth: None (public webhook)

### 6.5 Environment Variables

**Current App (.env):**
```env
VITE_SUPABASE_URL=https://ykaawgnggvwleiyzvilf.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>
VITE_SUPABASE_PROJECT_ID=<your-id>
```

**Superadmin App (will use same Supabase):**
```env
VITE_SUPABASE_URL=https://ykaawgnggvwleiyzvilf.supabase.co
VITE_SUPABASE_ANON_KEY=<your-key>  # Same as main app
VITE_SUPABASE_PROJECT_ID=<your-id>  # Same as main app
```

### 6.6 Performance Monitoring Targets

**Current Baseline:**
- Total response time: 4-8 seconds
- Flowise API: 2-5 seconds (PRIMARY BOTTLENECK)
- Database: ~350ms
- Fonnte send: 1-2 seconds

**Target After Optimization:**
- Total response time: 2-4 seconds (50% improvement)
- Flowise API: 1-3 seconds
- Database: < 50ms (with caching)
- Fonnte send: async (off critical path)

**Monitoring Metrics to Track:**
- P50, P90, P95, P99 response times
- Error rate (per 1000 requests)
- Throughput (messages per minute)
- Resource usage (CPU, memory, connections)

---

## Next Steps

### For Implementation Team

1. **Read All Documentation**
   - Review all 5 documentation files thoroughly
   - Understand current system architecture
   - Clarify any unclear requirements

2. **Set Up Development Environment**
   - Clone this repository for reference
   - Set up new repository: `lapor-superadmin-portal`
   - Configure Supabase access
   - Install dependencies

3. **Start with Database Schema**
   - Create database migrations (see [03-TECHNICAL-ARCHITECTURE.md](./03-TECHNICAL-ARCHITECTURE.md))
   - Test migrations on development database
   - Validate RLS policies

4. **Follow Implementation Guide**
   - Use phased approach from [04-IMPLEMENTATION-GUIDE.md](./04-IMPLEMENTATION-GUIDE.md)
   - Start with Phase 1 (Setup & Foundation)
   - Progress through phases systematically

5. **Performance Monitoring First**
   - Prioritize performance monitoring dashboard
   - Implement metric collection in fonnte-webhook
   - Build real-time and historical views

### Questions or Clarifications?

Contact: Platform Team
Repository: https://github.com/yourorg/lapor-citizen-feedback
Current App: https://pimpinan.com
Planned Admin: https://admin.pimpinan.com

---

**Document Status:** ✅ Complete and ready for implementation

**Last Reviewed:** 2025-11-10

**Version History:**
- v1.0 (2025-11-10): Initial comprehensive documentation
