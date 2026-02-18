# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lapor** is a multi-tenant civic tech platform for Indonesian local government (Pemda/Pemkot). Citizens submit reports ("laporan") or aspirations ("aspirasi") and track them via ticket IDs. Government staff (admins, OPD members) manage reports, dispositions, and WhatsApp conversations in an admin dashboard. Integrates with Flowise (AI chatflow) and Fonnte (WhatsApp Business gateway).

UI is in Bahasa Indonesia. "OPD" = Organisasi Perangkat Daerah (government department unit).

---

## Commands

```bash
npm run dev              # Start dev server (port 8080)
npm run dev:staging      # Dev with staging env vars
npm run build            # Production build
npm run build:staging    # Staging build
npm run lint             # ESLint
npx tsc --noEmit         # Typecheck (no typecheck script in package.json)
```

No test suite exists.

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

Public routes: `/lapor` (submit report), `/lacak` (track ticket), `/` → Auth page.

### Auth & RBAC

Six roles (defined in `app_role` enum): `superadmin > owner > admin > member > opd_member > viewer`

- `src/hooks/use-user-role.tsx` is the central auth hook — queries `user_roles` table, returns boolean flags (`isAdmin`, `isOPDMember`, etc.)
- New users go through an approval flow (`user_approvals` table) or bypass via invitation token (`/invite/:token`)
- `has_role()` is a SECURITY DEFINER Postgres function used in RLS policies to prevent privilege escalation

### Multi-tenancy

Every major table has a `tenant_id UUID` FK to the `tenants` table. Row Level Security (RLS) enforces isolation via `get_user_tenant_id()`. This was added retroactively, so watch for missing `tenant_id` on any new tables you create.

### Data Fetching Pattern

TanStack Query is installed but **not consistently used**. Most data fetching uses plain `useEffect` + `useState` + direct Supabase client calls. The `use-dashboard-data.tsx` and `use-executive-dashboard.tsx` hooks follow this pattern. Stick to this pattern for consistency unless refactoring is explicitly requested.

### OPD Disposition Workflow

Reports flow: `pending → in_progress → resolved/rejected`. Admins assign reports to OPDs via `report_dispositions` (full audit trail with `status_before/status_after`). OPD members can request re-assignment via `report_return_requests` which admins must approve.

### Database Migrations

All migrations under `supabase/migrations/` use `IF NOT EXISTS` and `ON CONFLICT DO NOTHING` to be **idempotent** (required for Supabase branch creation). Always follow this pattern for new migrations.

### API Key Security

`supabase/functions/generate-api-key/` uses SHA-256 hashing. Only `key_prefix` is stored; the full key is returned once at creation (GitHub/Stripe pattern).

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
