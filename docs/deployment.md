# Deployment

SimuLearn deploys as one public site with two independent modules.

## Public Routes

| Route | Module | Owner |
| --- | --- | --- |
| `/` and tutorial pages | Tutorial | Cloudflare Worker + Assets |
| `/cae/` | Online simulation frontend | Built static files served by the main site |
| `/api/auth/*` | Shared login | Cloudflare Worker |
| `/api/cae/*` | Online simulation API | Main-domain routing to CAE backend |

`cae.simulearn.cn` is not a production dependency.

## Tutorial And CAE Frontend Deployment

From repository root:

```bash
npm run deploy:site
```

This runs:

1. `npm run build:cae`
2. `npm run build:tutorial`
3. `wrangler deploy`

Changing tutorial content does not require restarting CAE backend containers. Changing CAE frontend does require a site deploy because `/cae/` is served as static assets by the main site.

## CAE Backend Deployment

On the Alibaba Cloud server:

```bash
cd ~/simulearn-site
git pull
cd docker/cae
bash deploy.sh
```

The CAE backend deployment should only touch CAE containers:

- `cae-backend`
- `cae-worker`
- `cae-db`
- `cae-redis`
- `cae-minio`

It must not modify or restart the tutorial Cloudflare deployment.

## Required Secrets

Tutorial/Worker:

- `JWT_SECRET`
- `RESEND_API_KEY`
- `SIMULEARN_AI_USERNAME`
- `SIMULEARN_AI_PASSWORD`
- Dify-related API settings

CAE backend:

- Database password
- MinIO credentials
- Optional OpenAI/API keys for future AI features
- `JWT_SECRET`, matching the Cloudflare Worker `JWT_SECRET`

## Production Notes

- The current Alibaba Cloud EIP observed during troubleshooting is `39.106.111.97`.
- Alibaba Cloud firewall must allow TCP 80 and 443 if the backend is exposed through Nginx or future routing.
- Subdomain `cae.simulearn.cn` is intentionally not required to avoid separate ICP filing.
- The main-domain `/cae/` route is the canonical user entry.
- Cloudflare Worker `/api/cae/*` forwards to `CAE_BACKEND_URL` and rewrites the public prefix to `/api/v1/*`.
- The CAE production frontend container is Nginx-based and proxies `/api/v1/*` to the internal `backend:8000` service.
- Production `CAE_BACKEND_URL` is `https://cae-origin.simulearn.cn`. This is an internal Cloudflare Tunnel hostname routed to `http://127.0.0.1:8000`; it is not a public application entry.
