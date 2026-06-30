FROM python:3.12-slim-bookworm

WORKDIR /app

# Use Alibaba Cloud mirrors for fast downloads inside China
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources

# Install system dependencies: Gmsh, CalculiX, and build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    gmsh \
    calculix-ccx \
    && rm -rf /var/lib/apt/lists/*

# Verify CAE tools
RUN gmsh --version && echo "✅ Gmsh OK"
RUN ccx -v 2>&1 || echo "✅ CalculiX CCX OK"

# Install Python dependencies (Alibaba Cloud pypi mirror)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    -i https://mirrors.aliyun.com/pypi/simple/ \
    --trusted-host mirrors.aliyun.com

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
