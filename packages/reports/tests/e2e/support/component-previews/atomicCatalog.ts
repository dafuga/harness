import { nativeAtomVariants } from './nativeAtomVariants';
import { nativeAtomContent } from './nativeAtomContent';
import { isReviewedNativeAtom } from './nativeAtomPresentationAssertions';
import { expect, type Locator } from '../../../../../../test/support/browserTest';

export async function assertCompositionFilter(component: Locator): Promise<void> {
	const level = component.getByRole('combobox', { name: 'Component level' });
	const items = component.locator('section.ex-group li');
	const count = await items.count();
	expect(count).toBeGreaterThan(0);
	for (const [index, value] of ['atom', 'molecule', 'organism'].entries()) {
		await level.selectOption(value);
		await expect(items).toHaveCount(Math.floor(count / 3) + (index < count % 3 ? 1 : 0));
	}
	await level.selectOption('all');
	await expect(items).toHaveCount(count);
}

/** Native states assert real browser properties, then the standard test records the same element. */
const nativeSelectors: Record<string, string> = {
	path: 'svg > path',
	tr: 'tbody > tr',
	option: 'option[value="example"]'
};

export async function assertNativeAtomState(component: Locator, id: string, variant: string) {
	if (!Object.hasOwn(nativeAtomVariants, id)) return;
	const name = id.split('-').at(-1)!;
	const tag = name === 'element' ? 'div' : name;
	const element = component
		.locator('.atom-host')
		.locator(nativeSelectors[tag] ?? tag)
		.first();
	await expect(tag === 'option' ? component.locator('.atom-host select') : element).toBeVisible();
	if (tag === 'option') await assertNativeOption(element, component, variant);
	await assertNativeList(component, tag);
	await assertNativeTable(component, tag);
	await assertNativeControl(element, tag, variant, id);
	await assertNativeDisclosure(component, tag, variant);
	await assertNativeAttributes(element, tag, variant);
	await assertNativeCopy(element, name, variant);
	if (tag === 'audio' && !variant)
		await expect
			.poll(() => element.evaluate((node: HTMLAudioElement) => node.readyState))
			.toBeGreaterThanOrEqual(2);
}

async function assertNativeList(component: Locator, tag: string) {
	if (!['ol', 'ul', 'li'].includes(tag)) return;
	const list = component.locator(`.atom-host ${tag === 'li' ? 'ul' : tag}`);
	const items = list.locator(':scope > li');
	const marker = tag === 'ol' ? 'decimal' : 'disc';
	await expect(items.first()).toHaveCSS('list-style-type', marker, { timeout: 1000 });
	await expect(items).toHaveCount(tag === 'li' ? 2 : 3);
	for (const item of await items.all()) {
		await expect(item).toHaveCSS('display', 'list-item');
		await expect(item).toHaveCSS('list-style-type', marker);
		await expect(item).toHaveCSS('list-style-position', 'inside');
		await expect(item).toBeInViewport();
	}
}

async function assertNativeTable(component: Locator, tag: string) {
	if (!['table', 'thead', 'tbody', 'tr', 'th', 'td'].includes(tag)) return;
	const table = component.locator('.atom-host table');
	await expect(table.getByRole('row')).toHaveCount(3, { timeout: 1000 });
	await expect(table.getByRole('columnheader')).toHaveCount(2);
	await expect(table.getByRole('cell')).toHaveCount(4);
	for (const cell of await table.locator('th, td').all()) {
		await expect(cell).toHaveCSS('border-top-width', '1px');
		await expect(cell).toHaveCSS('border-top-style', 'solid');
		await expect(cell).toBeInViewport();
	}
}

async function assertNativeDisclosure(component: Locator, tag: string, variant: string) {
	if (!['details', 'summary'].includes(tag)) return;
	const details = component.locator('.atom-host details');
	const body = details.locator('p');
	if (variant === 'closed') {
		await expect(details).not.toHaveAttribute('open');
		await expect(body).toBeHidden();
	} else {
		await expect(details).toHaveAttribute('open', '');
		await expect(body).toBeVisible();
	}
}

async function assertNativeControl(element: Locator, tag: string, variant: string, id: string) {
	if (variant === 'disabled') await assertDisabledNativeControl(element, tag, id);
	if (variant === 'empty') await expect(element).toHaveValue('');
	if (tag === 'textarea' && variant === 'filled')
		await expect(element).toHaveValue('A saved message with several words.');
	if (variant === 'long' && !isReviewedNativeAtom(id))
		await expect(element).toContainText('Long native content');
}

async function assertDisabledNativeControl(element: Locator, tag: string, id: string) {
	await expect(element).toBeDisabled();
	const legacyInput = tag === 'input' && !isReviewedNativeAtom(id);
	if (tag === 'textarea' || legacyInput) await expect(element).toHaveValue('Disabled example text');
	if (['button', 'input', 'textarea'].includes(tag))
		await expect(element).toHaveCSS('opacity', '0.45');
}

async function assertNativeOption(element: Locator, component: Locator, variant: string) {
	const label = `HtmlOption: ${variant === 'disabled' ? 'Disabled choice' : 'Available choice'}`;
	await expect(element).toHaveText(label);
	await expect(element).toHaveJSProperty('label', label);
	await expect(element).toBeInViewport();
	await expect(component.locator('select')).toHaveAttribute('size', '3');
	await expect(component.locator('option')).toHaveCount(3);
	await expect(component.locator('option').first()).toHaveJSProperty('selected', true);
	await expect(component.locator('option').last()).toBeDisabled();
}

async function assertNativeAttributes(element: Locator, tag: string, variant: string) {
	if (tag === 'a') await assertNativeAnchor(element, variant);
	if (variant === 'alt-only') await expect(element).toHaveAttribute('alt', 'No image available');
	if (variant === 'outlined') await expect(element).toHaveAttribute('fill', 'none');
	if (tag === 'path' && variant === 'filled')
		await expect(element).toHaveAttribute('fill', 'currentColor');
}

async function assertNativeAnchor(element: Locator, variant: string) {
	if (variant === 'unlinked') {
		await expect(element).not.toHaveAttribute('href');
		await expect(element).not.toHaveRole('link');
		await expect(element).toHaveCSS('text-decoration-line', 'none');
		await expect(element).not.toBeEmpty();
		return;
	}
	await expect(element).toHaveRole('link');
	await expect(element).toHaveCSS('text-decoration-line', 'underline', { timeout: 1000 });
	await expect(element).toHaveAttribute('href', '#release-notes');
	await element.focus();
	await expect(element).toBeFocused();
}

async function assertNativeCopy(element: Locator, name: string, variant: string) {
	const expected = nativeAtomContent[`Html${name[0].toUpperCase()}${name.slice(1)}`];
	if (!variant && expected) await expect(element).toContainText(expected);
}
