# Client Deployment Checklist — Option B (Vercel + Self-Hosted Backend)

> Print this page and check off each item as you complete it.
> For detailed instructions, see [OPTION-B-VERCEL-HYBRID.md](./OPTION-B-VERCEL-HYBRID.md).

---

## Pre-Deployment

- [ ] VPN access to client VPS verified (`ping <VPS_IP>` works)
- [ ] SSH access to client VPS confirmed (`ssh root@<VPS_IP>`)
- [ ] Docker + Docker Compose installed on VPS
- [ ] **Public domain** available with DNS control
- [ ] **Vercel account** ready with project creation permissions
- [ ] Node.js 18+ installed on deployment machine
- [ ] Latest repo cloned/pulled
- [ ] Client-specific info collected:
  - [ ] VPS IP address: `____________`
  - [ ] Domain name: `____________`
  - [ ] WhatsApp provider: Fonnte / WA Cloud / Infobip
  - [ ] WhatsApp API credentials ready
  - [ ] Flowise URL (if using AI chatbot): `____________`

---

## Phases 1–6: Backend Setup

> Follow [OPTION-A Checklist](./CHECKLIST-A.md) Phases 1–6, then return here.

- [ ] Phase 1: Supabase Docker running on VPS
- [ ] Phase 2: Migrations applied
- [ ] Phase 3: Edge functions deployed
- [ ] Phase 4: Edge function secrets configured
- [ ] Phase 5: Storage buckets created
- [ ] Phase 6: Tenant & admin user created

---

## Phase 7: HTTPS Setup (Required)

- [ ] DNS A record created: `api.<DOMAIN>` → `<VPS_IP>`
- [ ] DNS propagated (verify: `dig api.<DOMAIN>`)
- [ ] Nginx installed on VPS
- [ ] Nginx reverse proxy config created for `api.<DOMAIN>` → `localhost:8000`
- [ ] SSL certificate obtained via Certbot
- [ ] HTTPS working: `curl https://api.<DOMAIN>/rest/v1/` returns JSON
- [ ] `API_EXTERNAL_URL` updated in Supabase Docker `.env`
- [ ] `SUPABASE_PUBLIC_URL` updated in `.env.functions`
- [ ] Affected services restarted: `docker compose up -d --force-recreate kong auth functions`

---

## Phase 8: Deploy Frontend on Vercel

### lapor-citizen-feedback
- [ ] Vercel project created: `lapor-<client-name>`
- [ ] Git repo connected
- [ ] Environment variables set:
  - [ ] `VITE_SUPABASE_URL` = `https://api.<DOMAIN>`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY` = `<ANON_KEY>`
  - [ ] `VITE_WEBHOOK_BASE_URL` = `https://api.<DOMAIN>`
- [ ] Build successful on Vercel
- [ ] Frontend accessible at Vercel URL

### Custom Domain (Optional)
- [ ] CNAME record: `app.<DOMAIN>` → `cname.vercel-dns.com`
- [ ] Custom domain added in Vercel project settings
- [ ] Vercel SSL provisioned for custom domain

---

## Phase 9: Auth Redirect URLs

- [ ] `SITE_URL` set to lapor frontend URL in Supabase Docker `.env`
- [ ] `ADDITIONAL_REDIRECT_URLS` includes all frontend URLs (Vercel + custom domain)
- [ ] Auth service restarted: `docker compose restart auth --no-deps`

---

## Phase 10: WhatsApp Webhook Registration

- [ ] Webhook URL: `https://api.<DOMAIN>/functions/v1/<webhook-name>`
- [ ] Webhook registered in provider dashboard (Fonnte / Meta / Infobip)
- [ ] Webhook verification passed (WA Cloud verify challenge)

---

## Phase 11: Smoke Tests

### API
- [ ] `curl https://api.<DOMAIN>/rest/v1/` returns JSON
- [ ] `curl https://api.<DOMAIN>/functions/v1/get-webhook-errors` returns JSON

### Lapor Frontend (Vercel)
- [ ] Landing page loads at `/`
- [ ] Report submission works at `/lapor`
- [ ] Report tracking works at `/lacak/<ticket_id>`
- [ ] Can sign up / sign in at `/auth`
- [ ] Admin dashboard loads at `/admin/dashboard`
- [ ] Reports list at `/admin/reports` shows data
- [ ] No mixed content errors in browser console

### WhatsApp
- [ ] Send message → appears in `/admin/conversations`
- [ ] AI chatbot responds (if Flowise configured)
- [ ] Human takeover works
- [ ] Human reply arrives on WhatsApp

---

## Post-Deployment

- [ ] Record client-specific credentials in secure vault
- [ ] SSL auto-renewal verified: `certbot renew --dry-run`
- [ ] Docker auto-restart configured: `restart: unless-stopped`
- [ ] Database backup schedule set up
- [ ] Record deployment details:
  - VPS IP: `____________`
  - Domain: `____________`
  - Vercel lapor project: `____________`
  - Deployed date: `____________`
  - WhatsApp provider: `____________`
