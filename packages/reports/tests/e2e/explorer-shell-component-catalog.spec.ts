import { expect, test } from '../../../../test/support/browserTest';
import { buildShellFixture, removeShellFixture, captureShell } from './support/shellFixture';
import { pictured } from './support/sharedSelect';
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
import { declaredStyleTokens, expectColorRoles } from './support/styleCatalog';
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
	for (const stage of ['history', 'revision'] as const) {
		test(`console data loading: ${stage} at ${viewport.id}`, async ({ page }) => {
			const unit = 'reports.component.harness-harness-console';
			await page.setViewportSize(viewport);
			await openPreview(page, home, unit);
			await readyPreview(page, unit);
			let release!: () => void;
			const held = new Promise<void>((resolve) => (release = resolve));
			const path = stage === 'history' ? '**/data/index.json' : '**/data/revisions/*.json';
			await page.route(path, async (route) => {
				await held;
				await route.fallback();
			});
			await page.reload();
			const message = stage === 'history' ? 'Loading history…' : 'Loading this revision…';
			const status = page.getByRole('status').filter({ hasText: message });
			try {
				await expect(status).toBeVisible();
				await pictured(page, `console-loading-${stage}-${viewport.id}`);
				await captureShell(page, home, {
					state: `loading-${stage}`,
					viewport: viewport.id,
					slot: unit
				});
				await expect(
					status.locator('[aria-hidden="true"]'),
					'Loading status has a decorative indicator'
				).toBeVisible();
				const ring = (await status.locator('[aria-hidden="true"]').boundingBox())!;
				expect(Math.abs(ring.x + ring.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(8);
				expect(Math.abs(ring.y + ring.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(8);
				await page.emulateMedia({ reducedMotion: 'reduce' });
				await expect(status.locator('[aria-hidden="true"]')).toHaveCSS('animation-name', 'none');
				await expect
					.poll(() => page.evaluate(() => document.documentElement.scrollWidth))
					.toBeLessThanOrEqual(viewport.width);
			} finally {
				release();
			}
			await readyPreview(page, unit);
			await expect(status).toHaveCount(0);
			await expect(page.getByRole('heading', { level: 1, name: 'Components' })).toBeVisible();
		});
	}
}
for (const viewport of catalogViewports) {
	for (const unit of catalogUnits) {
		test(`${unit.id} at ${viewport.id}`, async ({ page }) => {
			await page.setViewportSize(viewport);
			await openPreview(page, home, unit.id);
			await expect(page.locator('#preview-title')).toHaveText(unit.title);
			const component = await readyPreview(page, unit.id);
			await capturePreview(page, home, unit.id, viewport.id);
			if (unit.id === 'reports.component.explorer-ui-harness-explorer-styles-screen') {
				await expectColorRoles(component);
				await expect(component.locator('[data-style-token]')).toHaveCount(
					declaredStyleTokens().length
				);
			}
			for (const field of await component.locator('.hx-revision .has-display select').all())
				await expect(
					field,
					'Only the compact value is painted in a closed revision field'
				).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
			if (unit.kind === 'layout') {
				const slot = component.getByRole('region', { name: 'Child content', exact: true });
				await expect(slot).toBeVisible();
				const box = await slot.boundingBox();
				expect(box!.width).toBeGreaterThan(200);
				expect(box!.height).toBeGreaterThan(250);
				await expect(slot).toContainText('Your page renders here');
				const bubble = component.locator('.floating-chat-bubble');
				await expect(bubble, 'The complete layout includes exactly one chat bubble').toHaveCount(1);
				await expect(bubble).toBeVisible();
				const bubbleBox = await bubble.boundingBox();
				expect(bubbleBox!.x).toBeGreaterThanOrEqual(0);
				expect(bubbleBox!.y + bubbleBox!.height).toBeLessThanOrEqual(viewport.height);
				expect(bubbleBox!.x + bubbleBox!.width).toBeLessThanOrEqual(viewport.width);
			}
			if (unit.id === 'reports.page.harness-branch-branch-at-layouts') {
				const card = component.locator('article').filter({ hasText: 'OrdersFrame' });
				await expect(card.locator('img')).toHaveAttribute('src', /synthetic-layout-input\.svg$/);
				const usage = card.getByRole('link', { name: 'Orders page', exact: true });
				await expect(usage).toBeVisible();
				await expect(usage).toHaveAttribute('href', /\/pages\/app\.page\.orders$/);
			}

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
			if (unit.id === 'desktop.component.relationships-panel')
				await expect(component.locator('.chip')).toHaveText(['Page', 'Layout']);
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
