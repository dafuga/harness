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
