# Lapor — Client Deployment Guide

> Complete guides for deploying the Lapor platform to a client environment.

Choose the deployment option that fits the client's infrastructure:

---

## Option A: Fully Self-Hosted

**Everything runs on the client's VPS** — Supabase backend + frontend (Docker Nginx).

- [Full Guide](./OPTION-A-SELF-HOSTED.md)
- [Checklist](./CHECKLIST-A.md)

**Best for:** Clients on isolated/air-gapped networks, VPN-only access, no public domain.

---

## Option B: Vercel + Self-Hosted Backend

**Supabase on the VPS, frontend on Vercel** (managed hosting with CDN).

- [Full Guide](./OPTION-B-VERCEL-HYBRID.md)
- [Checklist](./CHECKLIST-B.md)

**Best for:** Clients with a public domain who want managed frontend hosting and automatic deployments.

---

## Option C: Single-Domain VPS (Frontend + Backend)

**Everything on one VPS, one domain, path-based routing** — Nginx Proxy Manager handles SSL and routes Supabase API paths vs frontend.

- [Full Guide](./OPTION-C-SINGLE-DOMAIN-VPS.md)
- [Checklist](./CHECKLIST-C.md)

**Best for:** Clients with a public IP and domain who want maximum performance — no Cloudflare, no Vercel, no external dependencies. Single domain serves both frontend and API.

---

## Comparison

| Aspect | Option A (Self-Hosted) | Option B (Vercel Hybrid) | Option C (Single-Domain VPS) |
|--------|------------------------|--------------------------|------------------------------|
| **Frontend hosting** | Docker Nginx on VPS | Vercel (managed) | Docker Nginx on VPS |
| **API access** | Direct IP:8000 | Cloudflare Tunnel / domain | Same domain, path-routed |
| **HTTPS/SSL** | Optional | Required | Required (Let's Encrypt auto) |
| **Domain needed** | No (IP works) | Yes (2 subdomains) | Yes (1 domain) |
| **Reverse proxy** | None | Cloudflare Tunnel | Nginx Proxy Manager (Docker) |
| **CDN / edge caching** | No | Yes (Vercel Edge) | No |
| **Frontend updates** | SSH + scp | Git push (auto-deploy) | SSH + scp |
| **CORS** | N/A (same origin) | Cross-origin | Same-origin (no CORS) |
| **Internet dependency** | None (LAN/VPN only) | Frontend needs internet | Needs public IP + domain |
| **Setup complexity** | Low | Moderate + DNS/SSL | Moderate (NPM GUI helps) |
| **Performance** | Fastest (LAN) | Slowest (cross-ocean) | Fast (same server, public) |
| **Best for** | Air-gapped / VPN-only | Auto-deploy, CDN needed | Public-facing, max performance |

---

## Shared Resources

- [Environment Architecture](./ENVIRONMENT_ARCHITECTURE.md) — 4-environment overview with diagrams
- [Cloudflare Tunnel](./cloudflare-tunnel.md) — Expose VPS Supabase to the internet via secure tunnel
- [VPN Access](./vpn.md) — VPN credentials for VPS access
- Backend Phases 1–6 are **identical** in both options

## Deployment Scripts

All in `deployment/scripts/` (gitignored):

| Script | Used By | Purpose |
|--------|---------|---------|
| `apply-migrations.mjs` | Both | Apply DB migrations to any self-hosted Supabase |
| `deploy-functions.sh` | Both | Deploy edge functions via SSH |
| `deploy-frontend.sh` | Option A, C | Deploy frontend via SSH |
| `build-frontend.sh` | Option A, C | Build frontend for client mode |

## Docker Frontend Config

In `deployment/docker/frontend/` (gitignored):

| File | Used By | Purpose |
|------|---------|---------|
| `docker-compose.frontend.yml` | Option A, C | Nginx container for frontend |
| `nginx/lapor.conf` | Option A, C | Nginx SPA config for lapor |
| `.env.frontend.example` | Option A, C | Template for frontend paths |
