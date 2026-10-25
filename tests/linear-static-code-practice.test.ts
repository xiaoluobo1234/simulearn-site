import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../public/downloads/linear-static-exercises/', import.meta.url));
const bundledPython = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.SIMULEARN_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'py' : 'python3');
const run = (source: string) => JSON.parse(execFileSync(python, ['-c', source, directory], {
  encoding: 'utf8', timeout: 30_000, windowsHide: true, maxBuffer: 2 * 1024 * 1024,
  env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
}));
const sha = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const evidence = JSON.parse(readFileSync(join(directory, 'reference-check-results.json'), 'utf8'));

describe('offline linear-static code practice with an intentionally unfinished scaffold', () => {
  it('keeps the two TODOs separate from reference answers and records four real reference-check groups', () => {
    const scaffold = readFileSync(join(directory, 'exercise.py'), 'utf8');
    expect(scaffold.match(/raise NotImplementedError/g)).toHaveLength(2);
    expect(scaffold).not.toContain('import reference_solution');
    expect(readFileSync(join(directory, 'reference_solution.py'), 'utf8')).toContain('REFERENCE ANSWER');
    expect(evidence.execution.executor).toBe('Codex AI执行环境中的Python参考实现检查');
    expect(evidence.execution.python_implementation).toBe('CPython');
    expect(evidence.execution.executed_at_asia_shanghai).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+08:00$/);
    expect(evidence.execution.not_evidence_of).toEqual(expect.arrayContaining(['学员已完成TODO', '用户本机运行', 'ANSYS或CAE运行']));
    expect(evidence.groups).toHaveLength(4);
    expect(evidence.reference_implementation).toMatchObject({ tests_run: 10, successful: true, failures: 0, errors: 0, returncode: 0 });
    expect(evidence.default_unfinished_scaffold).toMatchObject({ tests_run: 10, successful: false, failures: 10, returncode: 1 });
    expect(evidence.deliberately_incorrect_implementations).toHaveLength(6);
    expect(evidence.deliberately_incorrect_implementations.every((item: any) => item.detected && !item.successful && item.failures > 0)).toBe(true);
  });

  it('actually executes default and reference implementations and shows signed expected/actual including support external load', () => {
    const probe = String.raw`
import json,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]); results=[]
for extra in ([],['--implementation',str(root/'reference_solution.py')]):
 done=subprocess.run([sys.executable,str(root/'run_tests.py'),*extra],capture_output=True,encoding='utf-8')
 results.append({'returncode':done.returncode,'stdout':done.stdout,'stderr':done.stderr})
print(json.dumps(results))
`;
    const [scaffold, reference] = run(probe);
    expect(scaffold.returncode).toBe(1);
    expect(scaffold.stdout).toContain('actual=NotImplementedError (TODO unfinished)');
    expect(scaffold.stdout).toContain('[SUMMARY] tests=10 failures=10 errors=0 successful=false');
    expect(reference.returncode).toBe(0);
    expect(reference.stdout).toContain('[SUMMARY] tests=10 failures=0 errors=0 successful=true');
    expect(reference.stdout).toContain('loaded-support / recover_reaction: expected=-10500 N; actual=-10500.0 N');
    expect(reference.stdout).toContain('reverse-load / recover_reaction: expected=10000 N; actual=10000.0 N');
    expect(reference.stdout).toContain('coupled-matrix / strain_energy: expected=11.5 N mm; actual=11.5 N mm');
    expect(reference.stdout).toContain('zero-motion / strain_energy: expected=0 N mm; actual=0.0 N mm');
    expect(reference.stdout.match(/\[COMPARE\]/g)).toHaveLength(10);
  });

  it('really detects six common wrong implementations instead of only checking saved success flags', () => {
    const probe = String.raw`
import json,pathlib,re,subprocess,sys,tempfile
root=pathlib.Path(sys.argv[1])
mutations={
 'reaction_omits_external_load':'def recover_reaction(K,u,F,support_dof):\n    return sum(K[support_dof][j]*u[j] for j in range(len(u)))\n',
 'reaction_absolute_value':'def recover_reaction(K,u,F,support_dof):\n    return abs(_reaction(K,u,F,support_dof))\n',
 'reaction_reversed_sign':'def recover_reaction(K,u,F,support_dof):\n    return -_reaction(K,u,F,support_dof)\n',
 'energy_missing_half':'def strain_energy(K,u):\n    return 2*_energy(K,u)\n',
 'energy_diagonal_only':'def strain_energy(K,u):\n    return 0.5*sum(K[i][i]*u[i]*u[i] for i in range(len(u)))\n',
 'energy_joules_instead_of_Nmm':'def strain_energy(K,u):\n    return _energy(K,u)/1000\n'}
results=[]
with tempfile.TemporaryDirectory(prefix='simulearn-code-practice-tests-') as temporary:
 for name,body in mutations.items():
  implementation=pathlib.Path(temporary)/(name+'.py')
  implementation.write_text('import sys\nsys.path.insert(0,'+repr(str(root))+')\nfrom reference_solution import recover_reaction as _reaction, strain_energy as _energy\nrecover_reaction=_reaction\nstrain_energy=_energy\n'+body,encoding='utf-8')
  done=subprocess.run([sys.executable,str(root/'run_tests.py'),'--implementation',str(implementation)],capture_output=True,encoding='utf-8')
  match=re.search(r'\[SUMMARY\] tests=(\d+) failures=(\d+) errors=(\d+) successful=(true|false)',done.stdout)
  results.append({'id':name,'returncode':done.returncode,'tests_run':int(match[1]),'failures':int(match[2]),'errors':int(match[3]),'successful':match[4]=='true','has_expected_actual':'expected=' in done.stdout and 'actual=' in done.stdout})
print(json.dumps(results))
`;
    const results = run(probe);
    expect(results).toHaveLength(6);
    for (const result of results) {
      expect(result).toMatchObject({ returncode: 1, tests_run: 10, successful: false, has_expected_actual: true, errors: 0 });
      expect(result.failures).toBeGreaterThan(0);
      const saved = evidence.deliberately_incorrect_implementations.find((item: any) => item.id === result.id);
      expect(result.failures).toBe(saved.failures);
    }
  });

  it('verifies archive hashes and runs both modes after extraction without repository imports', () => {
    const probe = String.raw`
import hashlib,json,pathlib,subprocess,sys,tempfile,zipfile
root=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(root/'code-practice.zip') as archive:
 names=archive.namelist()
 if archive.testzip() is not None: raise RuntimeError('ZIP CRC error')
 for name in names:
  if name not in ('exercise.py','reference_solution.py','run_tests.py','fixtures.json','README.md','reference-check-results.json','PACKAGE-SHA256SUMS.txt'): raise RuntimeError('unexpected member')
  if archive.read(name)!=(root/name).read_bytes(): raise RuntimeError('archive mismatch')
 manifest=archive.read('PACKAGE-SHA256SUMS.txt').decode('ascii').strip().splitlines()
 for line in manifest:
  expected,name=line.split('  ')
  if hashlib.sha256(archive.read(name)).hexdigest()!=expected:raise RuntimeError('member hash mismatch')
 with tempfile.TemporaryDirectory(prefix='simulearn-code-practice-package-') as temporary:
  archive.extractall(temporary); folder=pathlib.Path(temporary)
  default=subprocess.run([sys.executable,str(folder/'run_tests.py')],cwd=temporary,capture_output=True,encoding='utf-8')
  reference=subprocess.run([sys.executable,str(folder/'run_tests.py'),'--implementation','reference_solution.py'],cwd=temporary,capture_output=True,encoding='utf-8')
  print(json.dumps({'names':names,'hash_entries':len(manifest),'default_status':default.returncode,'reference_status':reference.returncode,'default_unfinished':'actual=NotImplementedError' in default.stdout,'reference_ok':'tests=10 failures=0 errors=0 successful=true' in reference.stdout}))
`;
    const value = run(probe);
    expect(value.names.sort()).toEqual(['PACKAGE-SHA256SUMS.txt', 'README.md', 'exercise.py', 'fixtures.json', 'reference-check-results.json', 'reference_solution.py', 'run_tests.py']);
    expect(value).toMatchObject({ hash_entries: 6, default_status: 1, reference_status: 0, default_unfinished: true, reference_ok: true });
  });

  it('checks every distribution digest and leaves the default scaffold and saved evidence unchanged', () => {
    const lines = readFileSync(join(directory, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/);
    const files = lines.map(line => {
      const match = line.match(/^([a-f0-9]{64})  ([a-zA-Z0-9_.-]+)$/);
      expect(match).not.toBeNull();
      const [, expected, name] = match!;
      expect(sha(readFileSync(join(directory, name)))).toBe(expected);
      return name;
    });
    expect(new Set(files).size).toBe(8);
    expect(files.sort()).toEqual(readdirSync(directory).filter(name => name !== 'SHA256SUMS.txt' && name !== '__pycache__').sort());
    expect(JSON.parse(readFileSync(join(directory, 'reference-check-results.json'), 'utf8'))).toEqual(evidence);
    expect(readFileSync(join(directory, 'exercise.py'), 'utf8').match(/raise NotImplementedError/g)).toHaveLength(2);
  });
});
