# AGENTS.md - SimuLearn Unified Handoff

This repository is the single canonical workspace for SimuLearn. It contains two modules that must stay clearly separated in code, testing, and deployment:

- **Tutorial module**: `simulearn.cn` learning site, content system, books, AI admin, search, login.
- **Online simulation module**: `simulearn.cn/cae` CAE frontend and simulation backend.

When starting a task, identify the target module first. User requests should be interpreted as scoped to one of these modules unless they explicitly say the change is cross-module.

## Module Boundaries

| Module | Primary paths | Runtime | Deployment |
| --- | --- | --- | --- |
| Tutorial | `src/`, `functions/`, `worker/`, `public/` | Astro 4 + Cloudflare Workers + R2 | `npm run deploy:site` |
| Online simulation | `apps/cae-frontend/`, `services/cae-backend/`, `docker/cae/` | React/Vite + FastAPI/Celery/Redis/MinIO | Frontend ships with site build; backend via `npm run deploy:cae` |

Do not refactor across module boundaries unless the user asks for it. Shared contracts such as authentication, API prefixes, deployment scripts, and CSS tokens may be changed only with explicit cross-module intent.

## Current Product Direction

- `simulearn.cn` is the only public primary website.
- `simulearn.cn/cae` is the online simulation page.
- `cae.simulearn.cn` is not a required production entry because subdomain ICP filing is not being pursued.
- Login is shared through the tutorial module's `simulearn_sess` httpOnly JWT cookie.
- Simulation APIs should be exposed under `/api/cae/*` on the main domain and map to the CAE backend's internal `/api/v1/*` routes.

## Tutorial Module

The tutorial module is the existing SimuLearn learning site.

Key paths:

```text
src/pages/ai/index.astro          # Admin workbench and content editor
src/pages/login.astro             # Email/password, email code, OAuth login UI
src/pages/search.astro            # Site search
src/pages/domains/kp.astro        # Knowledge point detail page
src/data/learning-catalog.ts      # Knowledge catalog and markdown generation
src/components/Header.astro       # Navigation, theme toggle, user menu
src/layouts/BaseLayout.astro      # SEO, JSON-LD, theme initialization
functions/_shared/auth.ts         # PBKDF2, JWT, verification codes, OAuth helpers
functions/_shared/content-store.ts# R2 content overrides
worker/index.ts                   # Worker router for auth, AI, learning, books
wrangler.jsonc                    # Worker + Assets + R2 config
```

Important API prefixes:

| Prefix | Purpose |
| --- | --- |
| `/api/auth/*` | Shared login/session APIs |
| `/api/ai/*` | AI/admin APIs protected by Basic Auth |
| `/api/learning/*` | Learning plan/progress/checkpoint |
| `/api/knowledge/*` | Knowledge content serving |
| `/api/books/*` | Books and assets |

Tutorial storage uses the `simulearn-books` R2 bucket for books, content overrides, user profiles, verification codes, and progress.

## Online Simulation Module

The online simulation module is now part of the main repository.

Key paths:

```text
apps/cae-frontend/               # React + Vite + Three.js + VTK.js UI
services/cae-backend/             # FastAPI + Celery simulation backend
docker/cae/docker-compose.local.yml
docker/cae/docker-compose.prod.yml
docker/cae/deploy.sh
docker/cae/images/                # Solver/sandbox image definitions
```

Frontend conventions:

- Vite `base` is `/cae/`.
- Build output goes to `public/cae/`; Astro copies it into `dist/cae/`.
- Browser API calls use `/api/cae`.
- Upload/start simulation requires the shared main-site login state.

Backend conventions:

- Internal FastAPI prefix remains `/api/v1`.
- Public main-domain prefix is `/api/cae`, implemented in `worker/index.ts` and mapped to the backend's `/api/v1`.
- The backend validates the main site's `simulearn_sess` JWT before accepting simulation requests. Production `JWT_SECRET` must match the Cloudflare Worker secret.
- Production Worker traffic reaches the CAE backend through the internal Cloudflare Tunnel hostname `cae-origin.simulearn.cn`, which maps to `http://127.0.0.1:8000` on the Alibaba Cloud server.
- The simulation pipeline remains Gmsh -> CalculiX -> meshio -> VTK.

CAE service ports on the Alibaba Cloud server:

| Service | Host port | Container |
| --- | ---: | --- |
| Backend API | 8000 | `cae-backend` |
| Frontend dev server | 3001 | `cae-frontend` |
| PostgreSQL | 5433 | `cae-db` |
| Redis | 6380 | `cae-redis` |
| MinIO API | 9002 | `cae-minio` |
| MinIO Console | 9003 | `cae-minio` |

Current server EIP discovered during troubleshooting: `39.106.111.97`.

## Build And Deployment

Primary commands from repository root:

```bash
npm run dev              # Tutorial Astro dev server
npm run dev:cae          # CAE Vite dev server
npm run build            # Build CAE frontend into public/cae, then build tutorial site
npm run build:tutorial   # Tutorial-only build
npm run build:cae        # CAE frontend-only build
npm run check:functions  # Compile Cloudflare functions
npm run deploy:site      # Build and deploy Cloudflare Worker + Assets
npm run deploy:cae       # Run docker/cae/deploy.sh on a Linux server
```

Deployments must remain independent:

- Tutorial/content changes should not restart CAE backend containers.
- CAE backend changes should not require redeploying the tutorial content unless the API contract or `/cae` frontend changed.
- CAE frontend changes are shipped with the main site build because `/cae` is a main-domain static path.

## Local Development

See `docs/local-development.md` for step-by-step local setup.

Short version:

```bash
# Tutorial
npm install
npm run dev

# CAE frontend
npm --prefix apps/cae-frontend install
npm run dev:cae

# CAE backend
cd services/cae-backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Security And Auth

- `JWT_SECRET` is required for shared login and must stay secret.
- Main-site auth is implemented in `functions/_shared/auth.ts`.
- `simulearn_sess` is httpOnly and should be treated as the shared session cookie.
- The CAE frontend can only observe login state through `/api/auth/me`.
- The CAE backend should not trust frontend-only checks; it must validate the session server-side before accepting upload/start requests.

## Known Follow-Up Work

1. Run a real authenticated upload and complete simulation pipeline test through `https://simulearn.cn/cae/`.
2. Add monitoring/restart alerts for the `cloudflared` service and CAE containers.
3. Decide whether the old `simulearn-cae` GitHub repository becomes archived read-only or remains as historical reference.

## Troubleshooting Notes

- `cae.simulearn.cn` returned ICP filing errors because subdomain filing was not completed.
- Alibaba Cloud firewall rules for TCP 80/443 must be enabled for origin traffic.
- Cloudflare SSL mode was temporarily changed during troubleshooting; the main direction is to avoid the CAE subdomain and use `/cae`.
- Do not use `cae.simulearn.cn` as the production canonical URL.

## Current Status

- Tutorial module: production-ready and deployed through Cloudflare Workers.
- Online simulation frontend: copied into `apps/cae-frontend` and configured for `/cae/`.
- Online simulation backend: copied into `services/cae-backend`; Docker config lives under `docker/cae`.
- Shared auth: frontend login gate, Worker `/api/cae/*` auth check, and backend JWT validation are deployed with a shared `JWT_SECRET`.
- Production origin routing: `cae-origin.simulearn.cn` is an internal Cloudflare Tunnel hostname and is not a user-facing entry.
