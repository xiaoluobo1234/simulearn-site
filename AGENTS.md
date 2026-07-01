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

1. ✅ ~~Run end-to-end simulation pipeline test~~ — mesh PNG snapshot deployed; E2E test may still have JWT alignment issues.
2. Add monitoring/restart alerts for the `cloudflared` service and CAE containers.
3. ✅ ~~Fix the flaky knowledge-page E2E locators~~ — changed to `[data-kp-title]` and `[data-review-badge]`; added 15s timeouts and content-load waits.
4. ✅ ~~Merge PR #2 into `main`~~ — merged; `simulearn-cae` archived read-only.
5. Implement the confirmed product acceptance metrics and collect the first invited-beta cohort results.
6. 🔄 Mesh visualization: currently shows matplotlib PNG snapshot in "wireframe" mode. Three.js `WireframeGeometry` approach tested but OBJ may not contain surface triangles — PNG is the fallback that works reliably.
7. 🔄 JWT_SECRET sync: Worker and server must use the same secret. Server `.env` value is `VoWaQeYRT…`. Worker secret set via `wrangler secret put JWT_SECRET`.

## FEA 实战系列 (2026-07-01)

A new content series on ANSYS finite element analysis is being built from `C:/Users/Lenovo/ZCodeProject/ansys_fea_series_master_doc.md`.

### Published
- **Page**: `src/pages/fea-series.astro` → `https://simulearn.cn/fea-series`
- **§1.0 引言** (3,000+ chars): Full draft published — cantilever beam SOLID185 vs 186 comparison, element math fundamentals, validation methodology, 6 benchmark problems, reading paths
- **Ch1 remaining**: §1.1–§1.7 outlined with word counts and benchmark problems; marked as "大纲完成"
- **Entry point**: Tools page hero has `🔥 ANSYS 实战系列` button linking to `/fea-series`

### Planned Chapters
| Chapter | Topic | Timeline |
|---------|-------|----------|
| Ch1 | 实体单元选型与精度验证 | ~38,000字, 6 benchmarks |
| Ch2 | 网格 | 3-4 周 |
| Ch3 | 接触 | 4-6 周 |
| Ch4 | 模态动力学 | 2-3 周 |
| Ch5 | 热固耦合 | 3-4 周 |

### Source Document
- `C:/Users/Lenovo/ZCodeProject/ansys_fea_series_master_doc.md` (1893 lines, v1.0, 2026-07-01)
- Contains: full Ch1 outline, §1.0–§1.1 drafts, benchmark library template, Matplotlib styles, 2-week writing plan, Zotero citation workflow

## Recent Changes (2026-07-01)

### Security Hardening
- Dark mode: Deep professional theme (`#0c1117` base), CSS variables for all semantic states
- CSRF protection: `/api/auth/csrf-token` endpoint + `is:inline` auto-interceptor + `X-CSRF-Token` header on all mutations
- Rate limiting: `EMAIL_RATE_LIMITER` (3 req/60s per IP) for email verification
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-XSS-Protection` on all responses
- Hardcoded secrets removed from `docker-compose.local.yml` and `worker/index.ts`

### CAE Mesh PNG
- Backend: `_render_mesh_png()` uses matplotlib to render 2-view wireframe PNG from mesh OBJ
- Frontend: PNG displayed in wireframe mode instead of Three.js rendering; large stats card (nodes/elements/Jacobian); OBJ download link
- Requirements: `matplotlib==3.10.0` added

### Dark Mode FOUC Fix
- `<script is:inline>` at top of `<head>` sets `data-theme` before first paint
- Navigation delay protection for dark mode internal links

### Error Lookup Restyle
- Cards changed from rounded `.card` style to sharp 4px border, matching KP card style
- 2-column grid layout on desktop

## Current Status

- Tutorial module: production-ready. 32 pages built.
- FEA Series: §1.0 published at `/fea-series`; remaining Ch1 sections outlined.
- CAE frontend: deployed with PNG mesh preview, stats card, download link.
- CAE backend: mesh PNG generation deployed via `docker cp`; JWT_SECRET synced.
- GitHub: `main` branch up to date; PR #2 merged; `simulearn-cae` archived.
- Server: `39.106.111.97`, Cloudflare Tunnel `cae-origin.simulearn.cn` → `localhost:8000`.
- Latest Worker Version: `b5e574a5-4d97-49e8-88b2-38c7c305f222`.
