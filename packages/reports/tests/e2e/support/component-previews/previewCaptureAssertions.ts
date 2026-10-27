import { expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogScenario, previewState } from './catalogUnits';

/** The saved picture must frame actual compact and multi-root UI, not its preview document. */
export async function assertComponentCapture(
	page: Page,
	id: string,
	viewport: string,
	variant = ''
) {
	assertCaptureSlot(id, viewport, variant);
	if (id === 'desktop.component.agents-providers-chat-agents') await assertAgentsPreview(page);
	const directory = process.env.COMPONENT_PREVIEW_SHOTS;
	if (!directory) return;
	const selectors: Record<string, string> = {
		'desktop.component.environment-picker': '.environment-choice',
		'desktop.component.deployment-route': '.deployment-route',
		'reports.component.harness-harness-icon': 'svg',
		'hub.component.account-menu': ':scope > *',
		'desktop.component.deployment-dialog': 'dialog[open]',
		'desktop.component.project-agent': '.floating-chat-panel'
	};
	const selector =
		id === 'desktop.component.project-agent'
			? variant === 'closed'
				? '.floating-chat-bubble'
				: '.floating-chat-panel'
			: selectors[id];
	if (!selector) return;
	const content = page.locator(`[data-preview-unit="${id}"]`);
	const boxes = await content
		.locator(selector)
		.evaluateAll((nodes) =>
			nodes
				.map((node) => node.getBoundingClientRect().toJSON())
				.filter((box) => box.width && box.height)
		);
	expect(boxes.length, `${id} has visible component pixels`).toBeGreaterThan(0);
	const width =
		Math.max(...boxes.map((box) => box.right)) - Math.min(...boxes.map((box) => box.left));
	const height =
		Math.max(...boxes.map((box) => box.bottom)) - Math.min(...boxes.map((box) => box.top));
	const png = readFileSync(join(directory, `${previewState(id, variant)}-${viewport}.png`));
	expect(png.subarray(1, 4).toString()).toBe('PNG');
	const captured = { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
	for (const [dimension, actual] of Object.entries({ width, height })) {
		expect(
			captured[dimension as keyof typeof captured],
			`${id} includes its full ${dimension}`
		).toBeGreaterThanOrEqual(Math.floor(actual));
		expect(
			captured[dimension as keyof typeof captured],
			`${id} excludes the preview title and empty canvas`
		).toBeLessThanOrEqual(Math.ceil(actual) + 18);
	}
}

async function assertAgentsPreview(page: Page) {
	const panel = page.locator('[data-harness-component="agents-providers-chat-agents"]');
	await expect(panel).toBeVisible();
	await expect(panel).toContainText('1 working');
	await expect(panel.getByRole('region', { name: 'Main chats' })).toContainText(
		'Capture component states'
	);
	await expect(panel.getByRole('region', { name: 'Modules being worked on' })).toContainText(
		'Preview agent'
	);
}

/** The recorded slot selects the manifest's element rules as well as its required state. */
function assertCaptureSlot(id: string, viewport: string, variant = '') {
	const directory = process.env.HARNESS_EVIDENCE_DIR;
	if (!directory || process.env.TAKE_SCREENSHOT !== '1') return;
	const lines = readFileSync(join(directory, 'captures.ndjson'), 'utf8')
		.split('\n')
		.filter(Boolean)
		.map((text) => JSON.parse(text));
	const capture = lines.findLast(
		(line) =>
			line.kind === 'screenshot' &&
			line.state === previewState(id, variant) &&
			line.viewport === viewport
	);
	expect(
		catalogScenario.evidence,
		'a component capture uses declared element evidence'
	).toContainEqual(expect.objectContaining({ id: capture?.evidence, capture: 'element' }));
}

/** The translation matrix exercises the shared selector and its three-column projection. */
export async function assertTranslationControls(component: Locator) {
	await expect(component.getByRole('combobox', { name: 'Language' })).toHaveValue('fr');
	await expect(component.getByRole('columnheader')).toHaveText(['English', 'French', 'Used In']);
	await expect(component.locator('tbody code, tbody small')).toHaveCount(0);
	await expect(component.getByRole('columnheader', { name: 'English', exact: true })).toBeVisible();
	await expect(component.getByRole('columnheader', { name: 'French', exact: true })).toBeAttached();
	await expect(component.locator('tbody tr')).toHaveCount(50);
	await component.getByRole('button', { name: 'View More' }).click();
	await expect(component.locator('tbody tr')).toHaveCount(100);
	await component.getByRole('searchbox', { name: 'Search translations' }).fill('Écouter');
	await expect(component.locator('tbody tr')).toHaveCount(1);
	await expect(component.locator('tbody')).toContainText('Listen and compare');
	await expect(component.locator('tbody')).toContainText('Écouter et comparer');
	await component.getByRole('combobox', { name: 'Language' }).selectOption('de');
	await expect(component.getByRole('columnheader')).toHaveText(['English', 'German', 'Used In']);
	await expect(component.locator('tbody')).toContainText('Anhören und vergleichen');
	await expect(component.locator('tbody')).not.toContainText('Écouter et comparer');
	await component.getByRole('combobox', { name: 'Language' }).selectOption('fr');
	await component
		.getByRole('searchbox', { name: 'Search translations' })
		.fill('no-such-translation');
	await expect(component.getByText('No translations match this search.')).toBeVisible();
	await component.getByRole('searchbox', { name: 'Search translations' }).clear();
	await expect(component.locator('tbody tr')).toHaveCount(50);
}

/** Module previews must show the actual library and generated-resource content. */
export async function assertModulePreview(component: Locator, id: string, variant = '') {
	if (id === 'reports.component.networking-security-explorer-permissions-screen') {
		for (const text of [
			'Member',
			'app.endpoint.orders',
			'GET',
			'app.model.order',
			'Own account only'
		])
			await expect(component.getByText(text, { exact: false }).first()).toBeVisible();
	}

	if (id === 'reports.component.module-system-explorer-modules-screen') {
		if (variant) {
			await expect(
				component.getByRole('heading', {
					level: 1,
					name: variant === 'playwright' ? 'Playwright' : 'Headless audio',
					exact: true
				})
			).toBeVisible();
			await expect(component).toContainText(`harness plugin test ${variant}`);
			await expect(component.getByText('Testing', { exact: true })).toBeVisible();
			return;
		}
		await expect(
			component.getByRole('link', { name: 'Rust WebAssembly', exact: true })
		).toBeVisible();
		await expect(component.getByRole('link', { name: 'Rust Backend', exact: true })).toBeVisible();
		await expect(
			component.getByRole('heading', { level: 1, name: 'Plugins', exact: true })
		).toBeVisible();
		await expect(component.getByRole('link', { name: 'Email', exact: true })).toBeVisible();
		await expect(component.getByText('Installed', { exact: true })).toBeVisible();
		await expect(component.getByRole('link', { name: 'Layouts', exact: true })).toHaveCount(0);
		await expect(component.getByRole('link', { name: 'Playwright', exact: true })).toBeVisible();
		await expect(
			component.getByRole('link', { name: 'Headless audio', exact: true })
		).toBeVisible();
		await expect(component).toContainText('harness plugin add offline');
	}
	if (id === 'reports.component.module-system-explorer-module-resources-screen') {
		if (variant) {
			await expect(
				component.getByRole('heading', { level: 1, name: 'Browser tests', exact: true })
			).toBeVisible();
			await expect(component).toContainText('harness plugin generate playwright test');
			await expect(component).toContainText('Nothing generated yet.');
			return;
		}
		await expect(component.getByRole('heading', { name: 'Emails', exact: true })).toBeVisible();
		await expect(component.getByRole('heading', { name: 'Welcome', exact: true })).toBeVisible();
		await expect(component).toContainText('harness plugin generate email email');
	}
}

/** Permission table words stay intact and wider data remains keyboard inspectable. */
export async function assertPermissionTable(component: Locator, page: Page) {
	const identifier = component.getByRole('table').first().locator('tbody code').first();
	expect(
		await identifier.evaluate((node) => {
			const range = document.createRange();
			range.selectNodeContents(node);
			return [...range.getClientRects()].filter((box) => box.width > 0).length;
		}),
		'Data identifiers remain unbroken'
	).toBe(1);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		'Permission tables stay inside the document'
	).toBe(true);
	const region = component.getByRole('region', { name: /data access/ }).first();
	if (await region.evaluate((node) => node.scrollWidth > node.clientWidth)) {
		await region.focus();
		await region.press('ArrowRight');
		await expect.poll(() => region.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
	}
}
