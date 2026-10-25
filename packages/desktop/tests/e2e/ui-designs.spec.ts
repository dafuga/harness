import { desktopEvidence } from './desktop-evidence';
import { catalogCategories } from './ui-workspace-fixture';
import { test, expect, type Page } from '../../../../test/support/browserTest';
import { fixture } from './ui-design-fixture';
import type { DesktopBridge, RunEvent } from '../../src/models/DesktopBridge.types';

async function checkpoint(page: Page, name: string) {
	await desktopEvidence(page, name, false);
	if (process.env.TAKE_SCREENSHOT !== 'true') return;
	await page.evaluate(async () => {
		await document.fonts.ready;
		await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
	});
	await page.mouse.move(0, 0);
	await page.screenshot({ path: `test-results/ui-${name}.png`, fullPage: true });
}
test('exact image region, approval, Change, public stream and source disclosure', async ({
	page
}) => {
	await fixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await checkpoint(page, 'catalog');
	await page.getByRole('link', { name: 'Open Activity', exact: true }).click();
	await expect(page.getByRole('img', { name: 'Activity v002 desktop default' })).toBeVisible();
	await page.getByRole('button', { name: 'Open thread 1', exact: true }).click();
	await expect(page.getByText('Keep the filters on one line.')).toBeVisible();
	await checkpoint(page, 'design');
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeDisabled();
	const bounds = await page.locator('.image-canvas').boundingBox();
	if (!bounds) throw Error('Image canvas missing');
	await page.mouse.move(bounds.x + bounds.width * 0.1, bounds.y + bounds.height * 0.1);
	await page.mouse.down();
	await page.mouse.move(bounds.x + bounds.width * 0.3, bounds.y + bounds.height * 0.3);
	await page.mouse.up();
	await page.getByRole('button', { name: 'Comment on selection', exact: true }).click();
	await page.getByRole('button', { name: 'Select region with keyboard' }).click();
	await page.getByRole('button', { name: 'Comment on region', exact: true }).click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('"width":0.4');
	await page.getByRole('button', { name: 'Approve v002', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeEnabled();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.not.toContain('"action":"run"');
	await page.getByRole('button', { name: 'Change', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Implement the approved design');
	await page.getByRole('button', { name: 'Send change', exact: true }).click();
	await expect(page.getByText('Working on the approved design.')).toBeVisible();
	await page.getByRole('button', { name: 'Cancel run', exact: true }).click();
	await expect(page.getByText('Run cancelled', { exact: true })).toBeVisible();
	await page
		.getByRole('navigation', { name: 'Entity sections' })
		.getByRole('button', { name: 'Source', exact: true })
		.click();
	await page.getByRole('button', { name: 'src/activity.svelte', exact: true }).click();
	await expect(page.getByLabel('src/activity.svelte', { exact: true })).toContainText(
		'<h1>Activity</h1>'
	);
	await checkpoint(page, 'approved');
});

for (const viewport of [
	{ name: 'mobile', width: 390, height: 844 },
	{ name: 'tablet', width: 920, height: 1100 }
]) {
	test(`${viewport.name} keeps navigation and composer reachable without overflow`, async ({
		page
	}) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await fixture(page);
		await page.goto('/');
		await page.getByRole('button', { name: 'Open Project', exact: true }).click();
		await page.getByRole('link', { name: 'Open Activity', exact: true }).click();
		await expect(page.getByRole('img', { name: 'Activity v002 desktop default' })).toBeVisible();
		await expect(
			page.getByRole('navigation', { name: 'Catalog categories' }).getByRole('link')
		).toHaveText(catalogCategories);
		if (viewport.width <= 850)
			await page.getByRole('button', { name: 'Conversation', exact: true }).click();
		await page.getByRole('textbox', { name: 'Message', exact: true }).scrollIntoViewIfNeeded();
		await checkpoint(page, viewport.name);
		await expect(page.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
		expect(
			await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
		).toBe(true);
	});
}

test('headless committed notes approve without a fabricated image', async ({ page }) => {
	await fixture(page, true);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Project', exact: true }).click();
	await page
		.getByRole('navigation', { name: 'Catalog categories' })
		.getByRole('link', { name: 'Services', exact: true })
		.click();
	await page.getByRole('link', { name: 'Review designs' }).click();
	await expect(
		page.getByText(
			'Validate each event before saving it. Return a typed error when the input is invalid.'
		)
	).toBeVisible();
	await expect(page.locator('.image-canvas')).toHaveCount(0);
	await page.getByRole('button', { name: 'Approve v002', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Change', exact: true })).toBeEnabled();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.stringify((window as unknown as { __calls: unknown[] }).__calls))
		)
		.toContain('"imageHashes":[]');
	await page.getByRole('button', { name: 'Change', exact: true }).click();
	await page
		.getByRole('textbox', { name: 'Message', exact: true })
		.fill('Implement the approved validation notes');
	await checkpoint(page, 'headless-before-change');
	await page.getByRole('button', { name: 'Send change', exact: true }).click();
	await expect(page.getByText('Working on the approved design.')).toBeVisible();
	await checkpoint(page, 'headless-after-change');
	const calls = await page.evaluate(
		() => (window as unknown as { __calls: Record<string, unknown>[] }).__calls
	);
	expect(calls.find((call) => call.action === 'thread')).toMatchObject({
		entityId: 'page:activity',
		version: null,
		imageSha256: null,
		state: null,
		viewport: null,
		region: null
	});
	expect(calls.find((call) => call.action === 'run')).toMatchObject({
		mode: 'change',
		threadId: 'thread-1',
		text: 'Implement the approved validation notes',
		approval: { version: 'v002', imageHashes: [], contractHash: 'c'.repeat(64) }
	});
});

async function persistTerminalOutcome(page: Page, outcome: 'failed' | 'cancelled') {
	await page.evaluate(async (kind) => {
		const host = window as unknown as { harness: DesktopBridge; __terminate: () => void };
		const bridge = host.harness;
		const original = bridge.onRunEvent;
		bridge.onRunEvent = (listener) => {
			host.__terminate = () => {
				const loadEntity = bridge.entity,
					loadSnapshot = bridge.snapshot;
				bridge.entity = async (query) => {
					const entity = structuredClone(await loadEntity(query));
					entity.history.push({
						id: 'terminal',
						at: 'Today',
						kind: 'reason',
						title: `Persisted ${kind} outcome`,
						detail: 'Saved public outcome',
						commit: 'd'.repeat(40),
						version: 'v002'
					});
					return entity;
				};
				bridge.snapshot = async (query) => {
					const snapshot = structuredClone(await loadSnapshot(query));
					snapshot.revision = { ...snapshot.revision, commit: 'd'.repeat(40), tip: 'd'.repeat(40) };
					return snapshot;
				};
				listener({ runId: 'run-owned', kind, message: 'Provider stopped' } as RunEvent);
			};
			return original(listener);
		};
	}, outcome);
}
for (const outcome of ['failed', 'cancelled'] as const) {
	test(`persisted ${outcome} outcome refreshes entity history and current commit`, async ({
		page
	}) => {
		await fixture(page);
		await page.goto('/');
		await persistTerminalOutcome(page, outcome);
		await page.getByRole('button', { name: 'Open Project', exact: true }).click();
		await page.getByRole('link', { name: 'Open Activity', exact: true }).click();
		await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Revise the design');
		await page.getByRole('button', { name: 'Send plan', exact: true }).click();
		await expect(page.getByText('Working on the approved design.')).toBeVisible();
		await page.evaluate(() => (window as unknown as { __terminate: () => void }).__terminate());
		await expect(
			page.getByText(outcome === 'failed' ? 'Provider stopped' : 'Run cancelled', { exact: true })
		).toBeVisible();
		await page.getByRole('button', { name: 'History', exact: true }).click();
		await checkpoint(page, `${outcome}-history`);
		await expect(
			page.getByRole('main').getByText(`Persisted ${outcome} outcome`, { exact: true })
		).toBeVisible();
		expect(await page.getByLabel('Branch', { exact: true }).getAttribute('title')).toContain(
			`Tip · ddddddd`
		);
	});
}
