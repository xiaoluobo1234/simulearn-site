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
