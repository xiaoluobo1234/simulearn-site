import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';

const repository = fileURLToPath(new URL('../', import.meta.url));
const script = join(repository, 'scripts', 'verify-learning-evidence.mjs');
const packageRelative = join('public', 'downloads', 'linear-static');
const catalogRelative = join('src', 'data', 'linear-static-benchmarks.ts');
const bundled = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
// Match the production evidence script's interpreter preference exactly. An
// explicit, broken SIMULEARN_PYTHON setting is a configuration failure, not a skip.
const explicitPython = process.env.SIMULEARN_PYTHON;
const python = explicitPython || (existsSync(bundled) ? bundled : process.platform === 'win32' ? 'py' : 'python3');
const probe = spawnSync(python, ['--version'], { encoding: 'utf8', windowsHide: true, timeout: 10_000 });
const versionText = `${probe.stdout || ''} ${probe.stderr || ''}`;
const version = versionText.match(/Python (\d+)\.(\d+)/);
const pythonAvailable = !probe.error && probe.status === 0 && !!version && (Number(version[1]) > 3 || Number(version[1]) === 3 && Number(version[2]) >= 10);
const nodeAvailable = Number(process.versions.node.split('.')[0]) >= 24;
const temporaryRoot = resolve(tmpdir());
const fixturePrefix = 'simulearn-evidence-';
const fixtures: string[] = [];
const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
const rootFiles = [script, join(repository, catalogRelative), ...linearStaticBenchmarks.flatMap(item => ['verify.py', 'input.json', 'reference-results.json'].map(name => join(repository, packageRelative, item.slug, name)))];
const rootDigests = new Map(rootFiles.map(path => [path, digest(path)]));

function fixture() {
  const directory = mkdtempSync(join(temporaryRoot, fixturePrefix));
  fixtures.push(directory);
  cpSync(join(repository, packageRelative), join(directory, packageRelative), { recursive: true });
  mkdirSync(join(directory, 'src', 'data'), { recursive: true });
  cpSync(join(repository, catalogRelative), join(directory, catalogRelative));
  return directory;
}
function archivedPath(directory: string, slug = 'uniform-bar') { return join(directory, packageRelative, slug, 'reference-results.json'); }
function modifyArchived(directory: string, mutate: (value: any) => void) {
  const path = archivedPath(directory); const saved = JSON.parse(readFileSync(path, 'utf8'));
  mutate(saved); writeFileSync(path, JSON.stringify(saved, null, 2) + '\n');
}
function run(directory: string) {
  // The absolute .mjs imports the real read-only TypeScript catalog, while
  // every calculation input, archived output, hash and manifest uses fixture cwd.
  return spawnSync(process.execPath, [script], {
    cwd: directory, encoding: 'utf8', windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, SIMULEARN_PYTHON: python, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
  });
}
function expectRefused(directory: string, reason: string) {
  const result = run(directory);
  expect(result.error).toBeUndefined(); expect(result.status).not.toBe(0);
  expect(result.stderr).toContain(reason);
  expect(existsSync(join(directory, 'public', 'generated', 'learning-evidence.json'))).toBe(false);
  expect(result.stdout).not.toContain('3 个案例');
}
afterEach(() => {
  for (const directory of fixtures.splice(0)) {
    // Check the final absolute target before recursive removal on Windows.
    const target = resolve(directory);
    if (dirname(target) !== temporaryRoot || !basename(target).startsWith(fixturePrefix)) throw Error('Refusing to remove a path outside the dedicated temporary fixture.');
    rmSync(target, { recursive: true, force: true });
  }
});
afterAll(() => { for (const [path, hash] of rootDigests) expect(digest(path)).toBe(hash); });

describe.skipIf(!nodeAvailable || (!pythonAvailable && !explicitPython))('actual build-evidence gate in isolated cwd (Node 24 and Python 3.10+)', () => {
  it('actually runs all three teaching solvers and writes a pending-human-review manifest with correct local file hashes', () => {
    expect(pythonAvailable, `Configured Python must be available: ${python}\n${versionText}`).toBe(true);
    const directory = fixture(); const started = Date.now(); const result = run(directory);
    expect(result.error).toBeUndefined(); expect(result.status, result.stderr).toBe(0); expect(result.stdout).toContain('3 个案例');
    const manifest = JSON.parse(readFileSync(join(directory, 'public', 'generated', 'learning-evidence.json'), 'utf8'));
    expect(manifest).toMatchObject({ schemaVersion: 1, contentVersion: 'linear-static-v1', reviewStatus: 'pending-human-review' });
    expect(manifest.scope).toContain('不代表用户实践'); expect(manifest.scope).toContain('在线CAE验收');
    expect(Date.parse(manifest.generatedAt)).toBeGreaterThanOrEqual(started - 1000);
    expect(Date.parse(manifest.generatedAt)).toBeLessThanOrEqual(Date.now() + 1000);
    expect(manifest.cases).toHaveLength(3);
    const keys = { 'tip-displacement': 'tip_displacement_mm', 'reaction-force': 'reaction_force_N', 'strain-energy': 'strain_energy_Nmm' } as const;
    for (const item of linearStaticBenchmarks) {
      const current = manifest.cases.find((value: any) => value.id === `benchmark:${item.slug}`);
      expect(current.check).toBe('matched');
      expect(current.executor.executor).toBe('构建环境中的教材参考复核');
      expect(current.executor.python_version).toMatch(/^3\./);
      expect(current.executor.not_evidence_of).toContain('用户本机运行');
      for (const quantity of item.quantities) expect(current.quantities[keys[quantity.id]]).toBeCloseTo(quantity.value, 6);
      expect(current.files).toHaveLength(4);
      for (const file of current.files) expect(file.sha256).toBe(digest(join(directory, file.path)));
    }
    expect(manifest).not.toHaveProperty('userCompleted'); expect(manifest).not.toHaveProperty('humanReviewPassed');
  }, 60_000);
  it('refuses a modified archived scalar even when its input hash and self-check flag still agree', () => {
    const directory = fixture(); modifyArchived(directory, value => { value.quantities.tip_displacement_mm += 1; });
    expectRefused(directory, '已保存参考输出与实际运行不一致');
  }, 60_000);
  it('refuses an archived result bearing a different input hash', () => {
    const directory = fixture(); modifyArchived(directory, value => { value.input_sha256 = '0'.repeat(64); });
    expectRefused(directory, '参考输出的输入指纹不一致');
  }, 60_000);
  it('refuses an input-byte change even when the three numerical results would stay identical', () => {
    const directory = fixture(); const path = join(directory, packageRelative, 'uniform-bar', 'input.json');
    writeFileSync(path, readFileSync(path, 'utf8') + '\n');
    expectRefused(directory, '参考输出的输入指纹不一致');
  }, 60_000);
  it('refuses archived checks.passed=false rather than trusting matching target quantities', () => {
    const directory = fixture(); modifyArchived(directory, value => { value.checks.passed = false; });
    expectRefused(directory, '参考程序自检未通过');
  }, 60_000);
  it('refuses an actual solver result declaring failed checks, using only a mutated temporary solver copy', () => {
    const directory = fixture(); const path = join(directory, packageRelative, 'uniform-bar', 'verify.py');
    const original = readFileSync(path, 'utf8'); const changed = original.replace('"checks": {"passed": True', '"checks": {"passed": False');
    expect(changed).not.toBe(original); writeFileSync(path, changed);
    expectRefused(directory, '参考程序自检未通过');
  }, 60_000);
});
