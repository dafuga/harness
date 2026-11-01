import { expect, type Locator } from '../../../../../../test/support/browserTest';

const reviewedAtoms = new Set([
	'html-a',
	'html-aside',
	'html-blockquote',
	'html-code',
	'html-details',
	'html-dl',
	'html-element',
	'html-figcaption',
	'html-footer',
	'html-h1',
	'html-h3',
	'html-header',
	'html-input',
	'html-label',
	'html-main',
	'html-ol',
	'html-output',
	'html-pre',
	'html-small',
	'html-strong',
	'html-table',
	'html-td',
	'html-th',
	'html-time',
	'html-ul',
	'svg-path'
]);

export function isReviewedNativeAtom(id: string): boolean {
	return reviewedAtoms.has(id.replace('reports.component.shared-primitives-atoms-', ''));
}

/** Inspect the saved state's content and geometry after the standard capture checkpoint. */
export async function assertNativePresentation(component: Locator, id: string, variant: string) {
	if (!isReviewedNativeAtom(id)) return;
	const name = id.split('-').at(-1)!;
	const selectors: Record<string, string> = { element: 'div', path: 'svg > path' };
	const selector = selectors[name] ?? name;
	const element = component.locator('.atom-host').locator(selector).first();
	const copy = await element.evaluate((node) =>
		[
			node.textContent ?? '',
			'value' in node ? String(node.value) : '',
			node.getAttribute('placeholder') ?? ''
		].join(' ')
	);
	await expect(element).toBeVisible();
	expect(
		copy,
		'Native examples use realistic content without implementation or fixture labels'
	).not.toMatch(/\b(?:Html[A-Z]\w*|Svg[A-Z]\w*|Example)\b|Long native content|a caller supplies/i);
	if (variant === 'long')
		expect(copy.trim().length, 'The long state contains substantial content').toBeGreaterThan(60);
	if (name === 'input') await assertReviewedInput(element, variant);
	if (variant === 'unlinked') await expect(element).toHaveText('Open the release notes');
	const bounds = await element.boundingBox();
	expect(bounds?.width, 'The atom has visible pixels').toBeGreaterThan(0);
	expect(bounds!.x, 'The atom begins inside the viewport').toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width, 'The atom fits its actual viewport width').toBeLessThanOrEqual(
		component.page().viewportSize()!.width + 1
	);
	if (name === 'pre')
		expect(
			await element.evaluate((node) => node.scrollWidth <= node.clientWidth + 1),
			'Code lines remain fully readable'
		).toBe(true);
}

async function assertReviewedInput(element: Locator, variant: string) {
	await expect(element).toHaveValue(variant === 'empty' ? '' : 'October release');
	if (variant === 'empty') await expect(element).toHaveAttribute('placeholder', 'Release title');
}
