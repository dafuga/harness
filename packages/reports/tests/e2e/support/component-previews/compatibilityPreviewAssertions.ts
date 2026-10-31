import { expect, type Locator } from '@playwright/test';

export async function prepareCompatibilityState(component: Locator, id: string, variant: string) {
	if (id !== 'desktop.component.remote-approval' || !['read', 'write'].includes(variant)) return;
	await component.getByRole('checkbox').first().check();
	await component.getByRole('combobox', { name: 'Device access' }).selectOption(variant);
}

export async function assertCompatibilityPreview(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.agent-controls') await controls(component, variant);
	if (id !== 'desktop.component.remote-approval') return;
	await readableSelections(component);
	await expect(component.locator('small').first()).toHaveText(
		/^Key (?:[0-9a-f]{4} ){15}[0-9a-f]{4} · iOS$/
	);
	if (variant === 'no-projects')
		await expect(component).toContainText('Add a local project first.');
	if (['read', 'write'].includes(variant)) {
		await expect(component.getByRole('combobox', { name: 'Device access' })).toHaveValue(variant);
		await expect(component.getByRole('button', { name: 'Approve', exact: true })).toBeEnabled();
	} else
		await expect(component.getByRole('button', { name: 'Approve', exact: true })).toBeDisabled();
	if (variant === 'busy')
		await expect(component.getByRole('button', { name: 'Deny', exact: true })).toBeDisabled();
}

async function controls(component: Locator, variant: string) {
	if (variant === 'compact') {
		await expect(component.locator('.agent-icons')).toBeVisible();
		await expect(component.getByRole('combobox')).toHaveCount(0);
		return;
	}
	await readableSelections(component);
	await expect(component.getByRole('combobox', { name: 'Model', exact: true })).toHaveCount(1);
	if (variant === 'empty') await expect(component).toContainText('No agent provider available.');
	if (['empty', 'unavailable'].includes(variant))
		await expect(component.getByRole('combobox', { name: 'Model', exact: true })).toBeDisabled();
}

async function readableSelections(component: Locator) {
	for (const select of await component.getByRole('combobox').all()) {
		const geometry = await select.evaluate((node: HTMLSelectElement) => {
			const style = getComputedStyle(node);
			const context = document.createElement('canvas').getContext('2d')!;
			context.font = style.font;
			const text = node.selectedOptions[0]?.text ?? '';
			const icon = node.parentElement?.querySelector('svg');
			const iconStyle = icon && getComputedStyle(icon);
			const reserved =
				icon && iconStyle
					? icon.getBoundingClientRect().width + 2 * parseFloat(iconStyle.right)
					: 0;
			return {
				text,
				needed:
					context.measureText(text).width +
					parseFloat(style.paddingLeft) +
					Math.max(parseFloat(style.paddingRight), reserved),
				available: node.clientWidth
			};
		});
		expect(
			geometry.needed,
			`Selected label remains readable: ${geometry.text}`
		).toBeLessThanOrEqual(geometry.available + 2);
	}
}
