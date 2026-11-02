import { assertNativeAtomState } from './atomicCatalog';
import { assertNativePresentation } from './nativeAtomPresentationAssertions';
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
import { assertDesktopState, assertDesktopCapturedState } from './desktopStateAssertions';
import { desktopCaptureDirectory } from './desktopStateActions';

/** The saved picture must frame actual compact and multi-root UI, not its preview document. */
export async function assertComponentCapture(
	page: Page,
	id: string,
	viewport: string,
	variant = ''
) {
	assertCaptureSlot(id, viewport, variant);
	await assertNativePresentation(page.locator(`[data-preview-unit="${id}"]`), id, variant);
	await assertDesktopCapturedState(page.locator(`[data-preview-unit="${id}"]`), id, variant);
	await assertAudioViewerCapture(page, id, viewport);
	await assertDefaultAgents(page, id, variant);
	if (id === 'reports.component.project-activity' && variant === 'stale')
		await assertActivityCountFits(page);
	const directory = desktopCaptureDirectory(id);
	if (!directory) return;
	await assertCaptureGeometry(page, id, { viewport, variant, directory });
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
	await assertDataCatalogState(component, id, variant, viewport);
	await assertFilterState(component, id, variant);
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
		'Review the order-card states'
	);
	await expect(panel.getByRole('region', { name: 'Modules being worked on' })).toContainText(
		'Checkout reviewer'
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

export { assertTranslationControls } from './catalogTranslationAssertions';
export { assertModulePreview } from './catalogModuleAssertions';

async function assertCaptureGeometry(
	page: Page,
	id: string,
	{ viewport, variant, directory }: { viewport: string; variant: string; directory: string }
) {
	const selectors: Record<string, string> = {
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

async function assertDataCatalogState(
	component: Locator,
	id: string,
	variant: string,
	viewport: string
) {
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
}

async function assertFilterState(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.filter-dialog' && variant === 'active') {
		const trigger = component.getByRole('button', { name: 'Filters', exact: true });
		await expect(trigger).toHaveClass(/active/);
		await expect(trigger).toHaveAttribute('title', 'Filters · 3 active');
	}
	if (id === 'reports.component.filter-dialog' && variant === 'open')
		await expect(component.getByRole('dialog', { name: 'Filters', exact: true })).toBeVisible();
}
