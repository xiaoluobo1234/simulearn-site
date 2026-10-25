import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {linearStaticBenchmarks} from '../src/data/linear-static-benchmarks.ts';
const bundled=join(homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','python','python.exe');
const python=process.env.SIMULEARN_PYTHON||(existsSync(bundled)?bundled:process.platform==='win32'?'py':'python3');
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const keys={'tip-displacement':'tip_displacement_mm','reaction-force':'reaction_force_N','strain-energy':'strain_energy_Nmm'};
const cases=[];
for(const item of linearStaticBenchmarks){
  const root=`public/downloads/linear-static/${item.slug}`;
  const saved=JSON.parse(readFileSync(`${root}/reference-results.json`,'utf8'));
  const actual=JSON.parse(execFileSync(python,[`${root}/verify.py`,'--input',`${root}/input.json`,'--executor','构建环境中的教材参考复核'],{encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:4*1024*1024,env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONDONTWRITEBYTECODE:'1'}}));
  const inputHash=hash(`${root}/input.json`);
  if(actual.input_sha256!==inputHash||saved.input_sha256!==inputHash)throw Error(`参考输出的输入指纹不一致: ${item.slug}`);
  if(actual.checks?.passed!==true||saved.checks?.passed!==true)throw Error(`参考程序自检未通过: ${item.slug}`);
  for(const quantity of item.quantities){const value=actual.quantities?.[keys[quantity.id]];
    if(!Number.isFinite(value)||Math.abs(value-quantity.value)>Math.max(1e-7,Math.abs(quantity.value)*1e-8))throw Error(`教材数值与实际参考运行不一致: ${item.slug}/${quantity.id}`);
    const archived=saved.quantities?.[keys[quantity.id]];
    if(!Number.isFinite(archived)||Math.abs(value-archived)>Math.max(1e-7,Math.abs(value)*1e-8))throw Error(`已保存参考输出与实际运行不一致: ${item.slug}/${quantity.id}`);
  }
  const files=[`${root}/input.json`,`${root}/verify.py`,`${root}/reference-results.json`,'src/data/linear-static-benchmarks.ts'];
  cases.push({id:`benchmark:${item.slug}`,check:'matched',executor:actual.execution,quantities:actual.quantities,files:files.map(path=>({path,sha256:hash(path)}))});
}
let sourceCommit='unavailable',workingTree='unknown';try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();workingTree=execFileSync('git',['status','--porcelain'],{encoding:'utf8',windowsHide:true}).trim()?'modified':'clean';}catch{}
mkdirSync('public/generated',{recursive:true});
writeFileSync('public/generated/learning-evidence.json',JSON.stringify({schemaVersion:1,contentVersion:'linear-static-v1',generatedAt:new Date().toISOString(),sourceCommit,workingTree,reviewStatus:'pending-human-review',scope:'构建环境重跑教学参考，不代表用户实践、人工审核或在线CAE验收',cases},null,2)+'\n');
console.log(`教材参考复核：${cases.length} 个案例的程序、展示数值与文件指纹已关联。`);
