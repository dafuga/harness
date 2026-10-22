import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, removeShellFixture } from './support/shellFixture';
import {
	catalogUnits,
	catalogViewports,
	catalogScenario,
	previewState
} from './support/component-previews/catalogUnits';
import {
	openPreview,
	readyPreview,
	capturePreview
} from './support/component-previews/previewPage';
import { profilePreview } from './support/component-previews/profilePreview';
let home = '';
test.beforeAll(async () => {
	test.setTimeout(180_000);
	home = buildShellFixture(['catalog']);
});
test.afterAll(() => removeShellFixture(home));
test('every active visual component has its own required capture state', () => {
	const expected = catalogUnits.map((unit) => unit.id);
	expect([...catalogScenario.units].sort()).toEqual(expected);
	expect(catalogScenario.states).toEqual(
		catalogUnits.map((unit) =>
			expect.objectContaining({ id: previewState(unit.id), units: [unit.id] })
		)
	);
});
for (const viewport of catalogViewports) {
	for (const unit of catalogUnits) {
		test(`${unit.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await openPreview(page, home, unit.id);
			await expect(page.locator('#preview-title')).toHaveText(unit.title);
			const component = await readyPreview(page, unit.id);
			await capturePreview(page, home, unit.id, viewport.id);
			if (unit.id === 'reports.component.explorer-function-card') {
				await expect(component.locator('article')).toHaveCSS('border-top-style', 'solid');
				await expect(component.locator('code')).toHaveText('filterOrders(orders, "SERVICE")');
				await expect(component.getByRole('link', { name: 'OrderList', exact: true })).toBeVisible();
				await expect(
					component.getByRole('link', { name: 'OrderStore', exact: true })
				).toBeVisible();
			}
			if (unit.id === 'reports.component.usage-examples-usage-examples')
				await expect(component.locator('code')).toHaveText('formatDuration(90)\n// => "1:30"');
			if (unit.id === 'reports.component.harness-entity-history-row') {
				await expect(component.locator('table.ex-history tbody > tr')).toHaveCount(1);
				await expect(component.locator('td').first()).toHaveCSS('white-space', 'nowrap');
			}
			if (unit.id === 'reports.component.harness-harness-icon') {
				await expect(component.getByRole('img', { name: 'Component', exact: true })).toBeVisible();
				await expect(component.locator('path')).toHaveAttribute('d', /\S+/);
			}
			if (
				['remote-connection', 'remote-host-panel', 'remote-offer-code'].some(
					(name) => unit.id === `desktop.component.${name}`
				)
			) {
				await expect(component.getByText('Expires in 5:00', { exact: true })).toBeVisible();
			}
			if (unit.id === 'desktop.component.agent-controls') {
				const provider = component
					.getByRole('group', { name: 'Agent', exact: true })
					.getByRole('button');
				await expect(provider).toHaveText('Codex');
				const colors = await provider.evaluate((node) => {
					const style = getComputedStyle(node);
					return { text: style.color, background: style.backgroundColor };
				});
				expect(colors.text, 'The provider label must remain readable').not.toBe(colors.background);
			}
			if (unit.id === 'reports.component.provider-picker-cards') {
				await expect(component.getByText('GPT 6.1', { exact: true })).toBeVisible();
				await expect(component.getByText('Claude Opus 5.5', { exact: true })).toBeVisible();
			}
			if (unit.id === 'hub.component.account-menu') {
				await expect(component).toHaveCSS('display', 'flex');
				await expect(component).toHaveCSS('column-gap', '10px');
			}
			if (unit.id === 'reports.component.harness-explorer-page-card') {
				await expect(component.locator('article')).toHaveCSS('display', 'grid');
				await expect(component.locator('img')).toHaveCSS('object-fit', 'contain');
				await expect(component.locator('img')).toHaveAttribute('src', /synthetic-card-input\.svg$/);
				await expect(
					component.getByRole('link', { name: 'Open OrderCard', exact: true })
				).toHaveAttribute('title', /Synthetic preview input/);
			}
			await expect
				.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
				.toBeLessThanOrEqual(viewport.width);
			if (viewport.id === 'desktop') await profilePreview(page, unit.id);
		});
	}
}
