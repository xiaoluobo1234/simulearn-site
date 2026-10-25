import {expect,test} from '@playwright/test';
const record=(id:string,title:string,nextTask:string,updatedAt:string)=>({kind:'record',id,title,updatedAt,fields:{nextTask,doneWhen:'保留实际输入和输出，不改变声明状态。'}});
const a='record-11111111-1111-4111-8111-111111111111',b='record-22222222-2222-4222-8222-222222222222';
test.beforeEach(async({page,baseURL})=>{
  test.skip(!baseURL?.startsWith('http://127.0.0.1:'),'Synthetic account fixtures are local only.');
  await page.route('https://fonts.googleapis.com/**',route=>route.abort());
  await page.route('https://fonts.gstatic.com/**',route=>route.abort());
  await page.route('**/api/auth/csrf-token',route=>route.fulfill({json:{ok:true,token:'local-desk-only'}}));
});
test('overview uses saved next task across pages without writing progress or rendering private HTML',async({page})=>{
  const writes:string[]=[];page.on('request',r=>{if(r.method()!=='GET'&&new URL(r.url()).pathname.startsWith('/api/'))writes.push(r.url());});
  await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,user:{userId:'local-desk-owner'}}}));
  await page.route('**/api/study/items?*',route=>{
    const cursor=new URL(route.request().url()).searchParams.get('cursor');
    return route.fulfill({json:{ok:true,items:[cursor?record(b,'新的私人任务','<img src=x onerror="alert(1)">核对单位','2026-10-25T01:00:00Z'):record(a,'旧任务','读取表头','2026-10-24T01:00:00Z')],cursor:cursor?null:'second-page'}});
  });
  await page.goto('/learning/');
  await expect(page.locator('#desk-title')).toHaveText('已保存 2 条学习记录');
  await expect(page.locator('#next-task-label')).toHaveText('你保存的下一项任务');
  await expect(page.locator('#next-task-title')).toHaveText('新的私人任务');
  await expect(page.locator('#next-task-description')).toHaveText('<img src=x onerror="alert(1)">核对单位');
  await expect(page.locator('#next-task-description img')).toHaveCount(0);
  await expect(page.locator('#next-task-link')).toHaveAttribute('href',`/learning/records/?id=${b}`);
  await expect(page.locator('#next-task-badge')).toHaveText('待你执行');
  expect(writes).toEqual([]);
});
test('account change before final render never discloses the loaded private record',async({page})=>{
  let owner='owner-a';
  await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,user:{userId:owner}}}));
  await page.route('**/api/study/items?*',route=>{owner='owner-b';return route.fulfill({json:{ok:true,items:[record(a,'PRIVATE OWNER A','PRIVATE NEXT TASK','2026-10-25T01:00:00Z')]}});});
  await page.goto('/learning/');
  await expect(page.locator('#desk-title')).toHaveText('暂时无法读取学习记录');
  await expect(page.locator('.study-overview')).not.toContainText('PRIVATE');
  await expect(page.locator('#next-task-badge')).toHaveText('拟开展');
});
test('repeating pagination fails closed and leaves proposed task unchanged',async({page})=>{
  await page.route('**/api/auth/me',route=>route.fulfill({json:{ok:true,user:{userId:'local-owner'}}}));
  await page.route('**/api/study/items?*',route=>route.fulfill({json:{ok:true,items:[],cursor:'loop'}}));
  await page.goto('/learning/');
  await expect(page.locator('#desk-title')).toHaveText('暂时无法读取学习记录');
  await expect(page.locator('#next-task-label')).toHaveText('下一项建议任务');
  await expect(page.locator('#recent-records')).toBeEmpty();
});
