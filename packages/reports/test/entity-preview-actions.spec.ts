import { expect, test } from '@playwright/test';
import { capture, open, viewports, where } from './entityPreviewPage';
import { ids } from './entityUnits';

const page = { category: 'pages' as const, entity: ids.page };
for (const [name, size] of Object.entries(viewports)) {
	test(`a page card opens with one compact icon at ${name} width`, async ({ page: tab }) => {
		await tab.setViewportSize(size);
		await open(tab);
		const action = tab.getByRole('link', { name: 'Open page', exact: true });
		await expect(action).toBeVisible();
		await tab.evaluate(async () => {
			await document.fonts.ready;
			await Promise.all([...document.images].map((image) => image.decode()));
		});
		await capture(tab, `compact-page-${name}`);
		expect((await action.innerText()).trim()).toBe('');
		await expect(action).toHaveAttribute('title', 'Open page');
		await expect(action.locator('svg')).toHaveCount(1);
		expect(await action.boundingBox()).toMatchObject({ width: 36, height: 36 });
		await action.focus();
		await tab.keyboard.press('Enter');
		expect(await where(tab)).toEqual({ branch: 'feature/orders', commit: null, ...page });
	});
}
