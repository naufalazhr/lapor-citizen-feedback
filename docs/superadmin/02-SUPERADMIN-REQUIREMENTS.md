# Superadmin Portal - Requirements & Specifications

**Document Version:** 1.0
**Last Updated:** 2025-11-10
**Purpose:** Detailed feature requirements and specifications for the Superadmin Portal

---

## Table of Contents

1. [Goals & Objectives](#1-goals--objectives)
2. [User Personas](#2-user-personas)
3. [Functional Requirements](#3-functional-requirements)
4. [Performance Monitoring Specifications](#4-performance-monitoring-specifications-critical)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Success Metrics](#6-success-metrics)
7. [User Stories](#7-user-stories)

---

## 1. Goals & Objectives

### 1.1 Primary Goals

**G1: Enable Multi-Tenant SaaS Operations**
- Onboard new client organizations efficiently
- Manage multiple institutions from single portal
- Isolate data per organization
- Track usage per client

**G2: Provide Performance Visibility** ⭐ **PRIMARY**
- Real-time system health monitoring
- Identify bottlenecks across the stack
- Track response times per component
- Compare performance across organizations
- Historical trend analysis

**G3: Centralize Platform Administration**
- Cross-organization user management
- System-wide configuration
- Audit trail for compliance
- Reduced need for database access

**G4: Support Business Intelligence**
- Usage analytics per organization
- Billable metrics tracking
- Growth trends and insights
- Export capabilities for reporting

### 1.2 Secondary Goals

- Reduce onboarding time from 2-3 hours to < 10 minutes
- Reduce support requests by 60% through self-service
- Enable data-driven decision making
- Demonstrate enterprise-ready security
- Support compliance requirements (SOC 2, ISO 27001)

### 1.3 Out of Scope (V1)

- ❌ Billing integration (Stripe)
- ❌ Organization self-service portal
- ❌ White-labeling per organization
- ❌ Custom domain per organization
- ❌ API access for organizations
- ❌ Advanced ML-powered insights
- ❌ Multi-region deployment

*(These features planned for future releases)*

---

## 2. User Personas

### Persona 1: Platform Administrator (Primary)

**Name:** Sarah (Platform Owner)
**Role:** CEO/Founder of Lapor Platform
**Goals:**
- Onboard new government institutions quickly
- Monitor system health and performance
- Make data-driven product decisions
- Ensure platform reliability

**Pain Points:**
- Currently needs to manually configure each new client
- No visibility into which organizations have performance issues
- Cannot easily track usage for pricing decisions
- Requires developer help for routine tasks

**Needs from Superadmin Portal:**
- Dashboard showing all clients at a glance
- Performance metrics with clear bottleneck identification
- One-click organization creation
- Usage reports exportable to CSV

**Technical Level:** Medium (can use web UIs but not comfortable with SQL)

---

### Persona 2: Technical Operations Engineer

**Name:** David (DevOps Engineer)
**Role:** Manages infrastructure and monitors uptime
**Goals:**
- Keep system running smoothly
- Identify and resolve performance issues quickly
- Optimize resource usage
- Prevent outages

**Pain Points:**
- No real-time performance dashboard
- Has to check logs manually to find slow requests
- Cannot easily identify which component is slow
- No alerting for degraded performance

**Needs from Superadmin Portal:**
- Real-time performance metrics dashboard
- Slow request log with filtering
- Percentile graphs (P50, P90, P95, P99)
- Alert configuration for thresholds
- Historical data for capacity planning

**Technical Level:** High (comfortable with SQL, APIs, command line)

---

### Persona 3: Customer Support Team Member

**Name:** Maria (Support Specialist)
**Role:** Helps clients troubleshoot issues
**Goals:**
- Quickly find user information across all organizations
- Understand what a user is experiencing
- Help clients configure their account
- Track support tickets

**Pain Points:**
- Cannot search for users across organizations
- No way to see user's recent activity
- Cannot help with configuration without admin access
- Hard to verify if issue is user-specific or system-wide

**Needs from Superadmin Portal:**
- Cross-organization user search
- User activity log viewer
- Ability to see user's conversations and reports
- Per-organization performance to diagnose issues
- Audit log to see what changed

**Technical Level:** Low-Medium (uses web UIs, not technical)

---

### Persona 4: Business Intelligence Analyst

**Name:** Alex (Data Analyst)
**Role:** Analyzes usage and growth metrics
**Goals:**
- Track growth metrics (users, messages, organizations)
- Identify most active organizations
- Calculate revenue based on usage
- Forecast resource needs

**Pain Points:**
- No centralized usage data
- Has to run complex SQL queries manually
- Cannot easily export data for analysis
- No visualization of trends

**Needs from Superadmin Portal:**
- Usage dashboard with charts
- Per-organization metrics
- Export to CSV/JSON
- Trend analysis (day/week/month views)
- Comparison tools

**Technical Level:** Medium-High (comfortable with SQL, Excel, Tableau)

---

## 3. Functional Requirements

### 3.1 Dashboard & Overview

**Feature ID:** F-DASH-001
**Priority:** P0 (Must Have)
**User Story:** As a platform administrator, I want to see system health at a glance so I can quickly identify issues.

**Requirements:**

#### **Dashboard Cards**
- **Total Organizations**
  - Count of active organizations
  - Count of trial, suspended, cancelled
  - Change indicator (+/- from last period)

- **Active Users (24h)**
  - Count of users who logged in last 24 hours
  - Percentage of total users
  - Trend graph (sparkline)

- **Total Conversations**
  - All-time count
  - Last 24h count
  - Last 7d count
  - Growth percentage

- **Total Messages**
  - All-time count
  - Last 24h count
  - Average per conversation

- **System Health**
  - Average response time (last hour)
  - Error rate (last hour)
  - Status indicator (green/yellow/red)
  - Link to detailed performance dashboard

#### **Charts**
- **Response Time Trend (Line Chart)**
  - Last 24 hours
  - Shows P50, P95 lines
  - Hover tooltip with exact values

- **Message Volume (Bar Chart)**
  - Last 7 days
  - Messages per day
  - Click to drill down

#### **Recent Activity Feed**
- Last 20 events across all organizations
- Event types:
  - Organization created
  - User registered
  - Performance alert triggered
  - Error spike detected
  - Configuration changed
- Click to view details

#### **Quick Actions**
- "Create New Organization" button
- "View All Alerts" button
- "Export Usage Report" button

**UI Mockup:**
```
┌───────────────────────────────────────────────────────────────┐
│  Lapor Superadmin                           [Profile] [Logout]│
├─────────┬─────────────────────────────────────────────────────┤
│ [Icons] │  📊 Dashboard                                       │
│ Dash    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐│
│ Orgs    │  │    12    │ │  1,234   │ │  5,678   │ │  4.2s  ││
│ Users   │  │  Clients │ │  Users   │ │  Convos  │ │  Avg   ││
│ Perf    │  │  (+2)    │ │  (+45)   │ │  (+123)  │ │  🟢    ││
│ Usage   │  └──────────┘ └──────────┘ └──────────┘ └────────┘│
│ Settings│                                                      │
│ Logs    │  Response Time Trends (Last 24h)                    │
│         │  ┌──────────────────────────────────────────────┐  │
│         │  │        [Line chart]                          │  │
│         │  │                                              │  │
│         │  └──────────────────────────────────────────────┘  │
│         │                                                      │
│         │  Recent Activity                  Message Volume    │
│         │  • Org "City Hall" created        [Bar chart]       │
│         │  • Alert: P95 > 10s                                 │
│         │  • User john@gov.id registered                      │
│         │  • Config changed by admin                          │
└─────────┴─────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Dashboard loads in < 2 seconds
- [ ] All cards show accurate real-time data
- [ ] Charts are interactive (hover, click)
- [ ] Activity feed updates every 30 seconds
- [ ] Quick actions work correctly
- [ ] Responsive on mobile and desktop

---

### 3.2 Organization Management

**Feature ID:** F-ORG-001 to F-ORG-005
**Priority:** P0 (Must Have)

#### **F-ORG-001: Organization List**

**Requirements:**
- Data table showing all organizations
- Columns:
  - Name (clickable)
  - Status (badge: trial/active/suspended/cancelled)
  - Created Date
  - Last Active
  - User Count
  - Message Count (30d)
  - Actions (Edit, View Details, Suspend/Activate)
- Filters:
  - Status filter (multi-select)
  - Date range filter
- Search:
  - By organization name, slug, or domain
- Sorting:
  - By any column
  - Default: Last Active (descending)
- Pagination:
  - 20 per page
  - Jump to page

**Acceptance Criteria:**
- [ ] List loads in < 1 second
- [ ] Search works with debounce (300ms)
- [ ] Filters apply immediately
- [ ] Sorting persists on page refresh
- [ ] Click name navigates to detail page

#### **F-ORG-002: Create Organization**

**Modal Form Fields:**

**Required:**
- Organization Name (e.g., "Kota Bandung")
- Slug (auto-generated from name, editable, must be unique)
  - Validation: lowercase, alphanumeric, dashes only
  - Used in URLs: `pimpinan.com/org/{slug}`
- Contact Email
- Contact Phone

**Optional:**
- Domain (e.g., "bandung.go.id")
- Address
- Subscription Tier (dropdown: trial, basic, pro, enterprise)
- Notes (textarea)

**Settings (JSON):**
- Custom Flowise config (checkbox to override defaults)
- Custom Fonnte config (checkbox to override defaults)
- Session timeout override
- Rate limit override

**Form Behavior:**
- Real-time slug validation (check uniqueness)
- Email format validation
- Phone format validation (Indonesia +62)
- Preview slug as you type

**On Submit:**
1. Create organization record
2. Set status to 'trial' by default
3. Create default admin user (optional)
4. Send welcome email (future)
5. Log to audit_logs
6. Redirect to organization detail page

**Acceptance Criteria:**
- [ ] Form validation works (client + server)
- [ ] Slug uniqueness checked in real-time
- [ ] Organization created successfully
- [ ] Success toast notification
- [ ] Audit log entry created
- [ ] Redirect to detail page

#### **F-ORG-003: Organization Detail Page**

**URL:** `/superadmin/organizations/{id}`

**Tabs:**

**Tab 1: Overview**
- Organization info card
  - Name, slug, status, domain
  - Contact email, phone
  - Created date, activated date
  - Subscription tier
- Quick stats
  - Total users
  - Active users (7d, 30d)
  - Total reports
  - Total conversations
  - Total messages
  - Storage used
- Recent activity (last 20 events for this org)
- Actions:
  - Edit organization
  - Change status (activate/suspend/cancel)
  - Delete organization (with confirmation)

**Tab 2: Users**
- User list for this organization
- Same structure as global user list
- Filter by role, approval status
- Search by name/email
- Actions: Assign role, suspend, view details
- "Add User" button (create user for this org)

**Tab 3: Performance**
- Performance metrics specific to this organization
- Same charts as global performance page but filtered
- Compare to platform average
- Slow requests for this org
- Error log for this org

**Tab 4: Usage Analytics**
- Usage metrics graphs
- Messages sent (chart over time)
- API calls made
- Storage usage trend
- Active users trend
- Export button

**Tab 5: Settings**
- Edit organization details
- Override configs:
  - Flowise settings
  - Fonnte settings
  - Session timeout
  - Rate limits
  - Feature flags
- Integration credentials (view only)
- Danger zone:
  - Suspend organization
  - Cancel subscription
  - Delete organization

**Acceptance Criteria:**
- [ ] All tabs load quickly
- [ ] Data is scoped to organization
- [ ] Actions update immediately
- [ ] Charts render correctly
- [ ] Export works

#### **F-ORG-004: Edit Organization**

**Same form as Create, but:**
- Pre-populated with current values
- Slug cannot be changed (immutable)
- Additional fields:
  - Status (dropdown)
  - Activated date (if active)
  - Cancelled date (if cancelled)
  - Cancellation reason (textarea)

**On Submit:**
- Update organization record
- Log change to audit_logs (track what changed)
- Show success toast
- Update detail page

**Acceptance Criteria:**
- [ ] Form pre-fills correctly
- [ ] Changes save successfully
- [ ] Audit log captures changes
- [ ] Success notification shown

#### **F-ORG-005: Delete Organization**

**Confirmation Modal:**
- Warning: "This will permanently delete all data for this organization"
- Lists what will be deleted:
  - X users
  - X reports
  - X conversations
  - X messages
  - X attachments
- Type organization name to confirm
- Cancel / Delete buttons

**On Confirm:**
1. Soft delete (set deleted_at timestamp) OR
2. Hard delete (CASCADE on all FK relationships)
3. Log to audit_logs
4. Send notification email to organization contact
5. Redirect to organization list

**Acceptance Criteria:**
- [ ] Confirmation modal shows correct counts
- [ ] Type-to-confirm works
- [ ] Deletion completes successfully
- [ ] Cascade deletes related data
- [ ] Audit log entry created
- [ ] Cannot be undone (warning clear)

---

### 3.3 User Management (Cross-Organization)

**Feature ID:** F-USER-001 to F-USER-004
**Priority:** P1 (Should Have)

#### **F-USER-001: User List (All Organizations)**

**Requirements:**
- Data table with all users across all organizations
- Columns:
  - Name
  - Email
  - Organization (link to org detail)
  - Role (badge)
  - Status (active/suspended/pending approval)
  - Last Login
  - Created Date
  - Actions (Edit Role, View Details, Suspend)
- Filters:
  - Organization (multi-select)
  - Role (multi-select)
  - Status (multi-select)
  - Last login (date range)
- Search:
  - By name, email, or organization
  - Fuzzy search
- Sorting:
  - Any column
  - Default: Last Login (descending)
- Pagination:
  - 50 per page

**Acceptance Criteria:**
- [ ] List loads in < 2 seconds
- [ ] Search is fast (< 500ms)
- [ ] Filters work correctly
- [ ] Can search across all orgs
- [ ] Click email opens detail page

#### **F-USER-002: User Detail Page**

**URL:** `/superadmin/users/{id}`

**Sections:**

**User Profile Card**
- Full name, email
- Organization (link)
- Department, position
- Role (with edit button)
- Approval status
- Last login timestamp
- Created date
- Actions:
  - Edit role
  - Suspend/activate
  - Reset password
  - Impersonate (for support) - ⚠️ Security sensitive
  - Delete user

**Activity Log**
- Last 50 actions by this user
- Types:
  - Login
  - Report created/updated
  - Conversation initiated
  - Configuration changed
  - Role assigned
- Timestamp, action type, details

**User's Reports**
- List of reports created by this user
- Link to report detail

**User's Conversations**
- List of conversations this user participated in
- Link to conversation detail

**Statistics**
- Reports created: X
- Conversations: X
- Messages sent: X
- Last active: X days ago

**Acceptance Criteria:**
- [ ] Profile loads quickly
- [ ] Activity log shows recent actions
- [ ] Links to reports/conversations work
- [ ] Actions update immediately

#### **F-USER-003: Assign Role to User**

**Modal:**
- Current role displayed
- Dropdown to select new role:
  - superadmin (if assigner is superadmin)
  - owner
  - admin
  - member
  - viewer
- Role descriptions shown
- Confirmation checkbox: "I understand this will change the user's permissions"
- Cancel / Save buttons

**On Submit:**
- Call `assign_user_role()` function
- Log to audit_logs (who assigned, old role, new role)
- Send email notification to user (optional)
- Update UI immediately
- Show success toast

**Validation:**
- Cannot remove last admin (enforced by DB function)
- Cannot assign superadmin unless you are superadmin
- Cannot change your own role

**Acceptance Criteria:**
- [ ] Modal shows current and available roles
- [ ] Validation prevents invalid assignments
- [ ] Role change succeeds
- [ ] Audit log created
- [ ] User notification sent (if enabled)

#### **F-USER-004: User Activity Search**

**Advanced search page:**
- Search criteria:
  - User (autocomplete)
  - Organization
  - Action type (dropdown)
  - Date range
  - Resource type (report, conversation, config)
- Results table:
  - Timestamp
  - User name
  - Organization
  - Action
  - Resource (link)
  - Details (expandable)
- Export button (CSV)

**Acceptance Criteria:**
- [ ] Search filters work
- [ ] Results accurate
- [ ] Export includes all filtered results
- [ ] Links navigate correctly

---

## 4. Performance Monitoring Specifications (CRITICAL)

**Feature ID:** F-PERF-001 to F-PERF-010
**Priority:** P0 (Must Have) ⭐ **PRIMARY FEATURE**

### 4.1 Overview

Performance monitoring is the **most important feature** of the superadmin portal. It addresses the primary pain point: no visibility into system performance.

**Goals:**
1. Identify slow components in real-time
2. Track performance trends over time
3. Compare performance across organizations
4. Alert on degraded performance
5. Support capacity planning

### 4.2 Data Collection Requirements

#### **F-PERF-001: Performance Metrics Collection**

**Location:** Supabase Edge Function (fonnte-webhook)

**What to Measure:**

**Timing Metrics:**
1. **webhook_total** - Total processing time (ms)
2. **flowise_api** - Flowise API call duration (ms)
3. **flowise_api_ttfb** - Time to first byte from Flowise (ms)
4. **db_query_{operation}** - Individual DB queries (ms)
   - db_query_get_config
   - db_query_find_conversation
   - db_query_get_history
   - db_query_save_message
   - db_query_update_session
5. **attachment_download** - Download from Fonnte (ms)
6. **attachment_upload** - Upload to Supabase Storage (ms)
7. **attachment_convert** - Base64 conversion (ms)
8. **fonnte_send** - Send message via Fonnte (ms)

**Additional Metadata:**
```typescript
{
  organization_id: UUID,
  conversation_id: UUID,
  metric_type: string,
  duration_ms: number,
  metadata: {
    has_attachment: boolean,
    attachment_size_bytes?: number,
    message_length: number,
    history_message_count: number,
    retry_count?: number,
    error?: string,
    flowise_streaming?: boolean,
    http_status?: number,
  },
  created_at: timestamp,
}
```

**Implementation:**

```typescript
// In fonnte-webhook/index.ts

const startTime = performance.now();

// ... process webhook ...

const endTime = performance.now();
const duration = Math.round(endTime - startTime);

// Save to performance_metrics table
await supabase.from('performance_metrics').insert({
  organization_id: conversation.organization_id,
  conversation_id: conversation.id,
  metric_type: 'webhook_total',
  duration_ms: duration,
  metadata: {
    has_attachment: !!payload.media,
    message_length: payload.message.length,
    history_message_count: history.length,
  },
});

// Similar for each component...
```

**Sampling Strategy:**
- V1: Log every request (manageable volume)
- V2: Sample 10% for high-volume periods
- Always log slow requests (>threshold)
- Always log errors

**Acceptance Criteria:**
- [ ] All timing metrics collected accurately
- [ ] Metadata includes relevant context
- [ ] Minimal performance impact (< 5ms overhead)
- [ ] Data persists to database
- [ ] No data loss on errors

---

#### **F-PERF-002: Performance Dashboard (Real-Time)**

**URL:** `/superadmin/performance`

**Layout:**

```
┌───────────────────────────────────────────────────────────────┐
│  📈 Performance Monitoring                    [Refresh] [⚙️]   │
├───────────────────────────────────────────────────────────────┤
│                                                                │
│  Time Range: [Last Hour ▼] [Last 24h] [Last 7d] [Last 30d]   │
│  Organization: [All ▼] [City Hall] [District A] [...]         │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  System Health Overview                                  │ │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │ │
│  │  │  4.2s   │ │  8.5s   │ │  0.7%   │ │  152    │       │ │
│  │  │  P50    │ │  P95    │ │  Errors │ │  Req/min│       │ │
│  │  │  🟢     │ │  🟡     │ │  🟢     │ │  🟢     │       │ │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Response Time Trends (P50, P90, P95, P99)              │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │                                                    │ │ │
│  │  │   [Multi-line chart with 4 lines]                 │ │ │
│  │  │   P50 (green), P90 (blue), P95 (yellow), P99 (red)│ │ │
│  │  │                                                    │ │ │
│  │  │   X-axis: Time                                     │ │ │
│  │  │   Y-axis: Response time (ms)                       │ │ │
│  │  │                                                    │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │  Hover tooltip: "12:30 PM: P95 = 8,234ms"             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌────────────────────────────────────────────────────────────┐│
│  │  Component Breakdown (Avg Duration)                       ││
│  │  ┌──────────────────────────────────────────────────────┐││
│  │  │                                                      │││
│  │  │  [Stacked area chart or horizontal bar chart]       │││
│  │  │                                                      │││
│  │  │  Flowise API:    ███████████████ 65% (3,250ms)      │││
│  │  │  Fonnte Send:    ████ 15% (750ms)                   │││
│  │  │  DB Queries:     ███ 12% (600ms)                    │││
│  │  │  Attachments:    ██ 6% (300ms)                      │││
│  │  │  Other:          █ 2% (100ms)                       │││
│  │  │                                                      │││
│  │  └──────────────────────────────────────────────────────┘││
│  │  Click a component to drill down                          ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Slow Requests (P95+ in selected timeframe)             │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │ Time     │ Org      │ Duration │ Component │ Details│ │ │
│  │  ├────────────────────────────────────────────────────┤ │ │
│  │  │ 2:45 PM  │ City Hall│  15,234ms│ Flowise   │ [View]│ │ │
│  │  │ 2:42 PM  │ Dist A   │  12,890ms│ Flowise   │ [View]│ │ │
│  │  │ 2:30 PM  │ City Hall│  10,567ms│ Attachment│ [View]│ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │  Showing 50 of 234 slow requests. [View All]            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Time range selector updates all charts
- Organization filter scopes data to one org
- Hover on chart shows exact values
- Click component bar drills into detail view
- Click slow request opens detail modal
- Auto-refresh every 30 seconds (toggle on/off)

**Data Queries:**

```sql
-- P50, P90, P95, P99 calculation
SELECT
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY duration_ms) as p90,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99
FROM performance_metrics
WHERE metric_type = 'webhook_total'
  AND created_at > NOW() - INTERVAL '1 hour'
  AND (organization_id = $1 OR $1 IS NULL);

-- Trends over time (bucketed by 5-minute intervals)
SELECT
  DATE_TRUNC('minute', created_at) as time_bucket,
  PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY duration_ms) as p50,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95
FROM performance_metrics
WHERE metric_type = 'webhook_total'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY time_bucket
ORDER BY time_bucket;

-- Component breakdown
SELECT
  metric_type,
  AVG(duration_ms) as avg_duration,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) as p95_duration,
  COUNT(*) as count
FROM performance_metrics
WHERE metric_type IN ('flowise_api', 'fonnte_send', 'attachment_download', 'db_query_get_history')
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY metric_type
ORDER BY avg_duration DESC;

-- Slow requests
SELECT
  pm.created_at,
  pm.duration_ms,
  pm.metric_type,
  pm.metadata,
  o.name as organization_name,
  c.phone_number
FROM performance_metrics pm
JOIN conversations c ON pm.conversation_id = c.id
JOIN organizations o ON pm.organization_id = o.id
WHERE pm.metric_type = 'webhook_total'
  AND pm.duration_ms > $threshold
  AND pm.created_at > NOW() - INTERVAL '24 hours'
ORDER BY pm.duration_ms DESC
LIMIT 50;
```

**Acceptance Criteria:**
- [ ] Dashboard loads in < 2 seconds
- [ ] Charts render correctly with real data
- [ ] Percentile calculations accurate
- [ ] Time range filter works
- [ ] Organization filter works
- [ ] Auto-refresh works
- [ ] Slow requests table paginated
- [ ] Drill-down navigation works

---

#### **F-PERF-003: Component Detail View**

**URL:** `/superadmin/performance/{component}`
(e.g., `/superadmin/performance/flowise_api`)

**Layout:**

**Header:**
- Component name (e.g., "Flowise API Performance")
- Back to overview button
- Time range and org filters

**Metrics Cards:**
- Average duration
- P50, P95, P99
- Min/Max
- Total requests
- Error rate

**Charts:**

**1. Response Time Distribution (Histogram)**
- X-axis: Duration buckets (0-1s, 1-2s, 2-3s, 3-5s, 5-10s, 10s+)
- Y-axis: Request count
- Visualizes distribution shape

**2. Trend Over Time (Line Chart)**
- P50 and P95 lines
- Zoom and pan enabled

**3. By Organization (Bar Chart)**
- Compare average duration across organizations
- Sort by duration
- Identifies which org has slowest performance

**Detailed Request Log:**
- Table with ALL requests for this component
- Columns:
  - Timestamp
  - Organization
  - Duration
  - Status (success/error)
  - Metadata (expandable JSON)
  - Conversation link
- Filters:
  - Duration range
  - Organization
  - Status
- Sort by duration (asc/desc)
- Export to CSV

**Acceptance Criteria:**
- [ ] Metrics calculated correctly
- [ ] Histogram shows distribution
- [ ] Trend chart renders
- [ ] Organization comparison works
- [ ] Request log filterable and sortable
- [ ] Export includes filtered results

---

#### **F-PERF-004: Performance Comparison**

**URL:** `/superadmin/performance/compare`

**Compare Mode:**

**Option 1: Compare Organizations**
- Select 2-5 organizations
- Show side-by-side metrics:
  - P50, P95, P99
  - Component breakdown
  - Error rate
- Line charts with multiple lines (one per org)
- Identify which org is slower

**Option 2: Compare Time Periods**
- Select two date ranges
- Compare "This Week" vs "Last Week"
- Calculate delta (improvement/regression)
- Highlight what changed

**Option 3: Compare Components**
- Already in main dashboard (component breakdown)

**Acceptance Criteria:**
- [ ] Can select multiple orgs
- [ ] Comparison charts render
- [ ] Delta calculations correct
- [ ] Can compare time periods
- [ ] Export comparison data

---

#### **F-PERF-005: Slow Request Detail Modal**

**Triggered by:** Click on slow request in any table

**Modal Content:**

**Request Overview:**
- Timestamp
- Organization
- Conversation ID (link)
- Phone number
- Total duration
- Status

**Timeline Visualization:**
```
0ms         ┌─────┐ Parse payload (50ms)
50ms        ├─────┤ DB: Find conversation (80ms)
130ms       ├─────┤ DB: Get history (120ms)
250ms       ├──────────────────────────────┤ Flowise API (5,234ms) ⚠️
5,484ms     ├────┤ DB: Save messages (150ms)
5,634ms     ├────────┤ Fonnte send (1,200ms)
6,834ms     └ TOTAL: 6,834ms
```

**Component Breakdown (Table):**
| Component | Duration | % of Total | Status |
|-----------|----------|------------|--------|
| Flowise API | 5,234ms | 76.6% | ⚠️ Slow |
| Fonnte Send | 1,200ms | 17.5% | Normal |
| DB Queries | 350ms | 5.1% | Fast |
| Other | 50ms | 0.7% | Fast |

**Metadata:**
- Message text (truncated)
- Had attachment? (Yes/No, size)
- History message count
- Retry attempts
- Error details (if any)

**Actions:**
- View full conversation
- View organization detail
- Report issue (create ticket)
- Add to alert rule

**Acceptance Criteria:**
- [ ] Modal shows accurate timeline
- [ ] Component breakdown adds up to 100%
- [ ] Links work correctly
- [ ] Metadata displayed clearly

---

#### **F-PERF-006: Performance Alerts**

**URL:** `/superadmin/performance/alerts`

**Alert Configuration:**

**Alert Types:**
1. **Response Time Threshold**
   - Condition: P95 > X ms for Y minutes
   - Example: "P95 > 10,000ms for 5 minutes"

2. **Error Rate Threshold**
   - Condition: Error rate > X% for Y minutes
   - Example: "Error rate > 5% for 10 minutes"

3. **Component Degradation**
   - Condition: Component duration > X ms
   - Example: "Flowise API > 8,000ms"

4. **Organization-Specific Alert**
   - Condition: Org's P95 > platform avg by X%
   - Example: "City Hall P95 > 150% of platform average"

**Alert Channels:**
- Email (to superadmin users)
- Slack webhook (future)
- Discord webhook (future)
- SMS (Twilio, future)

**Alert Configuration Form:**
- Alert name
- Description
- Condition (dropdown + inputs)
- Threshold value
- Duration (sustained for X minutes)
- Organization scope (all or specific)
- Notification channels (checkboxes)
- Enabled toggle

**Alert History:**
- Table of triggered alerts
- Columns:
  - Timestamp
  - Alert name
  - Condition
  - Value
  - Organization
  - Status (active/resolved)
  - Acknowledged by
- Click to view details
- Acknowledge button (mark as seen)

**Acceptance Criteria:**
- [ ] Can create alert rules
- [ ] Alerts trigger correctly
- [ ] Notifications sent
- [ ] Alert history accurate
- [ ] Can acknowledge alerts
- [ ] Can edit/delete rules

---

#### **F-PERF-007: Historical Performance Analysis**

**URL:** `/superadmin/performance/historical`

**Date Range Selection:**
- Last 7 days
- Last 30 days
- Last 90 days
- Custom range picker

**Analysis Views:**

**1. Performance Trends**
- Line chart showing P50, P95 over entire range
- Annotate with events:
  - "Deployment on 2025-10-15"
  - "Flowise upgrade on 2025-10-20"
  - "Traffic spike on 2025-10-25"
- Identify regressions or improvements

**2. Daily Summary Table**
| Date | Requests | P50 | P95 | P99 | Error % | Trend |
|------|----------|-----|-----|-----|---------|-------|
| 2025-11-10 | 1,234 | 4.2s | 8.5s | 15s | 0.5% | 📈 |
| 2025-11-09 | 1,156 | 4.5s | 9.2s | 16s | 0.8% | 📉 |
| 2025-11-08 | 1,089 | 4.1s | 8.1s | 14s | 0.4% | 📈 |

**3. Heatmap View**
- X-axis: Hour of day (0-23)
- Y-axis: Day of week (Mon-Sun)
- Color: Average P95 duration
- Identify peak hours and patterns

**4. Capacity Planning**
- Projected growth based on trends
- Estimated resources needed
- Forecasted response times

**Acceptance Criteria:**
- [ ] Can select date range
- [ ] Trends chart accurate
- [ ] Daily summary calculates correctly
- [ ] Heatmap visualizes patterns
- [ ] Export data for offline analysis

---

#### **F-PERF-008: Performance Export**

**Feature:** Export performance data for external analysis

**Export Formats:**
- CSV (for Excel)
- JSON (for programmatic access)
- Parquet (for data warehouses)

**Export Scope:**
- All data
- Filtered data (by time range, org, component)
- Aggregated data (daily/hourly summaries)
- Raw request logs

**Export UI:**
- Export button on each performance page
- Modal to configure export:
  - Format selection
  - Date range
  - Filters
  - Aggregation level
  - Include metadata (checkbox)
- Generate and download

**Large Exports:**
- If > 10k rows, generate async
- Send email when ready
- Download link expires in 7 days

**Acceptance Criteria:**
- [ ] Export generates correctly
- [ ] CSV opens in Excel
- [ ] JSON is valid
- [ ] Filtered exports respect filters
- [ ] Async exports work for large datasets

---

#### **F-PERF-009: Real-Time Performance Monitoring**

**Feature:** Live dashboard with websocket updates

**URL:** `/superadmin/performance/realtime`

**Display:**
- Large screen-friendly layout
- Auto-refresh every 5 seconds (or websocket push)
- No interaction needed (read-only display)

**Metrics:**
- **Active Requests Right Now**
  - Count of requests in-flight
  - Average duration so far

- **Last 5 Minutes**
  - Requests completed: 45
  - Average: 4.2s
  - P95: 8.5s
  - Errors: 0

- **Live Request Feed**
  - Scrolling list of last 20 requests
  - Each shows: timestamp, org, duration, status
  - Color-coded: green (< 5s), yellow (5-10s), red (> 10s)

**Chart:**
- Real-time line chart (rolling window)
- Shows last 30 minutes
- Updates every 5 seconds
- P50 and P95 lines

**Use Case:**
- Display on TV in office
- Monitor during peak hours
- Quickly spot issues

**Acceptance Criteria:**
- [ ] Updates in real-time
- [ ] No manual refresh needed
- [ ] Chart animates smoothly
- [ ] Color coding works
- [ ] Suitable for large screen

---

#### **F-PERF-010: Bottleneck Identification**

**Feature:** AI-assisted bottleneck detection

**Algorithm:**

1. **Analyze Component Duration Distribution**
   - Calculate % of total time per component
   - Identify component > 50% of total time

2. **Compare to Baseline**
   - Compare current P95 to 7-day average
   - Flag if > 150% of baseline

3. **Identify Outliers**
   - Find organizations with P95 > 2x platform average
   - Flag for investigation

4. **Pattern Detection**
   - Time-of-day patterns (e.g., slow at peak hours)
   - Day-of-week patterns
   - Attachment correlation (slow with large files)

**Dashboard Widget:**
```
┌─────────────────────────────────────────────────────────┐
│ 🔍 Detected Bottlenecks                                 │
├─────────────────────────────────────────────────────────┤
│ 🔴 Critical: Flowise API                                │
│    • 65% of total response time                         │
│    • P95: 8.5s (baseline: 5.2s, +63%)                   │
│    • Recommendation: Optimize chatflow                  │
│    [View Details]                                       │
│                                                         │
│ 🟡 Warning: City Hall Organization                      │
│    • P95: 12.3s (platform avg: 6.5s, +89%)            │
│    • Possible cause: Large conversation history        │
│    [Investigate]                                        │
│                                                         │
│ 🟢 Info: Peak hour detected                             │
│    • 2-4 PM has 2x volume and 1.5x latency            │
│    • Consider scaling resources during peak            │
│    [View Pattern]                                       │
└─────────────────────────────────────────────────────────┘
```

**Recommendations:**
- Based on bottleneck type, suggest fixes:
  - "Flowise slow" → "Optimize chatflow, reduce history, use caching"
  - "Attachments slow" → "Enable parallel processing, use CDN"
  - "DB queries slow" → "Add indexes, optimize queries, enable caching"

**Acceptance Criteria:**
- [ ] Bottlenecks detected accurately
- [ ] Recommendations relevant
- [ ] Updates daily or on-demand
- [ ] Can drill into each bottleneck

---

### 4.3 Performance Monitoring Summary

**Must-Have Features (V1):**
- ✅ F-PERF-001: Metrics collection
- ✅ F-PERF-002: Real-time dashboard
- ✅ F-PERF-003: Component detail view
- ✅ F-PERF-005: Slow request details
- ✅ F-PERF-006: Performance alerts

**Nice-to-Have (V1.5):**
- ✅ F-PERF-004: Comparison tools
- ✅ F-PERF-007: Historical analysis
- ✅ F-PERF-008: Export functionality

**Future (V2):**
- ✅ F-PERF-009: Real-time websocket monitoring
- ✅ F-PERF-010: AI bottleneck detection

---

## 5. Non-Functional Requirements

### 5.1 Performance

**NFR-PERF-001:** Dashboard Load Time
- Requirement: Dashboard must load in < 2 seconds
- Measured: Time from navigation to interactive
- Acceptance: 95% of loads meet requirement

**NFR-PERF-002:** Query Response Time
- Requirement: Database queries must complete in < 500ms
- Measured: Server-side query execution time
- Acceptance: P95 < 500ms

**NFR-PERF-003:** Chart Rendering
- Requirement: Charts must render in < 1 second
- Measured: Time from data received to chart displayed
- Acceptance: All charts meet requirement

### 5.2 Security

**NFR-SEC-001:** Authentication
- Requirement: Only superadmin users can access
- Implementation: Supabase Auth + RLS policies
- Verification: Automated tests

**NFR-SEC-002:** Authorization
- Requirement: All actions authorized via RLS
- Implementation: Row-level security policies
- Verification: Policy tests

**NFR-SEC-003:** Audit Logging
- Requirement: All administrative actions logged
- Implementation: audit_logs table
- Verification: Log coverage > 95%

**NFR-SEC-004:** Data Encryption
- Requirement: All data encrypted at rest and in transit
- Implementation: Supabase (built-in), HTTPS (Vercel)
- Verification: SSL/TLS enabled

**NFR-SEC-005:** Session Management
- Requirement: Sessions timeout after 8 hours
- Implementation: Supabase Auth configuration
- Verification: Test session expiry

### 5.3 Usability

**NFR-UX-001:** Responsive Design
- Requirement: Works on desktop (1920x1080) and tablet (768x1024)
- Implementation: Tailwind CSS responsive classes
- Verification: Manual testing

**NFR-UX-002:** Accessibility
- Requirement: WCAG 2.1 Level AA compliance
- Implementation: Semantic HTML, ARIA labels
- Verification: Automated accessibility tests

**NFR-UX-003:** Loading States
- Requirement: All async operations show loading indicator
- Implementation: Skeleton screens, spinners
- Verification: Manual testing

**NFR-UX-004:** Error Messages
- Requirement: User-friendly error messages
- Implementation: Toast notifications with clear text
- Verification: Error message review

### 5.4 Reliability

**NFR-REL-001:** Uptime
- Requirement: 99.9% uptime
- Measured: Vercel uptime monitoring
- Acceptance: < 43 minutes downtime per month

**NFR-REL-002:** Data Integrity
- Requirement: Zero data loss
- Implementation: Database ACID compliance, backups
- Verification: Daily backup tests

**NFR-REL-003:** Error Recovery
- Requirement: Graceful degradation on errors
- Implementation: Error boundaries, fallbacks
- Verification: Chaos testing

### 5.5 Scalability

**NFR-SCALE-001:** User Capacity
- Requirement: Support 100+ organizations
- Measured: Database query performance at scale
- Acceptance: Query times remain < 500ms

**NFR-SCALE-002:** Data Volume
- Requirement: Handle 1M+ performance metrics
- Implementation: Proper indexing, partitioning (future)
- Verification: Load testing

**NFR-SCALE-003:** Concurrent Users
- Requirement: Support 10 concurrent superadmin users
- Measured: Application response time under load
- Acceptance: No degradation with 10 users

---

## 6. Success Metrics

### 6.1 Adoption Metrics

**M-001: Onboarding Time Reduction**
- Baseline: 2-3 hours per new organization
- Target: < 10 minutes per organization
- Measure: Time from start to activated status
- Success: 80% of onboarding completes in < 10 min

**M-002: Support Request Reduction**
- Baseline: 15 support requests/week
- Target: < 6 support requests/week (60% reduction)
- Measure: Support ticket count
- Success: Sustained reduction over 4 weeks

**M-003: Dashboard Usage**
- Target: 80% of superadmin users visit dashboard daily
- Measure: Google Analytics or Vercel Analytics
- Success: Meet target within 1 month of launch

### 6.2 Performance Metrics

**M-004: Performance Issue Detection Time**
- Target: < 2 minutes from occurrence to identification
- Measure: Time from slow request to alert
- Success: 90% of issues identified within 2 min

**M-005: Performance Data Completeness**
- Target: 100% of webhook requests logged
- Measure: Count of logged metrics vs webhook count
- Success: > 99.9% completeness

**M-006: Alert Accuracy**
- Target: < 5% false positives
- Measure: Alerts triggered vs real issues
- Success: Meet target after 2 weeks of tuning

### 6.3 Business Metrics

**M-007: Organization Growth**
- Target: 10 new organizations in first 3 months
- Measure: Count of active organizations
- Success: Meet or exceed target

**M-008: Usage Data Availability**
- Target: 100% of organizations have usage reports
- Measure: Completeness of usage_metrics table
- Success: Data available for all orgs

**M-009: Time to Value**
- Target: New organization gets first report in < 24 hours
- Measure: Time from activation to first citizen report
- Success: 80% meet target

---

## 7. User Stories

### Epic 1: Organization Management

**US-001:** As a platform administrator, I want to create a new organization in < 10 minutes so I can onboard clients quickly.

**US-002:** As a platform administrator, I want to view all organizations at a glance so I can monitor client portfolio.

**US-003:** As a platform administrator, I want to suspend an organization so I can enforce payment or policy violations.

**US-004:** As a support team member, I want to view an organization's details so I can help troubleshoot their issues.

---

### Epic 2: Performance Monitoring

**US-005:** As a DevOps engineer, I want to see real-time performance metrics so I can identify issues immediately.

**US-006:** As a DevOps engineer, I want to be alerted when P95 exceeds 10 seconds so I can investigate before users complain.

**US-007:** As a platform administrator, I want to compare performance across organizations so I can identify which clients need optimization.

**US-008:** As a DevOps engineer, I want to drill down into slow requests so I can understand what went wrong.

**US-009:** As a DevOps engineer, I want to see which component is the bottleneck so I can prioritize optimization efforts.

**US-010:** As a platform administrator, I want to export performance data so I can analyze it in Excel or share with stakeholders.

---

### Epic 3: User Management

**US-011:** As a support team member, I want to search for a user by email across all organizations so I can find their account quickly.

**US-012:** As a platform administrator, I want to assign roles to users so I can control their permissions.

**US-013:** As a support team member, I want to view a user's activity log so I can understand what they've been doing.

**US-014:** As a platform administrator, I want to suspend a user account so I can enforce security policies.

---

### Epic 4: Usage Analytics

**US-015:** As a business analyst, I want to see message volume per organization so I can calculate billing.

**US-016:** As a platform administrator, I want to export usage reports so I can send invoices to clients.

**US-017:** As a business analyst, I want to see growth trends so I can forecast resource needs.

---

### Epic 5: Audit & Compliance

**US-018:** As a platform administrator, I want to see all administrative actions logged so I can maintain compliance.

**US-019:** As a security officer, I want to review audit logs so I can investigate suspicious activity.

**US-020:** As a platform administrator, I want to export audit logs so I can provide them for security audits.

---

**Document Complete ✅**

**Total Requirements:** 40+ functional requirements across 7 feature categories

**Next:** See [03-TECHNICAL-ARCHITECTURE.md](./03-TECHNICAL-ARCHITECTURE.md) for implementation details.
