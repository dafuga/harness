import { expect, type Locator, type Page } from '@playwright/test';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
import { prepareProjectAgentState } from './projectAgentRunAssertions';

/** Mode text must stay inside its button and the toolbar that owns the hit target. */
export async function assertComposerCaptions(component: Locator, id: string) {
	if (!['desktop.component.composer', 'desktop.component.project-agent'].includes(id)) return;
	const modes = component.getByRole('group', { name: 'Request mode', exact: true });
	if (!(await modes.count())) return;
	const labels = await modes.evaluate((node) => {
		const group = node.getBoundingClientRect();
		return [...node.querySelectorAll('button')].map((button) => {
			const box = button.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(button);
			const text = range.getBoundingClientRect();
			return {
				label: button.textContent,
				captionFits:
					text.left >= box.left - 1 &&
					text.right <= box.right + 1 &&
					text.top >= box.top - 1 &&
					text.bottom <= box.bottom + 1,
				buttonFits: box.left >= group.left - 1 && box.right <= group.right + 1
			};
		});
	});
	for (const label of labels) {
		expect(
			label.captionFits,
			`${label.label} mode caption stays completely inside its button`
		).toBe(true);
		expect(label.buttonFits, `${label.label} mode stays inside its toolbar`).toBe(true);
	}
}

export async function assertProjectAgentState(
	page: Page,
	component: Locator,
	state: ProjectAgentState
) {
	await prepareProjectAgentState(page, component, state);
	if (state === 'closed') return assertClosedLauncher(component);
	if (state === 'read-only') return assertReadOnly(component);
	if (state === 'conversation') return assertConversation(component);
	if (state === 'no-provider') return assertNoProvider(component);
	if (state.startsWith('agents-')) return assertAgents(page, component, state);
}

async function assertClosedLauncher(component: Locator) {
	const launcher = component.locator('.floating-chat-bubble');
	const panel = component.locator('.floating-chat-panel');
	await expect(launcher).toHaveCount(1);
	await expect(launcher).toHaveRole('button');
	await expect(launcher).toHaveAccessibleName(/.+/);
	await expect(panel).toBeHidden();
	await launcher.press('Enter');
	await expect(panel).toBeVisible();
	const textbox = panel.getByRole('textbox').first();
	await panel.getByRole('button', { name: 'Comment', exact: true }).click();
	await textbox.fill('Review the order-search acceptance cases.');
	await panel.getByRole('button', { name: 'Send comment' }).click();
	await expect(textbox).toHaveValue('');
	const draft = 'Include empty queries in the search review.';
	await textbox.fill(draft);
	await launcher.click();
	await expect(panel).toBeHidden();
	await expect(launcher).toBeFocused();
	await launcher.press('Enter');
	await expect(textbox).toHaveValue(draft);
	await expect(panel).toContainText('Review the order-search acceptance cases.');
	await textbox.press('Escape');
	await expect(panel).toBeHidden();
	await expect(launcher).toBeFocused();
	await launcher.press('Enter');
	await expect(textbox).toHaveValue(draft);
	await textbox.press('Escape');
	await expect(panel).toBeHidden();
}

async function assertReadOnly(component: Locator) {
	const panel = component.locator('.floating-chat-panel');
	await assertConversation(component);
	const fields = panel.getByRole('textbox');
	const submits = panel.locator('button.send');
	await expect(
		await fields.evaluateAll((nodes) => nodes.some((node) => node.matches(':enabled'))),
		'Read permission cannot enter a comment or agent request'
	).toBe(false);
	await expect(
		await submits.evaluateAll((nodes) => nodes.some((node) => node.matches(':enabled'))),
		'Read permission cannot submit a comment or agent request'
	).toBe(false);
}

async function assertConversation(component: Locator) {
	const panel = component.locator('.floating-chat-panel');
	await expect(panel).toContainText('Please review');
	await expect(panel).toContainText('app.function.archive-orders');
	await expect(panel).toContainText('filterOrders');
	const known = panel.locator('a[href*="app.page.orders"]');
	await expect(known).toHaveAttribute('href', /\/history(?:[?#]|$)/);
	await expect(panel.locator('a[href*="app.function.archive-orders"]')).toHaveCount(0);
	const assistant = panel.locator('.chat-message.agent').last();
	await expect(assistant).toContainText('The search matches order names');
	await expect(assistant).toBeVisible();
	const lines = await assistant.evaluate((node) => {
		const range = document.createRange();
		range.selectNodeContents(node);
		return range.getClientRects().length;
	});
	expect(lines, 'Long assistant text wraps inside the conversation').toBeGreaterThan(1);
}

async function assertNoProvider(component: Locator) {
	const panel = component.locator('.floating-chat-panel');
	const comment = panel.getByRole('button', { name: 'Comment', exact: true });
	await expect(comment).toBeVisible();
	await comment.click();
	const textbox = panel.getByRole('textbox').first();
	await expect(textbox).toBeEnabled();
	await textbox.fill('Please review the order-search edge cases.');
	await expect(panel.locator('button.send')).toBeEnabled();
	const plan = panel.getByRole('button', { name: 'Plan', exact: true });
	await plan.click();
	await textbox.fill('Plan coverage for empty queries and mixed-case order names.');
	await expect(panel.locator('button.send')).toBeDisabled();
}

async function assertAgents(page: Page, component: Locator, state: ProjectAgentState) {
	const panel = component.locator('.floating-chat-panel');
	const chat = component.getByRole('button', { name: 'Chat', exact: true });
	const agents = component.getByRole('button', { name: 'Agents', exact: true });
	const textbox = panel.getByRole('textbox').first();
	const draft = 'Review the order-search behavior after the agent summary.';
	await textbox.fill(draft);
	await agents.click();
	const roster = page.locator('[data-harness-component="agents-providers-chat-agents"]');
	await expect(roster).toBeVisible();
	await chat.click();
	await expect(textbox).toHaveValue(draft);
	await agents.click();
	await assertRosterState(roster, state);
}

async function assertRosterState(roster: Locator, state: ProjectAgentState) {
	if (state === 'agents-many') {
		await expect(roster).toContainText('8 working');
		await roster.getByRole('button', { name: 'Show all 8 sessions' }).click();
		await expect(roster.getByRole('list', { name: 'Agent sessions' }).locator('li')).toHaveCount(8);
		await roster.getByRole('button', { name: /Show (fewer|less)/ }).click();
		await expect(roster.getByRole('button', { name: 'Show all 8 sessions' })).toBeVisible();
		const summary = roster.getByText('8 working', { exact: true });
		await summary.scrollIntoViewIfNeeded();
		await expect(summary).toBeInViewport({ ratio: 1 });
	}
	if (state === 'agents-active') {
		await expect(roster).toContainText('1 working');
		await expect(roster).toContainText('Review order-card state 1');
		await expect(roster).toContainText('Order review 1');
		await expect(
			roster.getByRole('region', { name: 'Modules being worked on' }).getByRole('link')
		).toHaveAttribute('href', /\/components\/app\.component\.order-card$/);
	}
	if (state === 'agents-empty') {
		await expect(roster).toContainText(/no (active )?(agents|sessions)|empty/i);
		await expect(roster).not.toContainText(/unknown|unavailable|not available|unsupported/i);
	}
	if (state === 'agents-unknown') {
		await expect(roster).toContainText(
			/unknown|unavailable|not available|unsupported|not tracked/i
		);
		await expect(roster).not.toContainText(/no (active )?(agents|sessions)|empty/i);
	}
	if (state === 'agents-stale') {
		await expect(roster).toContainText(/stale/i);
		await expect(
			roster.getByRole('region', { name: /modules being worked on/i })
		).not.toContainText('Order review');
	}
}
