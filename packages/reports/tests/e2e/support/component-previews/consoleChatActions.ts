import { expect, type Locator } from '@playwright/test';

/** Open the real console conversation and settle the selected visible state. */
export async function prepareConsoleChatState(component: Locator, variant: string) {
	const request = component.page().waitForRequest((call) => call.url().endsWith('/api/agent'));
	await component.locator('.floating-chat-bubble').click();
	await request;
	await expect(component.locator('.floating-chat-panel')).toBeVisible();
	const message = component.getByRole('textbox', { name: 'Message' });
	if (variant === 'loading') return expect(message).toBeDisabled();
	if (variant === 'connection-error') {
		await expect(
			component.getByText('Chat unavailable: Error: Project connection unavailable.')
		).toBeVisible();
		return expect(message).toBeDisabled();
	}
	if (variant === 'read-only') {
		await expect(component.getByText('This project is read-only.')).toBeVisible();
		return expect(message).toBeEnabled();
	}
	await expect(
		component.getByText('Ask a question, plan a design, or request a code change.')
	).toBeVisible();
	await expect(message).toBeEnabled();
	await expect(component.getByRole('button', { name: 'Choose model' })).toHaveAttribute(
		'title',
		'Model: Codex · Preview model'
	);
	if (variant === 'agents') return agentRoster(component);
	const modes: Record<string, string> = { ask: 'Ask', change: 'Change', comment: 'Comment' };
	if (modes[variant]) {
		const button = component.getByRole('button', { name: modes[variant], exact: true });
		await button.click();
		return expect(button).toHaveAttribute('aria-pressed', 'true');
	}
	const pickers: Record<string, string> = {
		'model-open': 'Choose model',
		'effort-open': 'Reasoning effort'
	};
	if (pickers[variant]) {
		await component.getByRole('button', { name: pickers[variant], exact: true }).click();
		await expect(
			component.getByRole('dialog', { name: pickers[variant], exact: true })
		).toBeVisible();
	}
}

async function agentRoster(component: Locator) {
	await component.getByRole('button', { name: 'Agents', exact: true }).click();
	await expect(
		component.getByRole('list', { name: 'Agent sessions' }).getByText('Preview agent')
	).toBeVisible();
	await expect(
		component
			.getByRole('region', { name: 'Modules being worked on' })
			.getByText('No fresh assignments')
	).toBeVisible();
	const body = component.locator('.floating-chat-body');
	await expect
		.poll(() => body.evaluate((node) => node.scrollHeight - node.clientHeight))
		.toBeLessThanOrEqual(1);
}
