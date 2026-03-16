# Lapor Platform — 4-Environment Architecture

> This document describes how the Lapor platform is deployed across four distinct environments, each with its own Supabase instance, frontend deployment strategy, and access model.

---

## Environment Overview

| Environment | Supabase Host | Git Branch | Frontend Deployment | Access | Purpose |
|-------------|---------------|------------|---------------------|--------|---------|
| **Production** | `ykaawgnggvwleiyzvilf.supabase.co` (hosted) | `main` | Vercel auto-deploy | Public | Live users — citizens & government staff |
| **Staging** | `cxauavfcyfscjnatxino.supabase.co` (hosted) | `staging` | Vercel auto-deploy | Public | Pre-production testing |
| **Local** | `http://192.168.1.19:8000` (Docker, dev machine) | — | Vite dev (`:3000`) or Docker Nginx | LAN only | Developer local testing |
| **Client** | `http://<CLIENT_VPS_IP>:8000` (Docker, client VPS) | — | Docker Nginx (`:3000`) or Vercel | VPN / public domain | Per-client production deployment |

---

## Environment File Mapping

Each Vite build mode loads a different `.env.*` file:

| File | Vite Mode | Target | Gitignored? | npm Script |
|------|-----------|--------|-------------|------------|
| `.env.staging` | `staging` | Hosted staging Supabase | No (public keys only) | `npm run dev:staging` |
| `.env.production` | `production` | Hosted production Supabase | No (public keys only) | `npm run dev:production` |
| `.env.local-network` | `local-network` | Local Docker Supabase | Yes | `npm run dev:local` |
| `.env.client` | `client` | Client VPS Supabase | Yes | `npm run dev:client` |
| `.env.functions` | N/A (Docker host) | Edge function secrets | Yes | N/A |

### Key Variables in Each .env File

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_SUPABASE_URL` | Supabase API base URL | `http://10.0.0.5:8000` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anon/public JWT key | `eyJhbGci...` |
| `VITE_WEBHOOK_BASE_URL` | (Optional) Public-facing URL for webhook display in admin UI | `https://client.example.com` |

---

## Database Migration Flow

```
┌─────────────┐     supabase db push          ┌──────────────┐
│   Staging    │ ──────────────────────────►   │  Staging DB  │
│   (branch)   │     --project-ref cxau...     │   (hosted)   │
└─────────────┘                                └──────────────┘
       │
       │ merge to main
       ▼
┌─────────────┐     supabase db push          ┌──────────────┐
│  Production  │ ──────────────────────────►   │ Production DB│
│   (branch)   │     --project-ref ykaa...     │   (hosted)   │
└─────────────┘                                └──────────────┘

┌─────────────┐     node apply-migrations.mjs  ┌──────────────┐
│  Any branch  │ ──────────────────────────►   │   Local DB   │
│              │     (REST API, defaults)       │   (Docker)   │
└─────────────┘                                └──────────────┘

┌─────────────┐     node apply-migrations.mjs  ┌──────────────┐
│  Any branch  │ ──────────────────────────►   │  Client DB   │
│              │     --url --key (CLI args)     │   (Docker)   │
└─────────────┘                                └──────────────┘
```

### Commands

```bash
# Staging (hosted)
supabase db push --project-ref cxauavfcyfscjnatxino

# Production (hosted) — ALWAYS confirm with team first
supabase db push --project-ref ykaawgnggvwleiyzvilf

# Local (self-hosted Docker)
node scripts/apply-migrations-local.mjs

# Client VPS (self-hosted Docker)
node deployment/scripts/apply-migrations.mjs --url http://<CLIENT_VPS_IP>:8000 --key <SERVICE_ROLE_KEY>
```

---

## Edge Function Deployment Flow

```
┌────────────────┐    supabase functions deploy    ┌──────────────┐
│ Hosted Supabase│ ◄──────────────────────────────  │  Developer   │
│ (staging/prod) │    --project-ref <ref>           │   Machine    │
└────────────────┘                                  └──────┬───────┘
                                                           │
                                                    scp + SSH restart
                                                           │
┌────────────────┐    deploy-functions.sh            ┌─────▼───────┐
│  Client VPS    │ ◄──────────────────────────────   │  Developer  │
│  (Docker)      │    --host --user --path           │   Machine   │
└────────────────┘                                   └─────────────┘

┌────────────────┐    deploy-functions-to-local.ps1  ┌─────────────┐
│  Local Docker  │ ◄──────────────────────────────   │  Developer  │
│  (same machine)│    (file copy + restart)          │   Machine   │
└────────────────┘                                   └─────────────┘
```

### Commands

```bash
# Staging (hosted)
supabase functions deploy <function-name> --project-ref cxauavfcyfscjnatxino

# Production (hosted)
supabase functions deploy <function-name> --project-ref ykaawgnggvwleiyzvilf

# Local (same machine Docker)
.\scripts\deploy-functions-to-local.ps1

# Client VPS (remote via SSH)
./deployment/scripts/deploy-functions.sh --host <CLIENT_VPS_IP> --user root --path /root/supabase/docker
```

---

## Secrets Management

| Environment | Method | Location |
|-------------|--------|----------|
| **Production** | `supabase secrets set KEY=VALUE --project-ref ykaa...` | Supabase vault |
| **Staging** | `supabase secrets set KEY=VALUE --project-ref cxau...` | Supabase vault |
| **Local** | `.env.functions` file → Docker `env_file:` | Docker host filesystem |
| **Client** | `.env.functions` file → Docker `env_file:` | Client VPS filesystem |

### Edge Function Secrets Reference

| Secret | Required? | Used By | Notes |
|--------|-----------|---------|-------|
| `SUPABASE_URL` | Auto | All | Auto-injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto | All | Auto-injected by Supabase runtime |
| `SUPABASE_ANON_KEY` | Auto | Auth-protected functions | Auto-injected by Supabase runtime |
| `pimpinan-insight` | If using AI | `generate-ai-insight`, `extract-report-from-conversation` | OpenRouter API key |
| `LICENSE_PUBLIC_KEY` | If using licensing | `redeem-license` | Ed25519 public key (64-char hex) |
| `SUPABASE_PUBLIC_URL` | If behind proxy | Webhook handlers | Rewrites internal Docker URLs |
| `DEBUG` | Optional | All webhook handlers | Set `true` for verbose logs |

### WhatsApp Provider Credentials (Database, NOT Secrets)

These are stored in **database tables**, configured via the admin UI at `/admin/integration`:

| Provider | Config Table | Key Columns |
|----------|-------------|-------------|
| Fonnte | `fonnte_config` | `api_token` |
| WhatsApp Cloud (Meta) | `whatsapp_cloud_config` | `phone_number_id`, `access_token`, `verify_token` |
| Infobip | `infobip_config` | `api_key`, `base_url`, `sender_number` |

Active provider selection: `whatsapp_provider_config` table (per-tenant, `is_active = true`).

---

## Frontend Build & Deployment

The **lapor-citizen-feedback** frontend includes both citizen-facing pages and the admin dashboard (including license management and tenant configuration).

| Environment | Build Command | Deploy Method | Port |
|-------------|--------------|---------------|------|
| **Production** | `npm run build` | Git push to `main` → Vercel auto-deploy | Vercel URL |
| **Staging** | `npm run build:staging` | Git push to `staging` → Vercel auto-deploy | Vercel URL |
| **Local (dev)** | N/A (dev server) | `npm run dev:local` → Vite HMR | `:3000` |
| **Local (prod build)** | `bash deployment/scripts/build-frontend.sh local-network` | Docker Nginx via `deploy-frontends-to-local.ps1` | `:3000` |
| **Client (Option A)** | `bash deployment/scripts/build-frontend.sh client` | Docker Nginx via `deploy-frontend.sh` | `:3000` |
| **Client (Option B)** | Vercel auto-build | Vercel auto-deploy on git push | Vercel HTTPS URL |

### Option A: Docker Nginx Container (Self-Hosted Frontend)

The frontend is served by a Docker Nginx container defined in `deployment/docker/frontend/docker-compose.frontend.yml`:

```
deployment/docker/frontend/
├── docker-compose.frontend.yml    # Nginx container
├── .env.frontend.example          # Template for env vars
└── nginx/
    └── lapor.conf                 # SPA config for lapor
```

The Nginx container:
- Serves static files from volume-mounted `dist/` directory
- Has SPA fallback (`try_files $uri $uri/ /index.html`)
- Gzip compression for JS/CSS/SVG
- 1-year cache for hashed static assets

### Option B: Vercel-Hosted Frontend

The frontend is deployed as a Vercel project pointing to the self-hosted Supabase:
- **Requires HTTPS** on the Supabase API (Vercel serves over HTTPS; mixed content blocked)
- **Requires a domain** with DNS control (e.g., `api.client-domain.com`)
- Frontend updates deploy automatically on git push
- Vercel handles CDN, SSL, and edge caching

---

## Network Architecture

### Production & Staging (Hosted Supabase + Vercel)
```
Internet → Vercel (frontend) → Supabase Cloud (API + DB + Functions)
```

### Local Development
```
Dev Machine → Vite (localhost:3000) → Local Docker (192.168.1.19:8000)
                                           │
                                      Cloudflare Tunnel (optional, for webhook testing)
                                           │
                                      External APIs (Fonnte, Meta, Infobip)
```

### Client VPS — Option A (Fully Self-Hosted)
```
VPN/Internet → Reverse Proxy (nginx + SSL, optional)
                    │
              Supabase Docker (:8000)
                    │
              Docker Nginx Container
              └── lapor-frontend (:3000) — citizen + admin
```

### Client VPS — Option B (Vercel + Self-Hosted Backend)
```
Internet → Vercel (app.client-domain.com) ──┐
                                             │ HTTPS API calls
                                             ▼
         Reverse Proxy (nginx + SSL) → Supabase Docker (:8000)
              api.client-domain.com
                    │
              VPN access for admin/SSH management
```
