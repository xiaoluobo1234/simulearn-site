import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendLabOutput, createLabResult, hasLabSession, LAB_OUTPUT_LIMIT, LAB_TEXT_LIMIT, pythonLabTemplates, PYODIDE_BASE, PYODIDE_VERSION, validLabRun } from '../src/lib/python-lab';

const assets = resolve('public/vendor/pyodide', PYODIDE_VERSION);
const downloads = resolve('public/downloads/python-lab');
function checkManifest(folder: string) {
  const lines = readFileSync(resolve(folder, 'SHA256SUMS.txt'), 'utf8').trim().split(/\r?\n/);
  expect(lines.length).toBeGreaterThan(4);
  for (const line of lines) {
    const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
    expect(match, line).not.toBeNull();
    expect(createHash('sha256').update(readFileSync(resolve(folder, match![2]))).digest('hex'), match![2]).toBe(match![1]);
  }
  const listed = lines.map(line => line.slice(66)).sort();
  expect(listed).toEqual(readdirSync(folder).filter(name => name !== 'SHA256SUMS.txt').sort());
}

describe('Python lab contracts and real runtime', () => {
  it('only accepts a valid existing account response, not a truthy user shell', () => {
    expect(hasLabSession({ ok: true, user: { userId: 'local-acceptance' } })).toBe(true);
    for (const value of [null, {}, { ok: true, user: null }, { ok: true, user: {} }, { ok: true, user: { userId: '' } }, { ok: false, user: { userId: 'x' } }]) expect(hasLabSession(value)).toBe(false);
  });
  it('validates worker messages and limits without turning the input into code', () => {
    const request = { type: 'run', id: 'local-123', code: 'print(2 + 2)', input: '"; raise RuntimeError("not code")' };
    expect(validLabRun(request)).toBe(true);
    for (const value of [{ ...request, id: '../../x' }, { ...request, code: '' }, { ...request, code: 'x'.repeat(LAB_TEXT_LIMIT + 1) }, { ...request, input: null }, { ...request, type: 'stop' }]) expect(validLabRun(value)).toBe(false);
    const result = createLabResult(request.code, request.input, '2026-10-25T00:00:00.000Z');
    expect(result.input).toBe(request.input);
    expect(result).toMatchObject({ state: 'loading', environment: null, finishedAt: null, stdout: '', stderr: '' });
    expect(result.limitation).toContain('不证明');
  });
  it('marks every discarded output chunk within the cap, including an exact earlier boundary', () => {
    const marker = '\n[输出达到上限，已截断]';
    const exact = 'x'.repeat(LAB_OUTPUT_LIMIT);
    expect(appendLabOutput('', exact)).toBe(exact);
    expect(appendLabOutput(exact, '')).toBe(exact);
    for (const [current, incoming] of [[exact, 'TAIL'], [exact.slice(1), 'TAIL'], ['', '中'.repeat(LAB_OUTPUT_LIMIT + 100)], [exact + 'legacy oversized output', '']]) {
      const output = appendLabOutput(current, incoming);
      expect(output).toHaveLength(LAB_OUTPUT_LIMIT);
      expect(output.endsWith(marker)).toBe(true);
      expect(output).not.toContain('TAIL');
      expect(appendLabOutput(output, 'more output')).toBe(output);
    }
  });
  it('keeps self-hosted upstream files and fallback files byte-verifiable', () => {
    expect(PYODIDE_BASE).toBe('/vendor/pyodide/314.0.7/');
    checkManifest(assets); checkManifest(downloads);
    const metadata = JSON.parse(readFileSync(resolve(assets, 'SOURCE.json'), 'utf8'));
    expect(metadata.version).toBe(PYODIDE_VERSION);
    expect(metadata.source).toBe('https://registry.npmjs.org/pyodide/-/pyodide-314.0.7.tgz');
    expect(readFileSync(resolve(assets, 'pyodide.asm.wasm')).subarray(0, 4)).toEqual(Buffer.from([0, 97, 115, 109]));
    for (const template of pythonLabTemplates) {
      expect(template.code).toBe(readFileSync(resolve(downloads, template.codeFile), 'utf8'));
      expect(template.input).toBe(readFileSync(resolve(downloads, template.inputFile), 'utf8'));
    }
  });
  it('runs both actual Python templates and rejects bad values in the real bundled interpreter', () => {
    // This is real CPython/WebAssembly under Node, not a Python or output mock.
    // Browser Worker execution, termination and auth are covered separately by E2E.
    const program = String.raw`
      const fs = require('node:fs');
      const path = require('node:path');
      const {pathToFileURL} = require('node:url');
      (async () => {
        const folder = path.resolve('public/vendor/pyodide/314.0.7');
        const {loadPyodide} = await import(pathToFileURL(path.join(folder,'pyodide.mjs')).href);
        const py = await loadPyodide({indexURL:folder,jsglobals:Object.freeze(Object.create(null))});
        const output=[];
        py.setStdout({batched: text=>output.push(text)});
        function execute(file,input) {
          output.length=0; py.globals.set('input_text', input);
          py.runPython(fs.readFileSync('public/downloads/python-lab/'+file,'utf8'));
          return output.join('\n');
        }
        const csv=fs.readFileSync('public/downloads/python-lab/sample.csv','utf8');
        const bar=fs.readFileSync('public/downloads/python-lab/bar-input.json','utf8');
        const actual={version:py.runPython('import sys; sys.version.split()[0]'), arithmetic:py.runPython('2+2'),
          jsFetch:py.runPython('import js; hasattr(js,"fetch")'),
          csv:execute('csv_check.py',csv), badCsv:execute('csv_check.py',csv.replace('A,100,','A,abc,')),
          bar:execute('axial_bar.py',bar)};
        const negative=JSON.parse(bar); negative.P.value=-10000;
        actual.negative=execute('axial_bar.py',JSON.stringify(negative));
        const zero=JSON.parse(bar); zero.P.value=0;
        actual.zero=execute('axial_bar.py',JSON.stringify(zero));
        const invalid=JSON.parse(bar); invalid.A.value=0;
        try {execute('axial_bar.py',JSON.stringify(invalid)); actual.invalid='did not fail';}
        catch(e) {actual.invalid=String(e.message);}
        console.log(JSON.stringify(actual));
      })().catch(error=>{console.error(error);process.exit(1)});
    `;
    const child = spawnSync(process.execPath, ['-e', program], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1_000_000 });
    expect(child.status, child.stderr).toBe(0);
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1)!);
    expect(result.version).toBe('3.14.2'); expect(result.arithmetic).toBe(4); expect(result.jsFetch).toBe(false);
    expect(result.csv).toContain('读取 4 行；检查发现 0 项问题');
    expect(result.badCsv).toContain('第 3 行: value=\'abc\'');
    expect(result.bar).toContain('端位移 = 0.476190476 mm');
    expect(result.bar).toContain('左端反力 = -10000.000000 N');
    expect(result.negative).toContain('端位移 = -0.476190476 mm');
    expect(result.negative).toContain('应变能 = 2380.952381');
    expect(result.zero).toContain('应变能 = 0.000000');
    expect(result.invalid).toContain('A 必须大于 0');
  }, 35_000);
});
