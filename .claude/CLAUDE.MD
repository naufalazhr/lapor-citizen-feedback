# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Important Instruction: Keep other features and functions that are already working properly intact. 

Think deeper and step by step, make sure you understand, then create a plan to fix it. 


## Project Overview

**Lapor** is a multi-tenant civic tech platform for Indonesian local government (Pemda/Pemkot). Citizens submit reports ("laporan") or aspirations ("aspirasi") and track them via ticket IDs. Government staff (admins, OPD members) manage reports, dispositions, and WhatsApp conversations in an admin dashboard. Integrates with Flowise (AI chatflow) and Fonnte (WhatsApp Business gateway).

UI is in Bahasa Indonesia. "OPD" = Organisasi Perangkat Daerah (government department unit).

---

## Two-Codebase Architecture (CRITICAL)

This SaaS product is split across **two separate codebases** that share the same Supabase database:

### 1. `lapor-citizen-feedback` (THIS REPO)
**Path**: `C:\Users\yugie\lapor ai\lapor-citizen-feedback`

This is the **primary codebase** and the **source of truth** for:
- Citizen-facing pages (`/lapor`, `/lacak`)
- Tenant admin/member dashboard (`/admin/*`) — used by government staff (admins, OPDs, members)
- WhatsApp integration (Fonnte, Edge Functions, AI chatbot)
- **ALL Supabase migrations** — this is the ONLY place migrations should be written and run
- All Supabase Edge Functions (`supabase/functions/`)

### 2. `citizen-admin-hub` (SEPARATE REPO)
**Path**: `C:\Users\yugie\superadmin\citizen-admin-hub`

This is the **SaaS owner/superadmin dashboard** for us (the product builders) to manage the multi-tenant platform:
- Manage tenants (create, suspend, configure)
- Cross-tenant visibility and settings
- Consumes the **same Supabase database** as lapor-citizen-feedback

⚠️ **CRITICAL RULE — MIGRATIONS**:
- **NEVER write or run Supabase migrations from `citizen-admin-hub`**
- All schema changes MUST be written as migration files in `lapor-citizen-feedback/supabase/migrations/`
- Past mistake: migrations were accidentally authored from `citizen-admin-hub` — this caused schema drift confusion. Always check which repo you are in before creating migrations.

---

## Supabase Project IDs (CRITICAL — Do Not Confuse)

Configured in `supabase/config.toml`:

| Environment | Project ID / Host | Git Branch | Deployment |
|-------------|-------------------|------------|------------|
| **Production** | `ykaawgnggvwleiyzvilf` | `main` | Vercel auto-deploy |
| **Staging** | `cxauavfcyfscjnatxino` | `staging` | Vercel auto-deploy |
| **Local** | `http://192.168.1.19:8000` (self-hosted Docker) | — | Manual (see Local Dev) |

⚠️ **CRITICAL RULES**:
- Always confirm which environment you are targeting before running `supabase db push`, `supabase functions deploy`, or any Supabase CLI command that mutates remote state.
- Use `--project-ref ykaawgnggvwleiyzvilf` for production, `--project-ref cxauavfcyfscjnatxino` for staging.
- **NEVER deploy to production without explicit confirmation from the user.**
- When on the `staging` git branch, default all Supabase CLI operations to the **staging** project unless the user explicitly says otherwise.
- Migrations tested on staging MUST be verified before being promoted to production.
- **Local Supabase** is a self-hosted Docker instance. Edge functions are deployed by copying to Docker volumes (`scripts/deploy-functions-to-local.ps1`), NOT via `supabase functions deploy`.

---

## Commands

```bash
npm run dev              # Start dev server (port 8080, default .env)
npm run dev:staging      # Dev with .env.staging vars (Supabase staging project)
npm run dev:production   # Dev with .env.production vars (Supabase production project)
npm run dev:local        # Dev with .env.local-network vars (self-hosted local Supabase)
npm run build            # Production build
npm run build:staging    # Staging build
npm run lint             # ESLint
npx tsc --noEmit         # Typecheck (no typecheck script in package.json)
```

No test suite exists.

### Environment Files

Vite uses `--mode` to select env file:

| File | Target | Key Variables |
|------|--------|--------------|
| `.env.staging` | Staging Supabase (`cxauavfcyfscjnatxino`) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` |
| `.env.production` | Production Supabase (`ykaawgnggvwleiyzvilf`) | Same |
| `.env.local-network` | Self-hosted Docker (`http://192.168.1.19:8000`) | Same + `VITE_WEBHOOK_BASE_URL` |
| `.env.functions` | Edge function secrets for local Docker | `FONNTE_TOKEN`, `WA_CLOUD_*`, `INFOBIP_*`, etc. |

`VITE_WEBHOOK_BASE_URL` is an optional override for webhook display URLs in admin UI. When set (e.g., to a Cloudflare tunnel URL), admin config pages show the tunnel URL instead of `VITE_SUPABASE_URL`. Used for local webhook testing with external services (Meta WhatsApp Cloud API, Fonnte, Infobip).

Never commit real keys. `.env.functions` and `.env.local-network` are gitignored.

### Deploying Edge Functions

```bash
# Deploy single function to staging
supabase functions deploy <function-name> --project-ref cxauavfcyfscjnatxino

# Deploy single function to production
supabase functions deploy <function-name> --project-ref ykaawgnggvwleiyzvilf

# Push DB migrations to staging
supabase db push --project-ref cxauavfcyfscjnatxino

# Push DB migrations to production (confirm with user first)
supabase db push --project-ref ykaawgnggvwleiyzvilf
```

---

## Architecture

**Stack**: React 18 + Vite (SWC) + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres + Auth + Storage + Edge Functions) + React Query + React Router v6

**Key integrations**: Flowise (self-hosted AI), Fonnte (WhatsApp), Leaflet (maps), Recharts (charts), jsPDF (PDF export)

### Directory Structure

```
src/
├── pages/                  # Route-level components
│   ├── admin/              # Protected admin pages (Reports, Dashboard, etc.)
│   └── Auth, Report, TrackReport, Landing (public pages)
├── components/
│   ├── admin/              # Admin-only UI components
│   │   └── dashboard/      # Chart components + executive KPI cards
│   └── ui/                 # shadcn/ui primitives
├── hooks/                  # Data fetching hooks (useEffect + useState pattern)
├── integrations/supabase/
│   ├── client.ts           # Supabase JS client
│   └── types.ts            # Generated DB types (auto-generated, do not edit manually)
├── utils/                  # invitation token helpers, PDF export
└── lib/utils.ts            # cn() (clsx + tailwind-merge)

supabase/
├── migrations/             # 50+ idempotent SQL migration files
├── functions/              # Deno Edge Functions (generate-api-key)
└── diagnostics/            # Debug SQL scripts (not migrations)
```

### Routing

Routes are defined in `src/App.tsx`. Admin routes (`/admin/*`) are NOT wrapped in a centralized `<ProtectedRoute>` — each admin page manually checks `supabase.auth.getSession()` in a `useEffect` and redirects to `/auth` if unauthenticated.

| Route | Access | Page |
|---|---|---|
| `/` | Public | Auth |
| `/lapor` | Public | Submit report |
| `/lacak`, `/lacak/:ticketId` | Public | Track ticket |
| `/profile-setup` | Authenticated | Profile setup |
| `/pending-approval` | Authenticated | Approval wait screen |
| `/invite/:token` | Public | Accept invitation |
| `/admin` | Admin+ | Redirect to dashboard |
| `/admin/dashboard` | Admin+ | Overview dashboard |
| `/admin/reports` | Admin+ | Reports list |
| `/admin/reports/:id` | Admin+ | Report detail |
| `/admin/conversations` | Admin+ | WhatsApp conversations |
| `/admin/integration` | Admin+ | API / integration config |
| `/admin/users` | Admin+ | User management |
| `/admin/opds` | Admin+ | OPD management |

### Auth & RBAC

Six roles (defined in `app_role` enum): `superadmin > owner > admin > member > opd_member > viewer`

- `src/hooks/use-user-role.tsx` is the central auth hook — queries `user_roles` table, returns boolean flags (`isAdmin`, `isOPDMember`, etc.)
- New users go through an approval flow (`user_approvals` table) or bypass via invitation token (`/invite/:token`)
- `has_role()` is a SECURITY DEFINER Postgres function used in RLS policies to prevent privilege escalation

### Multi-tenancy

Every major table has a `tenant_id UUID` FK to the `tenants` table. Row Level Security (RLS) enforces isolation via `get_user_tenant_id()`. This was added retroactively, so watch for missing `tenant_id` on any new tables you create.

### Data Fetching Pattern

TanStack Query is installed but **not consistently used**. Most data fetching uses plain `useEffect` + `useState` + direct Supabase client calls. The `use-dashboard-data.tsx` and `use-executive-dashboard.tsx` hooks follow this pattern. Stick to this pattern for consistency unless refactoring is explicitly requested.

### Edge Functions

Eleven deployed Deno Edge Functions in `supabase/functions/`:

| Function | JWT | Purpose |
|---|---|---|
| `submit-report` | No | Public — citizen submits a report |
| `fonnte-webhook` | No | Fonnte WhatsApp webhook; AI (Flowise) or human handoff |
| `whatsapp-cloud-webhook` | No | Meta WhatsApp Cloud API webhook; same flow as fonnte-webhook |
| `infobip-webhook` | No | Infobip WhatsApp webhook; same flow as fonnte-webhook |
| `get-webhook-errors` | No | Returns webhook error logs for admin debugging |
| `generate-ai-insight` | No | Triggers AI analysis on a report |
| `generate-api-key` | Yes | Creates hashed API keys (admin only) |
| `send-human-reply` | Yes | Admin sends WhatsApp reply during human takeover |
| `admin-submit-report` | Yes | Admin submits report on behalf of citizen from conversation |
| `extract-report-from-conversation` | Yes | AI extracts structured report from human-handled conversation |
| `redeem-license` | No | Validates Ed25519-signed license tokens, stores activation |

All three webhook functions (`fonnte-webhook`, `whatsapp-cloud-webhook`, `infobip-webhook`) share the same core modules in `fonnte-webhook/`:
- `conversation-manager.ts` — conversation CRUD, `saveMessage()` (includes `tenant_id`), deduplication
- `flowise-client.ts` — sends messages to Flowise AI chatflow
- `attachment-processor.ts` — handles media attachments
- `providers/` — WhatsApp provider abstraction (see below)

### WhatsApp Provider Pattern

Provider abstraction in `supabase/functions/fonnte-webhook/providers/`:
- `types.ts` — `IWhatsAppProvider` interface + `WhatsAppProviderType` enum
- `provider-factory.ts` — reads `whatsapp_provider_config` table, instantiates the right provider (falls back to Fonnte)
- Four implementations:

| Provider | File | Config Table | Status |
|----------|------|-------------|--------|
| Fonnte | `fonnte-provider.ts` | `fonnte_config` | Primary, production |
| WhatsApp Cloud | `whatsapp-cloud-provider.ts` | `whatsapp_cloud_config` | Official Meta API |
| Infobip | `infobip-provider.ts` | `infobip_config` | Available |
| Twilio | `twilio-provider.ts` | Environment secrets | Reference impl |

To add a new provider: add `<name>-provider.ts`, extend enum in `types.ts`, add case in `provider-factory.ts`, add DB migration for config table + enum value, add Supabase secrets.

### PII Masking (L0–L3)

Reports contain citizen PII (name, phone, address). Access is role-gated:

| Level | Roles | Name display | Phone display |
|---|---|---|---|
| L0 | superadmin, owner, admin | Full name | Full number |
| L1 | member, opd_member | "Ahmad F." | "0812****789" |
| L2 | viewer | "A***" | Hidden |
| L3 | Public/unauthenticated | Hidden | Hidden |

- Central hook: `src/hooks/use-pii-masking.tsx`
- Utility: `src/utils/pii-masking.ts`
- Masking is **synchronous and client-side** — happens in utility functions before render
- Every access logs a fire-and-forget entry to `pii_access_logs` table (never blocks UI)

### OPD Disposition Workflow

Reports flow: `pending → in_progress → resolved/rejected`. Admins assign reports to OPDs via `report_dispositions` (full audit trail with `status_before/status_after`). OPD members can request re-assignment via `report_return_requests` which admins must approve.

### Database Migrations

All migrations under `supabase/migrations/` use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` to be **idempotent** (required for Supabase branch creation). Always follow this pattern for new migrations.

### API Key Security

`supabase/functions/generate-api-key/` uses SHA-256 hashing. Only `key_prefix` is stored; the full key is returned once at creation (GitHub/Stripe pattern).

### TypeScript Config — Intentionally Loose

`tsconfig.json` has `noImplicitAny: false`, `strictNullChecks: false`, `noUnusedLocals: false`, `allowJs: true`. This is intentional (Lovable-generated project). The typecheck command (`npx tsc --noEmit`) will still catch structural errors but won't enforce strict null safety. Do not tighten strictness without a deliberate refactor.

### Deployment

- Deployed on **Vercel** via git push integration (`vercel.json` contains an SPA catch-all rewrite to `/index.html`)
- Push to `staging` branch → auto-deploys to staging Vercel environment
- Push to `main` branch → auto-deploys to production Vercel environment
- No GitHub Actions CI exists; Supabase migrations and edge functions must be deployed manually via CLI
- Edge functions must be deployed separately after code push (Vercel only handles the frontend)

### Local Development (Self-Hosted Supabase)

Self-hosted Supabase runs via Docker at `http://192.168.1.19:8000`.

```bash
npm run dev:local                           # Start frontend against local Supabase
node scripts/apply-migrations-local.mjs     # Apply all migrations to local DB
.\scripts\deploy-functions-to-local.ps1     # Copy edge functions to Docker + restart
```

**Webhook testing with Cloudflare Tunnel**: Local edge functions aren't reachable from the internet. Use `cloudflared tunnel --url http://192.168.1.19:8000` to get a public HTTPS URL, then set `VITE_WEBHOOK_BASE_URL` in `.env.local-network` to that tunnel URL. Register the tunnel URL with Meta/Fonnte/Infobip dashboards.

**Important**: The tunnel URL changes on every restart. Update both `.env.local-network` and the external provider's webhook config each time.

### Lovable Integration

This project was bootstrapped on [Lovable](https://lovable.dev) (generative UI platform). The `lovable-tagger` Vite plugin tags components for Lovable's AI in development mode. Editing locally and pushing to git syncs back to Lovable. This has no effect on production builds.

---

## Workflow
- Keep other features and functions that are already working properly intact.
- Think step by step, understand the context, then create a plan before implementing.
- Typecheck after a series of code changes: `npx tsc --noEmit`

---

## Design Thinking
Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Constraints**: Technical requirements (framework, performance, accessibility).
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines
Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision.

## DOCUMENTATION
For every project, write a detailed FORJOBMATCH.md file that explains the whole project in plain language.

Explain the technical architecture, the structure of the codebase and how the various parts are connected, the technologies used, why we made these technical decisions, and lessons I can learn from it (this should include the bugs we ran into and how we fixed them, potential pitfalls and how to avoid them in the future, new technologies used, how good engineers think and work, best practices, etc).

It should be very engaging to read; don't make it sound like boring technical documentation/textbook. Where appropriate, use analogies and anecdotes to make it more understandable and memorable.
