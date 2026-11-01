import { expect, type Locator } from '@playwright/test';

/** Painted captions and reasons distinguish the named catalog states. */
export async function assertDesktopPresentation(component: Locator, id: string, variant: string) {
	if (id === 'desktop.component.composer') await assertComposerPresentation(component, variant);
	if (id === 'desktop.component.status-icon') await assertStatusPresentation(component, variant);
}

async function assertComposerPresentation(component: Locator, variant: string) {
	await expect(component.getByRole('textbox', { name: 'Message' })).not.toHaveValue(
		/synthetic request kept for this capture/i
	);
	const modes: Record<string, string> = {
		ask: 'Ask',
		plan: 'Plan',
		change: 'Change',
		'visual-plan': 'Plan'
	};
	if (modes[variant])
		await expect(
			component.getByRole('button', { name: modes[variant], exact: true })
		).toHaveAttribute('aria-pressed', 'true');
	if (variant === 'visual-plan')
		await expect(component.getByRole('textbox', { name: 'Message' })).toHaveValue(/visual/i);
	if (variant === 'running') await expect(component.getByText(/agent is running/i)).toBeVisible();
}

async function assertStatusPresentation(component: Locator, variant: string) {
	const messages: Record<string, RegExp> = {
		failed: /verification failed/i,
		unknown: /status is unknown/i,
		unverified: /not been verified/i,
		'no-reason': /no verification recorded for this revision/i
	};
	const status = component.getByRole('status');
	if (messages[variant]) await expect(status).toHaveText(messages[variant]);
	if (variant === 'long') {
		const sentences = (await status.innerText())
			.split(/[.!?]+/)
			.map((sentence) => sentence.trim())
			.filter(Boolean);
		expect(
			new Set(sentences).size,
			'Long explanations contain distinct meaningful sentences'
		).toBeGreaterThanOrEqual(3);
	}
}
