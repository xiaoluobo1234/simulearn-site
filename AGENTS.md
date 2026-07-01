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
- The main homepage hero includes an `Online Simulation` button immediately after `Tools`; it uses the same `btn btn-ghost` sizing and links to `/cae/`.

## Repository Strategy

- `xiaoluobo1234/simulearn-site` is the only active source of truth for the public website, shared authentication, CAE frontend, CAE backend, infrastructure, and deployment.
- `xiaoluobo1234/simulearn-cae` is a historical repository. Archive it read-only only after PR #2 is merged into `main` and production/server checkouts follow the merged `main` branch. Do not delete it.
- `xiaoluobo1234/simulearn-scripts` remains an active independent reusable script library. It is linked from the tutorial module and has not been migrated into this repository; do not archive it unless its code, license, history, and public links are intentionally migrated first.
- The only canonical Agent handoff is this root `AGENTS.md`. Do not recreate `docs/AGENT-HANDOFF.md` or maintain a second full handoff copy.

## Confirmed Product Roadmap (2026-06-30)

This roadmap was confirmed after a ten-round product interview. Treat it as the
decision baseline for planning and acceptance. Do not silently replace these
priorities with a broader content portal or a general-purpose CAE SaaS product.

### Outcome And Primary Users

- Build an integrated learning flow: tutorial -> model -> solve -> result explanation.
- The first audience is students and junior engineers who understand basic
  engineering mechanics but are new to CAE.
- Reading stays public. Login is required when a user runs a simulation or saves
  progress.
- The primary success signal is completion of the full learning-to-simulation
  flow, not raw page count, solver count, or registration count.

### First Release Scope

- Tutorial routes are the primary navigation structure; the knowledge base and
  search remain secondary lookup tools.
- A core tutorial follows: concept -> assumptions -> operation -> simulation ->
  result judgment -> common failures.
- Tutorials provide guided, parameterized exercises before linking to the full
  CAE workbench.
- The first solver scope is reliable linear static structural analysis.
- Start with platform examples plus one validated upload family. STEP/STP is the
  first validated family; STL remains experimental until it passes the same
  acceptance suite.
- The workbench defaults to a step-by-step beginner flow and may expose advanced
  parameters separately.
- Results must include contours, key values, units, model assumptions, checks,
  and educational interpretation.
- Failure states must identify the failed stage, explain the likely cause in
  user-facing language, suggest a repair, and allow an edited retry.

### Explicit First Release Exclusions

- No full browser CAD system.
- No production-engineering certification or claim that unvalidated output is
  suitable for final engineering decisions.
- No broad multiphysics coverage, social feed, or unreviewed user publishing.
- No requirement for the complete CAE workbench to work on phones. Tutorial
  reading must support mobile and desktop; modeling and solving are desktop-first.
- No organization, class, assignment, or grading system in the first release.
- No autonomous AI model repair, solver configuration, engineering conclusion,
  or content publication.

### Tutorial Product Rules

- Content is created or curated by an administrator. AI may assist drafting and
  organization, but a human must review before publication.
- Learning state records route progress, exercise results, and key checkpoints.
- Real engineering experience, reproducible examples, assumptions, validation,
  and failure analysis are more valuable than a large volume of generic content.
- Do not fabricate simulation practice. Do not promote unreviewed AI drafts as
  authoritative engineering instruction.
- External text, papers, books, and images require ownership, permission, or a
  compliant limited citation with source records. Unauthorized full-book content
  must not be published.

### Data, Sharing, And Privacy

- Uploaded models and results are private to the owner by default.
- Ordinary simulation artifacts expire after 30 days. A user may explicitly save
  a project for long-term retention and may later delete it.
- Sharing is opt-in. A private share link is distinct from public publication.
  Public cases require human review for privacy, copyright, engineering risk, and
  content quality.
- User files and results must not be used for AI training or product training
  unless that user gives explicit consent.
- Deletion immediately revokes access, removes production data within the defined
  deletion window, and allows encrypted backups to expire on their normal cycle.

### Safety And Security

- Result pages and downloaded reports must state that output is for education and
  preliminary validation and must display the governing model assumptions.
- Uploads require format and size validation, isolated parsing, resource limits,
  and execution in a restricted solver container. Never pass an unchecked upload
  directly to a solver process.
- Ordinary users authenticate by email or OAuth. Administrator accounts require
  multi-factor authentication and an audit trail for sensitive operations.
- The AI explanation service is optional infrastructure. Tutorial reading and
  core simulation must continue when AI is unavailable.

### Service Limits And Operations

- Initial free allowance: up to 10 jobs per user per day and 30 minutes per job.
  These are ceilings, not permanent entitlements.
- Initial infrastructure budget: CNY 300-1000 per month. If cost exceeds the
  budget, reduce free job count or runtime before degrading service reliability.
- Enforce file-size limits, per-user concurrency, a bounded queue, cancellation,
  timeouts, and abuse rate limits before public beta.
- Alert on failures affecting the public site, authentication, submission,
  workers/queues, object storage, or the database.
- Back up daily. The initial recovery objectives are at most 24 hours of data loss
  and restoration of core services within 4 hours.

### Acceptance And Rollout

- A new learner must be able to reach the first result from a tutorial within 15
  minutes under normal queue conditions.
- At least three standard cases and one real uploaded model must complete the
  public end-to-end path and have their results checked for reasonableness.
- During invited beta, at least 95% of valid standard jobs must complete
  successfully.
- Roll out in stages: internal validation -> 20-50 invited users -> public beta.
- The first product validation cohort is at least 30 testers. The target is 60%
  completing one full learning/simulation flow and 40% returning within 7 days.

### Delivery Phases

1. Phase 1: make one linear-static tutorial-to-result flow reliable and safe.
2. Phase 2: add modal analysis, teacher course/assignment capabilities, and the
   foundations for individual subscriptions.
3. Later: add further analysis modules through a stable task interface and offer
   an organization edition only after individual learning value is validated.

If delivery capacity is cut, preserve one complete tutorial -> preset case ->
solve -> explanation flow. Do not keep disconnected feature fragments merely to
show a larger feature count.

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
3. Fix the flaky knowledge-page E2E locators: target the visible `[data-kp-title]` instead of the first repeated tree text, and allow the dynamic knowledge API enough time to render.
4. Merge PR #2 into `main`, switch production/server checkouts to merged `main`, and then archive `simulearn-cae` read-only.
5. Implement the confirmed product acceptance metrics and collect the first invited-beta cohort results.

## Troubleshooting Notes

- `cae.simulearn.cn` returned ICP filing errors because subdomain filing was not completed.
- Alibaba Cloud firewall rules for TCP 80/443 must be enabled for origin traffic.
- Cloudflare SSL mode was temporarily changed during troubleshooting; the main direction is to avoid the CAE subdomain and use `/cae`.
- Do not use `cae.simulearn.cn` as the production canonical URL.

## Current Status

- Tutorial module: production-ready and deployed through Cloudflare Workers.
- Homepage entry: `Online Simulation` is deployed beside `Tools`, uses the same button sizing, and links to `/cae/`.
- Online simulation frontend: copied into `apps/cae-frontend` and configured for `/cae/`.
- Online simulation backend: copied into `services/cae-backend`; Docker config lives under `docker/cae`.
- Shared auth: frontend login gate, Worker `/api/cae/*` auth check, and backend JWT validation are deployed with a shared `JWT_SECRET`.
- Production origin routing: `cae-origin.simulearn.cn` is an internal Cloudflare Tunnel hostname and is not a user-facing entry.
- Latest manual site deployment: Worker version `9e7ff44c-2cbe-4045-878c-b0d97f9fecd0`; both `/` and `/cae/` return HTTP 200 and production HTML contains the `/cae/` hero link.
- Integration work is on `codex/cae-monorepo-integration`; latest homepage commit is `2f5c7d0`; draft PR: `https://github.com/xiaoluobo1234/simulearn-site/pull/2`.
- Local validation passes: six unit tests, full site/CAE build, Functions compilation, and the focused homepage E2E.
- PR CI remains red because two pre-existing dynamic knowledge-page assertions use unstable text/role locators with a 5-second timeout. The homepage change itself is not the failing assertion. Cloudflare's external PR build check also reports failure, while the authenticated manual Wrangler deployment succeeds.
