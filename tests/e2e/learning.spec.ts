import { expect, test } from '@playwright/test';

for (const domain of ['structural', 'thermal', 'fluids', 'multiphysics', 'chip']) {
  test(`${domain} renders preset route`, async ({ page }) => {
    await page.goto(`/domains/${domain}/`);
    await expect(page.locator('[data-plan-panel="low"] [data-node-id]')).toHaveCount(20);
    await page.getByRole('button', { name: '中级' }).click();
    await expect(page.locator('[data-plan-panel="mid"]')).toBeVisible();
  });
}

test('knowledge page renders tree, review state and relations', async ({ page }) => {
  await page.goto('/domains/chip/kp/tcad-workflow-intro/');
  await expect(page.getByText('TCAD 流程入门', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('预设初稿 · 待人工校订')).toBeVisible();
  await expect(page.getByRole('heading', { name: '知识关联' })).toBeVisible();
});

test('home promotes tools without AI knowledge base action', async ({ page }) => {
  await page.goto('/');
  const hero = page.locator('.hero-actions');
  await expect(hero.getByRole('link', { name: /工具脚本/ })).toHaveAttribute('href', '/tools');
  await expect(hero.getByRole('link', { name: /工程书库/ })).toBeVisible();
  await expect(hero.getByRole('link', { name: /查看十年路线/ })).toHaveCount(0);
  await expect(hero.getByRole('link', { name: /AI 知识库/ })).toHaveCount(0);
});

test('tools page presents chapters and a separate practice placeholder', async ({ page }) => {
  await page.goto('/tools/');
  await expect(page.getByRole('heading', { name: 'Python 基础教程' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'APDL 初级教程' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NumPy 数值计算教程' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SciPy 科学计算教程' })).toBeVisible();
  await expect(page.locator('.chapter-section')).toHaveCount(27);
  await expect(page.locator('.kp-card')).toHaveCount(75);
  await expect(page.getByRole('heading', { name: '仿真实践' })).toBeVisible();
  await expect(page.getByText('案例整理中', { exact: true })).toBeVisible();
});

test('tools tutorial is detailed and contains no AI learning controls', async ({ page }) => {
  await page.goto('/domains/tools/kp/python-intro/');
  await expect(page.getByRole('heading', { name: '认识 Python' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Python 程序如何工作' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '知识教程' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '仿真实践' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI 拓展' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'AI 辅导问答' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '学习检验' })).toHaveCount(0);
});
