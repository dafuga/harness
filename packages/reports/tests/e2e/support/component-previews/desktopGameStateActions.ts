import { expect, type Locator } from '@playwright/test';

const actions: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	'game-create': create,
	'game-checkpoint-editor': checkpoint,
	'game-checkpoint-pane': pane,
	'game-level-brief': brief,
	'game-view-fields': fields,
	'game-preview': preview
};

/** Use authoring controls; the fixture bridge cannot create a project or contact a provider. */
export async function prepareDesktopGameState(component: Locator, id: string, variant: string) {
	await actions[id.replace('desktop.component.', '')]?.(component, variant);
}

async function create(component: Locator, variant: string) {
	if (variant === 'unavailable') {
		return;
	}
	const submit = component.getByRole('button', { name: 'Create project', exact: true });
	if (!variant) {
		await expect(submit).toBeDisabled();
		return;
	}
	await component.getByRole('textbox', { name: 'Name', exact: true }).fill('Garden trail');
	if (variant.startsWith('game-')) {
		await component.getByRole('combobox', { name: 'Project type' }).selectOption('game');
		await component
			.getByRole('combobox', { name: 'Dimension', exact: true })
			.selectOption(variant.slice(-2));
	}
	if (['busy', 'error'].includes(variant)) await submit.click();
	if (variant === 'busy')
		await expect(component.getByRole('form')).toHaveAttribute('aria-busy', 'true');
	if (variant === 'error') await expect(component.getByRole('alert')).toContainText(/project/i);
}

async function checkpoint(component: Locator, variant: string) {
	if (variant === 'empty') {
		await expect(component).toContainText('Select a checkpoint to edit it.');
		return;
	}
	if (variant === 'readonly')
		await expect(component.getByRole('button', { name: 'Add condition' })).toBeDisabled();
	if (variant === 'empty-rules')
		await expect(component.getByRole('group', { name: /^Condition / })).toHaveCount(0);
	if (variant === 'long') await expect(component.getByRole('checkbox')).toBeChecked();
}

async function pane(component: Locator, variant: string) {
	if (variant === 'advanced') {
		await component.getByRole('button', { name: 'Advanced rules' }).click();
		const rules = component.getByRole('region', { name: 'Rules', exact: true });
		await rules.scrollIntoViewIfNeeded();
		await expect(rules).toBeVisible();
		await component.locator('.viewer-content').evaluate((node) => node.scrollTo(0, 0));
		await expect(component.getByText('Describe your checkpoint', { exact: true })).toBeVisible();
	}
	if (variant === 'adding')
		await expect(component.getByRole('dialog', { name: 'Add checkpoint' })).toBeVisible();
	if (variant === 'readonly') {
		await expect(component.getByRole('button', { name: 'Delete checkpoint' })).toHaveCount(0);
		await expect(component.getByRole('textbox', { name: 'Checkpoint title' })).toHaveAttribute(
			'readonly',
			''
		);
	}
}

async function brief(component: Locator, variant: string) {
	if (variant === 'empty')
		await expect(component.getByRole('button', { name: 'Continue to level brief' })).toBeDisabled();
	if (variant === 'concept')
		await expect(component.getByRole('textbox', { name: 'Concept', exact: true })).toBeVisible();
	if (variant === 'readonly')
		await expect(component.getByRole('button', { name: 'Generate level' })).toHaveCount(0);
	if (variant === 'busy')
		await expect(component.getByRole('button', { name: 'Generate level' })).toBeDisabled();
	if (variant === 'error')
		await expect(component.getByRole('alert')).toContainText(
			'The provider could not generate a level proposal.'
		);
	if (variant === 'reviewable')
		await expect(component.getByRole('button', { name: 'Back to review' })).toBeVisible();
	if (variant === 'no-model') await expect(component).toContainText('No local model is available.');
}

async function fields(component: Locator, variant: string) {
	if (['settings-open', 'readonly', 'multiple'].includes(variant))
		await component.getByRole('button', { name: 'View settings' }).click();
	if (variant === 'readonly')
		await expect(component.getByRole('button', { name: 'New level' })).toHaveCount(0);
	if (variant === 'multiple')
		await expect(
			component.getByRole('combobox', { name: 'View', exact: true }).locator('option')
		).toHaveCount(2);
	if (variant === 'gated') {
		await expect(component.getByRole('button', { name: 'Preview', exact: true })).toBeDisabled();
		await expect(
			component.getByRole('button', { name: 'Checkpoints', exact: true })
		).toBeDisabled();
	}
}

async function preview(component: Locator, variant: string) {
	if (variant === 'reset') {
		await component.getByRole('button', { name: 'Reset', exact: true }).click();
		await expect(component).toContainText('No key yet');
	}
	if (variant === 'readonly')
		await expect(component.locator('[data-harness-component="game-preview"]')).toHaveAttribute(
			'data-readonly',
			'true'
		);
	await expect
		.poll(() =>
			component.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL().length)
		)
		.toBeGreaterThan(1000);
	await expect(component.getByRole('button', { name: 'Start AI video' })).toBeDisabled();
}
