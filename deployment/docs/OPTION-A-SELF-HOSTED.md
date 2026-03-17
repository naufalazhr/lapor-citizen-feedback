# Lapor — Client VPS Deployment Guide (Option A: Fully Self-Hosted)

> End-to-end guide for deploying the Lapor platform to a client's self-hosted VPS server.
> This covers everything from bare Docker to a fully functional system with WhatsApp integration.

**Related documents:**
- [ENVIRONMENT_ARCHITECTURE.md](./ENVIRONMENT_ARCHITECTURE.md) — 4-environment architecture overview
- [CHECKLIST-A.md](./CHECKLIST-A.md) — Printable deployment checklist

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Supabase Docker Setup](#phase-1-supabase-docker-setup)
3. [Phase 2: Apply Database Migrations](#phase-2-apply-database-migrations)
4. [Phase 3: Deploy Edge Functions](#phase-3-deploy-edge-functions)
5. [Phase 4: Configure Edge Function Secrets](#phase-4-configure-edge-function-secrets)
6. [Phase 5: Create Storage Buckets](#phase-5-create-storage-buckets)
7. [Phase 6: Create Tenant & Admin User](#phase-6-create-tenant--admin-user)
8. [Phase 7: Build & Deploy Frontend](#phase-7-build--deploy-frontend)
9. [Phase 8: WhatsApp Webhook Registration](#phase-8-whatsapp-webhook-registration)
10. [Phase 9: Verification & Smoke Tests](#phase-9-verification--smoke-tests)
11. [HTTPS / SSL Setup](#https--ssl-setup)
12. [Troubleshooting](#troubleshooting)
13. [Maintenance](#maintenance)
14. [Quick Reference](#quick-reference)

---

## Prerequisites

Before starting, ensure you have:

- [ ] **VPN access** to the client's VPS (test with `ping <VPS_IP>`)
- [ ] **SSH access** to the VPS (`ssh root@<VPS_IP>`)
- [ ] **Docker + Docker Compose** installed on the VPS
  ```bash
  # Verify on VPS:
  docker --version          # Docker 20.10+
  docker compose version    # Docker Compose v2+
  ```
- [ ] **Node.js 18+** on your deployment machine
- [ ] **Latest repo** cloned: `git pull origin staging`
- [ ] **Client-specific info gathered:**
  - VPS IP address
  - Desired domain (if any)
  - WhatsApp provider choice (Fonnte / WhatsApp Cloud / Infobip)
  - WhatsApp API credentials
  - Flowise URL + API key (if using AI chatbot)

---

## Phase 1: Supabase Docker Setup

### 1.1 Clone Supabase Docker on the VPS

```bash
ssh root@<VPS_IP>

# Clone the official Supabase Docker setup
git clone --depth 1 https://github.com/supabase/supabase.git /root/supabase
cd /root/supabase/docker
```

### 1.2 Generate Fresh Secrets

**CRITICAL: Never reuse secrets from another environment.**

```bash
# Copy the example env file
cp .env.example .env

# Generate a new JWT secret (minimum 32 chars)
openssl rand -base64 32
# Copy the output and paste it as JWT_SECRET in .env

# Generate a new Postgres password
openssl rand -base64 24
# Copy and paste as POSTGRES_PASSWORD in .env
```

### 1.3 Generate ANON_KEY and SERVICE_ROLE_KEY

The anon key and service role key are JWTs signed with your `JWT_SECRET`. Generate them using the Supabase JWT tool:

**Option A: Online tool** (for convenience)
1. Go to https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
2. Enter your `JWT_SECRET`
3. Copy the generated `ANON_KEY` and `SERVICE_ROLE_KEY`

**Option B: Command line**
```bash
# Install jwt-cli or use Node.js:
node -e "
const jwt = require('jsonwebtoken');
const secret = 'YOUR_JWT_SECRET_HERE';
const anon = jwt.sign({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+157680000}, secret);
const service = jwt.sign({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+157680000}, secret);
console.log('ANON_KEY=' + anon);
console.log('SERVICE_ROLE_KEY=' + service);
"
```

### 1.4 Configure `.env` on the Docker Host

Edit `/root/supabase/docker/.env`:

```env
# --- REQUIRED: Change these ---
POSTGRES_PASSWORD=<generated-password>
JWT_SECRET=<generated-jwt-secret>
ANON_KEY=<generated-anon-key>
SERVICE_ROLE_KEY=<generated-service-role-key>

# --- URLs ---
SITE_URL=https://<CLIENT_DOMAIN>
ADDITIONAL_REDIRECT_URLS=https://<CLIENT_DOMAIN>
API_EXTERNAL_URL=http://<VPS_IP>:8000

# --- Studio ---
DASHBOARD_USERNAME=supabase
DASHBOARD_PASSWORD=<choose-a-strong-password>

# --- Pooler ---
POOLER_TENANT_ID=client-tenant
```

> **Save these values securely** — you'll need `ANON_KEY` and `SERVICE_ROLE_KEY` later.

### 1.5 Start Supabase

```bash
cd /root/supabase/docker
docker compose up -d
```

### 1.6 Verify

```bash
# Check all services are running
docker compose ps

# Test REST API
curl http://localhost:8000/rest/v1/ -H "apikey: <ANON_KEY>"
# Expected: JSON response (even just {})

# Access Studio from your machine (via VPN)
# Open: http://<VPS_IP>:8000
# Login with DASHBOARD_USERNAME / DASHBOARD_PASSWORD
```

---

## Phase 2: Apply Database Migrations

Run from your **deployment machine** (not the VPS):

### 2.1 Apply Migrations

```bash
cd /path/to/lapor-citizen-feedback

# Apply all migrations to client VPS
node scripts/apply-migrations.mjs \
  --url http://<VPS_IP>:8000 \
  --key <SERVICE_ROLE_KEY>
```

The script will:
- Test connectivity to the Supabase instance
- Apply all SQL migrations in order
- Track applied migrations in `supabase_migrations.schema_migrations`
- Skip already-applied migrations on re-runs
- Handle "already exists" errors gracefully

### 2.2 Verify

Open Studio (`http://<VPS_IP>:8000`) and check:

1. **Table Editor** — tables exist: `reports`, `tenants`, `conversations`, `user_roles`, `profiles`, `messages`, `attachments`, `whatsapp_provider_config`, `fonnte_config`, `whatsapp_cloud_config`, `infobip_config`
2. **Database → Functions** — RPC functions exist: `has_role`, `get_user_tenant_id`, `get_pii_level`
3. **Database → Migrations** — all migrations listed (tracked by our script)

---

## Phase 3: Deploy Edge Functions

### 3.1 Deploy via SSH Script

From your deployment machine:

```bash
# Make the script executable (first time only)
chmod +x scripts/deploy-functions.sh

# Deploy to client VPS
./scripts/deploy-functions.sh \
  --host <VPS_IP> \
  --user root \
  --path /root/supabase/docker
```

This copies all 11 edge functions + `_shared/` + `deno.json` to the VPS and restarts the functions container.

### 3.2 Manual Alternative (if SSH script doesn't work)

```bash
# From your machine — copy functions via scp
scp -r supabase/functions/* root@<VPS_IP>:/root/supabase/docker/volumes/functions/

# SSH into VPS and restart
ssh root@<VPS_IP>
cd /root/supabase/docker
docker compose restart functions --no-deps
```

### 3.3 Verify

```bash
# Test a safe function (no side effects)
curl http://<VPS_IP>:8000/functions/v1/get-webhook-errors \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
# Expected: JSON response (possibly empty array)

# Check function logs
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose logs functions --tail=20"
```

If you see `{"error":"Function not found"}`:
1. Check files exist: `ssh root@<VPS_IP> "ls /root/supabase/docker/volumes/functions/"`
2. Verify `deno.json` was copied
3. Check `_shared/cors.ts` exists
4. Restart again: `docker compose restart functions --no-deps`

---

## Phase 4: Configure Edge Function Secrets

### 4.1 Create `.env.functions` on the Docker Host

```bash
ssh root@<VPS_IP>
cd /root/supabase/docker
nano .env.functions
```

Add the required secrets:

```env
# =============================================================================
# Edge Function Secrets for Client: <CLIENT_NAME>
# =============================================================================

# --- AI Insights (OpenRouter) ---
# Required if using AI report analysis and conversation extraction
pimpinan-insight=sk-or-v1-your_openrouter_api_key_here

# --- License System ---
# Required if using offline license validation
LICENSE_PUBLIC_KEY=your_64_char_hex_public_key_here

# --- Public URL Override ---
# Set this to the public-facing URL for correct attachment URLs
# If using a domain with reverse proxy: https://api.client-domain.com
# If using direct IP: http://<VPS_IP>:8000
SUPABASE_PUBLIC_URL=http://<VPS_IP>:8000

# --- Debug (optional) ---
# Set to "true" for verbose edge function logging
# DEBUG=true
```

> **Note:** WhatsApp provider credentials (Fonnte token, WA Cloud access token, Infobip API key) are stored in **database tables**, not here. You'll configure them via the admin UI in Phase 6.

### 4.2 Link Secrets in docker-compose.yml

```bash
nano /root/supabase/docker/docker-compose.yml
```

Find the `functions:` service block and add `env_file`:

```yaml
services:
  # ... other services ...
  functions:
    # ... existing lines ...
    env_file:
      - .env.functions    # ADD THIS LINE
```

### 4.3 Restart Functions with Secrets

```bash
cd /root/supabase/docker
docker compose up -d --force-recreate functions
```

### 4.4 Verify Secrets

```bash
# Check secrets are available inside the container
docker exec supabase-edge-runtime env | grep pimpinan
# Should print: pimpinan-insight=sk-or-v1-...

docker exec supabase-edge-runtime env | grep SUPABASE_PUBLIC_URL
# Should print the URL you set
```

---

## Phase 5: Create Storage Buckets

### 5.1 Via SQL (Recommended)

In Studio → SQL Editor, run:

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('report-attachments', 'report-attachments', false, 10485760),
  ('profile-images', 'profile-images', true, 5242880)
ON CONFLICT (id) DO NOTHING;
```

> `report-attachments` is private (requires auth), `profile-images` is public.
> File size limits: 10MB for reports, 5MB for profile images.

### 5.2 Via Studio UI

1. Open Studio → **Storage**
2. Click **New Bucket**
3. Create `report-attachments` (private) and `profile-images` (public)

### 5.3 Verify

Storage section in Studio should show both buckets.

---

## Phase 6: Create Tenant & Admin User

### 6.1 Create the Tenant

In Studio → SQL Editor:

```sql
-- Create the client's tenant
INSERT INTO tenants (id, name, slug, is_active)
VALUES (
  gen_random_uuid(),
  'Pemkot <CLIENT_NAME>',
  'pemkot-<client-slug>',
  true
)
RETURNING id;
-- SAVE this tenant ID — you'll need it below
```

### 6.2 Create the First Admin User

**Option A: Via the App** (recommended)
1. Open the frontend at the client URL
2. Sign up with an email/password
3. The user will be in "pending approval" state

Then in SQL Editor, approve and promote to admin:

```sql
-- Find the user
SELECT id, email FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- Set their tenant_id in profiles
UPDATE profiles
SET tenant_id = '<TENANT_ID_FROM_STEP_1>'
WHERE id = '<USER_ID>';

-- Assign admin role
INSERT INTO user_roles (user_id, role, tenant_id)
VALUES ('<USER_ID>', 'admin', '<TENANT_ID_FROM_STEP_1>')
ON CONFLICT DO NOTHING;

-- Approve the user (if pending)
UPDATE user_approvals
SET status = 'approved', reviewed_by = '<USER_ID>'
WHERE user_id = '<USER_ID>';
```

**Option B: Via Studio Auth**
1. Studio → **Authentication** → **Users** → **Add User**
2. Enter email and password
3. Then run the SQL above to set tenant and role

### 6.3 Configure Flowise (if using AI chatbot)

```sql
INSERT INTO flowise_config (tenant_id, url, api_key, chatflow_id, is_active)
VALUES (
  '<TENANT_ID>',
  'https://flowise.example.com',   -- Flowise server URL
  'flowise-api-key-here',          -- Flowise API key
  'chatflow-id-here',              -- Chatflow ID for this tenant
  true
)
ON CONFLICT DO NOTHING;
```

### 6.4 Configure WhatsApp Provider

This is best done via the admin UI after the frontend is deployed (Phase 7):
1. Log in as admin → Go to `/admin/integration`
2. Select **WhatsApp Channel**
3. Choose provider (Fonnte / WhatsApp Cloud / Infobip)
4. Enter API credentials

**Or via SQL** (if frontend isn't ready yet):

```sql
-- Example for WhatsApp Cloud (Meta):
INSERT INTO whatsapp_cloud_config (tenant_id, phone_number_id, access_token, verify_token, is_active)
VALUES (
  '<TENANT_ID>',
  '<PHONE_NUMBER_ID>',
  '<PERMANENT_ACCESS_TOKEN>',
  '<VERIFY_TOKEN>',
  true
);

INSERT INTO whatsapp_provider_config (tenant_id, provider, is_active, config_name)
VALUES (
  '<TENANT_ID>',
  'whatsapp_cloud',
  true,
  'WhatsApp Cloud - <CLIENT_NAME>'
);
```

---

## Phase 7: Build & Deploy Frontend

The **lapor-citizen-feedback** frontend is served via a **Docker Nginx container** using the config in `deployment/docker/frontend/`.

> **Note:** License management and tenant administration are now built into the lapor-citizen-feedback app. No separate admin frontend is needed.

### 7.1 Configure `.env.client`

Edit `.env.client` in the lapor-citizen-feedback repo:

```env
VITE_SUPABASE_URL=http://<VPS_IP>:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY_FROM_PHASE_1>
VITE_WEBHOOK_BASE_URL=http://<VPS_IP>:8000
```

If the client has a domain with HTTPS (see [HTTPS / SSL Setup](#https--ssl-setup)):
```env
VITE_SUPABASE_URL=https://api.client-domain.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY_FROM_PHASE_1>
VITE_WEBHOOK_BASE_URL=https://api.client-domain.com
```

### 7.2 Build the Frontend

```bash
# Build the SPA for client mode
bash deployment/scripts/build-frontend.sh client
```

This builds `lapor-citizen-feedback/dist/`.

### 7.3 Deploy via SSH Script

```bash
# Deploy frontend + Docker config to VPS
./deployment/scripts/deploy-frontend.sh \
  --host <VPS_IP> \
  --user root \
  --path /opt/lapor
```

This script:
1. Builds the frontend (or use `--skip-build` if already built)
2. SCPs the `dist/` directory to the VPS
3. Uploads `docker-compose.frontend.yml` and Nginx config
4. Creates `.env` on remote with correct paths
5. Starts/restarts the Docker Nginx container

### 7.4 Manual Alternative (if SSH script doesn't work)

```bash
# 1. Copy dist/ to VPS
ssh root@<VPS_IP> "mkdir -p /opt/lapor/lapor-citizen-feedback/dist /opt/lapor/frontend/nginx"

scp -r dist/* root@<VPS_IP>:/opt/lapor/lapor-citizen-feedback/dist/

# 2. Copy Docker Compose + Nginx config
scp deployment/docker/frontend/docker-compose.frontend.yml root@<VPS_IP>:/opt/lapor/frontend/
scp deployment/docker/frontend/nginx/lapor.conf root@<VPS_IP>:/opt/lapor/frontend/nginx/

# 3. SSH into VPS and create .env
ssh root@<VPS_IP>
cat > /opt/lapor/frontend/.env <<'EOF'
LAPOR_DIST_PATH=/opt/lapor/lapor-citizen-feedback/dist
LAPOR_PORT=3000
EOF

# 4. Start container
cd /opt/lapor/frontend
docker compose --env-file .env -f docker-compose.frontend.yml up -d
```

### 7.5 Verify Frontend

```bash
# Check container is running
ssh root@<VPS_IP> "docker ps | grep lapor-frontend"

# Test frontend
curl -s http://<VPS_IP>:3000/ | head -5
```

### 7.6 Configure Auth Redirect URLs

Edit the Supabase Docker `.env` to include the frontend URL:

```bash
ssh root@<VPS_IP>
cd /root/supabase/docker
nano .env
```

Update:
```env
SITE_URL=http://<VPS_IP>:3000
ADDITIONAL_REDIRECT_URLS=http://<VPS_IP>:3000,https://<CLIENT_DOMAIN>
```

Restart auth:
```bash
docker compose restart auth --no-deps
```

---

## Phase 8: WhatsApp Webhook Registration

### 8.1 Determine Webhook URL

The webhook URL depends on how the VPS is exposed to the internet:

| Scenario | Webhook URL |
|----------|-------------|
| Public IP, no SSL | `http://<VPS_IP>:8000/functions/v1/<webhook-name>` |
| Domain with nginx reverse proxy + SSL | `https://api.<DOMAIN>/functions/v1/<webhook-name>` |
| Cloudflare Tunnel | `https://<tunnel-subdomain>.cfargotunnel.com/functions/v1/<webhook-name>` |

Replace `<webhook-name>` with:
- **Fonnte**: `fonnte-webhook`
- **WhatsApp Cloud (Meta)**: `whatsapp-cloud-webhook`
- **Infobip**: `infobip-webhook`

> **Important**: Meta WhatsApp Cloud API **requires HTTPS**. If using WA Cloud, you must set up SSL (see [HTTPS / SSL Setup](#https--ssl-setup)).

### 8.2 Register in Provider Dashboard

**Fonnte:**
1. Go to https://md.fonnte.com
2. Select the device
3. Set webhook URL: `http(s)://<HOST>/functions/v1/fonnte-webhook`

**WhatsApp Cloud (Meta):**
1. Go to https://developers.facebook.com → Your App → WhatsApp → Configuration
2. Set Callback URL: `https://<HOST>/functions/v1/whatsapp-cloud-webhook`
3. Set Verify Token: must match the `verify_token` in `whatsapp_cloud_config` table
4. Subscribe to: `messages`

**Infobip:**
1. Go to Infobip portal → Channels → WhatsApp
2. Set webhook URL: `http(s)://<HOST>/functions/v1/infobip-webhook`

### 8.3 Test Webhook

Send a test WhatsApp message to the configured number. Check:

```bash
# View function logs on VPS
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose logs functions --tail=50 -f"
```

You should see the webhook handler processing the message.

---

## Phase 9: Verification & Smoke Tests

Use the [CHECKLIST-A.md](./CHECKLIST-A.md) for a complete verification walkthrough.

**Quick smoke test:**

```bash
# 1. API health check
curl http://<VPS_IP>:8000/rest/v1/ -H "apikey: <ANON_KEY>"

# 2. Edge function check
curl http://<VPS_IP>:8000/functions/v1/get-webhook-errors \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

# 3. Frontend loads
curl -s http://<VPS_IP>:3000/ | head -5
```

Then manually test:
1. Open the frontend → Sign in as admin
2. Check `/admin/dashboard` loads with data
3. Submit a test report at `/lapor`
4. Track it at `/lacak/<ticket_id>`
5. Send a WhatsApp message → verify it appears in `/admin/conversations`
6. Reply from dashboard → verify it arrives on WhatsApp

---

## HTTPS / SSL Setup

### Option A: Nginx Reverse Proxy with Let's Encrypt (Recommended)

```bash
ssh root@<VPS_IP>

# Install certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate (domain must point to VPS IP)
certbot --nginx -d api.<CLIENT_DOMAIN> -d <CLIENT_DOMAIN>

# Update nginx config to proxy Supabase API
cat > /etc/nginx/sites-available/supabase-api <<'EOF'
server {
    listen 443 ssl;
    server_name api.<CLIENT_DOMAIN>;

    ssl_certificate /etc/letsencrypt/live/api.<CLIENT_DOMAIN>/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.<CLIENT_DOMAIN>/privkey.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -sf /etc/nginx/sites-available/supabase-api /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

After setting up SSL, update your `.env.client`:
```env
VITE_SUPABASE_URL=https://api.<CLIENT_DOMAIN>
VITE_WEBHOOK_BASE_URL=https://api.<CLIENT_DOMAIN>
```

### Option B: Cloudflare Tunnel

If the VPS doesn't have a public IP or you can't configure DNS:

```bash
# Install cloudflared on the VPS
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Run tunnel (gets a temporary public URL)
cloudflared tunnel --url http://localhost:8000

# For persistent tunnel, use named tunnels:
# https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/
```

---

## Troubleshooting

### Cannot connect to VPS

```bash
# Check VPN is active
ping <VPS_IP>

# Check SSH
ssh -v root@<VPS_IP>

# Check Docker is running on VPS
ssh root@<VPS_IP> "docker compose -f /root/supabase/docker/docker-compose.yml ps"
```

### Migration script fails with "Cannot reach"

1. Verify the URL: `curl http://<VPS_IP>:8000/rest/v1/`
2. Check port 8000 is not firewalled: `ssh root@<VPS_IP> "ss -tlnp | grep 8000"`
3. Ensure `kong` container is running: `docker compose ps kong`

### Edge function returns "Function not found"

1. Check files on VPS: `ssh root@<VPS_IP> "ls /root/supabase/docker/volumes/functions/"`
2. Verify `deno.json` is present
3. Check `_shared/cors.ts` exists (functions import from it)
4. View logs: `docker compose logs functions --tail=50`
5. Restart: `docker compose restart functions --no-deps`

### Secrets not available in functions

1. Confirm `.env.functions` is in the Docker Compose directory
2. Confirm `env_file:` is in docker-compose.yml under `functions:` service
3. Force recreate: `docker compose up -d --force-recreate functions`
4. Verify: `docker exec supabase-edge-runtime env | grep <SECRET_NAME>`

### Dashboard shows empty data

Most common cause: **`tenant_id` mismatch**. Check:

```sql
-- Check the admin user's tenant_id
SELECT p.id, p.full_name, p.tenant_id, ur.role
FROM profiles p
JOIN user_roles ur ON ur.user_id = p.id
WHERE p.tenant_id IS NOT NULL;

-- Check reports have matching tenant_id
SELECT id, ticket_id, tenant_id FROM reports LIMIT 10;
```

If reports have `tenant_id = NULL`, backfill them:

```sql
UPDATE reports SET tenant_id = '<TENANT_ID>' WHERE tenant_id IS NULL;
UPDATE messages SET tenant_id = (
  SELECT c.tenant_id FROM conversations c WHERE c.id = messages.conversation_id
) WHERE tenant_id IS NULL;
```

> As of migration `20260304000001`, BEFORE INSERT triggers auto-fill `tenant_id` from parent records. This should prevent future NULL values.

### WhatsApp messages not arriving

1. Check webhook URL is registered correctly in provider dashboard
2. Check function logs: `docker compose logs functions --tail=50 -f`
3. Verify provider config in DB:
   ```sql
   SELECT * FROM whatsapp_provider_config WHERE is_active = true;
   ```
4. Ensure only ONE provider row has `is_active = true` per tenant
5. For WA Cloud: verify HTTPS is working (Meta requires it)

### Human reply not sent to WhatsApp

1. Check `send-human-reply` function logs
2. Verify the active provider: `SELECT * FROM whatsapp_provider_config WHERE is_active = true;`
3. Check provider credentials are valid in the respective config table
4. Ensure `conversation.tenant_id` is not NULL

---

## Maintenance

### Updating Edge Functions

When code changes are pushed to the repo:

```bash
git pull origin staging
./deployment/scripts/deploy-functions.sh --host <VPS_IP> --user root --path /root/supabase/docker
```

### Applying New Migrations

```bash
git pull origin staging
node deployment/scripts/apply-migrations.mjs --url http://<VPS_IP>:8000 --key <SERVICE_ROLE_KEY>
```

### Updating the Frontend

```bash
git pull origin staging
./deployment/scripts/deploy-frontend.sh --host <VPS_IP> --user root --path /opt/lapor
```

Or update just the build without redeploying containers:
```bash
bash deployment/scripts/build-frontend.sh client
scp -r dist/* root@<VPS_IP>:/opt/lapor/lapor-citizen-feedback/dist/
```

### Database Backups

```bash
# Manual backup via pg_dump
ssh root@<VPS_IP>
docker exec supabase-db pg_dump -U postgres postgres > /root/backups/lapor_$(date +%Y%m%d).sql

# Automated daily backup (add to crontab)
crontab -e
# Add:
0 2 * * * docker exec supabase-db pg_dump -U postgres postgres | gzip > /root/backups/lapor_$(date +\%Y\%m\%d).sql.gz
```

### Docker Auto-Restart

Ensure containers restart after VPS reboot:

```bash
# Check restart policy in docker-compose.yml
# Each service should have:
#   restart: unless-stopped
```

---

## Quick Reference

### Environment Variables Summary

| Where | Variable | Value |
|-------|----------|-------|
| `.env.client` (your machine) | `VITE_SUPABASE_URL` | `http(s)://<VPS_IP_OR_DOMAIN>:8000` |
| `.env.client` (your machine) | `VITE_SUPABASE_PUBLISHABLE_KEY` | `<ANON_KEY>` from Phase 1 |
| `.env.client` (your machine) | `VITE_WEBHOOK_BASE_URL` | Same as `VITE_SUPABASE_URL` or public domain |
| Docker `.env` (VPS) | `JWT_SECRET` | Generated in Phase 1 |
| Docker `.env` (VPS) | `ANON_KEY` | Generated in Phase 1 |
| Docker `.env` (VPS) | `SERVICE_ROLE_KEY` | Generated in Phase 1 |
| Docker `.env` (VPS) | `POSTGRES_PASSWORD` | Generated in Phase 1 |
| Docker `.env` (VPS) | `SITE_URL` | Frontend URL |
| `.env.functions` (VPS) | `pimpinan-insight` | OpenRouter API key |
| `.env.functions` (VPS) | `LICENSE_PUBLIC_KEY` | Ed25519 hex (64 chars) |
| `.env.functions` (VPS) | `SUPABASE_PUBLIC_URL` | Public URL for attachment URLs |

### Key Commands

```bash
# Apply migrations to client VPS
node deployment/scripts/apply-migrations.mjs --url http://<VPS_IP>:8000 --key <SERVICE_ROLE_KEY>

# Deploy edge functions to client VPS
./deployment/scripts/deploy-functions.sh --host <VPS_IP> --user root --path /root/supabase/docker

# Build frontend for client
bash deployment/scripts/build-frontend.sh client

# Deploy frontend to client VPS (build + upload + start container)
./deployment/scripts/deploy-frontend.sh --host <VPS_IP> --user root --path /opt/lapor

# Deploy frontend without rebuilding
./deployment/scripts/deploy-frontend.sh --host <VPS_IP> --user root --path /opt/lapor --skip-build

# View edge function logs on VPS
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose logs functions --tail=50 -f"

# View frontend container logs on VPS
ssh root@<VPS_IP> "cd /opt/lapor/frontend && docker compose logs -f"

# Restart a specific Docker service on VPS
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose restart <service> --no-deps"

# Full Docker restart on VPS
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose down && docker compose up -d"
```

### Docker Services Overview

**Supabase Stack** (`/root/supabase/docker/`):

| Service | Port | Purpose |
|---------|------|---------|
| `kong` | 8000 | API gateway (REST, Auth, Storage, Functions) |
| `db` | 5432 | PostgreSQL database |
| `auth` | — | GoTrue authentication |
| `rest` | — | PostgREST API |
| `realtime` | — | Real-time subscriptions |
| `storage` | — | File storage |
| `functions` | — | Deno edge functions runtime |
| `studio` | — | Dashboard UI (served via kong on :8000) |

**Frontend Stack** (`/opt/lapor/frontend/`):

| Service | Port | Purpose |
|---------|------|---------|
| `lapor-frontend` | 3000 | Citizen-facing + admin dashboard (Nginx) |
