import { expect, test, type Page } from '../../../../test/support/browserTest';
import { gamma, hostedFixture } from './ui-hosted-fixture';
import { evidenced, shell, withShell } from './ui-shells-fixture';

/**
 * A shared project in the same app: its shell is listed under Layouts as a local one is, and the
 * project stays comments-only there. No agent is offered and no plan or change can be asked for.
 */
const route = (rest: string) => `/projects/${gamma}/harness/branch/main/${rest}`;
const nav = (page: Page) => page.getByRole('navigation', { name: 'Catalog categories' });
const agent = (page: Page) => page.getByRole('button', { name: 'Work with agent', exact: true });

for (const viewport of [
	{ id: 'desktop', width: 1440, height: 900 },
	{ id: 'mobile', width: 390, height: 844 }
]) {
	test(`a shared project lists its shell under Layouts and offers comments only at ${viewport.id} width`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await withShell(page, hostedFixture);
		await page.goto(route('layouts'));
		await expect(nav(page).getByRole('link', { name: 'Layouts' })).toHaveClass(/active/);
		await expect(page.getByText('Shared workspace shell', { exact: true })).toBeVisible();
		await expect(agent(page)).toHaveCount(0);
		await evidenced(page, 'shells-hosted');
		await page.goto(route(`shells/${shell}`));
		await expect(page).toHaveURL(route(`layouts/${shell}`));
		await expect(
			page.getByRole('heading', { level: 1, name: 'Shared workspace shell' })
		).toBeVisible();
		await expect(agent(page)).toHaveCount(0);
		await expect(page.getByRole('group', { name: 'Request mode' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Plan', exact: true })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
	});
}
