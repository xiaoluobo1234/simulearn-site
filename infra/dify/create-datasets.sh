#!/usr/bin/env bash
set -euo pipefail

required_vars=(
  DIFY_API_URL
  DIFY_DATASET_API_KEY
  DIFY_EMBEDDING_MODEL
  DIFY_EMBEDDING_PROVIDER
)

for variable in "${required_vars[@]}"; do
  if [[ -z "${!variable:-}" ]]; then
    echo "缺少环境变量：${variable}"
    exit 1
  fi
done

for command in curl jq; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "缺少命令：${command}"
    exit 1
  fi
done

base_url="${DIFY_API_URL%/}"
base_url="${base_url%/v1}"
output_file="${DIFY_DATASET_OUTPUT:-datasets.json}"

declare -A names=(
  [structural]="SimuLearn｜结构"
  [thermal]="SimuLearn｜热"
  [fluids]="SimuLearn｜流体"
  [multiphysics]="SimuLearn｜多物理场"
  [chip]="SimuLearn｜芯片仿真"
  [private]="SimuLearn｜私有原始资料"
  [review]="SimuLearn｜待审核整理区"
)

slugs=(structural thermal fluids multiphysics chip private review)
result='{}'

headers=(
  -H "Authorization: Bearer ${DIFY_DATASET_API_KEY}"
  -H "Content-Type: application/json"
)

if [[ -n "${CF_ACCESS_CLIENT_ID:-}" && -n "${CF_ACCESS_CLIENT_SECRET:-}" ]]; then
  headers+=(
    -H "CF-Access-Client-Id: ${CF_ACCESS_CLIENT_ID}"
    -H "CF-Access-Client-Secret: ${CF_ACCESS_CLIENT_SECRET}"
  )
fi

for slug in "${slugs[@]}"; do
  name="${names[$slug]}"
  description="SimuLearn ${name#*｜}知识区。上传、公开和检索权限由人工审核规则控制。"
  payload="$(jq -n \
    --arg name "${name}" \
    --arg description "${description}" \
    --arg model "${DIFY_EMBEDDING_MODEL}" \
    --arg provider "${DIFY_EMBEDDING_PROVIDER}" \
    '{
      name: $name,
      description: $description,
      permission: "only_me",
      provider: "vendor",
      indexing_technique: "high_quality",
      embedding_model: $model,
      embedding_model_provider: $provider
    }')"

  echo "创建：${name}"
  response="$(curl -fsS "${base_url}/v1/datasets" \
    -X POST \
    "${headers[@]}" \
    --data "${payload}")"
  dataset_id="$(jq -r '.id // empty' <<<"${response}")"
  if [[ -z "${dataset_id}" ]]; then
    echo "创建失败：${response}"
    exit 1
  fi
  result="$(jq --arg slug "${slug}" --arg id "${dataset_id}" '. + {($slug): $id}' <<<"${result}")"
done

jq '.' <<<"${result}" > "${output_file}"
echo
echo "已写入 ${output_file}"
echo "将文件内容作为 DIFY_DATASETS_JSON 加密变量保存到 Cloudflare Pages。"
