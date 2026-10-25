import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { linearStaticBenchmarks } from '../src/data/linear-static-benchmarks';
import { getKnowledgePoint } from '../src/data/learning-catalog';

const directory = fileURLToPath(new URL('../public/downloads/linear-static/', import.meta.url));
const script = join(directory, 'verify.py');
const bundledPython = join(homedir(), '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'python', 'python.exe');
const python = process.env.SIMULEARN_PYTHON || (existsSync(bundledPython) ? bundledPython : process.platform === 'win32' ? 'py' : 'python3');
const slugs = ['uniform-bar', 'stepped-bar', 'cantilever-beam'] as const;
const records = slugs.map(slug => JSON.parse(readFileSync(join(directory, slug, 'reference-results.json'), 'utf8')));
const digest = (data: Buffer) => createHash('sha256').update(data).digest('hex');
function run(args: string[]) {
  return execFileSync(python, args, {
    encoding: 'utf8', timeout: 30_000, windowsHide: true, maxBuffer: 4 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONDONTWRITEBYTECODE: '1' },
  });
}
function near(actual: number, expected: number, absolute = 1e-7, relative = 1e-8) {
  expect(Number.isFinite(actual)).toBe(true);
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(absolute, Math.abs(expected) * relative));
}
const sourceKeys = {
  'tip-displacement': 'tip_displacement_mm',
  'reaction-force': 'reaction_force_N',
  'strain-energy': 'strain_energy_Nmm',
} as const;

describe('independent linear-static teaching FE packages', () => {
  it('keeps three draft contracts, signed quantities and valid lessons consistent with executed reference evidence', () => {
    expect(linearStaticBenchmarks.map(caseData => caseData.slug)).toEqual(slugs);
    const combined = JSON.parse(readFileSync(join(directory, 'reference-results.json'), 'utf8'));
    expect(combined.cases).toEqual(records);
    for (const [index, item] of linearStaticBenchmarks.entries()) {
      const record = records[index];
      expect(item.reviewStatus).toBe('draft');
      expect(item.quantities.map(quantity => quantity.id)).toEqual(['tip-displacement', 'reaction-force', 'strain-energy']);
      expect(item.downloadHref).toBe(`/downloads/linear-static/${item.slug}.zip`);
      expect(item.referenceHref).toBe(`/downloads/linear-static/${item.slug}/reference-results.json`);
      expect(record.execution.executor).toBe('Codex AI执行环境中的Python参考计算');
      expect(record.execution.python_implementation).toBe('CPython');
      expect(record.execution.python_version).toMatch(/^3\./);
      expect(record.execution.executed_at_asia_shanghai).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\+08:00$/);
      expect(record.execution.not_evidence_of).toEqual(expect.arrayContaining(['用户本机运行', 'ANSYS求解', 'CAE端到端验收']));
      const input = readFileSync(join(directory, item.slug, 'input.json'));
      expect(record.input_sha256).toBe(digest(input));
      expect(record.input).toEqual(JSON.parse(input.toString('utf8')));
      for (const quantity of item.quantities) {
        near(quantity.value, record.quantities[sourceKeys[quantity.id]]);
        expect(quantity.absoluteTolerance).toBe(1e-6);
        expect(quantity.relativeTolerance).toBe(0.005);
      }
      for (const related of item.related) {
        const id = related.href.match(/^\/domains\/structural\/kp\/([^/]+)\/$/)?.[1];
        expect(id).toBeTruthy();
        expect(getKnowledgePoint('structural', id!)).toBeTruthy();
      }
    }
    expect(records[0].quantities.reaction_force_N).toBe(-10000);
    expect(records[1].input.segments).toHaveLength(2);
    expect(records[1].finite_element.F_original).toEqual([0, 0, 10000]);
    expect(records[2].quantities.tip_displacement_mm).toBeLessThan(0);
    expect(records[2].quantities.reaction_force_N).toBeGreaterThan(0);
    near(records[2].support_moment_Nmm, 1000000);
  });

  it('actually reruns all standalone solvers and checks original-matrix reactions, physical energy and separate residual units', () => {
    for (const [index, slug] of slugs.entries()) {
      const saved = readFileSync(join(directory, slug, 'reference-results.json'), 'utf8');
      const actual = JSON.parse(run([join(directory, slug, 'verify.py'), '--executor', 'Vitest Python reference verification']));
      expect(actual.checks.passed).toBe(true);
      expect(actual.input_sha256).toBe(records[index].input_sha256);
      for (const key of Object.values(sourceKeys)) near(actual.quantities[key], records[index].quantities[key]);
      const fe = actual.finite_element;
      const Ku = fe.K_original.map((row: number[]) => row.reduce((sum, k, j) => sum + k * fe.u[j], 0));
      Ku.forEach((value: number, i: number) => near(value - fe.F_original[i], fe.reactions_and_free_residuals[i]));
      near(0.5 * fe.u.reduce((sum: number, u: number, i: number) => sum + u * Ku[i], 0), actual.quantities.strain_energy_Nmm);
      near(fe.element_energies_Nmm.reduce((a: number, b: number) => a + b, 0), actual.quantities.strain_energy_Nmm);
      near(actual.checks.global_force_balance_N, 0);
      expect(actual.checks.free_force_residual_max_N).toBeLessThan(1e-6);
      if (slug === 'cantilever-beam') {
        near(actual.checks.global_moment_balance_Nmm, 0, 1e-6);
        expect(actual.checks.free_moment_residual_max_Nmm).toBeLessThan(1e-6);
      }
      expect(readFileSync(join(directory, slug, 'reference-results.json'), 'utf8')).toBe(saved);
    }
  });

  it('assembles and solves different meshes and nonzero support motions rather than substituting tip formulas', () => {
    const probe = String.raw`
import importlib.util, json, pathlib, sys
root=pathlib.Path(sys.argv[1]); spec=importlib.util.spec_from_file_location('fe',root/'verify.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
rows=[]
for slug in ('uniform-bar','stepped-bar','cantilever-beam'):
 for n in (1,2,4,8,16):
  data=json.loads((root/slug/'input.json').read_text(encoding='utf-8'))
  data['left_displacement_mm']=0.2
  if data['model']=='axial-bar':
   for segment in data['segments']: segment['elements']=n
  else:
   data['elements']=n; data['left_rotation_rad']=0.0001
  result=module.calculate(data)
  rows.append({'slug':slug,'n':n,'quantities':result['quantities'],'analytical':result['analytical'],'nodes':len(result['finite_element']['coordinates_mm'])})
print(json.dumps(rows))
`;
    const rows = JSON.parse(run(['-c', probe, directory]));
    expect(rows).toHaveLength(15);
    for (const row of rows) {
      const index = slugs.indexOf(row.slug);
      const original = records[index].quantities;
      const shift = row.slug === 'cantilever-beam' ? 0.2 + 0.0001 * 1000 : 0.2;
      near(row.quantities.tip_displacement_mm, original.tip_displacement_mm + shift);
      near(row.quantities.reaction_force_N, original.reaction_force_N, 1e-5);
      near(row.quantities.strain_energy_Nmm, original.strain_energy_Nmm, 1e-5);
      expect(row.nodes).toBe(row.n * (row.slug === 'stepped-bar' ? 2 : 1) + 1);
      for (const key of Object.values(sourceKeys)) near(row.quantities[key], row.analytical[key], 1e-5);
    }
  });

  it('rejects invalid CLI inputs without modifying prior output, inputs or the solver itself', () => {
    const probe = String.raw`
import copy,json,pathlib,subprocess,sys,tempfile
root=pathlib.Path(sys.argv[1]); script=root/'verify.py'
bar=json.loads((root/'uniform-bar'/'input.json').read_text(encoding='utf-8'))
beam=json.loads((root/'cantilever-beam'/'input.json').read_text(encoding='utf-8'))
bad=[]
def altered(base,path,value):
 result=copy.deepcopy(base); target=result
 for key in path[:-1]: target=target[key]
 target[path[-1]]=value; return json.dumps(result)
bad += [altered(bar,['E_MPa'],0),altered(bar,['E_MPa'],True),altered(bar,['segments',0,'area_mm2'],-100),altered(bar,['segments',0,'length_mm'],0),altered(bar,['segments',0,'elements'],0),altered(bar,['segments',0,'elements'],1.5),altered(bar,['units','length'],'m'),altered(bar,['schema_version'],2),altered(bar,['slug'],'unknown'),altered(beam,['I_mm4'],0),altered(beam,['end_force_N'],float('nan')),'{bad',json.dumps(bar).replace('"E_MPa": 210000.0','"E_MPa": 210000.0, "E_MPa": 2')]
outcomes=[]
with tempfile.TemporaryDirectory(prefix='simulearn-fe-invalid-') as temporary:
 folder=pathlib.Path(temporary); source=folder/'input.json'; output=folder/'output.json'
 for raw in bad:
  source.write_text(raw,encoding='utf-8'); output.write_text('keep prior result',encoding='utf-8')
  done=subprocess.run([sys.executable,str(script),'--input',str(source),'--output',str(output)],capture_output=True,text=True)
  outcomes.append({'status':done.returncode,'stdout':done.stdout,'error':done.stderr,'prior':output.read_text(encoding='utf-8')})
 source.write_text(json.dumps(bar),encoding='utf-8'); old_input=source.read_bytes(); old_script=script.read_bytes()
 for forbidden in (source,script):
  done=subprocess.run([sys.executable,str(script),'--input',str(source),'--output',str(forbidden)],capture_output=True,text=True)
  if done.returncode != 2: raise RuntimeError('overwrite unexpectedly accepted')
 if source.read_bytes()!=old_input or script.read_bytes()!=old_script: raise RuntimeError('input/script changed')
print(json.dumps(outcomes))
`;
    const outcomes = JSON.parse(run(['-c', probe, directory]));
    expect(outcomes).toHaveLength(13);
    for (const outcome of outcomes) {
      expect(outcome.status).toBe(2);
      expect(outcome.stdout).toBe('');
      expect(outcome.error).toContain('Input/reference calculation failed:');
      expect(outcome.prior).toBe('keep prior result');
    }
  });

  it('validates ZIP contents and actually runs each extracted package with no repository dependency', () => {
    const probe = String.raw`
import hashlib,json,pathlib,subprocess,sys,tempfile,zipfile
root=pathlib.Path(sys.argv[1]); rows=[]
for slug in ('uniform-bar','stepped-bar','cantilever-beam'):
 with zipfile.ZipFile(root/(slug+'.zip')) as archive:
  names=archive.namelist()
  if sorted(names)!=sorted(['verify.py','input.json','reference-results.json','README.md']): raise RuntimeError('unexpected ZIP members')
  if archive.testzip() is not None: raise RuntimeError('ZIP CRC error')
  for name in names:
   if archive.read(name)!=(root/slug/name).read_bytes(): raise RuntimeError('archive file differs')
  with tempfile.TemporaryDirectory(prefix='simulearn-fe-package-') as temporary:
   archive.extractall(temporary)
   done=subprocess.run([sys.executable,str(pathlib.Path(temporary)/'verify.py')],cwd=temporary,capture_output=True,text=True,check=True,encoding='utf-8')
   result=json.loads(done.stdout)
   rows.append({'slug':slug,'files':names,'result':result['quantities'],'executor':result['execution']['executor'],'passed':result['checks']['passed']})
print(json.dumps(rows,ensure_ascii=False))
`;
    const rows = JSON.parse(run(['-c', probe, directory]));
    expect(rows).toHaveLength(3);
    for (const [index, row] of rows.entries()) {
      expect(row.files.sort()).toEqual(['README.md', 'input.json', 'reference-results.json', 'verify.py']);
      expect(row.passed).toBe(true);
      expect(row.executor).toBe('运行此脚本的 Python 环境（执行者未声明）');
      for (const key of Object.values(sourceKeys)) near(row.result[key], records[index].quantities[key]);
      expect(readFileSync(join(directory, row.slug, 'verify.py'))).toEqual(readFileSync(script));
    }
  });

  it('checks every distribution SHA-256 including all three ZIPs and rejects unlisted distribution files', () => {
    const lines = readFileSync(join(directory, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/);
    const covered = new Set<string>();
    for (const line of lines) {
      const match = line.match(/^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$/);
      expect(match).not.toBeNull();
      const [, hash, path] = match!;
      expect(path).not.toMatch(/(?:^|\/)\.\.(?:\/|$)/);
      expect(covered.has(path)).toBe(false);
      covered.add(path);
      expect(digest(readFileSync(join(directory, path)))).toBe(hash);
    }
    function collect(folder: string, prefix = ''): string[] {
      return readdirSync(folder, { withFileTypes: true }).flatMap(item => item.name === '__pycache__' ? [] : item.isDirectory()
        ? collect(join(folder, item.name), prefix + item.name + '/') : [prefix + item.name]);
    }
    expect([...covered].sort()).toEqual(collect(directory).filter(path => path !== 'SHA256SUMS.txt').sort());
    for (const slug of slugs) expect(covered.has(`${slug}.zip`)).toBe(true);
  });
});
