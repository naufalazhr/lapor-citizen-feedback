# Option C: Single-Domain VPS Deployment (Frontend + Backend)

> Deploy both the React frontend and Supabase backend on the **same VPS**, served through a **single domain** with path-based routing. Uses **Nginx Proxy Manager** (Docker) for reverse proxy + automatic Let's Encrypt SSL.

**When to use this option**: When the client's VPS has a public IP and you want maximum performance — no Cloudflare Tunnel, no Vercel, everything on one machine.

---

## Architecture

```
User's browser
  |
  +-- https://laporkangds.bandungkab.go.id
        |
        v
      Nginx Proxy Manager (Docker, port 80/443, Let's Encrypt SSL)
        |
        +-- /rest/v1/*       --> host:8000 (Supabase Kong)
        +-- /auth/v1/*       --> host:8000
        +-- /storage/v1/*    --> host:8000
        +-- /functions/v1/*  --> host:8000
        +-- /realtime/v1/*   --> host:8000 (WebSocket)
        |
        +-- /* (catch-all)   --> host:3000 (Frontend Docker nginx)
```

```
VPS (single machine, static public IP: 103.254.164.169)
|
+-- Nginx Proxy Manager (Docker, ports 80/443/81)
|   +-- SSL termination (Let's Encrypt auto-renewal)
|   +-- Path-based reverse proxy routing
|   +-- Admin UI on port 81 (VPN-only access)
|
+-- Docker: lapor-frontend (nginx:1.25-alpine, port 3000)
|   +-- Serves static dist/ files (React SPA)
|   +-- SPA fallback (try_files -> index.html)
|
+-- Docker: Supabase stack (port 8000)
    +-- Kong (API gateway)
    +-- PostgREST, GoTrue, Storage, Realtime
    +-- Edge Functions (Deno runtime)
    +-- PostgreSQL
```

### Why This Is Faster Than Vercel + Cloudflare Tunnel

| Metric | Old (Vercel + CF Tunnel) | New (Single-Domain VPS) |
|--------|--------------------------|------------------------|
| Frontend load | Vercel CDN (overseas) | Same VPS (local to users) |
| API call path | Browser -> Cloudflare edge -> Tunnel -> VPS | Browser -> VPS nginx -> localhost:8000 |
| CORS | Cross-origin (Vercel != CF domain) | Same-origin (no CORS needed) |
| SSL hops | 2 (Vercel SSL + CF Tunnel SSL) | 1 (single Let's Encrypt cert) |
| Points of failure | 3 (Vercel, Cloudflare, VPS) | 1 (VPS only) |

### Key Insight: Browser-Based API Calls

The React SPA is a **static bundle** served to the user's browser. All Supabase API calls happen **from the browser**, not server-to-server. So even though frontend and Supabase are on the same VPS, the browser still needs a public URL.

With single-domain routing, nginx routes API paths (`/rest/v1/`, `/auth/v1/`, etc.) to Supabase internally via localhost — no external network hops.

---

## Prerequisites

Before starting, ensure you have:

- [ ] VPS with Docker and Docker Compose installed
- [ ] Supabase Docker stack running on port 8000
- [ ] VPS has a **static public IP**
- [ ] SSH access to VPS (direct or via VPN)
- [ ] DNS A record pointing your domain to the VPS public IP
- [ ] Ports 80 and 443 open on VPS firewall/security group
- [ ] Phases 1-6 from [OPTION-A-SELF-HOSTED.md](OPTION-A-SELF-HOSTED.md) completed (Supabase setup, migrations, edge functions, secrets, storage, tenant)

---

## Step 1: DNS Record

Ask your DNS administrator to create an A record:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `<subdomain>` | `<VPS_PUBLIC_IP>` | 300 |

**Example**: `laporkangds.bandungkab.go.id` -> `103.254.164.169`

Verify propagation:
```bash
# From any machine with internet
dig <your-domain>
# or use https://dnschecker.org
```

Wait for global propagation (usually 5-30 minutes) before proceeding to SSL setup.

---

## Step 2: Check Port Availability on VPS

```bash
# SSH into VPS
ssh -p <PORT> <USER>@<VPS_IP>

# Check if port 80 or 443 is already in use
sudo ss -tlnp | grep ':80'
sudo ss -tlnp | grep ':443'
```

**If ports are free**: proceed to Step 3.

**If Supabase Kong is using port 80**: Edit Supabase's `docker-compose.yml` to remove the port 80 binding (keep only 8000). Kong should only need port 8000 since NPM will handle external traffic.

---

## Step 3: Install Nginx Proxy Manager

```bash
# Create directory
sudo mkdir -p /opt/nginx-proxy-manager
cd /opt/nginx-proxy-manager

# Create docker-compose.yml
sudo tee docker-compose.yml > /dev/null << 'COMPOSE_EOF'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"       # HTTP (public)
      - "443:443"     # HTTPS (public)
      - "81:81"       # Admin UI (restrict to VPN/internal only)
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - proxy-net

networks:
  proxy-net:
    driver: bridge
COMPOSE_EOF

# Start NPM
sudo docker compose up -d

# Verify it's running
sudo docker ps | grep nginx-proxy-manager
```

### First Login

Open the admin UI (via VPN or internal network): `http://<VPS_INTERNAL_IP>:81`

- Default email: `admin@example.com`
- Default password: `changeme`
- **Change these immediately on first login!**

> **Security**: Port 81 (admin UI) should only be accessible via VPN or internal network. Consider adding a firewall rule to block port 81 from public access:
> ```bash
> sudo ufw deny from any to any port 81
> sudo ufw allow from 10.0.0.0/8 to any port 81    # Allow VPN range
> ```

---

## Step 4: Configure NPM — Proxy Host + Path Routing

### 4a. Create Proxy Host

In the NPM Admin UI:

1. Go to **Proxy Hosts** -> **Add Proxy Host**
2. **Details tab**:
   - **Domain Names**: `<your-domain>` (e.g., `laporkangds.bandungkab.go.id`)
   - **Scheme**: `http`
   - **Forward Hostname / IP**: `172.17.0.1` (Docker bridge gateway — see note below)
   - **Forward Port**: `3000`
   - **Cache Assets**: ON
   - **Block Common Exploits**: ON
   - **Websockets Support**: ON
3. **SSL tab**:
   - **SSL Certificate**: Request a new SSL Certificate
   - **Force SSL**: ON
   - **HTTP/2 Support**: ON
   - **Email Address**: your email for Let's Encrypt notifications
   - **I Agree to the Let's Encrypt Terms of Service**: check
   - Click **Save**

> **Finding Docker bridge gateway IP**: If `172.17.0.1` doesn't work:
> ```bash
> docker network inspect bridge | grep Gateway
> ```
> Use whatever IP is shown. Common values: `172.17.0.1`, `172.18.0.1`.
>
> **Alternative**: Use the VPS's internal/VPN IP (e.g., `10.87.0.14`) instead.

### 4b. Add Custom Nginx Config for Supabase API Paths

After saving the proxy host:

1. Click the **three dots menu** -> **Edit**
2. Go to the **Advanced** tab
3. Paste the following in the **Custom Nginx Configuration** box:

```nginx
# ============================================================
# Supabase API path routing
# Routes Supabase-specific paths to Kong (port 8000)
# while the default location / routes to frontend (port 3000)
#
# CRITICAL: Use ^~ prefix modifier on ALL location blocks!
# Without ^~, NPM's built-in assets.conf regex
#   location ~* ^.*\.(css|js|jpe?g|gif|png|...)$
# will intercept .jpg/.css/.js requests on Supabase paths
# (e.g., /storage/v1/...image.jpg) and route them to the
# frontend (port 3000) instead of Supabase (port 8000),
# causing 404 errors on storage images and other assets.
#
# The ^~ modifier tells nginx: "if this prefix matches,
# do NOT check regex locations — use this block."
# ============================================================

# PostgREST API
location ^~ /rest/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# GoTrue Authentication
location ^~ /auth/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Storage API (file uploads/downloads)
location ^~ /storage/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50M;
}

# Edge Functions (Deno runtime)
location ^~ /functions/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}

# Realtime (WebSocket subscriptions)
location ^~ /realtime/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400s;
}
```

4. Click **Save**

> **Important**: Replace `172.17.0.1` with your Docker bridge gateway IP if different. All five location blocks must use the same IP.
>
> **Do NOT use Custom Locations tab** for these routes. Custom Locations don't support the `^~` modifier and will be overridden by NPM's built-in asset caching regex (`assets.conf`), causing 404 errors on storage images. Always use the **Advanced** tab with the `^~` config above.

### 4c. Verify Routing

```bash
# Test frontend (should return HTML)
curl -sI https://<your-domain>/ | head -5

# Test Supabase API (should return JSON, not 404)
curl -s https://<your-domain>/rest/v1/ \
  -H "apikey: <ANON_KEY>" | head -20

# Test auth endpoint
curl -s https://<your-domain>/auth/v1/settings

# Test edge function
curl -s https://<your-domain>/functions/v1/get-webhook-errors
```

---

## Step 5: Deploy Frontend Docker Container

### 5a. Update `.env.client` (On Your Local Machine)

Before building, update `.env.client` with the new domain:

```env
VITE_SUPABASE_URL=https://<your-domain>
VITE_SUPABASE_PUBLISHABLE_KEY=<your_anon_key>
VITE_WEBHOOK_BASE_URL=https://<your-domain>
```

**Example**:
```env
VITE_SUPABASE_URL=https://laporkangds.bandungkab.go.id
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6...
VITE_WEBHOOK_BASE_URL=https://laporkangds.bandungkab.go.id
```

> **Critical**: `VITE_SUPABASE_URL` is the **same domain** as the frontend. The Supabase JS client automatically appends `/rest/v1/`, `/auth/v1/`, etc. Nginx routes these to Supabase.
>
> `VITE_*` variables are baked into the `dist/` bundle at build time. You **must** set them before running the build.

### 5b. Build & Deploy

**Option A — Using deployment script** (recommended):
```bash
./deployment/scripts/deploy-frontend.sh \
  --host <VPS_INTERNAL_IP> \
  --user <SSH_USER> \
  --port <SSH_PORT> \
  --path /opt/lapor \
  --mode client
```

**Example**:
```bash
./deployment/scripts/deploy-frontend.sh \
  --host 10.87.0.14 \
  --user supabase14 \
  --port 49306 \
  --path /opt/lapor \
  --mode client
```

This script:
1. Builds `dist/` locally using `.env.client` variables
2. SCPs `dist/` to VPS at `/opt/lapor/lapor-citizen-feedback/dist/`
3. SCPs `docker-compose.frontend.yml` and nginx config
4. Creates `.env` with `LAPOR_DIST_PATH` and `LAPOR_PORT`
5. Starts the `lapor-frontend` container on port 3000

**Option B — Manual (SCP)**:
```bash
# 1. Build locally
npm run build:client

# 2. Copy files to VPS
scp -P <SSH_PORT> -r dist/ <USER>@<VPS_IP>:/opt/lapor/lapor-citizen-feedback/dist/
scp -P <SSH_PORT> deployment/docker/frontend/docker-compose.frontend.yml <USER>@<VPS_IP>:/opt/lapor/frontend/
scp -P <SSH_PORT> -r deployment/docker/frontend/nginx/ <USER>@<VPS_IP>:/opt/lapor/frontend/nginx/

# 3. On VPS: create .env and start container
ssh -p <SSH_PORT> <USER>@<VPS_IP>

cat > /opt/lapor/frontend/.env << 'EOF'
LAPOR_DIST_PATH=/opt/lapor/lapor-citizen-feedback/dist
LAPOR_PORT=3000
EOF

cd /opt/lapor/frontend
docker compose --env-file .env up -d
```

**Option C — Manual (SFTP via Termius)**:

If SCP/SSH key auth isn't set up, use Termius SFTP:

1. Build locally: `npm run build:client`
2. On VPS terminal, create directories and set permissions:
   ```bash
   sudo mkdir -p /opt/lapor/lapor-citizen-feedback/dist
   sudo mkdir -p /opt/lapor/frontend/nginx
   sudo chown -R <USER>:<USER> /opt/lapor
   ```
3. In Termius SFTP panel:
   - Upload contents of local `dist/` → remote `/opt/lapor/lapor-citizen-feedback/dist/`
   - Upload `deployment/docker/frontend/docker-compose.frontend.yml` → remote `/opt/lapor/frontend/`
   - Upload `deployment/docker/frontend/nginx/lapor.conf` → remote `/opt/lapor/frontend/nginx/`
4. On VPS terminal, create `.env` and start container (same as Option B step 3)

### 5c. Verify Frontend Container

```bash
# On VPS
docker ps | grep lapor-frontend

# Test directly (bypassing nginx)
curl -sI http://localhost:3000/ | head -5
# Should return: HTTP/1.1 200 OK
```

---

## Step 6: Update Supabase Docker Environment

SSH into VPS and edit the Supabase Docker `.env`:

```bash
nano /root/supabase/docker/.env
```

Update these variables to use the new domain:

```env
# Auth redirect URL (where login redirects back to)
SITE_URL=https://<your-domain>

# Public-facing API URL (used by GoTrue for email links, etc.)
API_EXTERNAL_URL=https://<your-domain>

# Allowed auth callback URLs
ADDITIONAL_REDIRECT_URLS=https://<your-domain>,https://<your-domain>/**
```

Also update edge function secrets:

```bash
nano /root/supabase/docker/.env.functions
```

```env
# Used by edge functions to construct public URLs (e.g., attachment URLs)
SUPABASE_PUBLIC_URL=https://<your-domain>
```

**Restart Supabase** to apply changes:

```bash
cd /root/supabase/docker
docker compose down && docker compose up -d
```

> **Transition period**: To keep both old and new domains working during migration, include both in `ADDITIONAL_REDIRECT_URLS`:
> ```env
> ADDITIONAL_REDIRECT_URLS=https://<new-domain>,https://<new-domain>/**,https://<old-domain>,https://<old-domain>/**
> ```

---

## Step 7: Update `index.html` OG Image URLs

In the codebase, update [index.html](../../index.html) (lines 13, 19):

```html
<!-- Change FROM -->
<meta property="og:image" content="https://lapor.pimpinan.com/og-image.png" />
<meta name="twitter:image" content="https://lapor.pimpinan.com/og-image.png" />

<!-- Change TO -->
<meta property="og:image" content="https://<your-domain>/og-image.png" />
<meta name="twitter:image" content="https://<your-domain>/og-image.png" />
```

After editing, **rebuild and redeploy** (repeat Step 5b).

---

## Step 8: Re-register Webhook URLs

Update webhook URLs in your WhatsApp provider dashboard(s):

| Provider | New Webhook URL |
|----------|----------------|
| Fonnte | `https://<your-domain>/functions/v1/fonnte-webhook` |
| WhatsApp Cloud (Meta) | `https://<your-domain>/functions/v1/whatsapp-cloud-webhook` |
| Infobip | `https://<your-domain>/functions/v1/infobip-webhook` |

The admin dashboard (Integration page) will auto-display these URLs based on `VITE_WEBHOOK_BASE_URL`.

---

## Step 9: Transition — Decommission Old Setup

Once the new domain is verified working:

### Disable Cloudflare Tunnel (if previously used)

```bash
# On VPS — try both service names (varies by installation method)
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared
# If that doesn't work, try:
sudo systemctl stop cloudflared-tunnel
sudo systemctl disable cloudflared-tunnel

# Verify it's gone (only the grep line itself should appear)
ps aux | grep cloudflare

# Optional: remove tunnel
cloudflared tunnel delete lapor-client
```

### Disable Vercel Deployment (if previously used)

- Remove or archive the Vercel project
- Or just disconnect the git integration

### Clean Up DNS

- Remove old CNAME/A records for the previous domain (e.g., in Cloudflare dashboard)

---

## Verification Checklist

Run through all of these to confirm the deployment is working:

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | `https://<your-domain>/` | Dashboard login page loads |
| 2 | `https://<your-domain>/rest/v1/` with apikey header | Supabase PostgREST JSON response |
| 3 | `https://<your-domain>/auth/v1/settings` | GoTrue settings JSON |
| 4 | `https://<your-domain>/functions/v1/get-webhook-errors` | Edge function response |
| 5 | Login with admin credentials | Auth works, redirects to dashboard |
| 6 | Submit a test report via `/lapor` | Report saved, gets ticket ID |
| 7 | Admin -> Integration page | Webhook URLs show new domain |
| 8 | Send test WhatsApp message | Webhook reaches edge function |
| 9 | `docker ps` on VPS | Both `lapor-frontend` and Supabase containers running |
| 10 | `http://<VPS_INTERNAL_IP>:8000` via VPN | Supabase Studio accessible |
| 11 | `http://<VPS_INTERNAL_IP>:81` via VPN | NPM admin UI accessible |
| 12 | Check SSL cert expiry | Valid, auto-renewal configured |

---

## Redeployment — Updating Code on VPS

When you make code changes locally and need to update the deployed frontend:

### Frontend Update (Most Common)

**1. Build locally:**
```bash
npm run build:client
```

**2. Upload the new `dist/` folder to VPS:**

**Option A — SCP** (if SSH key auth is set up):
```bash
scp -P <SSH_PORT> -r dist/* <USER>@<VPS_IP>:/opt/lapor/lapor-citizen-feedback/dist/
```

**Option B — SFTP via Termius**:
1. Open SFTP tab in Termius
2. Local side: navigate to `<project>/dist/`
3. Remote side: navigate to `/opt/lapor/lapor-citizen-feedback/dist/`
4. Delete old files on remote, then upload all new files (including `assets/` folder)

**3. Restart the frontend container on VPS:**
```bash
docker restart lapor-frontend
```

> **Note**: The frontend container mounts `dist/` as a volume, so you only need to replace the files and restart — no Docker image rebuild needed.

### Edge Function Update

When you modify edge functions in `supabase/functions/`:

**Option A — SSH-based script** (recommended):
```bash
./deployment/scripts/deploy-functions.sh \
  --host <VPS_INTERNAL_IP> \
  --user <SSH_USER> \
  --port <SSH_PORT> \
  --path <SUPABASE_DOCKER_PATH>
```

**Option B — Manual SFTP**:
1. Upload the modified function folder(s) from `supabase/functions/<function-name>/` to the VPS
2. Copy into the Supabase Docker volumes directory
3. Restart the edge functions container:
   ```bash
   cd <SUPABASE_DOCKER_PATH>
   docker compose up -d --force-recreate functions
   ```

### Database Migration Update

When you add new SQL migrations in `supabase/migrations/`:

```bash
# From VPS
node deployment/scripts/apply-migrations.mjs \
  --url http://localhost:8000 \
  --key <SERVICE_ROLE_KEY>
```

Or from your local machine (if VPS is reachable):
```bash
node deployment/scripts/apply-migrations.mjs \
  --url https://<your-domain> \
  --key <SERVICE_ROLE_KEY>
```

### Full Redeployment Checklist

Use this when doing a major update that touches multiple areas:

- [ ] Build frontend: `npm run build:client`
- [ ] Upload `dist/` to VPS
- [ ] Restart frontend: `docker restart lapor-frontend`
- [ ] Upload modified edge functions to VPS
- [ ] Restart edge functions: `docker compose up -d --force-recreate functions`
- [ ] Apply new migrations: `node deployment/scripts/apply-migrations.mjs --url ... --key ...`
- [ ] Restart Supabase (if `.env` changed): `docker compose down && docker compose up -d`
- [ ] Verify: login, submit report, check WhatsApp webhook, check storage images

---

## Troubleshooting

### curl from VPS hangs when testing public domain

- **Cause**: "Hairpin NAT" — the VPS can't reach itself via its own public domain. This is normal and does NOT affect real users.
- **Fix**: This is not a problem. Test API endpoints from the VPS using `localhost:8000` or `172.17.0.1:8000` instead. Test the public domain from your local machine's browser or PowerShell.

### NPM can't get SSL certificate

- **Cause**: DNS not propagated, or ports 80/443 blocked by firewall
- **Fix**: Verify DNS with `dig <domain>`, check firewall with `sudo ufw status` or cloud security groups

### 502 Bad Gateway on API paths

- **Cause**: NPM can't reach Supabase on port 8000 via Docker bridge
- **Fix**: Check Docker bridge IP:
  ```bash
  docker network inspect bridge | grep Gateway
  ```
  Update the IP in NPM Advanced config. Try `172.17.0.1`, `172.18.0.1`, or the VPS internal IP.

### 502 Bad Gateway on frontend (/)

- **Cause**: Frontend container not running on port 3000
- **Fix**:
  ```bash
  docker ps | grep lapor-frontend
  # If not running:
  cd /opt/lapor/frontend
  docker compose --env-file .env up -d
  ```

### Auth redirects to wrong URL

- **Cause**: `SITE_URL` or `ADDITIONAL_REDIRECT_URLS` not updated in Supabase `.env`
- **Fix**: Update and restart Supabase:
  ```bash
  cd /root/supabase/docker
  docker compose down && docker compose up -d
  ```

### Storage images return 404 (nginx/1.25.5 or openresty)

- **Cause**: NPM's built-in `assets.conf` includes a regex `location ~*` that matches all `.jpg`, `.png`, `.css`, `.js` files. Nginx regex locations take priority over plain prefix locations. So `/storage/v1/...image.jpg` matches the asset regex and gets routed to the frontend (port 3000) instead of Supabase (port 8000).
- **Symptoms**: 404 from `nginx/1.25.5` (frontend) or `openresty` (NPM) when accessing storage URLs. API and auth work fine because those paths don't serve files with image/css/js extensions.
- **Fix**: Use `^~` modifier on ALL location blocks in the Advanced tab (not Custom Locations). The `^~` tells nginx to skip regex matching when the prefix matches. See Step 4b for the correct config.
- **How to verify**: Compare headers — a correct response has `Via: kong/2.8.1` and `Server` is absent. A wrong response has `Server: openresty` or `Server: nginx/1.25.5`.

### Attachments show broken image URLs

- **Cause**: `SUPABASE_PUBLIC_URL` not set in `.env.functions`
- **Fix**: Set `SUPABASE_PUBLIC_URL=https://<your-domain>` and restart functions:
  ```bash
  docker compose up -d --force-recreate functions
  ```

### WebSocket connection fails (Realtime)

- **Cause**: Missing WebSocket headers in nginx config
- **Fix**: Ensure the `/realtime/v1/` location block has `proxy_http_version 1.1`, `Upgrade`, and `Connection "upgrade"` headers. Also ensure **Websockets Support** is ON in NPM proxy host settings.

### Edge functions timeout

- **Cause**: Default nginx proxy timeout (60s) too short for AI analysis
- **Fix**: The `/functions/v1/` location block should have `proxy_read_timeout 120s`

### Supabase Studio publicly accessible

- **Concern**: Studio should NOT be accessible via the public domain
- **Fix**: Studio is served at `/` on port 8000. Since NPM routes `/` to the frontend (port 3000), Studio is NOT publicly exposed. Access via VPN only: `http://<VPS_INTERNAL_IP>:8000`

---

## Quick Reference

### Docker Containers on VPS

| Container | Image | Port | Purpose |
|-----------|-------|------|---------|
| `nginx-proxy-manager` | `jc21/nginx-proxy-manager:latest` | 80, 443, 81 | Reverse proxy + SSL |
| `lapor-frontend` | `nginx:1.25-alpine` | 3000 | Serves React SPA |
| Supabase stack | Various | 8000 | API gateway + all services |

### Key Files on VPS

| Path | Purpose |
|------|---------|
| `/opt/nginx-proxy-manager/docker-compose.yml` | NPM Docker config |
| `/opt/nginx-proxy-manager/data/` | NPM data (configs, certs DB) |
| `/opt/nginx-proxy-manager/letsencrypt/` | SSL certificates |
| `/opt/lapor/frontend/docker-compose.frontend.yml` | Frontend Docker config |
| `/opt/lapor/frontend/.env` | Frontend env (dist path, port) |
| `/opt/lapor/lapor-citizen-feedback/dist/` | Built frontend files |
| `/root/supabase/docker/.env` | Supabase env (SITE_URL, etc.) |
| `/root/supabase/docker/.env.functions` | Edge function secrets |

### Key Files in This Repo (Local)

| Path | Purpose |
|------|---------|
| `.env.client` | Vite build env vars (VITE_SUPABASE_URL, etc.) |
| `index.html` | OG image URLs (update per deployment) |
| `deployment/docker/frontend/docker-compose.frontend.yml` | Frontend Docker template |
| `deployment/docker/frontend/nginx/lapor.conf` | Inner nginx SPA config |
| `deployment/scripts/deploy-frontend.sh` | SSH-based deploy script |

### Useful Commands

```bash
# Check all containers
docker ps

# View NPM logs
docker logs nginx-proxy-manager -f

# View frontend container logs
docker logs lapor-frontend -f

# Restart frontend after new build
cd /opt/lapor/frontend
docker compose --env-file .env up -d --force-recreate

# Restart Supabase
cd /root/supabase/docker
docker compose down && docker compose up -d

# Restart only edge functions (after secret changes)
cd /root/supabase/docker
docker compose up -d --force-recreate functions

# Check SSL cert status (via NPM admin UI)
# http://<VPS_INTERNAL_IP>:81 -> SSL Certificates
```
