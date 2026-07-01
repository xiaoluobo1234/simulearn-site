# Local Development

This repository contains two independent modules under one workspace.

## Prerequisites

- Node.js 20+ or 22+
- npm
- Python 3.12
- Docker Desktop or Docker Engine for CAE infrastructure
- Wrangler login for Cloudflare deployments

## Tutorial Module

```bash
cd simulearn-site
npm install
npm run dev
```

Useful commands:

```bash
npm run build:tutorial
npm run test
npm run check:functions
```

The tutorial module uses Astro pages in `src/`, Cloudflare Worker routing in `worker/`, and shared functions in `functions/`.

## Online Simulation Frontend

```bash
cd simulearn-site
npm --prefix apps/cae-frontend install
npm run dev:cae
```

The frontend is a React/Vite app. Its production base path is `/cae/`, and it calls `/api/cae`.

For local frontend development, Vite proxies `/api/cae` to `http://localhost:8000/api/v1`.

## Online Simulation Backend

```bash
cd simulearn-site/services/cae-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

For direct local backend work without the main-site login cookie, set `CAE_AUTH_REQUIRED=false`. Production must keep `CAE_AUTH_REQUIRED=true` and set `JWT_SECRET`.

Run tests:

```bash
cd simulearn-site
npm run test:cae
```

The upload test requires Redis and may be skipped if infrastructure is not running.

## CAE Infrastructure With Docker

From the repository root:

```bash
docker compose -f docker/cae/docker-compose.local.yml up -d postgres redis minio
```

For full local Docker mode:

```bash
docker compose -f docker/cae/docker-compose.local.yml up -d
```

## Integrated Build

```bash
npm run build
```

This builds CAE frontend into `public/cae/`, then runs Astro build so the final Cloudflare assets include `/cae/`.

`public/cae/` is generated output and is intentionally ignored by Git.
