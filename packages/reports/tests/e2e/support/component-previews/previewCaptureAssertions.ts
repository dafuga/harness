import { assertNativeAtomState } from './atomicCatalog';
import { expect, type Page, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catalogScenario, previewState } from './catalogUnits';
import { assertEntityCasesState } from './entityCasesPreviewAssertions';
import { assertAudioViewerCapture } from './audioViewerCaptureAssertions';
import { assertEntityExamplesState } from './entityExamplesPreviewAssertions';
import { assertEntityContractState } from './entityContractPreviewAssertions';
import { assertSearchResultsState } from './searchResultsPreviewAssertions';
import { assertEntitySearchState } from './entitySearchPreviewActions';
import { assertContractExampleState } from './contractExamplePreviewAssertions';
import { assertContractTableState } from './contractTablePreviewAssertions';
import { assertActivityCountFits } from './projectActivityAssertions';
import { assertDesktopState } from './desktopStateAssertions';
import { desktopCaptureDirectory } from './desktopStateActions';

/** The saved picture must frame actual compact and multi-root UI, not its preview document. */
export async function assertComponentCapture(
	page: Page,
	id: string,
	viewport: string,
	variant = ''
) {
	assertCaptureSlot(id, viewport, variant);
	await assertAudioViewerCapture(page, id, viewport);
	await assertDefaultAgents(page, id, variant);
	if (id === 'reports.component.project-activity' && variant === 'stale')
		await assertActivityCountFits(page);
	const directory = desktopCaptureDirectory(id);
	if (!directory) return;
	const selectors: Record<string, string> = {
		'desktop.component.status-icon': '.verification-wrap, .reason',
		'desktop.component.environment-picker': '.environment-choice',
		'desktop.component.deployment-route': '.deployment-route',
		'reports.component.harness-harness-icon': 'svg',
		'hub.component.account-menu': ':scope > *',
		'desktop.component.deployment-dialog': 'dialog[open]',
		'desktop.component.project-agent': '.floating-chat-panel'
	};
	let selector = selectors[id];
	if (id === 'desktop.component.project-agent')
		selector = variant === 'closed' ? '.floating-chat-bubble' : '.floating-chat-panel';
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

/** An opened search is a populated dialog, rather than a capture of its trigger alone. */
export async function assertCatalogState(
	component: Locator,
	id: string,
	variant = '',
	viewport = ''
) {
	await assertDesktopState(component, id, variant);
	await assertNativeAtomState(component, id, variant);
	if (id === 'reports.component.entity-cases') await assertEntityCasesState(component, variant);
	if (id === 'reports.component.entity-examples')
		await assertEntityExamplesState(component, variant);
	if (id === 'reports.component.entity-contract')
		await assertEntityContractState(component, variant);
	if (id === 'reports.component.entity-search-results')
		await assertSearchResultsState(component, variant, viewport);
	if (id === 'reports.component.contract-example')
		await assertContractExampleState(component, variant);
	if (id === 'reports.component.contract-table')
		await assertContractTableState(component, variant, viewport);
	if (id === 'reports.component.filter-dialog' && variant === 'active') {
		const trigger = component.getByRole('button', { name: 'Filters', exact: true });
		await expect(trigger).toHaveClass(/active/);
		await expect(trigger).toHaveAttribute('title', 'Filters · 3 active');
	}
	if (id === 'reports.component.filter-dialog' && variant === 'open')
		await expect(component.getByRole('dialog', { name: 'Filters', exact: true })).toBeVisible();
	if (id === 'reports.component.entity-search')
		await assertEntitySearchState(component, variant, viewport);
	if (id !== 'reports.component.entity-contract' || viewport !== 'mobile' || variant) return;
	const frame = component.locator('[data-harness-component="contract-table"] .frame').first();
	const action = frame.getByRole('button', { name: 'View example for Orders' });
	await expect(action).toBeVisible();
	const [frameBox, actionBox] = await Promise.all([frame.boundingBox(), action.boundingBox()]);
	expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width);
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

async function assertDefaultAgents(page: Page, id: string, variant: string) {
	if (id === 'desktop.component.agents-providers-chat-agents' && !variant)
		await assertAgentsPreview(page);
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
	if (id === 'reports.component.networking-security-explorer-permissions-screen' && !variant) {
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
			if (!['playwright', 'headless-audio'].includes(variant)) return;
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
			if (variant !== 'playwright') return;
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
