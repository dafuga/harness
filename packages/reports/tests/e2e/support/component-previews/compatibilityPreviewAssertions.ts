import { expect, type Locator } from '@playwright/test';

export async function prepareCompatibilityState(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.choice-dialog') {
		if (['closed', 'disabled'].includes(variant)) return;
		await component.getByRole('button', { name: 'Choose a model', exact: true }).click();
		await expect(component.getByRole('dialog', { name: 'Choose a model' })).toBeVisible();
	}
	if (id !== 'desktop.component.remote-approval' || ['no-projects', 'unselected'].includes(variant))
		return;
	await component.getByRole('checkbox').first().check();
	if (['read', 'write'].includes(variant))
		await component.getByRole('combobox', { name: 'Device access' }).selectOption(variant);
}

export async function assertCompatibilityPreview(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.agent-controls') await controls(component, variant);
	if (id === 'desktop.component.choice-dialog') await choices(component, variant);
	if (id !== 'desktop.component.remote-approval') return;
	await expect(component).not.toContainText(/\b(?:preview|synthetic|fixture)\b/i);
	await readableSelections(component);
	await expect(component.locator('small').first()).toHaveText(
		/^Key (?:[0-9a-f]{4} ){15}[0-9a-f]{4} · iOS$/
	);
	if (variant === 'no-projects')
		await expect(component).toContainText('Add a local project first.');
	const approve = component.getByRole('button', { name: /^Approv/ });
	if (['no-projects', 'unselected', 'busy'].includes(variant)) await expect(approve).toBeDisabled();
	else await expect(approve).toBeEnabled();
	if (['read', 'write'].includes(variant)) {
		await expect(component.getByRole('combobox', { name: 'Device access' })).toHaveValue(variant);
	}
	if (variant === 'busy') {
		await expect(component.getByRole('button', { name: 'Deny', exact: true })).toBeDisabled();
	}
}

/** Pixel checkpoints precede these layout and in-progress feedback assertions. */
export async function assertRecordedCompatibility(component: Locator, id: string, variant: string) {
	if (id === 'reports.component.harness-entity-artifact' && variant === 'expanded') {
		const gaps = await component
			.locator('.ex-steps, .ex-checks')
			.evaluateAll((lists) => lists.map((list) => parseFloat(getComputedStyle(list).rowGap)));
		expect(gaps, 'Steps and assertion rows use the same spacing').toHaveLength(2);
		expect(gaps[0], 'Steps and assertion rows use the same spacing').toBe(gaps[1]);
	}
	if (id === 'desktop.component.remote-approval' && variant === 'busy') {
		await expect(
			component.getByRole('button', { name: /^Approv/ }),
			'Approval progress is visibly distinct'
		).toHaveText('Approving…');
		await expect(component.getByRole('group')).toHaveAttribute('aria-busy', 'true');
	}
}

async function choices(component: Locator, variant: string) {
	const trigger = component.getByRole('button', { name: 'Choose a model', exact: true });
	const dialog = component.getByRole('dialog', { name: 'Choose a model' });
	if (['closed', 'disabled'].includes(variant)) {
		await expect(dialog).toBeHidden();
		if (variant === 'disabled') await expect(trigger).toBeDisabled();
		return;
	}
	await expect(dialog).toBeVisible();
	if (variant === 'empty') await expect(dialog).toContainText('No models available.');
	else {
		const selected = dialog.getByRole('button', { name: 'GPT-6.1 Sol', exact: true });
		await expect(selected).toHaveAttribute('aria-pressed', 'true');
		await expect(selected).toBeFocused();
		await expect(dialog.getByRole('button', { name: /Luna/ })).toBeDisabled();
	}
	await dialog.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(trigger).toBeFocused();
}

async function controls(component: Locator, variant: string) {
	await expect(component).not.toContainText(/\b(?:preview|synthetic|fixture)\b/i);
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
