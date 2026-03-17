# Client Deployment Checklist — Option C (Single-Domain VPS)

> Print this page and check off each item as you complete it.
> For detailed instructions, see [OPTION-C-SINGLE-DOMAIN-VPS.md](./OPTION-C-SINGLE-DOMAIN-VPS.md).

---

## Client Info (Fill In)

| Field | Value |
|-------|-------|
| Client name | `____________` |
| Domain | `____________` (e.g., `laporkangds.bandungkab.go.id`) |
| VPS public IP | `____________` (e.g., `103.254.164.169`) |
| VPS VPN IP | `____________` (e.g., `10.87.0.145`) |
| SSH port | `____________` (e.g., `49306`) |
| SSH user | `____________` (e.g., `supabase14`) |
| Supabase Docker path on VPS | `____________` (e.g., `~/lapor-kabbandung`) |
| ANON_KEY | `____________` (from Supabase Docker `.env`) |
| WhatsApp provider | Fonnte / WA Cloud / Infobip |
| Flowise URL (AI chatbot) | `____________` |
| OpenRouter API key (AI insight) | `____________` |

---

## Pre-Deployment Prerequisites

- [ ] Phases 1-6 from [OPTION-A-SELF-HOSTED.md](./OPTION-A-SELF-HOSTED.md) completed:
  - [ ] Supabase Docker running on port 8000
  - [ ] Migrations applied
  - [ ] Edge functions deployed
  - [ ] Secrets configured (`.env.functions`)
  - [ ] Storage buckets created
  - [ ] Tenant record created
- [ ] VPN connected and SSH access working
- [ ] DNS A record created: `<domain>` -> `<VPS_PUBLIC_IP>`
- [ ] DNS propagated (check: `dig <domain>` or https://dnschecker.org)
- [ ] Ports 80 and 443 open on VPS firewall

---

## Step 1: Check Port Availability

```bash
ssh -p <SSH_PORT> <USER>@<VPN_IP>
sudo ss -tlnp | grep ':80'
sudo ss -tlnp | grep ':443'
```

- [ ] Port 80 is free (only 8000 should be in use)
- [ ] Port 443 is free

---

## Step 2: Install Nginx Proxy Manager

```bash
sudo mkdir -p /opt/nginx-proxy-manager
cd /opt/nginx-proxy-manager

sudo tee docker-compose.yml > /dev/null << 'COMPOSE_EOF'
services:
  npm:
    image: jc21/nginx-proxy-manager:latest
    container_name: nginx-proxy-manager
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
      - "81:81"
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
    networks:
      - proxy-net

networks:
  proxy-net:
    driver: bridge
COMPOSE_EOF

sudo docker compose up -d
```

- [ ] NPM container running: `docker ps | grep nginx-proxy-manager`
- [ ] Admin UI accessible: `http://<VPN_IP>:81`
- [ ] Default credentials changed (was `admin@example.com` / `changeme`)

---

## Step 3: Get Docker Bridge Gateway IP

```bash
docker network inspect bridge | grep Gateway
```

- [ ] Gateway IP noted: `____________` (usually `172.17.0.1`)

---

## Step 4: Configure NPM Proxy Host

In NPM Admin UI (`http://<VPN_IP>:81`):

### 4a. Create Proxy Host

- [ ] Go to **Hosts** -> **Proxy Hosts** -> **Add Proxy Host**
- [ ] **Details tab**:
  - Domain Names: `<domain>`
  - Scheme: `http`
  - Forward Hostname/IP: `<GATEWAY_IP>` (e.g., `172.17.0.1`)
  - Forward Port: `3000`
  - Cache Assets: ON
  - Block Common Exploits: ON
  - Websockets Support: ON
- [ ] **SSL tab**:
  - SSL Certificate: Request a new SSL Certificate
  - Force SSL: ON
  - HTTP/2 Support: ON
- [ ] Saved — status shows **Online** with **Let's Encrypt** SSL

### 4b. Add Supabase API Path Routing

- [ ] Edit proxy host -> **Advanced tab** (gear icon)
- [ ] Paste the following config (replace `172.17.0.1` with your gateway IP if different):

```nginx
# CRITICAL: Use ^~ on ALL location blocks!
# Without ^~, NPM's assets.conf regex intercepts .jpg/.css/.js
# requests and routes them to frontend instead of Supabase.
# Do NOT use Custom Locations tab — it doesn't support ^~.

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

# Storage API
location ^~ /storage/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 50M;
}

# Edge Functions
location ^~ /functions/v1/ {
    proxy_pass http://172.17.0.1:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
}

# Realtime (WebSocket)
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

- [ ] Saved successfully

---

## Step 5: Update `.env.client` (Local Machine)

Edit `.env.client` in the repo root:

```env
VITE_SUPABASE_URL=https://<domain>
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_WEBHOOK_BASE_URL=https://<domain>
```

- [ ] `VITE_SUPABASE_URL` set to `https://<domain>`
- [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` set to client's ANON_KEY
- [ ] `VITE_WEBHOOK_BASE_URL` set to `https://<domain>`

---

## Step 6: Update `index.html` OG Image URLs (Local Machine)

In `index.html` (lines 13 and 19), update:

```html
<meta property="og:image" content="https://<domain>/og-image.png" />
<meta name="twitter:image" content="https://<domain>/og-image.png" />
```

- [ ] Both OG image URLs updated

---

## Step 7: Build & Deploy Frontend

### 7a. Build locally

```bash
npm run build:client
```

- [ ] Build succeeds (creates `dist/` folder)

### 7b. Upload to VPS

**Option A — Deploy script** (if SSH key auth works):
```bash
./deployment/scripts/deploy-frontend.sh \
  --host <VPN_IP> --user <SSH_USER> --port <SSH_PORT> \
  --path /opt/lapor --mode client --skip-build
```

**Option B — Manual via SFTP** (if password auth only):

1. Create directories on VPS:
```bash
sudo mkdir -p /opt/lapor/lapor-citizen-feedback/dist
sudo mkdir -p /opt/lapor/frontend/nginx
sudo chown -R <SSH_USER>:<SSH_USER> /opt/lapor
```

2. Upload via SFTP (e.g., Termius):
   - `dist/*` -> `/opt/lapor/lapor-citizen-feedback/dist/`
   - `deployment/docker/frontend/docker-compose.frontend.yml` -> `/opt/lapor/frontend/`
   - `deployment/docker/frontend/nginx/lapor.conf` -> `/opt/lapor/frontend/nginx/`

3. Create `.env` and start container:
```bash
cat > /opt/lapor/frontend/.env << 'EOF'
LAPOR_DIST_PATH=/opt/lapor/lapor-citizen-feedback/dist
LAPOR_PORT=3000
EOF

cd /opt/lapor/frontend
docker compose --env-file .env -f docker-compose.frontend.yml up -d
```

- [ ] Frontend container running: `docker ps | grep lapor-frontend`
- [ ] Test: `curl -sI http://localhost:3000/` returns `200 OK`

---

## Step 8: Update Supabase Docker Environment

On VPS, edit the Supabase `.env`:

```bash
nano <SUPABASE_DOCKER_PATH>/.env
```

Update these variables:

```env
SITE_URL=https://<domain>
API_EXTERNAL_URL=https://<domain>
ADDITIONAL_REDIRECT_URLS=https://<domain>,https://<domain>/**
SUPABASE_PUBLIC_URL=https://<domain>
```

- [ ] `SITE_URL` updated
- [ ] `API_EXTERNAL_URL` updated
- [ ] `ADDITIONAL_REDIRECT_URLS` updated
- [ ] `SUPABASE_PUBLIC_URL` updated

Also check `.env.functions` if `SUPABASE_PUBLIC_URL` is there instead:

```bash
nano <SUPABASE_DOCKER_PATH>/.env.functions
```

- [ ] `SUPABASE_PUBLIC_URL` set in the correct file

### Restart Supabase

```bash
cd <SUPABASE_DOCKER_PATH>
docker compose down && docker compose up -d
```

- [ ] All Supabase containers healthy: `docker ps`

---

## Step 9: Verify Everything

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1 | Open `https://<domain>/` in browser | Login page loads | [ ] |
| 2 | Open `https://<domain>/auth/v1/settings` | "No API key" (means routing works) | [ ] |
| 3 | Login with admin credentials | Dashboard loads | [ ] |
| 4 | Submit test report via `/lapor` | Report saved with ticket ID | [ ] |
| 5 | Admin -> Integration page | Webhook URLs show new domain | [ ] |
| 6 | `http://<VPN_IP>:8000` via VPN | Supabase Studio accessible | [ ] |
| 7 | `http://<VPN_IP>:81` via VPN | NPM admin UI accessible | [ ] |
| 8 | `docker ps` on VPS | All containers running | [ ] |

> **Note:** `curl` from the VPS to its own public domain may hang (hairpin NAT issue). This is normal — test from your browser instead.

---

## Step 10: Register Webhook URLs

Update webhook URLs in WhatsApp provider dashboard:

| Provider | Webhook URL |
|----------|-------------|
| Fonnte | `https://<domain>/functions/v1/fonnte-webhook` |
| WhatsApp Cloud (Meta) | `https://<domain>/functions/v1/whatsapp-cloud-webhook` |
| Infobip | `https://<domain>/functions/v1/infobip-webhook` |

- [ ] Webhook URL(s) registered in provider dashboard
- [ ] Test: send a WhatsApp message -> check if webhook receives it

---

## Step 11: Decommission Old Setup (If Migrating)

### If Cloudflare Tunnel was running:

```bash
sudo systemctl stop cloudflared
sudo systemctl disable cloudflared
```

- [ ] Tunnel stopped and disabled

### If Vercel was serving frontend:

- [ ] Custom domain removed from Vercel project
- [ ] (Optional) Vercel project archived

---

## Post-Deployment Reference

### Docker Containers on VPS

| Container | Port | Location |
|-----------|------|----------|
| `nginx-proxy-manager` | 80, 443, 81 | `/opt/nginx-proxy-manager/` |
| `lapor-frontend` | 3000 | `/opt/lapor/frontend/` |
| Supabase stack | 8000 | `<SUPABASE_DOCKER_PATH>/` |

### Key Files on VPS

| Path | Purpose |
|------|---------|
| `/opt/nginx-proxy-manager/docker-compose.yml` | NPM Docker config |
| `/opt/lapor/frontend/.env` | Frontend env (dist path, port) |
| `/opt/lapor/frontend/docker-compose.frontend.yml` | Frontend Docker config |
| `/opt/lapor/lapor-citizen-feedback/dist/` | Built frontend files |
| `<SUPABASE_DOCKER_PATH>/.env` | Supabase env (SITE_URL, etc.) |
| `<SUPABASE_DOCKER_PATH>/.env.functions` | Edge function secrets |

### Future Frontend Redeployment

When you need to update the frontend (new features, bug fixes):

```bash
# 1. Build locally
npm run build:client

# 2. Upload dist/ via SFTP to /opt/lapor/lapor-citizen-feedback/dist/

# 3. Restart container on VPS
cd /opt/lapor/frontend
docker compose --env-file .env -f docker-compose.frontend.yml up -d --force-recreate
```

### External Integrations (Unchanged by Deployment)

These external services work the same regardless of deployment option. Just ensure webhook URLs and API keys are correct:

| Integration | What It Does | Config Location |
|-------------|-------------|-----------------|
| **Flowise** (Railway/self-hosted) | AI chatbot for WhatsApp conversations | `flowise_config` table + `FLOWISE_API_URL` in edge function secrets |
| **OpenRouter API** | AI insight generation on dashboard | `pimpinan-insight` key in `.env.functions` |
| **WhatsApp Cloud API (Meta)** | WhatsApp webhook + message sending | `whatsapp_cloud_config` table + Meta developer dashboard |
| **Fonnte** | WhatsApp webhook + message sending | `fonnte_config` table + Fonnte dashboard |
| **Infobip** | WhatsApp webhook + message sending | `infobip_config` table + Infobip dashboard |

### Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Storage images return 404 | Missing `^~` on location blocks | Use Advanced tab config with `^~` prefix (NOT Custom Locations) |
| 502 Bad Gateway on API paths | NPM can't reach Supabase | Check Docker bridge IP: `docker network inspect bridge \| grep Gateway` |
| 502 Bad Gateway on `/` | Frontend container down | `docker ps \| grep lapor-frontend`, restart if needed |
| SSL cert not working | DNS not propagated or port 80 blocked | `dig <domain>`, check firewall |
| Auth redirects to wrong URL | `SITE_URL` not updated | Edit Supabase `.env`, restart |
| Broken attachment URLs | `SUPABASE_PUBLIC_URL` not set | Update in `.env` or `.env.functions`, restart |
| WebSocket fails (Realtime) | Missing upgrade headers | Check NPM Advanced config has `Upgrade`/`Connection` headers |
| `curl` hangs from VPS | Hairpin NAT | Normal — test from browser, not VPS |
