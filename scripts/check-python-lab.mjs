import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const folder=path.resolve('public/vendor/pyodide/314.0.7');
const {loadPyodide}=await import(pathToFileURL(path.join(folder,'pyodide.mjs')).href);
const py=await loadPyodide({indexURL:folder,jsglobals:Object.freeze(Object.create(null))});
const output=[],errors=[];
py.setStdout({batched:text=>output.push(text)});py.setStderr({batched:text=>errors.push(text)});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function execute(codeFile,inputFile){
 const code=fs.readFileSync(codeFile),input=fs.readFileSync(inputFile);
 output.length=0;errors.length=0;py.globals.set('input_text',input.toString('utf8'));
 let state='completed',error=null;
 try{py.runPython(code.toString('utf8'));}catch(caught){state='error';error=String(caught.message);}
 return {code:path.basename(codeFile),input:path.basename(inputFile),codeSha256:sha(code),inputSha256:sha(input),stdout:output.join('\n'),stderr:errors.join('\n'),state,error};
}
const base='public/downloads/python-lab/';
const checks=[execute(base+'csv_check.py',base+'sample.csv'),execute(base+'axial_bar.py',base+'bar-input.json')];
if(checks.some(check=>check.state!=='completed'))throw Error('Reference template did not complete');
const csvProjectChecks=['normal','missing-field','non-numeric','missing-unit'].map(id=>({id,...execute(base+'csv_check.py',`public/downloads/csv-checker/${id}.csv`)}));
if(!csvProjectChecks[0].stdout.includes('读取 4 行；检查发现 0 项问题')||csvProjectChecks[1].state!=='error'||!csvProjectChecks[1].error.includes('缺少表头')||!csvProjectChecks[2].stdout.includes("value='abc'")||!csvProjectChecks[3].stdout.includes("单位 ''"))throw Error('Expected CSV fixture behavior did not match');
const metadata={schemaVersion:1,executedAt:new Date().toISOString(),executor:'Codex AI execution environment',host:`${process.platform} ${process.arch}`,node:process.version,runtime:`CPython ${py.runPython('import sys; sys.version.split()[0]')} / Pyodide ${py.version} WebAssembly under Node (not browser Worker)`,arithmeticActual:py.runPython('2+2'),jsFetchVisible:py.runPython('import js; hasattr(js,"fetch")'),checks,csvProjectVersion:'csv-checker-v1',csvProjectChecks,scope:'Actual Node-hosted Python reference execution only. Browser acceptance separate; user local execution, human review and CAE not run.'};
fs.writeFileSync(base+'runtime-check.json',JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({runtime:metadata.runtime,checks:checks.map(check=>({code:check.code,state:check.state})),csvProjectChecks:csvProjectChecks.map(check=>({id:check.id,state:check.state})),executedAt:metadata.executedAt}));
