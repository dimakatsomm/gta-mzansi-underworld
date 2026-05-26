# Mzansi Underworld — Production Deployment Guide

Target: Fresh Ubuntu 24.04 LTS (Hetzner CX or AX series recommended — min 4 vCPU / 8 GB RAM).

---

## 1. Prerequisites

```bash
# Docker + Docker Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Git
sudo apt-get install -y git

# Node.js 22 LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
npm install -g pnpm

# PM2 (process manager for Node services)
npm install -g pm2
```

---

## 2. Clone & Configure

```bash
git clone https://github.com/your-org/gta-mzansi-underworld.git /opt/gta-mzansi-underworld
cd /opt/gta-mzansi-underworld

# Copy and fill in the production env file
cp infra/docker/.env.production.example infra/docker/.env.production
nano infra/docker/.env.production
```

**Secrets that must be changed before starting:**

- `POSTGRES_PASSWORD` — generate with `openssl rand -base64 32`
- `NATS_AUTH_TOKEN` — generate with `openssl rand -hex 16`; also update `NATS_URL` to embed it (`nats://<token>@127.0.0.1:4222`)
- `FIVEM_INGEST_TOKEN` — generate with `openssl rand -hex 16`
- `SV_LICENCEKEY` — from [keymaster.fivem.net](https://keymaster.fivem.net)
- All `DISCORD_*` values — from your Discord developer portal
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`

Also update `DATABASE_URL` to match the new `POSTGRES_PASSWORD`.

---

## 3. Start Infrastructure

```bash
cd /opt/gta-mzansi-underworld

docker compose \
  -f infra/docker/docker-compose.production.yml \
  --env-file infra/docker/.env.production \
  up -d

# Verify all containers are healthy
docker compose -f infra/docker/docker-compose.production.yml ps
```

Expected: postgres, redis, nats, node-exporter, and prometheus all show `healthy` or `running`.

---

## 4. Run Database Migrations

```bash
cd /opt/gta-mzansi-underworld

# Install workspace dependencies
pnpm install --frozen-lockfile

# Deploy Prisma migrations against the production DB
# (DATABASE_URL must be set in your shell or sourced from .env.production)
export $(grep -v '^#' infra/docker/.env.production | xargs)

pnpm --filter @gtarp/db prisma:deploy
```

---

## 5. Start Application Services

```bash
cd /opt/gta-mzansi-underworld

# Build all packages
pnpm build

# Start services under PM2
pm2 start ecosystem.config.js --env production

# Save PM2 process list and enable on reboot
pm2 save
pm2 startup    # follow the printed sudo command
```

If an `ecosystem.config.js` does not yet exist, start each service manually:

```bash
pm2 start "node apps/backend/dist/index.js"       --name backend        -i 2
pm2 start "node apps/ai-orchestrator/dist/index.js" --name ai-orchestrator
pm2 start "node apps/event-worker/dist/index.js"  --name event-worker
pm2 start "node apps/discord-bot/dist/index.js"   --name discord-bot
pm2 save
```

---

## 6. FiveM Server Setup

```bash
# Create FiveM server directory
mkdir -p /opt/fivem && cd /opt/fivem

# Download the latest FiveM Linux server artifacts from:
#   https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/
# Replace <build> with the latest recommended build number.
wget https://runtime.fivem.net/artifacts/fivem/build_proot_linux/master/<build>/fx.tar.xz
tar -xf fx.tar.xz

# Copy the server config template (adjust path as needed)
cp /opt/gta-mzansi-underworld/apps/fivem-resources/server.cfg.template /opt/fivem/server.cfg

# Edit server.cfg — fill in at minimum:
#   sv_licenseKey  (matches SV_LICENCEKEY in .env.production)
#   nats_url / ingest_token if custom convars are used
nano /opt/fivem/server.cfg

# Launch txAdmin (web-based server manager) on first run:
cd /opt/fivem
./run.sh +set txAdminPort 40120
# Then open http://<server-ip>:40120 to complete txAdmin setup.
```

> **Firewall rules required:**
>
> - `4222/tcp` open — FiveM → NATS
> - `30120/tcp` + `30120/udp` open — players → FiveM
> - `40120/tcp` open (or restrict to your IP) — txAdmin

---

## 7. Verify

**Container health:**

```bash
docker compose -f infra/docker/docker-compose.production.yml ps
docker compose -f infra/docker/docker-compose.production.yml logs --tail=50 postgres
docker compose -f infra/docker/docker-compose.production.yml logs --tail=50 nats
```

**Application healthz endpoints:**

```bash
curl -sf http://127.0.0.1:3001/healthz && echo "backend OK"
curl -sf http://127.0.0.1:3002/healthz && echo "ai-orchestrator OK"
curl -sf http://127.0.0.1:3003/healthz && echo "event-worker OK"
```

**Prometheus scrape targets:**

```
http://127.0.0.1:9090/targets
```

All targets should show state `UP`.

**End-to-end crime → dispatch pipeline test:**

1. Connect a test client to the FiveM server.
2. Trigger a crime event (e.g. rob a store).
3. Confirm a dispatch notification appears in `DISCORD_DISPATCH_CHANNEL_ID`.
4. Check `pm2 logs event-worker` for the processed event.
5. Check `pm2 logs ai-orchestrator` for any AI witness statements generated.
