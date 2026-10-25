/** Build/server-only module. No account, R2, simulation or private progress reads. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { contentProvenance, type ContentProvenance } from '../data/content-provenance';
import {
  assertReviewPath, humanReviewChecks, reviewSourcePaths,
  REVIEW_AUTOMATION_SCOPE, REVIEW_INSTRUCTIONS, REVIEW_REPOSITORY, REVIEW_SCOPE, STACKED_REVIEW_PRS,
  type ContentReviewPack, type ReviewAutomation, type ReviewSourceFile,
} from './content-review-pack';

const sha256 = (bytes: string | Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const SHA = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const benchmarkSlugs = ['uniform-bar', 'stepped-bar', 'cantilever-beam'];
interface BuildOptions { root?: string; catalog?: readonly ContentProvenance[]; generatedAt?: string }

/** Stable binding excludes timestamps and review decisions, includes exact public source bytes/version. */
export function reviewItemFingerprint(id: string, version: string, files: readonly Pick<ReviewSourceFile, 'path' | 'sha256'>[]): string {
  return sha256(JSON.stringify({ id, contentVersion: version, files: [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0).map(file => ({ path: file.path, sha256: file.sha256 })) }));
}

export function buildContentReviewPack(options: BuildOptions = {}): ContentReviewPack {
  const root = realpathSync(options.root ?? process.cwd());
  const catalog = options.catalog ?? contentProvenance;
  function git(args: string[], input?: string): Buffer {
    return execFileSync('git', args, { cwd: root, input, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  }
  const sourceCommit = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  if (!COMMIT.test(sourceCommit)) throw new Error('Human review pack requires an actual Git HEAD commit.');
  const workingTree = git(['status', '--porcelain', '--untracked-files=normal']).length ? 'modified' as const : 'clean' as const;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error('Invalid human review pack generation time.');
  const cache = new Map<string, ReviewSourceFile>();
  const seen = new Set<string>();
  const bundles = catalog.map(item => {
    if (seen.has(item.id) || !item.id || !item.version || !/^\/[a-z0-9/-]+\/$/.test(item.href)) throw new Error(`Invalid or duplicate review content: ${item.id}`);
    seen.add(item.id);
    return { item, paths: reviewSourcePaths(item) };
  });
  const committedHashes = new Map<string, string | null>();
  const paths = [...new Set(bundles.flatMap(bundle => bundle.paths))];
  if (paths.length) {
    // Batch binary-safe reads avoid spawning Git once per file (including the 9 MB WASM asset).
    const output = git(['cat-file', '--batch'], `${paths.map(path => `${sourceCommit}:${path}`).join('\n')}\n`);
    let offset = 0;
    for (const path of paths) {
      const end = output.indexOf(10, offset);
      if (end < offset) throw new Error('Incomplete Git source snapshot header.');
      const header = output.subarray(offset, end).toString('utf8');
      offset = end + 1;
      if (header.endsWith(' missing')) { committedHashes.set(path, null); continue; }
      const match = /^[a-f0-9]{40} blob (\d+)$/.exec(header);
      if (!match) throw new Error(`Git review source is not a blob: ${path}`);
      const size = Number(match[1]);
      if (!Number.isSafeInteger(size) || offset + size >= output.length || output[offset + size] !== 10) throw new Error('Incomplete Git source snapshot bytes.');
      committedHashes.set(path, sha256(output.subarray(offset, offset + size)));
      offset += size + 1;
    }
    if (offset !== output.length) throw new Error('Unexpected bytes in Git source snapshot.');
  }

  function currentPath(path: string): string {
    assertReviewPath(path);
    const resolved = realpathSync(resolve(root, path)); // Missing files fail instead of yielding empty fingerprints.
    const within = relative(root, resolved);
    if (!within || within === '..' || within.startsWith(`..${sep}`) || isAbsolute(within) || !statSync(resolved).isFile()) throw new Error(`Review file leaves repository or is not a file: ${path}`);
    return resolved;
  }
  function fileFingerprint(path: string): ReviewSourceFile {
    const saved = cache.get(path);
    if (saved) return { ...saved };
    const bytes = readFileSync(currentPath(path));
    const fingerprint = sha256(bytes);
    const committedSha256 = committedHashes.get(path) ?? null;
    const matchesCommit = committedSha256 === fingerprint;
    const result = {
      path, sha256: fingerprint, sizeBytes: bytes.length, committedSha256, matchesCommit,
      commitUrl: matchesCommit ? `${REVIEW_REPOSITORY}/blob/${sourceCommit}/${path.split('/').map(encodeURIComponent).join('/')}` : null,
    };
    cache.set(path, result);
    return { ...result };
  }

  const items = bundles.map(({ item, paths }) => {
    const files = paths.map(fileFingerprint);
    const fingerprint = reviewItemFingerprint(item.id, item.version, files);
    return {
      id: item.id, title: item.title, href: item.href, contentVersion: item.version, sourcePath: item.sourcePath, fingerprint, files,
      checks: humanReviewChecks(item.id),
      humanReview: { state: 'pending' as const, reviewer: null, reviewedAt: null, conclusion: null, notes: null, boundContentVersion: item.version, boundFingerprint: fingerprint },
    };
  });

  function automation(): ReviewAutomation {
    const empty = (status: ReviewAutomation['status']): ReviewAutomation => ({ status, generatedAt: null, sourceCommit: null, scope: REVIEW_AUTOMATION_SCOPE, cases: [] });
    const path = resolve(root, 'public/generated/learning-evidence.json');
    if (!existsSync(path)) return empty('unavailable');
    try {
      const data = JSON.parse(readFileSync(currentPath('public/generated/learning-evidence.json'), 'utf8'));
      if (data?.schemaVersion !== 1 || data.contentVersion !== 'linear-static-v1' || !COMMIT.test(data.sourceCommit) || !Number.isFinite(Date.parse(data.generatedAt)) || !Array.isArray(data.cases) || data.cases.length !== 3) return empty('invalid');
      const ids = new Set<string>();
      const cases = data.cases.map((value: { id: string; check: string; files: { path: string; sha256: string }[] }) => {
        if (!value || !benchmarkSlugs.some(slug => value.id === `benchmark:${slug}`) || ids.has(value.id) || value.check !== 'matched' || !Array.isArray(value.files)) throw Error('Invalid reference case.');
        ids.add(value.id);
        const slug = value.id.slice('benchmark:'.length);
        const expected = [`public/downloads/linear-static/${slug}/input.json`, `public/downloads/linear-static/${slug}/verify.py`, `public/downloads/linear-static/${slug}/reference-results.json`, 'src/data/linear-static-benchmarks.ts'].sort();
        if (value.files.length !== 4 || value.files.some(file => !file || typeof file.path !== 'string' || !SHA.test(file.sha256)) || JSON.stringify(value.files.map(file => file.path).sort()) !== JSON.stringify(expected)) throw Error('Invalid reference fingerprints.');
        return { id: value.id, currentFilesMatch: value.files.every(file => fileFingerprint(file.path).sha256 === file.sha256) };
      });
      const sameVersions = items.filter(item => item.id.startsWith('benchmark:')).every(item => item.contentVersion === data.contentVersion);
      const current = data.sourceCommit === sourceCommit && sameVersions && cases.every((item: { currentFilesMatch: boolean }) => item.currentFilesMatch);
      return { status: current ? 'matched-to-current-files' : 'stale', generatedAt: data.generatedAt, sourceCommit: data.sourceCommit, scope: REVIEW_AUTOMATION_SCOPE, cases };
    } catch { return empty('invalid'); }
  }

  return {
    schemaVersion: 1, kind: 'human-review-draft', generatedAt, repository: REVIEW_REPOSITORY, sourceCommit, workingTree,
    scope: REVIEW_SCOPE, instructions: [...REVIEW_INSTRUCTIONS], publication: { state: 'pending-human-review', approved: false },
    stackedPullRequests: STACKED_REVIEW_PRS.map(pr => ({ ...pr })), items, automatedEvidence: automation(),
  };
}

/** One build snapshot is shared by static downloads and public provenance components. */
let buildSnapshot: ContentReviewPack | undefined;
export function getBuildContentReviewPack(): ContentReviewPack { return buildSnapshot ??= buildContentReviewPack(); }
