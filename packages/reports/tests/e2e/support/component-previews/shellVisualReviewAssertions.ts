import { expect, type Locator } from '@playwright/test';
import { assertExplorerContentCatalog } from './explorerContentPreviewAssertions';
import { assertPopulatedEntitySection } from './entitySectionsPreviewAssertions';

/** A persistent cue remains visible when native scrollbars fade between interactions. */
export async function assertTabOverflowCue(component: Locator, id: string) {
	if (
		![
			'reports.component.harness-explorer-content',
			'reports.component.harness-harness-navbar',
			'reports.component.harness-harness-tabs'
		].includes(id)
	)
		return;
	for (const strip of await component.getByRole('tablist').all()) {
		if (!(await strip.evaluate((node) => node.scrollWidth > node.clientWidth + 1))) continue;
		await expect(
			component.getByText('Scroll horizontally to see more sections.', { exact: true }),
			'Overflowing sections retain a visible scroll cue'
		).toBeVisible();
	}
}

/** Review the rendered shell, after its ordinary catalog capture has retained the checkpoint. */
export async function assertShellVisualReview(component: Locator, id: string, variant: string) {
	await reviewedCopy(component, id);
	await assertExplorerContentCatalog(component, id, variant);
	if (id.endsWith('harness-entity-screens') || id.endsWith('harness-explorer-content')) {
		await expect(component).not.toContainText('No screenshot selected.');
		await screenGeometry(component, variant);
	}
	if (id.endsWith('harness-harness-navbar')) await navbar(component, variant);
	if (id.endsWith('harness-entity-sections')) await sections(component, variant);
	if (id.endsWith('harness-explorer-catalog-screen')) await catalog(component, variant);
	if (id.endsWith('harness-harness-console')) await consoleState(component, variant);
	if (id.endsWith('explorer-ui-explorer-module-card') && variant === 'page')
		await expect(component.getByRole('group', { name: 'Used In', exact: true })).toHaveCount(0);
	if (
		[
			'reports.component.harness-explorer-content',
			'reports.component.harness-harness-console',
			'reports.component.harness-harness-navbar'
		].includes(id)
	)
		await tabOverflow(component);
}

async function reviewedCopy(component: Locator, id: string) {
	if (
		![
			'reports.component.harness-entity-artifact',
			'reports.component.harness-harness-navbar',
			'reports.component.harness-harness-console',
			'reports.component.entity-search-results',
			'reports.component.console-chat'
		].includes(id)
	)
		return;
	await expect(component, 'Product-facing examples use realistic names').not.toContainText(
		/\b(?:preview (?:project|agent|model)|synthetic|fixture)\b/i
	);
}

async function screenGeometry(component: Locator, variant: string) {
	const images = component.locator('.ex-shot img');
	if (variant === 'initial') {
		for (const caption of await component.locator('.ex-pane figcaption').all())
			expect((await caption.innerText()).trim(), 'No separator without a revision').not.toMatch(
				/·$/
			);
	}
	if ((await images.count()) !== 2) return;
	const sizes = await images.evaluateAll((nodes) =>
		nodes.map((node) => {
			const image = node as HTMLImageElement;
			return { width: image.naturalWidth, height: image.naturalHeight, source: image.currentSrc };
		})
	);
	expect(sizes[0].source, 'Before and After show their distinct recorded inputs').not.toBe(
		sizes[1].source
	);
	if (variant === 'mobile-selected') {
		for (const size of sizes)
			expect([size.width, size.height], 'Mobile selects portrait image bytes').toEqual([390, 844]);
	}
	if (variant === 'incomparable')
		expect(sizes[0].width, 'The declared size mismatch is visible').not.toBe(sizes[1].width);
}

async function navbar(component: Locator, variant: string) {
	if (variant === 'search-open') {
		await expect(component.getByRole('combobox', { name: 'Search entities' })).toBeEnabled();
		await expect(component.getByRole('dialog')).not.toContainText('Loading entities…');
	}
	if (variant === 'historical')
		await expect(component.locator('.hx-history-state')).toHaveText('Historical commit');
	if (variant === 'pages')
		await expect(
			component
				.getByRole('navigation', { name: 'Harness categories' })
				.getByRole('link', { name: 'Pages', exact: true })
		).toHaveAttribute('aria-current', 'page');
	if (!variant)
		await expect(
			component
				.getByRole('navigation', { name: 'Harness categories' })
				.getByRole('link', { name: 'Code', exact: true })
		).toHaveAttribute('aria-current', 'page');
}

async function sections(component: Locator, variant: string) {
	await assertPopulatedEntitySection(component, variant);
	await expect(component).not.toContainText('Recent activity is ready to review.');
	if (variant === 'used-in') {
		for (const card of await component.locator('.ex-page-minimal').all())
			await expect(card.getByRole('group', { name: 'Used In', exact: true })).toHaveCount(0);
	}
	if (variant !== 'table') return;
	const clipped = await component.locator('.schema td').evaluateAll((cells) =>
		cells
			.filter((cell) => {
				const box = cell.getBoundingClientRect();
				const frame = cell.closest('.ex-scroll')!.getBoundingClientRect();
				return box.left < frame.left - 1 || box.right > frame.right + 1;
			})
			.map((cell) => cell.textContent?.trim())
	);
	expect(
		clipped,
		'Every schema field fits the visible frame, including Nullable and Default'
	).toEqual([]);
}

async function catalog(component: Locator, variant: string) {
	if (variant === 'search') {
		await expect(component.locator('article')).toHaveCount(2);
		await expect(component.getByRole('heading', { name: 'SearchBox', exact: true })).toHaveCount(0);
	}
	if (variant === 'layouts') {
		await expect(
			component.getByRole('heading', { name: 'OrdersFrame', exact: true })
		).toBeVisible();
		const image = component.getByRole('img', { name: 'Screenshot of OrdersFrame' });
		expect(
			await image.evaluate(async (node: HTMLImageElement) => (await fetch(node.currentSrc)).text())
		).toContain('Child content');
	}
	if (!variant || variant === 'search') {
		const sources = await component
			.locator('article img')
			.evaluateAll((images) => images.map((node) => (node as HTMLImageElement).currentSrc));
		expect(new Set(sources).size, 'Each catalog component has its own image').toBe(sources.length);
	}
}

async function consoleState(component: Locator, variant: string) {
	if (variant === 'loading-history')
		await expect(component.getByText('Northstar Store', { exact: true })).toBeVisible();
	if (variant !== 'unindexed') return;
	await expect(
		component.getByRole('heading', { name: 'No registry at this revision', exact: true })
	).toBeVisible();
	await expect(component.locator('.hc-notice')).toHaveCount(0);
	await expect(component.locator('.ex-missing .hx-verdict')).toHaveCount(0);
}

async function tabOverflow(component: Locator) {
	for (const strip of await component.getByRole('tablist').all()) {
		const geometry = await strip.evaluate((node) => {
			const box = node as HTMLElement;
			const track = getComputedStyle(box, '::-webkit-scrollbar-track');
			const thumb = getComputedStyle(box, '::-webkit-scrollbar-thumb');
			return {
				overflow: box.scrollWidth > box.clientWidth + 1,
				height: parseFloat(getComputedStyle(box, '::-webkit-scrollbar').height),
				track: track.backgroundColor,
				thumb: thumb.backgroundColor
			};
		});
		if (!geometry.overflow) continue;
		expect(
			geometry.height,
			'Overflowing tabs have a painted horizontal scroll cue'
		).toBeGreaterThan(0);
		expect(geometry.thumb, 'The scroll thumb differs from its track').not.toBe(geometry.track);
	}
}

/** State declarations may wrap at spaces, while every word stays whole in its visible cell. */
export async function assertRequiredStateWords(component: Locator) {
	await expect(component).not.toContainText('synthetic orders');
	const cells = component.locator('table[aria-label^="States of "] tbody td:first-of-type');
	await expect(cells).not.toHaveCount(0);
	const broken = await cells.evaluateAll((nodes) =>
		nodes.flatMap((cell) => {
			const words: string[] = [];
			const box = cell.getBoundingClientRect();
			const frame = cell.closest('.ex-scroll')!.getBoundingClientRect();
			if (box.left < frame.left - 1 || box.right > frame.right + 1)
				words.push('Cell outside frame');
			const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
			let text: Node | null;
			while ((text = walker.nextNode())) {
				for (const match of text.textContent!.matchAll(/[A-Za-z]+/g)) {
					const range = document.createRange();
					range.setStart(text, match.index!);
					range.setEnd(text, match.index! + match[0].length);
					if (range.getClientRects().length > 1) words.push(match[0]);
				}
			}
			return words;
		})
	);
	expect(broken, 'Required declarations do not split inside a word').toEqual([]);
}
