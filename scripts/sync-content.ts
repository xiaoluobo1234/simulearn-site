/**
 * sync-content.ts — 将 R2 中管理员编辑的内容覆盖同步回 Git 源文件。
 *
 * 用法：
 *   npx tsx scripts/sync-content.ts [--domain tools] [--dry-run]
 *
 * 环境变量（二选一）：
 *   方式 A — 通过已部署 API（需要 SIMULEARN_AI_USERNAME / SIMULEARN_AI_PASSWORD）：
 *     SYNC_API_BASE=https://simulearn.cn SIMULEARN_AI_USERNAME=... SIMULEARN_AI_PASSWORD=... npx tsx scripts/sync-content.ts
 *
 *   方式 B — 通过 wrangler 直读 R2（需要本地 wrangler 配置）：
 *     npx tsx scripts/sync-content.ts
 *
 * 映射说明：
 *   - tools 域 → src/data/tools-tutorials-*.ts（按分类拆分）
 *   - 其他域（structural/thermal/fluids/multiphysics/chip）→ src/data/{domain}-learning.ts
 *
 * 脚本会读取 R2 覆盖，更新对应 TypeScript 源文件中的 title/description/markdown，
 * 然后提示你执行 git diff 和 git commit。
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──

interface ContentOverride {
  slug: string;
  domain: string;
  title?: string;
  description?: string;
  aiContent?: string;
  updatedAt: string;
  createdAt: string;
}

interface ContentOverrideSummary {
  slug: string;
  domain: string;
  title: string;
  updatedAt: string;
}

// ── Config ──

const API_BASE = process.env.SYNC_API_BASE || 'https://simulearn.cn';
const USERNAME = process.env.SIMULEARN_AI_USERNAME || '';
const PASSWORD = process.env.SIMULEARN_AI_PASSWORD || '';
const DRY_RUN = process.argv.includes('--dry-run');
const DOMAIN_FILTER = process.argv.includes('--domain')
  ? process.argv[process.argv.indexOf('--domain') + 1]
  : null;

const PROJECT_ROOT = path.resolve(__dirname, '..');

// Map domain → array of source files that contain tutorial markdown
const DOMAIN_FILE_MAP: Record<string, string[]> = {
  tools: [
    'src/data/tools-tutorials-foundation.ts',
    'src/data/tools-tutorials-language.ts',
    'src/data/tools-tutorials-control.ts',
    'src/data/tools-tutorials-structure.ts',
  ],
  structural: ['src/data/structural-learning.ts'],
  thermal: ['src/data/thermal-learning.ts'],
  fluids: ['src/data/fluids-learning.ts'],
  multiphysics: ['src/data/multiphysics-learning.ts'],
  chip: ['src/data/chip-learning.ts'],
};

// Map tools tutorials to their files by slug prefix
const TOOLS_FILE_SLUGS: Record<string, string> = {
  'python-intro': 'src/data/tools-tutorials-foundation.ts',
  'python-install': 'src/data/tools-tutorials-foundation.ts',
  'first-program': 'src/data/tools-tutorials-foundation.ts',
  'syntax-basics': 'src/data/tools-tutorials-foundation.ts',
  'variables-and-naming': 'src/data/tools-tutorials-foundation.ts',
  'input-output': 'src/data/tools-tutorials-language.ts',
  'numbers-booleans-none': 'src/data/tools-tutorials-language.ts',
  'strings-basics': 'src/data/tools-tutorials-language.ts',
  'type-conversion': 'src/data/tools-tutorials-language.ts',
  'basic-operators': 'src/data/tools-tutorials-language.ts',
  'control-flow-if': 'src/data/tools-tutorials-control.ts',
  'loops-for-while': 'src/data/tools-tutorials-control.ts',
  'lists': 'src/data/tools-tutorials-control.ts',
  'tuples': 'src/data/tools-tutorials-control.ts',
  'dicts': 'src/data/tools-tutorials-control.ts',
  'sets': 'src/data/tools-tutorials-structure.ts',
  'functions': 'src/data/tools-tutorials-structure.ts',
  'modules-packages': 'src/data/tools-tutorials-structure.ts',
  'file-io': 'src/data/tools-tutorials-structure.ts',
  'error-handling': 'src/data/tools-tutorials-structure.ts',
};

// ── Helpers ──

function log(message: string) {
  process.stdout.write(`[sync-content] ${message}\n`);
}

function warn(message: string) {
  process.stderr.write(`[sync-content] ⚠ ${message}\n`);
}

function bail(message: string): never {
  process.stderr.write(`[sync-content] ✗ ${message}\n`);
  process.exit(1);
}

// ── Fetch overrides via API ──

async function fetchOverridesFromApi(): Promise<ContentOverride[]> {
  if (!USERNAME || !PASSWORD) {
    bail('缺少 SIMULEARN_AI_USERNAME / SIMULEARN_AI_PASSWORD 环境变量。请设置后重试，或使用 wrangler 模式。');
  }

  const auth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  };

  const domains = DOMAIN_FILTER ? [DOMAIN_FILTER] : Object.keys(DOMAIN_FILE_MAP);
  const overrides: ContentOverride[] = [];

  for (const domain of domains) {
    log(`从 API 获取 ${domain} 域覆盖列表...`);
    const listResponse = await fetch(`${API_BASE}/api/ai/content/${domain}`, { headers });
    if (!listResponse.ok) {
      warn(`获取 ${domain} 列表失败 (${listResponse.status})，跳过。`);
      continue;
    }
    const listData = await listResponse.json() as { ok: boolean; overrides: ContentOverrideSummary[] };
    if (!listData.ok || !listData.overrides) {
      warn(`${domain} 域无覆盖数据。`);
      continue;
    }

    for (const summary of listData.overrides) {
      log(`  获取 ${domain}/${summary.slug} ...`);
      const getResponse = await fetch(`${API_BASE}/api/ai/content/${domain}/${summary.slug}`, { headers });
      if (!getResponse.ok) {
        warn(`获取 ${domain}/${summary.slug} 失败 (${getResponse.status})，跳过。`);
        continue;
      }
      const getData = await getResponse.json() as { ok: boolean; override: ContentOverride | null };
      if (getData.ok && getData.override) {
        overrides.push(getData.override);
      }
    }
  }

  return overrides;
}

// ── Fetch overrides via wrangler R2 ──

async function fetchOverridesFromR2(): Promise<ContentOverride[]> {
  try {
    execSync('wrangler --version', { cwd: PROJECT_ROOT, stdio: 'pipe' });
  } catch {
    bail('wrangler 不可用。请安装或使用 API 模式（设置 SIMULEARN_AI_USERNAME / SIMULEARN_AI_PASSWORD）。');
  }

  const prefix = DOMAIN_FILTER ? `content/${DOMAIN_FILTER}/` : 'content/';
  log(`通过 wrangler 列出 R2 对象 (prefix: ${prefix})...`);

  let output: string;
  try {
    output = execSync(`wrangler r2 object list BOOKS --prefix "${prefix}" --json`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (err: any) {
    bail(`wrangler r2 object list 失败: ${err.message || err}`);
  }

  let objects: Array<{ key: string }> = [];
  try {
    const parsed = JSON.parse(output);
    objects = parsed || [];
  } catch {
    bail('无法解析 wrangler R2 输出。');
  }

  const overrides: ContentOverride[] = [];
  for (const obj of objects) {
    const match = obj.key.match(/^content\/([a-z]+)\/(.+)\.json$/);
    if (!match) continue;

    log(`  下载 ${obj.key} ...`);
    try {
      const content = execSync(`wrangler r2 object get BOOKS "${obj.key}"`, {
        cwd: PROJECT_ROOT,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      const override = JSON.parse(content) as ContentOverride;
      overrides.push(override);
    } catch (err: any) {
      warn(`下载 ${obj.key} 失败: ${err.message || err}`);
    }
  }

  return overrides;
}

// ── Apply overrides to source files ──

function applyOverride(override: ContentOverride): boolean {
  const { domain, slug, title, description, aiContent } = override;

  // Determine target file
  let filePath: string;
  if (domain === 'tools') {
    filePath = TOOLS_FILE_SLUGS[slug];
    if (!filePath) {
      warn(`tools 域中未知 slug: ${slug}，跳过。`);
      return false;
    }
  } else {
    const files = DOMAIN_FILE_MAP[domain];
    if (!files || files.length === 0) {
      warn(`未知域: ${domain}，跳过。`);
      return false;
    }
    filePath = files[0];
  }

  const fullPath = path.resolve(PROJECT_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    warn(`源文件不存在: ${filePath}，跳过。`);
    return false;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');

  // Find the tutorial entry for this slug
  // Tutorial entries look like: 'slug': String.raw`...content...`
  const entryStartPattern = new RegExp(
    `(['"])${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\s*:\\s*String\\.raw\``,
    'g',
  );

  const match = entryStartPattern.exec(content);
  if (!match) {
    warn(`${filePath} 中未找到 ${slug} 教程条目，跳过。`);
    return false;
  }

  // We found the entry but modifying String.raw content with title/description
  // requires understanding the structure. For now, we update the markdown body
  // and log that title/description changes need manual review.

  // Find the end of this String.raw block (ends with `, or `\n  'next-slug')
  const startOfBody = match.index + match[0].length;
  // Find the closing backtick followed by comma or next entry
  const bodyRest = content.slice(startOfBody);
  const endMatch = bodyRest.match(/\n\`,\s*$/m) || bodyRest.match(/\n\`,\s*\n/);
  if (!endMatch) {
    warn(`${slug}: 无法确定 String.raw 块结束位置，跳过。`);
    return false;
  }

  const bodyEnd = startOfBody + (endMatch.index ?? bodyRest.length);
  const oldBody = content.slice(startOfBody, bodyEnd);

  if (aiContent && aiContent !== oldBody) {
    if (DRY_RUN) {
      log(`  [DRY-RUN] 将更新 ${filePath} → ${slug} 正文 (${aiContent.length} 字符)`);
    } else {
      content = content.slice(0, startOfBody) + aiContent + content.slice(bodyEnd);
      fs.writeFileSync(fullPath, content, 'utf-8');
      log(`  ✓ 更新 ${filePath} → ${slug} 正文`);
    }
  }

  // Title / description changes are trickier because they live in the catalog,
  // not in the tutorial files. Log a reminder.
  if (title || description) {
    log(`  📝 ${slug}: title/description 有覆盖（title=${title || '(未改)'}, desc=${description || '(未改)'}）`);
    log(`     这些字段存储在 learning-catalog 中，需要手动更新。`);
  }

  return true;
}

// ── Main ──

async function main() {
  log('开始同步 R2 内容覆盖 → Git 源文件...');
  if (DRY_RUN) log('*** DRY-RUN 模式，不会实际写入 ***');

  let overrides: ContentOverride[];

  if (USERNAME && PASSWORD) {
    log('使用 API 模式获取覆盖...');
    overrides = await fetchOverridesFromApi();
  } else {
    log('使用 wrangler R2 模式获取覆盖...');
    overrides = await fetchOverridesFromR2();
  }

  if (overrides.length === 0) {
    log('没有找到任何内容覆盖。无需同步。');
    return;
  }

  log(`共找到 ${overrides.length} 条覆盖，开始应用...`);

  let applied = 0;
  for (const override of overrides) {
    if (applyOverride(override)) applied++;
  }

  log(`完成！已应用 ${applied}/${overrides.length} 条覆盖。`);

  if (!DRY_RUN && applied > 0) {
    log('');
    log('下一步：');
    log('  1. git diff   — 查看更改');
    log('  2. git add -A && git commit -m "sync: 从 R2 同步内容编辑"');
    log('  3. git push   — 部署到 Cloudflare');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
