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
export async function assertNativeAtomState(component: Locator, id: string, variant: string) {
	if (!id.includes('.shared-primitives-atoms-')) return;
	const name = id.split('-').at(-1)!;
	const tag = name === 'element' ? 'div' : name;
	const element = component.locator('.atom-host').locator(tag).first();
	await expect(tag === 'option' ? component.locator('.atom-host select') : element).toBeVisible();
	await assertNativeControl(element, tag, variant);
	if (tag === 'details') {
		if (variant === 'closed') await expect(element).not.toHaveAttribute('open');
		else await expect(element).toHaveAttribute('open', '');
	}
	await assertNativeAttributes(element, tag, variant);
	if (tag === 'audio' && !variant)
		await expect
			.poll(() => element.evaluate((node: HTMLAudioElement) => node.readyState))
			.toBeGreaterThanOrEqual(2);
}

async function assertNativeControl(element: Locator, tag: string, variant: string) {
	if (variant === 'disabled') await expect(element).toBeDisabled();
	if (variant === 'empty') await expect(element).toHaveValue('');
	if (tag === 'textarea' && variant === 'filled')
		await expect(element).toHaveValue('A saved message with several words.');
	if (variant === 'long') await expect(element).toContainText('Long native content');
}

async function assertNativeAttributes(element: Locator, tag: string, variant: string) {
	if (variant === 'unlinked') await expect(element).not.toHaveAttribute('href');
	if (variant === 'alt-only')
		await expect(element).toHaveAttribute('alt', 'Image description without a source');
	if (variant === 'outlined') await expect(element).toHaveAttribute('fill', 'none');
	if (tag === 'path' && variant === 'filled')
		await expect(element).toHaveAttribute('fill', 'currentColor');
}
