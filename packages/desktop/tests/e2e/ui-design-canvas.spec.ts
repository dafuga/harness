import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, test } from '../../../../test/support/browserTest';
import { projectFixture } from './ui-project-fixture';
import { DesignCanvasService } from '../../../../src/services/planning-collaboration/design-canvas-service/DesignCanvasService';

/** The canvas committed in this repository, read the way the Mac app's bridge reads it. */
const canvas = new DesignCanvasService(resolve(import.meta.dirname, '../../../..')).read(
	'needs-you'
);

/** With HARNESS_VERIFY=1 the built renderer is served under the packaged app's own policy. */
test('the Mac app shows a local canvas under its own strict policy', async ({ page }, info) => {
	await page.addInitScript(
		(data) => {
			Object.assign(window, {
				harness: {
					designCanvases: async () => data,
					onRunEvent: () => () => {}
				}
			});
		},
		{
			commit: 'c'.repeat(40),
			branch: 'feat/cards',
			branches: ['feat/cards'],
			canvases: [{ name: 'needs-you', title: canvas.title, artboards: canvas.boards.length }],
			canvas
		}
	);
	await page.emulateMedia({ colorScheme: 'dark' });
	const opened = await page.goto('/designs?projectId=p1&from=%2Fharness%2Fpages');
	if (process.env.HARNESS_VERIFY === '1')
		expect(opened?.headers()['content-security-policy']).toContain("frame-src 'none'");
	await expect(page.locator('.design-board')).toHaveCount(canvas.boards.length);
	const frame = page.frameLocator('iframe[title="Home on desktop"]');
	await expect(frame.getByRole('heading', { name: /Needs you/ })).toBeVisible();
	await expect(page.locator('iframe').first()).toHaveAttribute('sandbox', '');
	await expect(page.getByText('feat/cards · ccccccc and local edits')).toBeVisible();
	await expect(page.getByRole('link', { name: '← Project' })).toHaveAttribute(
		'href',
		'/harness/pages'
	);
	const folder = process.env.DESIGN_PROOF_DIR ?? info.outputDir;
	mkdirSync(folder, { recursive: true });
	await page.screenshot({ path: join(folder, 'mac-canvas-dark.png') });
	const selected = page.getByRole('navigation', { name: 'Canvases' }).getByRole('button', {
		name: `${canvas.title} ${canvas.boards.length}`,
		exact: true
	});
	await expect(selected).toHaveAttribute('aria-pressed', 'true', { timeout: 1500 });
	await page.getByRole('button', { name: /^Other modal on iPhone, / }).dblclick();
	const full = page.getByRole('dialog', { name: 'Other modal on iPhone' });
	await expect(full.frameLocator('iframe').getByRole('dialog')).toBeVisible();
	await page.screenshot({ path: join(folder, 'mac-artboard-full.png') });
});

test('a local project offers Designs only when its bridge reads canvases', async ({ page }) => {
	await projectFixture(page);
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Alpha', exact: true }).click();
	const categories = page.getByRole('navigation', { name: 'Catalog categories' });
	await expect(categories.getByRole('link', { name: 'Pages' })).toBeVisible();
	await expect(categories.getByRole('link', { name: 'Designs' })).toHaveCount(0);
	await page.addInitScript(() => {
		const host = window as unknown as { harness: Record<string, unknown> };
		host.harness.designCanvases = async () => ({
			commit: 'c'.repeat(40),
			branch: 'main',
			branches: ['main'],
			canvases: [],
			canvas: null
		});
	});
	await page.reload();
	await categories.getByRole('link', { name: 'Designs' }).click();
	await expect(page.getByText('No canvas in this checkout.', { exact: false })).toBeVisible();
	await page.getByRole('link', { name: '← Project' }).click();
	await expect(categories.getByRole('link', { name: 'Pages' })).toBeVisible();
});
