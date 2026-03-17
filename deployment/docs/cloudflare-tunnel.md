# Cloudflare Tunnel — Expose VPS Supabase to the Internet

> Make your self-hosted Supabase (on a VPN-only VPS) publicly reachable via a secure Cloudflare Tunnel.
> Frontend is on Vercel (Option B). Only the Supabase backend is tunneled.

## Architecture

```
Internet (HTTPS)
  └── api.<domain>  ──→  Cloudflare Tunnel  ──→  VPS :8000 (Kong)
                                                    ├── /rest/v1/*      (PostgREST API)
                                                    ├── /auth/v1/*      (GoTrue Auth)
                                                    ├── /storage/v1/*   (Storage)
                                                    ├── /functions/v1/* (Edge Functions)
                                                    ├── /realtime/v1/* (WebSockets)
                                                    └── /              (Studio Dashboard)

Frontend: Vercel (auto-deploy from git)
```

The tunnel creates an **encrypted outbound connection** from the VPS to Cloudflare's edge. No inbound ports need to be opened on the VPS firewall.

---

## Prerequisites

- `cloudflared` installed on the VPS
- Cloudflare account with a domain zone (e.g., `yourdomain.com`)
- SSH access to VPS (via VPN): `ssh -p 49306 supabase14@10.87.0.14`
- Supabase Docker stack running on port 8000

### Install cloudflared (if not yet installed)

```bash
# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared

# Verify
cloudflared --version
```

---

## Step 1 — Login to Cloudflare

```bash
cloudflared tunnel login
```

This prints a URL. Copy it, open in a browser on your local machine, select your domain zone, and authorize.

A `cert.pem` file is saved to `~/.cloudflared/`.

---

## Step 2 — Create a Named Tunnel

```bash
cloudflared tunnel create lapor-client
```

Output:
```
Tunnel credentials written to /root/.cloudflared/<TUNNEL_ID>.json
Created tunnel lapor-client with id <TUNNEL_ID>
```

Save the `<TUNNEL_ID>` — you'll need it for the config.

---

## Step 3 — Create Config File

```bash
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: lapor-client
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: api.yourdomain.com
    service: http://localhost:8000
  - service: http_status:404
```

Replace:
- `<TUNNEL_ID>` with the actual tunnel ID from Step 2
- `api.yourdomain.com` with your chosen subdomain

---

## Step 4 — Create DNS Record

```bash
cloudflared tunnel route dns lapor-client api.yourdomain.com
```

This creates a CNAME record: `api.yourdomain.com` → `<TUNNEL_ID>.cfargotunnel.com`

You can verify in the Cloudflare dashboard under DNS settings.

---

## Step 5 — Test the Tunnel

```bash
cloudflared tunnel run lapor-client
```

Test from your local machine:
```bash
# Test API
curl https://api.yourdomain.com/rest/v1/ -H "apikey: <ANON_KEY>"

# Test Edge Functions
curl https://api.yourdomain.com/functions/v1/get-webhook-errors

# Test Studio — open in browser
# https://api.yourdomain.com
```

Press `Ctrl+C` to stop the test run.

---

## Step 6 — Set Up systemd Service (Persistent)

```bash
sudo tee /etc/systemd/system/cloudflared-tunnel.service > /dev/null <<'EOF'
[Unit]
Description=Cloudflare Tunnel - lapor-client
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared tunnel run lapor-client
Restart=on-failure
RestartSec=5s
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable cloudflared-tunnel
sudo systemctl start cloudflared-tunnel
```

Verify:
```bash
sudo systemctl status cloudflared-tunnel
cloudflared tunnel list    # Should show "lapor-client" as active
```

---

## Step 7 — Update Supabase Docker .env

On the VPS, update the Supabase environment to know about the public URLs:

```bash
nano /root/supabase/docker/.env
```

Update these variables:
```env
# The public URL where the frontend lives (Vercel)
SITE_URL=https://app.yourdomain.com

# The public API URL (tunnel)
API_EXTERNAL_URL=https://api.yourdomain.com

# Allowed redirect URLs for auth callbacks
ADDITIONAL_REDIRECT_URLS=https://app.yourdomain.com,https://app.yourdomain.com/**
```

Restart affected services:
```bash
cd /root/supabase/docker
docker compose restart auth --no-deps
```

Also update edge function secrets if `SUPABASE_PUBLIC_URL` is used:
```bash
nano /root/supabase/docker/.env.functions
```

```env
SUPABASE_PUBLIC_URL=https://api.yourdomain.com
```

Restart functions:
```bash
docker compose up -d --force-recreate functions
```

---

## Step 8 — Update Frontend Env Vars

### Option A: `.env.client` (for local dev against client VPS)

```env
VITE_SUPABASE_URL=https://api.yourdomain.com
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
VITE_WEBHOOK_BASE_URL=https://api.yourdomain.com
```

### Option B: Vercel Environment Variables

In Vercel dashboard → Project Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://api.yourdomain.com` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<ANON_KEY>` |
| `VITE_WEBHOOK_BASE_URL` | `https://api.yourdomain.com` |

Trigger a redeploy after updating.

---

## Step 9 — Register Webhook URLs

Now that the tunnel provides a stable public URL, register it with WhatsApp providers:

### Fonnte
- md.fonnte.com → Select device → Webhook URL:
  `https://api.yourdomain.com/functions/v1/fonnte-webhook`

### WhatsApp Cloud (Meta)
- developers.facebook.com → Your App → WhatsApp → Configuration
- Callback URL: `https://api.yourdomain.com/functions/v1/whatsapp-cloud-webhook`
- Verify Token: must match `whatsapp_cloud_config.verify_token` in DB

### Infobip
- Infobip portal → Channels → WhatsApp → Webhook URL:
  `https://api.yourdomain.com/functions/v1/infobip-webhook`

---

## Verification Checklist

- [ ] `cloudflared tunnel list` shows tunnel as active
- [ ] `curl https://api.yourdomain.com/rest/v1/` returns 200
- [ ] `curl https://api.yourdomain.com/functions/v1/get-webhook-errors` returns 200
- [ ] Supabase Studio accessible at `https://api.yourdomain.com`
- [ ] Frontend on Vercel can connect to Supabase (auth, data loading)
- [ ] WhatsApp webhook test message reaches edge functions
- [ ] `systemctl status cloudflared-tunnel` shows active after VPS reboot

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Tunnel inactive after VPS reboot | `sudo systemctl enable cloudflared-tunnel` (ensure it's enabled) |
| 502 Bad Gateway | Check Supabase Docker is running: `docker ps \| grep kong` |
| Auth redirect fails | Verify `SITE_URL` and `ADDITIONAL_REDIRECT_URLS` include Vercel URL |
| Attachments show broken URLs | Set `SUPABASE_PUBLIC_URL` in `.env.functions` to tunnel URL, restart functions |
| Edge function "not found" | Redeploy functions: `./deployment/scripts/deploy-functions.sh` |
| DNS not resolving | Check CNAME record in Cloudflare dashboard, wait for propagation |
| Tunnel URL changes | Named tunnels have stable URLs. If you deleted and recreated, update DNS route |

---

## Optional: Lock Down Studio Later

If you want to restrict Studio access in the future, use **Cloudflare Access** (Zero Trust):

1. Go to Cloudflare Zero Trust dashboard → Access → Applications
2. Create an application:
   - **Name**: Lapor Studio
   - **Domain**: `api.yourdomain.com`
   - **Path**: `/project/*` (Studio project pages)
3. Add a policy: "Allow" → emails matching your team
4. Anyone else gets a Cloudflare login gate

This doesn't require any VPS changes — it's configured entirely in the Cloudflare dashboard.

---

## Quick Reference

```bash
# Check tunnel status
sudo systemctl status cloudflared-tunnel

# View tunnel logs
sudo journalctl -u cloudflared-tunnel -f

# Restart tunnel
sudo systemctl restart cloudflared-tunnel

# List tunnels
cloudflared tunnel list

# Delete tunnel (if needed)
cloudflared tunnel delete lapor-client
```
