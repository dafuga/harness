import { expect, type Locator } from '@playwright/test';
import { previewCaptureBounds } from './previewCaptureBounds';

/** Open the real console conversation and settle the selected visible state. */
export async function prepareConsoleChatState(component: Locator, variant: string) {
	const request = component.page().waitForRequest((call) => call.url().endsWith('/api/agent'));
	await component.locator('.floating-chat-bubble').click();
	await request;
	await expect(component.locator('.floating-chat-panel')).toBeVisible();
	const message = component.getByRole('textbox', { name: 'Message' });
	if (variant === 'loading') {
		await expect(message).toBeDisabled();
		await expect(component.getByText('Loading project…', { exact: true })).toBeVisible();
		return;
	}
	if (variant === 'connection-error') {
		await expect(
			component.getByText('Chat unavailable: Error: Project connection unavailable.')
		).toBeVisible();
		return expect(message).toBeDisabled();
	}
	if (variant === 'read-only' || variant === 'agents') {
		await expect(component.getByText('This project is read-only.')).toBeVisible();
		await expect(message).toBeEnabled();
		if (variant === 'agents') return agentRoster(component);
		return;
	}
	await expect(
		component.getByText('Ask a question, plan a design, or request a code change.')
	).toBeVisible();
	await expect(message).toBeEnabled();
	await expect(component.getByRole('button', { name: 'Choose model' })).toHaveAttribute(
		'title',
		'Model: Codex · GPT 6.1'
	);
	if (variant === 'populated') return populateConversation(component, message);
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
		await assertChatFrame(component, variant);
	}
}

async function populateConversation(component: Locator, message: Locator) {
	await component.getByRole('button', { name: 'Comment', exact: true }).click();
	await message.fill('Please review the activity panel on mobile.');
	await component.getByRole('button', { name: 'Send comment', exact: true }).click();
	await expect(component.getByText('Please review the activity panel on mobile.')).toBeVisible();
	await expect(component.getByText('Comment saved on this device; not shared yet.')).toBeVisible();
}

async function assertChatFrame(component: Locator, variant: string) {
	const clip = await previewCaptureBounds(
		component.page(),
		'reports.component.console-chat',
		variant
	);
	const offset = await component.page().evaluate(() => ({ x: scrollX, y: scrollY }));
	for (const selector of [
		'.floating-chat-panel',
		'.floating-chat-bubble',
		'dialog[open], [role="dialog"]:visible'
	]) {
		const box = await component.locator(selector).boundingBox();
		expect(box).not.toBeNull();
		const message = 'Console chat capture includes its panel, launcher and dialog';
		expect(clip.x, message).toBeLessThanOrEqual(box!.x + offset.x);
		expect(clip.y, message).toBeLessThanOrEqual(box!.y + offset.y);
		expect(clip.x + clip.width, message).toBeGreaterThanOrEqual(box!.x + offset.x + box!.width);
		expect(clip.y + clip.height, message).toBeGreaterThanOrEqual(box!.y + offset.y + box!.height);
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
