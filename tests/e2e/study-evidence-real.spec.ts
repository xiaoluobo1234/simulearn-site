import {expect,test,type Download,type Page} from '@playwright/test';
import {createHash} from 'node:crypto';

async function bytes(download:Download){
  const stream=await download.createReadStream();expect(stream).not.toBeNull();
  const chunks:Buffer[]=[];for await(const chunk of stream!)chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function download(page:Page,selector:string){const pending=page.waitForEvent('download');await page.locator(selector).click();return bytes(await pending);}

test('real Python and assembly exports can be archived and restored while all imported claims stay unverified',async({page,context,baseURL})=>{
  test.setTimeout(95_000);
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'),'Synthetic accounts and inputs stay on loopback.');
  await context.route('https://fonts.googleapis.com/**',route=>route.abort());
  await context.route('https://fonts.gstatic.com/**',route=>route.abort());
  await context.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,user:{userId:'local-evidence-acceptance'}}}));
  const writes:string[]=[];context.on('request',request=>{if(new URL(request.url()).pathname.startsWith('/api/')&&!['GET','HEAD','OPTIONS'].includes(request.method()))writes.push(request.url());});

  // The calculation engines and their output files are real, never mocked.
  await page.goto('/labs/python/?template=bar');
  await page.locator('[data-lab-run]').click();
  await expect(page.locator('[data-python-lab]')).toHaveAttribute('data-lab-state','succeeded',{timeout:55_000});
  const python=await download(page,'[data-lab-export="result"]');
  expect(JSON.parse(python.toString('utf8')).stdout).toContain('端位移 = 0.476190476');
  await page.goto('/labs/assembly/');
  await page.locator('#assembly-solve').click();
  await expect(page.locator('#assembly-result')).toBeVisible();
  const assembly=await download(page,'#assembly-export');
  expect(JSON.parse(assembly.toString('utf8')).solution.displacement[2]).toBeCloseTo(10/21,10);

  await page.goto('/learning/start/');
  const prediction='PRIVATE REAL-FILE ACCEPTANCE: 我准备核对实际输出，尚未确认复现。';
  await page.locator('#first-prediction').fill(prediction);
  for(const [name,buffer]of [['python-result.json',python],['assembly-result.json',assembly]] as const){
    await page.locator('#study-evidence-file').setInputFiles({name,mimeType:'application/json',buffer});
    await expect(page.locator('#study-evidence-preview')).toBeVisible();
    await expect(page.locator('#study-evidence-apply')).toBeEnabled();
    await page.locator('#study-evidence-apply').click();
  }
  const backupBytes=await download(page,'#first-study-export-json');
  const backup=JSON.parse(backupBytes.toString('utf8'));
  expect(backup.schemaVersion).toBe(2);expect(backup.evidence).toHaveLength(2);
  expect(backup.evidence.map((file:any)=>file.kind).sort()).toEqual(['assembly','python']);
  for(const file of backup.evidence){
    expect(file.trust).toBe('unverified-imported-file');
    expect(file.modelMatch).toBe('matches-guide-input');
    expect(file.sha256).toBe(createHash('sha256').update(file.kind==='python'?python:assembly).digest('hex'));
    expect(file.originalText).toBe((file.kind==='python'?python:assembly).toString('utf8'));
  }
  expect(backup.learningCompletion).toBe('not-assessed');expect(backup.executionEvidence.status).toBe('not-verified-by-guide');
  expect(backup.environment.status).toBe('not-provided');expect(backup.fields.prediction).toBe(prediction);
  expect(Object.values(backup.declarations).every((item:any)=>item.selfReported===false)).toBe(true);

  await page.reload();await expect(page.locator('#first-prediction')).toHaveValue('');
  await page.locator('#study-backup-file').setInputFiles({name:'private-study-backup.json',mimeType:'application/json',buffer:backupBytes});
  await expect(page.locator('#study-backup-preview')).toBeVisible();
  await expect(page.locator('#study-backup-apply')).toBeEnabled();
  await expect(page.locator('#first-prediction')).toHaveValue('');
  await page.locator('#study-backup-apply').click();
  await expect(page.locator('#first-prediction')).toHaveValue(prediction);
  const restored=JSON.parse((await download(page,'#first-study-export-json')).toString('utf8'));
  expect(restored.evidence).toEqual(backup.evidence);
  expect(restored.restoredFrom).toMatchObject({fileName:'private-study-backup.json',sourceSchemaVersion:2,sha256:createHash('sha256').update(backupBytes).digest('hex')});
  expect(restored.learningCompletion).toBe('not-assessed');expect(restored.finishedAt).toBeNull();
  expect(await page.evaluate(needle=>JSON.stringify({...localStorage,...sessionStorage}).includes(needle),prediction)).toBe(false);
  expect(writes).toEqual([]);
});
