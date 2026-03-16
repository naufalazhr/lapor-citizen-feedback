# Client Deployment Checklist — Option A (Self-Hosted)

> Print this page and check off each item as you complete it.
> For detailed instructions, see [OPTION-A-SELF-HOSTED.md](./OPTION-A-SELF-HOSTED.md).

---

## Pre-Deployment

- [ ] VPN access to client VPS verified (`ping <VPS_IP>` works)
- [ ] SSH access to client VPS confirmed (`ssh root@<VPS_IP>`)
- [ ] Docker + Docker Compose installed on VPS (`docker --version`, `docker compose version`)
- [ ] Node.js 18+ installed on deployment machine
- [ ] Latest `lapor-citizen-feedback` repo cloned/pulled
- [ ] Client-specific info collected:
  - [ ] VPS IP address: `____________`
  - [ ] SSH user/port: `____________`
  - [ ] Client domain (if any): `____________`
  - [ ] WhatsApp provider: Fonnte / WA Cloud / Infobip
  - [ ] WhatsApp API credentials ready
  - [ ] Flowise URL (if using AI chatbot): `____________`

---

## Phase 1: Supabase Docker Setup

- [ ] Supabase Docker repo cloned on VPS
- [ ] Fresh secrets generated (`JWT_SECRET`, `POSTGRES_PASSWORD`, `ANON_KEY`, `SERVICE_ROLE_KEY`)
- [ ] `.env` configured on Docker host
- [ ] `docker compose up -d` — all services running
- [ ] Studio accessible at `http://<VPS_IP>:8000`
- [ ] Health check passes: `curl http://<VPS_IP>:8000/rest/v1/`

---

## Phase 2: Database Migrations

- [ ] Migrations applied: `node deployment/scripts/apply-migrations.mjs --url http://<VPS_IP>:8000 --key <KEY>`
- [ ] Tables exist in Studio: `reports`, `tenants`, `conversations`, `user_roles`, `profiles`
- [ ] RPC functions exist: `has_role`, `get_user_tenant_id`, `get_pii_level`
- [ ] Migrations tracked in Studio → Database → Migrations page

---

## Phase 3: Edge Functions

- [ ] Functions deployed via SSH: `./deployment/scripts/deploy-functions.sh --host <IP> --user root --path <PATH>`
- [ ] `deno.json` copied to `volumes/functions/`
- [ ] Functions container restarted
- [ ] Test: `curl http://<VPS_IP>:8000/functions/v1/get-webhook-errors` returns JSON

---

## Phase 4: Edge Function Secrets

- [ ] `.env.functions` created on Docker host with required secrets
- [ ] `env_file: .env.functions` added to `docker-compose.yml` under `functions:` service
- [ ] Functions container recreated: `docker compose up -d --force-recreate functions`
- [ ] Secrets verified: `docker exec supabase-edge-runtime env | grep pimpinan`

---

## Phase 5: Storage Buckets

- [ ] `report-attachments` bucket created (private)
- [ ] `profile-images` bucket created (public)
- [ ] Storage RLS policies applied (from migrations)

---

## Phase 6: Tenant & User Setup

- [ ] Tenant created in `tenants` table
- [ ] Admin user created (sign up via app or Studio Auth)
- [ ] Admin profile has correct `tenant_id` in `profiles` table
- [ ] Admin role assigned in `user_roles` table (role: `admin`)
- [ ] Flowise config created (if using AI chatbot):
  - [ ] `flowise_config` row with correct `url` and `api_key`
- [ ] WhatsApp provider config created:
  - [ ] Provider credentials in respective config table
  - [ ] `whatsapp_provider_config` row with `is_active = true`

---

## Phase 7: Frontend Deployment

- [ ] `.env.client` configured in **lapor-citizen-feedback** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_WEBHOOK_BASE_URL`)
- [ ] Frontend built: `bash deployment/scripts/build-frontend.sh client`
- [ ] `dist/` deployed: `./deployment/scripts/deploy-frontend.sh --host <IP> --user root --path /opt/lapor`
- [ ] Docker container running: `docker ps | grep lapor-frontend`
- [ ] lapor-citizen-feedback accessible at `http://<VPS_IP>:3000`
- [ ] SPA routing works (deep links like `/admin/reports`, `/lacak/123` don't 404)
- [ ] Auth redirect URLs configured in Docker `.env` (`SITE_URL`, `ADDITIONAL_REDIRECT_URLS`)

---

## Phase 8: WhatsApp Webhook Registration

- [ ] Webhook URL determined (public IP/domain with HTTPS if using WA Cloud):
  - Fonnte: `http(s)://<DOMAIN>:8000/functions/v1/fonnte-webhook`
  - WA Cloud: `https://<DOMAIN>/functions/v1/whatsapp-cloud-webhook`
  - Infobip: `http(s)://<DOMAIN>:8000/functions/v1/infobip-webhook`
- [ ] Webhook URL registered in provider dashboard (Fonnte/Meta/Infobip)
- [ ] Webhook verification passed (WA Cloud sends verify challenge)
- [ ] `VITE_WEBHOOK_BASE_URL` set in `.env.client` (if different from `VITE_SUPABASE_URL`)

---

## Phase 9: Smoke Tests

### Public Pages
- [ ] Landing page loads at `/`
- [ ] Report submission works at `/lapor`
- [ ] Report tracking works at `/lacak/<ticket_id>`

### Authentication
- [ ] Can sign up at `/auth`
- [ ] Can log in with created admin account
- [ ] Correct role displayed (admin)

### Admin Dashboard
- [ ] Dashboard loads at `/admin/dashboard`
- [ ] Reports list at `/admin/reports` shows test data
- [ ] Report detail at `/admin/reports/<id>` loads correctly

### WhatsApp Integration
- [ ] Send WhatsApp message → appears in `/admin/conversations`
- [ ] AI chatbot responds (if Flowise configured)
- [ ] Human takeover works — admin can "Ambil Alih"
- [ ] Human reply sent from dashboard → received on WhatsApp

### AI Insights (if configured)
- [ ] Generate AI insight on a test report → insight appears

---

## Post-Deployment

- [ ] Document client-specific credentials in secure vault (not in repo)
- [ ] Set up monitoring (Docker health checks, uptime monitoring)
- [ ] Configure automatic Docker restart on VPS reboot (`restart: unless-stopped`)
- [ ] Schedule regular database backups
- [ ] Record deployment details:
  - VPS IP: `____________`
  - Domain: `____________`
  - Deployed date: `____________`
  - Supabase Docker version: `____________`
  - WhatsApp provider: `____________`
