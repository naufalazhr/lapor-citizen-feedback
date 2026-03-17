# Option B: Vercel Frontend + Self-Hosted Backend

> Supabase (backend, DB, edge functions) runs on the client's VPS.
> The frontend is deployed on Vercel (managed hosting with CDN).

**When to use this option:**
- Client has a public domain with DNS control
- Client wants CDN/edge caching for frontend performance
- Client prefers managed frontend hosting (zero nginx config)
- Frontend updates should deploy via git push (no SSH needed)

**Requirements that Option A doesn't have:**
- A **public domain** pointing to the VPS (e.g., `api.client-domain.com`)
- **HTTPS/SSL** on the Supabase API (Vercel serves over HTTPS; browsers block mixed content)
- **Vercel account** with permission to create projects

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Supabase Docker Setup](#phase-1-supabase-docker-setup)
3. [Phase 2: Apply Database Migrations](#phase-2-apply-database-migrations)
4. [Phase 3: Deploy Edge Functions](#phase-3-deploy-edge-functions)
5. [Phase 4: Configure Edge Function Secrets](#phase-4-configure-edge-function-secrets)
6. [Phase 5: Create Storage Buckets](#phase-5-create-storage-buckets)
7. [Phase 6: Create Tenant & Admin User](#phase-6-create-tenant--admin-user)
8. [Phase 7: HTTPS Setup (Required)](#phase-7-https-setup-required)
9. [Phase 8: Deploy Frontend on Vercel](#phase-8-deploy-frontend-on-vercel)
10. [Phase 9: Configure Auth Redirect URLs](#phase-9-configure-auth-redirect-urls)
11. [Phase 10: WhatsApp Webhook Registration](#phase-10-whatsapp-webhook-registration)
12. [Phase 11: Verification & Smoke Tests](#phase-11-verification--smoke-tests)
13. [Troubleshooting](#troubleshooting)
14. [Maintenance](#maintenance)
15. [Quick Reference](#quick-reference)

---

## Prerequisites

Before starting, ensure you have:

- [ ] **VPN access** to the client's VPS (test with `ping <VPS_IP>`)
- [ ] **SSH access** to the VPS (`ssh root@<VPS_IP>`)
- [ ] **Docker + Docker Compose** installed on the VPS
- [ ] **Public domain** with DNS control (e.g., `client-domain.com`)
  - You'll need at least: `api.client-domain.com` → VPS IP
  - Optionally: `app.client-domain.com` as CNAME to Vercel
- [ ] **Vercel account** with permission to create new projects
- [ ] **Node.js 18+** on your deployment machine
- [ ] **Latest repo** cloned: `git pull origin staging`
- [ ] **Client-specific info gathered:**
  - VPS IP address
  - Domain name
  - WhatsApp provider choice (Fonnte / WhatsApp Cloud / Infobip)
  - WhatsApp API credentials
  - Flowise URL + API key (if using AI chatbot)

---

## Phases 1–6: Backend Setup

> Phases 1 through 6 are **identical** to Option A.
> Follow [OPTION-A-SELF-HOSTED.md](./OPTION-A-SELF-HOSTED.md) Phases 1–6, then return here for Phase 7.

**Quick summary:**

| Phase | What | Command / Action |
|-------|------|-----------------|
| 1 | Supabase Docker Setup | Clone, generate secrets, `docker compose up -d` |
| 2 | Database Migrations | `node deployment/scripts/apply-migrations.mjs --url http://<VPS_IP>:8000 --key <KEY>` |
| 3 | Edge Functions | `./deployment/scripts/deploy-functions.sh --host <VPS_IP> --user root --path /root/supabase/docker` |
| 4 | Edge Function Secrets | Create `.env.functions`, add `env_file:` to docker-compose |
| 5 | Storage Buckets | Create `report-attachments` and `profile-images` via SQL |
| 6 | Tenant & Admin User | Create tenant, admin user, configure Flowise/WhatsApp via SQL |

After completing Phase 6, continue below.

---

## Phase 7: HTTPS Setup (Required)

> **This phase is MANDATORY for Option B.** Vercel frontends are served over HTTPS. Browsers will block API calls to `http://` URLs (mixed content policy). Your self-hosted Supabase must be accessible via HTTPS.

### Option 7A: Nginx Reverse Proxy + Let's Encrypt (Recommended)

#### 7A.1 Point Domain to VPS

In your DNS provider, create an A record:

```
api.client-domain.com  →  <VPS_IP>
```

Wait for DNS propagation (check with `dig api.client-domain.com` or `nslookup`).

#### 7A.2 Install Nginx + Certbot on VPS

```bash
ssh root@<VPS_IP>

apt update && apt install -y nginx certbot python3-certbot-nginx
```

#### 7A.3 Create Nginx Config

```bash
cat > /etc/nginx/sites-available/supabase-api <<'EOF'
server {
    listen 80;
    server_name api.client-domain.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Large body for file uploads
        client_max_body_size 50M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/supabase-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

#### 7A.4 Get SSL Certificate

```bash
certbot --nginx -d api.client-domain.com

# Follow the prompts — choose to redirect HTTP to HTTPS
```

Certbot automatically:
- Gets a Let's Encrypt certificate
- Updates the nginx config with SSL
- Sets up auto-renewal via systemd timer

#### 7A.5 Verify HTTPS

```bash
# From your machine:
curl https://api.client-domain.com/rest/v1/ -H "apikey: <ANON_KEY>"
# Should return JSON response
```

### Option 7B: Cloudflare Tunnel (No Domain Needed)

If you can't configure DNS or the VPS has no public IP:

```bash
ssh root@<VPS_IP>

# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# Login to Cloudflare (one-time)
cloudflared tunnel login

# Create a named tunnel (persistent)
cloudflared tunnel create lapor-client
cloudflared tunnel route dns lapor-client api.client-domain.com

# Create config
cat > /root/.cloudflared/config.yml <<'EOF'
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.client-domain.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run as a service
cloudflared service install
systemctl enable cloudflared
systemctl start cloudflared
```

### 7.6 Update Supabase Config

After HTTPS is working, update the Supabase Docker `.env`:

```bash
ssh root@<VPS_IP>
cd /root/supabase/docker
nano .env
```

Update:
```env
API_EXTERNAL_URL=https://api.client-domain.com
```

Also update `.env.functions`:
```env
SUPABASE_PUBLIC_URL=https://api.client-domain.com
```

Restart affected services:
```bash
docker compose up -d --force-recreate kong auth functions
```

#### Verify

```bash
# Test from your machine
curl https://api.client-domain.com/rest/v1/ -H "apikey: <ANON_KEY>"

# Test edge functions
curl https://api.client-domain.com/functions/v1/get-webhook-errors \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

---

## Phase 8: Deploy Frontend on Vercel

> **Note:** License management and tenant administration are now built into the lapor-citizen-feedback app. Only one frontend needs to be deployed.

### 8.1 Strategy: Separate Vercel Project per Client

> **Recommended approach.** Each client gets their own Vercel project with isolated environment variables. No risk of accidentally deploying to the wrong backend.

#### Create Vercel Project for lapor-citizen-feedback

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import the `lapor-citizen-feedback` git repository
3. **Project name**: `lapor-<client-name>` (e.g., `lapor-pemkot-bandung`)
4. **Framework preset**: Vite
5. **Build command**: `npm run build`
6. **Output directory**: `dist`
7. **Environment Variables** — add these:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://api.client-domain.com` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<ANON_KEY from Phase 1>` |
| `VITE_WEBHOOK_BASE_URL` | `https://api.client-domain.com` |

8. Click **Deploy**

### 8.2 Custom Domain (Optional but Recommended)

After deploying, add a custom domain in Vercel:

1. **Vercel Project Settings** → **Domains**
2. Add `app.client-domain.com` for lapor-citizen-feedback
3. In your DNS, add a CNAME record:
   ```
   app.client-domain.com    →  cname.vercel-dns.com
   ```
4. Vercel auto-provisions SSL certificate

### 8.3 Branch Strategy

For client-specific deployments, you have two options:

**Option A: Deploy from `main`/`staging` branch (simplest)**
- Client gets the same code as production/staging
- Environment variables in Vercel determine which backend is used
- Frontend updates happen automatically when you push to the branch

**Option B: Client-specific branch (for customizations)**
- Create `client-<name>` branch: `git checkout -b client-pemkot-bandung`
- In Vercel Project Settings → **Git** → **Production Branch**: set to `client-pemkot-bandung`
- Client can have custom branding, features, etc.
- You must merge upstream changes manually

### 8.4 Verify Deployment

After Vercel deploys:

```bash
# Check frontend
curl -s https://lapor-<client-name>.vercel.app/ | head -5
# OR with custom domain:
curl -s https://app.client-domain.com/ | head -5
```

Record the Vercel URL — you'll need it for the next phase.

---

## Phase 9: Configure Auth Redirect URLs

The Supabase auth service needs to know which URLs are allowed for redirects after login/signup.

```bash
ssh root@<VPS_IP>
cd /root/supabase/docker
nano .env
```

Update:
```env
SITE_URL=https://app.client-domain.com
ADDITIONAL_REDIRECT_URLS=https://app.client-domain.com,https://lapor-<client-name>.vercel.app
```

> Include both custom domain AND Vercel `.vercel.app` URL for safety.

Restart auth:
```bash
docker compose restart auth --no-deps
```

---

## Phase 10: WhatsApp Webhook Registration

> Identical to Option A Phase 8, but now you **must** use the HTTPS domain URL.

The webhook URL is:
```
https://api.client-domain.com/functions/v1/<webhook-name>
```

Replace `<webhook-name>` with:
- **Fonnte**: `fonnte-webhook`
- **WhatsApp Cloud (Meta)**: `whatsapp-cloud-webhook`
- **Infobip**: `infobip-webhook`

Register in the provider's dashboard:

**Fonnte:**
1. Go to https://md.fonnte.com → Select device
2. Set webhook URL: `https://api.client-domain.com/functions/v1/fonnte-webhook`

**WhatsApp Cloud (Meta):**
1. Go to https://developers.facebook.com → Your App → WhatsApp → Configuration
2. Set Callback URL: `https://api.client-domain.com/functions/v1/whatsapp-cloud-webhook`
3. Set Verify Token: must match `verify_token` in `whatsapp_cloud_config` table
4. Subscribe to: `messages`

**Infobip:**
1. Go to Infobip portal → Channels → WhatsApp
2. Set webhook URL: `https://api.client-domain.com/functions/v1/infobip-webhook`

### Test Webhook

```bash
# Send a WhatsApp message to the configured number, then:
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose logs functions --tail=50 -f"
```

---

## Phase 11: Verification & Smoke Tests

Use the [CHECKLIST-B.md](./CHECKLIST-B.md) for a complete walkthrough.

**Quick smoke test:**

```bash
# 1. API health check (via HTTPS)
curl https://api.client-domain.com/rest/v1/ -H "apikey: <ANON_KEY>"

# 2. Edge function check
curl https://api.client-domain.com/functions/v1/get-webhook-errors \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"

# 3. Frontend loads (via Vercel)
curl -s https://app.client-domain.com/ | head -5
```

Then manually test:
1. Open `https://app.client-domain.com` → Sign in as admin
2. Check `/admin/dashboard` loads with data
3. Submit a test report at `/lapor`
4. Track it at `/lacak/<ticket_id>`
5. Send a WhatsApp message → verify it appears in `/admin/conversations`
6. Reply from dashboard → verify it arrives on WhatsApp

---

## Troubleshooting

### Mixed content errors in browser console

**Symptom**: Browser console shows `Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource 'http://...'`

**Cause**: Frontend is on Vercel (HTTPS) but `.env` has `http://` Supabase URL.

**Fix**: Ensure `VITE_SUPABASE_URL` in Vercel uses `https://` — redeploy after changing.

### CORS errors

**Symptom**: Browser console shows `Access-Control-Allow-Origin` errors.

**Cause**: Supabase Kong gateway isn't allowing the Vercel domain.

**Fix**: Supabase Docker's Kong allows all origins by default. If you've customized CORS, ensure the Vercel domain is in the allowed list. Check:
```bash
ssh root@<VPS_IP>
docker exec supabase-kong env | grep CORS
```

### Vercel deployment fails

1. Check Vercel build logs in the Vercel dashboard
2. Ensure all `VITE_*` environment variables are set in Vercel project settings
3. Verify the build command is `npm run build` and output directory is `dist`

### SSL certificate not working

```bash
# Check certbot certificate status
ssh root@<VPS_IP> "certbot certificates"

# Test SSL
curl -vI https://api.client-domain.com 2>&1 | grep -E "(SSL|certificate|subject)"

# Renew manually if expired
ssh root@<VPS_IP> "certbot renew --force-renewal"
```

### Auth redirect fails after login

1. Check `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` in Supabase Docker `.env`
2. Both Vercel URL (`.vercel.app`) and custom domain must be listed
3. After updating, restart auth: `docker compose restart auth --no-deps`

### For backend troubleshooting (Phases 1-6)

See [OPTION-A-SELF-HOSTED.md — Troubleshooting](./OPTION-A-SELF-HOSTED.md#troubleshooting) — all backend troubleshooting applies to both options.

---

## Maintenance

### Updating Edge Functions

```bash
git pull origin staging
./deployment/scripts/deploy-functions.sh --host <VPS_IP> --user root --path /root/supabase/docker
```

### Applying New Migrations

```bash
git pull origin staging
node deployment/scripts/apply-migrations.mjs --url https://api.client-domain.com --key <SERVICE_ROLE_KEY>
```

### Updating the Frontend

**No SSH or SCP needed!** Just push to the branch that Vercel is watching:

```bash
git push origin main
# OR: git push origin client-<name>
```

Vercel auto-builds and deploys. Check the Vercel dashboard for build status.

### SSL Certificate Renewal

Let's Encrypt certificates expire every 90 days. Certbot sets up auto-renewal, but verify:

```bash
ssh root@<VPS_IP> "systemctl list-timers | grep certbot"
# Should show certbot.timer is active

# Test renewal (dry run)
ssh root@<VPS_IP> "certbot renew --dry-run"
```

### Database Backups

Same as Option A:
```bash
ssh root@<VPS_IP>
docker exec supabase-db pg_dump -U postgres postgres > /root/backups/lapor_$(date +%Y%m%d).sql
```

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Supabase API | `https://api.client-domain.com` |
| Supabase Studio | `https://api.client-domain.com` (login with dashboard credentials) |
| Lapor Frontend | `https://app.client-domain.com` (or `https://lapor-<client>.vercel.app`) |

### Environment Variables

| Where | Variable | Value |
|-------|----------|-------|
| Vercel (lapor) | `VITE_SUPABASE_URL` | `https://api.client-domain.com` |
| Vercel (lapor) | `VITE_SUPABASE_PUBLISHABLE_KEY` | `<ANON_KEY>` |
| Vercel (lapor) | `VITE_WEBHOOK_BASE_URL` | `https://api.client-domain.com` |
| Docker `.env` (VPS) | `JWT_SECRET` | Generated in Phase 1 |
| Docker `.env` (VPS) | `ANON_KEY` | Generated in Phase 1 |
| Docker `.env` (VPS) | `SERVICE_ROLE_KEY` | Generated in Phase 1 |
| Docker `.env` (VPS) | `API_EXTERNAL_URL` | `https://api.client-domain.com` |
| Docker `.env` (VPS) | `SITE_URL` | `https://app.client-domain.com` |
| Docker `.env` (VPS) | `ADDITIONAL_REDIRECT_URLS` | Vercel URLs (comma-separated) |
| `.env.functions` (VPS) | `SUPABASE_PUBLIC_URL` | `https://api.client-domain.com` |

### Key Commands

```bash
# Apply migrations
node deployment/scripts/apply-migrations.mjs --url https://api.client-domain.com --key <SERVICE_ROLE_KEY>

# Deploy edge functions
./deployment/scripts/deploy-functions.sh --host <VPS_IP> --user root --path /root/supabase/docker

# Update frontend (just push!)
git push origin main

# View edge function logs
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose logs functions --tail=50 -f"

# Check SSL certificate
ssh root@<VPS_IP> "certbot certificates"

# Restart Supabase services
ssh root@<VPS_IP> "cd /root/supabase/docker && docker compose restart <service> --no-deps"
```

### DNS Records Needed

| Record | Name | Value |
|--------|------|-------|
| A | `api.client-domain.com` | `<VPS_IP>` |
| CNAME | `app.client-domain.com` | `cname.vercel-dns.com` |
