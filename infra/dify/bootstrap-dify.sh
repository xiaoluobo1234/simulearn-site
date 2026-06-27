#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="${DIFY_INSTALL_DIR:-/opt/dify}"
MIN_MEMORY_KIB=$((7 * 1024 * 1024))

if [[ "${EUID}" -ne 0 ]]; then
  echo "请使用 sudo bash $0 运行。"
  exit 1
fi

for command in docker git curl openssl; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "缺少命令：${command}"
    exit 1
  fi
done

if ! docker compose version >/dev/null 2>&1; then
  echo "未检测到 Docker Compose V2。"
  exit 1
fi

memory_kib="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
if [[ -z "${memory_kib}" || "${memory_kib}" -lt "${MIN_MEMORY_KIB}" ]]; then
  echo "可用物理内存不足 8 GiB 规格，停止安装。请先升级服务器。"
  exit 1
fi

if [[ -e "${INSTALL_DIR}" ]]; then
  echo "目标目录已存在：${INSTALL_DIR}"
  echo "为避免覆盖现有数据，脚本不会继续。"
  exit 1
fi

release_json="$(curl -fsSL https://api.github.com/repos/langgenius/dify/releases/latest)"
latest_tag=""
if [[ "${release_json}" =~ \"tag_name\"[[:space:]]*:[[:space:]]*\"([^\"]+)\" ]]; then
  latest_tag="${BASH_REMATCH[1]}"
fi
if [[ -z "${latest_tag}" ]]; then
  echo "无法读取 Dify 最新稳定版本。"
  exit 1
fi

echo "安装 Dify ${latest_tag} 到 ${INSTALL_DIR}"
git clone --depth 1 --branch "${latest_tag}" https://github.com/langgenius/dify.git "${INSTALL_DIR}"

cd "${INSTALL_DIR}/docker"
cp .env.example .env

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" .env; then
    sed -i "s|^${key}=.*|${key}=${value}|" .env
  else
    printf '\n%s=%s\n' "${key}" "${value}" >> .env
  fi
}

set_env "SECRET_KEY" "$(openssl rand -hex 32)"
set_env "UPLOAD_FILE_SIZE_LIMIT" "15"
set_env "UPLOAD_FILE_BATCH_LIMIT" "5"

docker compose pull
docker compose up -d

echo
echo "Dify 已启动。"
echo "检查状态：cd ${INSTALL_DIR}/docker && sudo docker compose ps"
echo "下一步：建立 Cloudflare Tunnel，并将 ai.simulearn.cn 指向 http://localhost:80"
