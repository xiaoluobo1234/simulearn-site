#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"

echo "SimuLearn CAE deployment"
echo "========================"

command -v docker >/dev/null 2>&1 || { echo "Docker is not installed."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "docker compose is not available."; exit 1; }

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "Run this script from docker/cae."
  exit 1
fi

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env

  DB_PW="$(openssl rand -hex 16)"
  MINIO_PW="$(openssl rand -hex 16)"
  sed -i "s/YOUR_DB_PASSWORD/$DB_PW/" .env
  sed -i "s/YOUR_MINIO_USER/cae_admin/" .env
  sed -i "s/YOUR_MINIO_PASSWORD/$MINIO_PW/" .env
fi

if ! grep -Eq '^JWT_SECRET=.{16,}$' .env || grep -q 'YOUR_SHARED_SIMULEARN_JWT_SECRET' .env; then
  echo "JWT_SECRET is missing in docker/cae/.env."
  echo "Set it to the same value as the Cloudflare Worker JWT_SECRET before deploying."
  exit 1
fi

echo ""
echo "Building CAE images..."
docker compose -f "$COMPOSE_FILE" build --parallel

echo ""
echo "Stopping previous CAE compose services, if any..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

for port in 8000 3001 5433 6380 9002 9003; do
  if ss -tlnp | grep -q ":$port "; then
    echo "Port $port is still in use by a non-CAE process. Free it before deploying."
    exit 1
  fi
done

echo ""
echo "Starting CAE services..."
docker compose -f "$COMPOSE_FILE" up -d

echo ""
echo "Waiting for services..."
sleep 10

docker compose -f "$COMPOSE_FILE" ps

echo ""
echo "Deployment complete."
echo "Health check: curl http://localhost:8000/health"
echo "Logs: docker compose -f $COMPOSE_FILE logs -f"
