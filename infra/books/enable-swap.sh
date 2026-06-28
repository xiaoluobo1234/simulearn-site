#!/usr/bin/env bash
set -euo pipefail

SWAP_FILE="${SWAP_FILE:-/swapfile}"
SWAP_SIZE_MB="${SWAP_SIZE_MB:-4096}"

if swapon --show=NAME --noheadings | grep -qx "${SWAP_FILE}"; then
  echo "${SWAP_FILE} already active"
  exit 0
fi

if [[ ! -f "${SWAP_FILE}" ]]; then
  fallocate -l "${SWAP_SIZE_MB}M" "${SWAP_FILE}" || dd if=/dev/zero of="${SWAP_FILE}" bs=1M count="${SWAP_SIZE_MB}"
fi
chmod 600 "${SWAP_FILE}"
mkswap "${SWAP_FILE}"
swapon "${SWAP_FILE}"
grep -qF "${SWAP_FILE} none swap sw 0 0" /etc/fstab || echo "${SWAP_FILE} none swap sw 0 0" >> /etc/fstab
sysctl vm.swappiness=10
cat >/etc/sysctl.d/99-simulearn-books.conf <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
EOF
echo "4 GiB swap enabled"
