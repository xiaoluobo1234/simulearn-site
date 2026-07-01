#!/bin/bash
# ============================================================
# SimuLearn CAE — Server Deployment Script
# Usage: cd docker/cae && bash deploy.sh
# ============================================================
set -e

echo "🔧 SimuLearn CAE — Server Deployment"
echo "======================================"

# ── Check prerequisites ──
command -v docker >/dev/null 2>&1 || { echo "❌ Docker not installed"; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "❌ docker compose not available"; exit 1; }

# ── Create .env if missing ──
if [ ! -f .env ]; then
  echo "📝 Creating .env from .env.example..."
  cp .env.example .env
  # Generate random passwords
  DB_PW=$(openssl rand -hex 16)
  MINIO_PW=$(openssl rand -hex 16)
  sed -i "s/YOUR_DB_PASSWORD/$DB_PW/" .env
  sed -i "s/YOUR_MINIO_USER/cae_admin/" .env
  sed -i "s/YOUR_MINIO_PASSWORD/$MINIO_PW/" .env
  echo "   ✅ Generated secure passwords"
fi

# ── Check ports are free ──
for port in 8000 3001 5433 6380 9002 9003; do
  if ss -tlnp | grep -q ":$port "; then
    echo "⚠️  Port $port is in use! Please free it before deploying."
    exit 1
  fi
done
echo "✅ All ports available"

# ── Build and start ──
echo ""
echo "📦 Building CAE images (3-5 min first time)..."
docker compose -f docker-compose.prod.yml build --parallel

echo ""
echo "🚀 Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# ── Health checks ──
echo ""
echo "📋 Service Status:"
docker compose -f docker-compose.prod.yml ps

echo ""
echo "======================================"
echo "✅ Deployment complete!"
echo ""
echo "📌 Endpoints:"
echo "   Backend API:  http://localhost:8000"
echo "   Backend Docs: http://localhost:8000/docs"
echo "   Frontend:     http://localhost:3001"
echo "   MinIO Console: http://localhost:9003"
echo ""
echo "🔧 Test: curl http://localhost:8000/health"
echo "📋 Logs: docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "🔄 Future updates:"
echo "   git pull && bash deploy.sh"
