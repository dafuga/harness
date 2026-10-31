import { expect, type Locator } from '@playwright/test';

/** Check the actual state branches, so a successful screenshot cannot silently show the default. */
export async function assertDesktopState(component: Locator, id: string, variant: string) {
	const key = id.replace('desktop.component.', '') + ':' + variant;
	const messages: Record<string, string> = {
		'design-panel:empty': 'No design image yet',
		'design-panel:headless': 'Planned behavior',
		'design-panel:loading': 'Loading design image…',
		'design-panel:error': 'Synthetic image read refused.',
		'history-panel:empty': 'No history recorded for this entity.',
		'history-panel:incomplete': 'Earlier history is not loaded here.',
		'history-panel:long': 'A detailed history event.',
		'runtime-artifact:missing': 'Not recorded',
		'runtime-artifact:unstored': 'The original bytes were not retained.',
		'runtime-artifact:loading': 'Reading what it holds…',
		'runtime-artifact:unreadable': 'Synthetic artifact hash mismatch.',
		'runtime-artifact:text': 'Recorded plain text output.',
		'runtime-screens:incomparable': 'different runtime profiles',
		'runtime-evidence:error': 'Synthetic evidence read refused.',
		'runtime-evidence:offline': 'Saved'
	};
	if (messages[key]) await expect(component).toContainText(messages[key], { ignoreCase: true });
	await checks[id.replace('desktop.component.', '')]?.(component, variant);
}
const checks: Record<string, (component: Locator, variant: string) => Promise<void>> = {
	composer,
	'environment-picker': async (component, variant) => {
		if (variant === 'prod')
			await expect(component.getByRole('combobox', { name: 'Environment' })).toHaveValue('prod');
	},
	'status-icon': async (component, variant) => {
		const failed = ['failed', 'unverified', 'unknown', 'no-reason', 'long'].includes(variant);
		await expect(component.getByRole('button')).toHaveText(failed ? '×' : '✓');
		if (['open', 'long'].includes(variant))
			await expect(component.getByRole('status')).toBeVisible();
	},
	'revision-picker': async (component, variant) => {
		if (['pinned', 'historical'].includes(variant))
			await expect(component.getByRole('button', { name: 'Go to tip' })).toBeVisible();
	},
	'nav-bar': async (component, variant) => {
		if (variant === 'readonly')
			await expect(component.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
	},
	'project-gate': async (component, variant) => {
		if (variant === 'busy')
			await expect(component.getByRole('button', { name: 'Open Project' })).toBeDisabled();
	}
};

async function composer(component: Locator, variant: string) {
	const box = component.getByRole('textbox', { name: 'Message' });
	if (['running', 'no-modes'].includes(variant)) await expect(box).toBeDisabled();
	const send = component.locator('button.send');
	if (['running', 'no-modes', 'unapproved', 'no-provider'].includes(variant))
		await expect(send).toBeDisabled();
	if (['plan', 'ask', 'change', 'visual-plan', 'retry', 'compact', 'long'].includes(variant))
		await expect(send).toBeEnabled();
	if (variant === 'ask') await expect(box).toHaveAttribute('placeholder', 'Ask a question…');
}
