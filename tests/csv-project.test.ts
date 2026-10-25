import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { csvProjectCases, csvProjectVersion, readCsvProjectCase } from '../src/lib/csv-project';

describe('bounded CSV checker project', () => {
  it('uses the exact public fixture bytes and records expectations rather than learner outcomes', () => {
    expect(csvProjectVersion).toBe('csv-checker-v1');
    expect(csvProjectCases.map(item => item.id)).toEqual(['normal', 'missing-field', 'non-numeric', 'missing-unit']);
    for (const item of csvProjectCases) {
      expect(item.input).toBe(readFileSync(resolve('public', item.href.slice(1)), 'utf8'));
      expect(item.input.length).toBeLessThan(64_000);
      expect(item.expected.length).toBeGreaterThan(0);
      expect(item).not.toHaveProperty('actual');
      expect(item).not.toHaveProperty('completed');
    }
  });

  it('selects one known case only for the CSV template and never reads code or data from the URL', () => {
    for (const item of csvProjectCases) {
      expect(readCsvProjectCase(`?template=csv&case=${item.id}`)).toBe(item);
      expect(readCsvProjectCase(`?input=PRIVATE&case=${item.id}&template=csv&code=raise+Exception()`)).toBe(item);
    }
    for (const query of ['', '?case=normal', '?template=csv', '?template=bar&case=normal', '?template=csv&case=unknown',
      '?template=csv&case=__proto__', '?template=csv&case=normal&case=normal', '?template=csv&case=normal&case=missing-unit',
      '?template=csv&template=csv&case=normal', '?template=bar&template=csv&case=normal', '?template=csv&case=Normal']) {
      expect(readCsvProjectCase(query), query).toBeNull();
    }
  });

  it('executes the actual standalone Python file path against all four cases and malformed inputs in bundled CPython', () => {
    // Real CPython/WebAssembly, real script bytes and UTF-8 file reading via sys.argv.
    // No evaluator or output mock, and no host Python installation required in CI.
    const program = String.raw`
      const fs = require('node:fs');
      const path = require('node:path');
      const {pathToFileURL} = require('node:url');
      (async () => {
        const folder = path.resolve('public/vendor/pyodide/314.0.7');
        const {loadPyodide} = await import(pathToFileURL(path.join(folder, 'pyodide.mjs')).href);
        const py = await loadPyodide({indexURL: folder, jsglobals: Object.freeze(Object.create(null))});
        const output=[];
        py.setStdout({batched: text => output.push(text)});
        py.FS.writeFile('/csv_check.py', fs.readFileSync('public/downloads/python-lab/csv_check.py'));
        function execute(input) {
          output.length = 0;
          py.FS.writeFile('/input.csv', input);
          try {
            py.runPython('import runpy, sys\nsys.argv = ["csv_check.py", "/input.csv"]\nrunpy.run_path("/csv_check.py", run_name="__main__")\nNone');
            return {ok: true, stdout: output.join('\n')};
          } catch(error) { return {ok: false, stdout: output.join('\n'), error: String(error.message)}; }
        }
        const normal=fs.readFileSync('public/downloads/csv-checker/normal.csv','utf8');
        const cases={};
        for(const id of ['normal','missing-field','non-numeric','missing-unit']) cases[id]=execute(fs.readFileSync('public/downloads/csv-checker/'+id+'.csv','utf8'));
        const result={cases,
          reordered:execute('unit,value,parameter\nN/mm2,2.1e5,E\nmm2,+1e2,A\nmm,1000.,L\nN,-.5e4,P\n'),
          bom:execute('\ufeff'+normal.replace(/\r?\n/g,'\r\n')),
          duplicate:execute(normal.replace('parameter,value,unit','parameter,value,unit,value')),
          unknown:execute(normal.replace('parameter,value,unit','parameter,value,unit,note')),
          blankLine:execute(normal.replace('A,100,mm2','\nA,abc,mm2')),
          multiline:execute(normal.replace('A,100,mm2','A,"1\n00",mm2')),
          fewer:execute(normal.replace('A,100,mm2','A,100')),
          more:execute(normal.replace('A,100,mm2','A,100,mm2,EXTRA')),
          negativeE:execute(normal.replace('E,210000,','E,-1,')),
          zeroP:execute(normal.replace('P,10000,','P,0,')),
          preserved:execute(normal.replace('A,100,','A, 10mm ,')),
          numbers:{},quotes:{}
        };
        for(const value of ['NaN','Infinity','-Infinity','1_000','100mm','1e999','0x10','１２３']) result.numbers[value]=execute(normal.replace('A,100,','A,'+value+','));
        for(const [name,value] of Object.entries({bare:'A,10"0,mm2',unclosed:'A,"100,mm2',tail:'A,"100"oops,mm2',space:'A,"100" ,mm2'})) result.quotes[name]=execute(normal.replace('A,100,mm2',value));
        result.quoted=execute(normal.replace('A,100,mm2','"A","100","mm2"'));
        console.log(JSON.stringify(result));
      })().catch(error=>{console.error(error);process.exit(1)});
    `;
    const child = spawnSync(process.execPath, ['-e', program], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1_000_000 });
    expect(child.status, child.stderr).toBe(0);
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/).at(-1)!);
    expect(result.cases.normal).toMatchObject({ ok: true });
    expect(result.cases.normal.stdout).toContain("表头（原始字符串）: ['parameter', 'value', 'unit']");
    expect(result.cases.normal.stdout).toContain("第 2 行: ['E', '210000', 'N/mm2']");
    expect(result.cases.normal.stdout).toContain('读取 4 行；检查发现 0 项问题');
    expect(result.cases['missing-field']).toMatchObject({ ok: false });
    expect(result.cases['missing-field'].error).toContain('ValueError: 缺少表头: unit');
    expect(result.cases['non-numeric']).toMatchObject({ ok: true });
    expect(result.cases['non-numeric'].stdout).toContain("第 3 行: value='abc' 无法解析为有限数值");
    expect(result.cases['non-numeric'].stdout).toContain('读取 4 行；检查发现 1 项问题');
    expect(result.cases['missing-unit']).toMatchObject({ ok: true });
    expect(result.cases['missing-unit'].stdout).toContain("第 2 行: 单位 '' 不符合本练习约定，不自动换算");
    expect(result.cases['missing-unit'].stdout).toContain('读取 4 行；检查发现 1 项问题');
    for (const key of ['reordered', 'bom', 'quoted', 'zeroP']) {
      expect(result[key], key).toMatchObject({ ok: true });
      expect(result[key].stdout, key).toContain('读取 4 行；检查发现 0 项问题');
    }
    expect(result.duplicate.error).toContain('表头重复: value');
    expect(result.unknown.error).toContain('未知表头: note');
    expect(result.blankLine.stdout).toContain("第 4 行: value='abc'");
    expect(result.multiline.stdout).toContain("第 3 行: value='1\\n00'");
    expect(result.fewer.stdout).toContain('第 3 行: 列数 2 与表头 3 不一致');
    expect(result.more.stdout).toContain("['A', '100', 'mm2', 'EXTRA']");
    expect(result.more.stdout).toContain('第 3 行: 列数 4 与表头 3 不一致');
    expect(result.negativeE.stdout).toContain('E 必须大于 0');
    expect(result.preserved.stdout).toContain("value=' 10mm '");
    for (const [value, outcome] of Object.entries(result.numbers) as [string, {ok: boolean; stdout: string}][]) {
      expect(outcome.ok, value).toBe(true);
      expect(outcome.stdout, value).toContain('无法解析为有限数值');
      expect(outcome.stdout, value).toContain('检查发现 1 项问题');
    }
    for (const outcome of Object.values(result.quotes) as {ok: boolean; error: string}[]) {
      expect(outcome.ok).toBe(false);
      expect(outcome.error).toContain('ValueError: CSV 格式错误');
    }
  }, 35_000);
});
