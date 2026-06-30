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
  const simulationLink = hero.getByRole('link', { name: /在线仿真/ });
  await expect(simulationLink).toHaveAttribute('href', '/cae/');
  await expect(simulationLink).toHaveClass(/btn-ghost/);
  await expect(hero.getByRole('link', { name: /工程书库/ })).toHaveCount(0);
  await expect(hero.getByRole('link', { name: /查看十年路线/ })).toHaveCount(0);
  await expect(hero.getByRole('link', { name: /AI 知识库/ })).toHaveCount(0);
});

test('tools page presents Python tab with three sub-sections by default', async ({ page }) => {
  await page.goto('/tools/');
  // Tab nav visible
  await expect(page.getByRole('button', { name: 'Python 教程' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'APDL 教程' })).toBeVisible();
  // Python tab headings
  await expect(page.getByRole('heading', { name: 'Python 基础' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'NumPy 数值计算' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'SciPy 科学计算' })).toBeVisible();
  // Python tab chapters and cards
  await expect(page.locator('.tab-panel.active .chapter-section')).toHaveCount(18);
  await expect(page.locator('.tab-panel.active .kp-card')).toHaveCount(50);
  // Practice placeholder
  await expect(page.locator('.tab-panel.active .practice-placeholder').getByText('案例整理中', { exact: true })).toBeVisible();
  // Hero buttons
  await expect(page.getByRole('link', { name: 'Python 教程' })).toHaveAttribute('href', '/domains/tools/kp/python-intro');
  await expect(page.getByRole('link', { name: 'APDL 教程' })).toHaveAttribute('href', '/domains/tools/kp/apdl-intro');
});

test('tools page switches to APDL tab via button', async ({ page }) => {
  await page.goto('/tools/');
  await page.getByRole('button', { name: 'APDL 教程' }).click();
  // APDL tab headings
  await expect(page.getByRole('heading', { name: 'APDL 初级教程' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'APDL 进阶专题' })).toBeVisible();
  // APDL tab chapters and cards (8 primary chapters + 1 advanced = 9, 25 primary cards + 7 advanced = 32)
  await expect(page.locator('.tab-panel.active .chapter-section')).toHaveCount(9);
  await expect(page.locator('.tab-panel.active .kp-card')).toHaveCount(32);
  // Advanced tutorial cards
  await expect(page.getByText('APDL Math 矩阵入门', { exact: true })).toBeVisible();
  await expect(page.getByText('屈曲分析', { exact: true })).toBeVisible();
  // Practice placeholder
  await expect(page.locator('.tab-panel.active .practice-placeholder').getByText('案例整理中', { exact: true })).toBeVisible();
});

test('tools page switches tab via hash route', async ({ page }) => {
  await page.goto('/tools/#apdl');
  await expect(page.getByRole('heading', { name: 'APDL 初级教程' })).toBeVisible();
  await page.goto('/tools/#python');
  await expect(page.getByRole('heading', { name: 'Python 基础' })).toBeVisible();
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
