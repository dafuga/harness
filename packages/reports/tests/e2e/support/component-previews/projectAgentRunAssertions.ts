import { expect, type Locator, type Page } from '@playwright/test';
import { projectConversation } from './projectAgentRunFixture';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';

const runStates = new Set([
	'read-only',
	'conversation',
	'historical',
	'ask',
	'plan',
	'visual-plan',
	'change',
	'running',
	'saved-plan',
	'failure'
]);

/** Real UI submissions stop at the synthetic bridge, whose exact received inputs are observed. */
export async function prepareProjectAgentState(
	page: Page,
	component: Locator,
	state: ProjectAgentState
) {
	if (['local-comment', 'hosted-comment', 'comment-retry'].includes(state))
		return comment(page, component, state);
	if (!runStates.has(state)) return;
	let mode = 'Plan';
	if (state === 'change') mode = 'Change';
	if (state === 'ask') mode = 'Ask';
	await component.getByRole('button', { name: mode, exact: true }).click();
	const textbox = component.getByRole('textbox', { name: 'Message' });
	await textbox.fill('  ' + projectConversation + '  ');
	await component.locator('button.send').click();
	await expect
		.poll(() =>
			page.evaluate(() => JSON.parse(sessionStorage.getItem('harness.preview.request') ?? 'null'))
		)
		.toMatchObject({
			mode: mode.toLowerCase(),
			provider: 'codex',
			model: 'gpt-6.1-sol',
			effort: 'high',
			text: projectConversation
		});
	if (state === 'visual-plan') {
		const request = await page.evaluate(() =>
			JSON.parse(sessionStorage.getItem('harness.preview.request')!)
		);
		expect(request.designOptions).toBe(7);
	}
	await outcome(component, state);
}

async function outcome(component: Locator, state: ProjectAgentState) {
	if (state === 'running') {
		await expect(component).toContainText('Reviewing order search behavior…');
		await expect(component.getByRole('textbox', { name: 'Message' })).toBeDisabled();
		await expect(component.locator('button.send')).toBeDisabled();
		return;
	}
	if (state === 'failure') {
		await expect(component.getByRole('alert')).toHaveText(
			'The agent connection closed before the review finished. Try again.'
		);
		await expect(component.getByRole('textbox')).toHaveValue('  ' + projectConversation + '  ');
		await expect(component.getByRole('textbox')).toBeEnabled();
		return;
	}
	await expect(component).toContainText('Review completed. The proposed checks are ready.');
	if (state === 'saved-plan')
		await expect(component.getByRole('button', { name: 'Open the saved draft' })).toBeVisible();
	if (state === 'historical')
		await expect(component.getByRole('button', { name: 'Change', exact: true })).toHaveCount(0);
}

async function comment(page: Page, component: Locator, state: ProjectAgentState) {
	const textbox = component.getByRole('textbox', { name: 'Message' });
	const draft = '  Please keep the empty-query case in the order-search review.  ';
	await textbox.fill(draft);
	await component.getByRole('button', { name: 'Send comment' }).click();
	await expect
		.poll(() =>
			page.evaluate(
				() => JSON.parse(sessionStorage.getItem('harness.preview.comment') ?? 'null')?.text
			)
		)
		.toBe(draft.trim());
	expect(await page.evaluate(() => sessionStorage.getItem('harness.preview.request'))).toBeNull();
	if (state === 'comment-retry') {
		await expect(component.getByRole('alert')).toHaveText(
			"Error: Couldn't save the comment. Try again."
		);
		await expect(textbox).toHaveValue(draft);
		return;
	}
	await expect(component).toContainText(
		state === 'hosted-comment'
			? 'Comment saved to GitHub.'
			: 'Comment saved on this device; not shared yet.'
	);
	await expect(textbox).toHaveValue('');
}
