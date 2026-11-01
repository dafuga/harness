import { expect, type Locator } from '../../../../../../test/support/browserTest';
import { commits } from '../../../../test/entityUnits';
import { assertScrollbarPaint } from './scrollbarReviewAssertions';
import { assertShellVisualReview } from './shellVisualReviewAssertions';

const reviewed = new Set([
	'harness-entity-audio',
	'harness-entity-behavior',
	'harness-entity-details',
	'harness-entity-history',
	'harness-entity-screens',
	'harness-entity-sections',
	'harness-entity-source',
	'harness-explorer-catalog-screen',
	'harness-explorer-content',
	'harness-explorer-frame',
	'harness-harness-console',
	'harness-harness-header',
	'harness-harness-navbar',
	'harness-harness-selectors',
	'harness-harness-verdict',
	'harness-entity-artifact'
]);

/** Review the state that was just captured, including the visual defects missed by presence checks. */
export async function assertShellReview(
	component: Locator,
	id: string,
	variant: string,
	viewport: string
) {
	await assertShellVisualReview(component, id, variant);
	if (!reviewed.has(id.replace('reports.component.', ''))) return;
	expect(
		await component.innerText(),
		'Catalog text uses realistic identities and config values'
	).not.toMatch(/\b(?:a{7,}|b{7,}|c{7,})\b|record-test-|orders\/orders\//);
	if (id.endsWith('harness-entity-history') && variant === 'unread') {
		const read = component.getByRole('button', { name: 'Read the next commits' });
		await read.click();
		await expect(read, 'A failed revision read releases the retry action').toBeEnabled();
		await expect(component).toContainText('not known until');
	}
	await namedState(component, id, variant);
	await responsiveTables(component, id, variant, viewport);
	await affordances(component, id, variant);
}

async function affordances(component: Locator, id: string, variant: string) {
	if (id.endsWith('harness-entity-source') && variant === 'linked') await sourceLink(component);
	if (id.endsWith('harness-harness-navbar') && variant === 'search-open')
		await searchFocus(component);
	if (id.endsWith('harness-entity-artifact') && variant === 'expanded')
		await assertionsFlow(component);
	if (id.endsWith('harness-harness-verdict') && variant === 'long-open')
		await longTooltip(component);
}

async function namedState(component: Locator, id: string, variant: string) {
	await detailState(component, id, variant);
	if (id.endsWith('harness-explorer-frame') && variant === 'registry-optional')
		await expect(component.getByRole('heading', { name: 'Website', exact: true })).toBeVisible();
	if (id.endsWith('harness-harness-selectors') && variant === 'long')
		await expect(
			component.getByRole('combobox', { name: 'Branch', exact: true }),
			'Long branch is selected, not blank'
		).toHaveValue('feature/catalog/responsive-component-explorer-navigation');
	if (id.endsWith('harness-harness-console') && variant.endsWith('-error'))
		expect(
			await component.innerText(),
			'Load failures are user-facing, not parser diagnostics'
		).not.toMatch(/Expected property name|JSON at position|Unexpected token|SyntaxError/);
}

async function detailState(component: Locator, id: string, variant: string) {
	if (id.endsWith('harness-entity-details') && variant === 'summary') {
		await expect(
			component.getByRole('heading', { name: 'Performance profile', exact: true })
		).toBeVisible();
		await expect(
			component.getByRole('heading', { name: 'Contract', exact: true }),
			'Summary is distinct from the contract view'
		).toHaveCount(0);
	}
	if (id.endsWith('harness-entity-sections') && ['states', 'tests'].includes(variant)) {
		const verification = component.getByText(`Verification at ${commits.middle.slice(0, 7)}`);
		if (variant === 'tests')
			await expect(verification, 'Tests exposes verification details').toBeVisible();
		else await expect(verification, 'States keeps verification details collapsed').toBeHidden();
	}
}

async function responsiveTables(component: Locator, id: string, variant: string, viewport: string) {
	if (
		viewport === 'mobile' &&
		id.endsWith('harness-entity-details') &&
		['measurements', 'unmeasured'].includes(variant)
	) {
		const panel = component.locator('[data-harness-component="harness-entity-measures"]');
		expect(await panel.innerText(), 'Measurement values remain visible on mobile').toMatch(
			/source bytes/i
		);
		const split = await panel.evaluate((element) => {
			const broken: string[] = [];
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			while (walker.nextNode()) {
				const node = walker.currentNode;
				for (const word of (node.textContent ?? '').matchAll(/[A-Za-z]{5,}/g)) {
					const range = document.createRange();
					range.setStart(node, word.index!);
					range.setEnd(node, word.index! + word[0].length);
					if (range.getClientRects().length > 1) broken.push(word[0]);
				}
			}
			return broken;
		});
		expect(split, 'Limit values wrap between words, not a few letters per line').toEqual([]);
	}
	if (!id.endsWith('harness-entity-history')) return;
	const clipped = await component.locator('.ex-history td').evaluateAll((cells) =>
		cells
			.filter((cell) => {
				const rect = cell.getBoundingClientRect();
				const frame = cell.closest('.ex-scroll')!.getBoundingClientRect();
				return rect.width > 0 && (rect.left < frame.left - 1 || rect.right > frame.right + 1);
			})
			.map((cell) => cell.textContent?.trim())
	);
	expect(clipped, 'All history fields are visible within the viewport frame').toEqual([]);
}

async function sourceLink(component: Locator) {
	const link = component.locator('.source-files a').first();
	await expect(link).toHaveAttribute('href', /https:\/\/github\.com\/.+\/blob\/[a-f0-9]{40}\//);
	const indicated = await link.evaluate((anchor) => {
		const name = anchor.querySelector('.source-name') ?? anchor;
		const style = getComputedStyle(name);
		const panel = anchor.closest('section')!;
		const text = document.createRange();
		text.selectNodeContents(name);
		return {
			visible:
				style.textDecorationLine.includes('underline') ||
				style.color !== getComputedStyle(panel).color,
			room: name.getBoundingClientRect().bottom - text.getBoundingClientRect().bottom,
			offset: parseFloat(style.textUnderlineOffset) || 0
		};
	});
	expect(indicated.visible, 'The source filename visibly indicates that it is a link').toBe(true);
	expect(
		indicated.room,
		'The underline fits inside the source filename clipping box'
	).toBeGreaterThanOrEqual(indicated.offset + 1);
}

async function searchFocus(component: Locator) {
	const field = component.getByRole('dialog').getByRole('combobox', { name: 'Search entities' });
	await expect(field).toBeFocused();
	const rings = await field.evaluate((input) => {
		const style = getComputedStyle(input);
		return {
			outline: parseFloat(style.outlineWidth),
			border: parseFloat(style.borderTopWidth),
			shadow: style.boxShadow
		};
	});
	expect(rings, 'The field wrapper provides the single focus indicator').toEqual({
		outline: 0,
		border: 0,
		shadow: 'none'
	});
}

async function assertionsFlow(component: Locator) {
	await expect(component.locator('.ex-steps')).toContainText('Search for SERVICE');
	for (const row of await component.locator('.ex-checks > li').all()) {
		const label = row.locator(':scope > span').last();
		const [line, name] = await Promise.all([row.boundingBox(), label.boundingBox()]);
		expect(
			name!.y - line!.y,
			'Assertion labels begin at the top, including rows with JSON observations'
		).toBeLessThanOrEqual(2);
	}
}

async function longTooltip(component: Locator) {
	const tooltip = component.getByRole('tooltip');
	const geometry = await tooltip.evaluate((node) => {
		const tip = node as HTMLElement;
		const style = getComputedStyle(tip);
		return {
			overflow: tip.scrollHeight > tip.clientHeight,
			gutter:
				tip.offsetWidth -
				tip.clientWidth -
				parseFloat(style.borderLeftWidth) -
				parseFloat(style.borderRightWidth)
		};
	});
	expect(geometry.overflow, 'The long state exercises genuinely overflowing content').toBe(true);
	expect(geometry.gutter, 'A long tooltip has a visible scrollbar gutter').toBeGreaterThan(0);
	await assertScrollbarPaint(tooltip, geometry.gutter);
	await component.getByRole('button').press('End');
	const end = tooltip.locator(':scope > span').last();
	const [tip, last] = await Promise.all([tooltip.boundingBox(), end.boundingBox()]);
	expect(
		last!.y + last!.height,
		'Keyboard scrolling reveals the complete final reason'
	).toBeLessThanOrEqual(tip!.y + tip!.height);
}
