import type { LearningDomainSlug } from '../data/learning-catalog';

export type SearchType = 'kp' | 'error' | 'page' | 'case';
export interface SearchEntry {
  id: string;
  type: SearchType;
  title: string;
  description: string;
  href: string;
  domain?: LearningDomainSlug;
  group?: string;
  level?: string;
  keywords?: string[];
  code?: string;
}
export interface SearchOptions { domain?: string; type?: string; limit?: number }
export interface SearchResults { items: SearchEntry[]; total: number; query: string; truncated: boolean }
export const MAX_SEARCH_QUERY_LENGTH = 120;
const domains = ['structural', 'thermal', 'fluids', 'multiphysics', 'chip', 'tools'];
const types = ['kp', 'error', 'page', 'case'];
const publicPages = new Set([
  '/', '/learning', '/learning/records', '/library', '/tools', '/fea-series', '/cases',
  '/diagnostic', '/failures', '/errors', '/books', '/cae', '/about', '/search',
]);

/** A deliberately narrow route allowlist, including only existing public content. */
export function isSafeSearchHref(href: unknown): href is string {
  if (typeof href !== 'string' || href.length > 250 || !href.startsWith('/') || /[\\%?\s\u0000-\u001f]/.test(href)) return false;
  const path = href.length > 1 ? href.replace(/\/$/, '') : href;
  if (publicPages.has(path)) return true;
  if (path === '/learning/projects/linear-static') return true;
  return /^\/domains\/(structural|thermal|fluids|multiphysics|chip)(?:\/kp\/[a-z0-9]+(?:-[a-z0-9]+)*)?\/?$/.test(href)
    || /^\/domains\/tools\/kp\/[a-z0-9]+(?:-[a-z0-9]+)*\/?$/.test(href)
    || /^\/errors\/#(?:ANSYS|ABAQUS|GENERAL|FLUENT|LSDYNA)-\d{3}$/.test(href)
    || /^\/cases\/rock-dynamic-stability\/?$/.test(href)
    || /^\/cases\/benchmarks\/(uniform-bar|stepped-bar|cantilever-beam)\/?$/.test(href)
    || /^\/diagnostic\/(rigid-body|nonconvergence|stress-singularity|units|force-balance|boundary)\/?$/.test(href);
}

function normalizeText(value: string): string {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[‐‑‒–—−]/g, '-').replace(/\s+/g, ' ').trim();
}
export function normalizeSearchQuery(value: string): string {
  return normalizeText(value).slice(0, MAX_SEARCH_QUERY_LENGTH).trim();
}
// Alternatives within one group are OR; distinct query terms are always AND.
const aliasGroups = [
  ['csv', '文件读写', '读写文件', '文件读取', '读取文件', 'fileio', 'file-io'],
  ['fea', 'fem', '有限元', '有限元分析', '有限元法', 'finite element', 'finite-element'],
  ['cfd', '流体', '流体仿真', '计算流体力学', 'computational fluid dynamics'],
  ['numpy', 'np', '数组计算'], ['scipy', '科学计算'], ['python', 'py'],
  ['apdl', '命令流'], ['结构', 'structural'], ['热分析', 'thermal', '热仿真', '热', 'heat'],
  ['多物理场', 'multiphysics'], ['芯片', 'chip'],
  ['单位', '单位制', 'unit', 'units'],
  ['不收敛', 'nonconvergence', 'non-convergence', 'not converged', '收敛失败'],
  ['接触', 'contact'], ['刚体位移', 'rigid body motion'], ['网格', 'mesh'],
];
const aliases = new Map<string, string[]>();
for (const group of aliasGroups) for (const term of group) aliases.set(term, group);
const chinesePhrases = [...new Set([
  ...aliasGroups.flat().filter((term) => /^[\p{Script=Han}]+$/u.test(term)),
  '刚度矩阵', '单元畸变', '负体积', '浮点异常', '求解器', '求解', '读取', '文件', '读写',
  '数值', '字符串', '数据类型', '模态', '阻尼', '边界条件', '能量', '应力', '应变', '位移',
  '案例', '资料', '学习记录', '学习', '深部围岩', '卸荷', '动力响应', '稳定性', '失败复盘',
])].sort((a, b) => b.length - a.length);
const stopCharacters = new Set(['的', '与', '和', '及']);

function chineseTokens(text: string): string[] {
  // A small engineering phrase vocabulary handles “接触不收敛” without the old
  // OR-per-character behavior. Unknown phrases remain intact rather than fuzzy.
  const tokens: string[] = [];
  let unknown = '';
  const flush = () => { if (unknown) tokens.push(unknown); unknown = ''; };
  for (let offset = 0; offset < text.length;) {
    const phrase = chinesePhrases.find((term) => text.startsWith(term, offset));
    if (phrase) { flush(); tokens.push(phrase); offset += phrase.length; }
    else if (stopCharacters.has(text[offset])) { flush(); offset++; }
    else { unknown += text[offset]; offset++; }
  }
  flush();
  return tokens;
}

function queryTerms(query: string): string[][] {
  let expanded = query;
  for (const group of aliasGroups) for (const phrase of group) {
    if (phrase.includes(' ')) expanded = expanded.replace(new RegExp(`(^|[^a-z0-9])${phrase}(?=$|[^a-z0-9])`, 'g'), `$1${group[0]}`);
  }
  const rawTokens = expanded.match(/[a-z0-9]+(?:[-_.+#][a-z0-9]+)*|[\p{Script=Han}]+/gu) || [];
  const tokens = rawTokens.flatMap((token) => /^[\p{Script=Han}]+$/u.test(token) ? chineseTokens(token) : [token]);
  // A lone common Chinese character is not a useful full-site query.
  if (tokens.length === 1 && /^[\p{Script=Han}]$/u.test(tokens[0]) && !aliases.has(tokens[0])) return [];
  return [...new Set(tokens)].map((token) => aliases.get(token) || [token]);
}

function includesTerm(text: string, term: string): boolean {
  if (!term || !text) return false;
  if (/^[a-z0-9]{1,2}$/.test(term)) {
    // Short aliases such as “np” must not match the middle of “input”.
    const words: string[] = text.match(/[a-z0-9]+/g) || [];
    return words.includes(term);
  }
  return text.includes(term);
}

function normalizedFields(entry: SearchEntry) {
  return {
    title: normalizeText(entry.title), code: normalizeText(entry.code || ''),
    description: normalizeText(entry.description),
    keywords: normalizeText((entry.keywords || []).join(' ')),
    group: normalizeText(entry.group || ''),
    domain: normalizeText(entry.domain || ''),
  };
}

/** Pure synchronous search. It has no network, account storage or AI dependency. */
export function searchEntries(index: readonly SearchEntry[], input: string, options: SearchOptions = {}): SearchResults {
  const query = normalizeSearchQuery(input);
  const domain = normalizeSearchQuery(options.domain || '');
  const type = normalizeSearchQuery(options.type || '');
  const empty = { items: [], total: 0, query, truncated: false };
  if ((domain && domain !== 'all' && !domains.includes(domain)) || (type && type !== 'all' && !types.includes(type))) return empty;
  const terms = queryTerms(query);
  if (query && !terms.length) return empty;
  const matched: Array<{ item: SearchEntry; score: number; position: number }> = [];
  for (let position = 0; position < index.length; position++) {
    const entry = index[position];
    if (!isSafeSearchHref(entry.href) || !types.includes(entry.type)) continue;
    if (domain && domain !== 'all' && entry.domain !== domain) continue;
    if (type && type !== 'all' && entry.type !== type) continue;
    if (!query) { matched.push({ item: entry, score: 0, position }); continue; }
    const fields = normalizedFields(entry);
    let score = 0;
    let allMatched = true;
    for (const alternatives of terms) {
      let termScore = 0;
      for (const term of alternatives) {
        if (includesTerm(fields.title, term)) termScore = Math.max(termScore, 100);
        if (includesTerm(fields.code, term)) termScore = Math.max(termScore, 120);
        if (includesTerm(fields.keywords, term)) termScore = Math.max(termScore, 60);
        if (includesTerm(fields.group, term)) termScore = Math.max(termScore, 45);
        if (includesTerm(fields.description, term)) termScore = Math.max(termScore, 25);
        if (includesTerm(fields.domain, term)) termScore = Math.max(termScore, 20);
      }
      if (!termScore) { allMatched = false; break; }
      score += termScore;
    }
    if (!allMatched) continue;
    if (fields.code === query) score += 100_000;
    if (fields.title === query) score += 90_000;
    else if (fields.title.includes(query)) score += 1_000;
    matched.push({ item: entry, score, position });
  }
  matched.sort((a, b) => b.score - a.score || (query ? a.item.title.localeCompare(b.item.title, 'zh-CN') : a.position - b.position));
  const limit = Number.isFinite(options.limit) ? Math.max(0, Math.min(index.length, Math.floor(options.limit!))) : 20;
  return { items: matched.slice(0, limit).map(({ item }) => item), total: matched.length, query, truncated: matched.length > limit };
}
