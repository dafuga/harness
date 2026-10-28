import { expect, type Locator, type Page } from '@playwright/test';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';

export async function assertProjectAgentState(
	page: Page,
	component: Locator,
	state: ProjectAgentState
) {
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
	const draft = 'Keep this project draft while the panel closes.';
	await textbox.fill(draft);
	await launcher.click();
	await expect(panel).toBeHidden();
	await expect(launcher).toBeFocused();
	await launcher.press('Enter');
	await expect(textbox).toHaveValue(draft);
	await expect(panel).toContainText('Review the component states.');
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
	const submits = panel.locator('form button[type="submit"], form input[type="submit"]');
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
	await expect(panel).toContainText('missing.preview-unit');
	await expect(panel).toContainText('preview-function-name');
	const known = panel.locator('a[href*="app.page.orders"]');
	await expect(known).toHaveAttribute('href', /\/history(?:[?#]|$)/);
	await expect(panel.locator('a[href*="missing.preview-unit"]')).toHaveCount(0);
	const assistant = panel.getByText(/^A deterministic assistant response/);
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
	await textbox.fill('A comment remains available without an agent model.');
	await expect(panel.locator('form button[type="submit"]')).toBeEnabled();
	const plan = panel.getByRole('button', { name: 'Plan', exact: true });
	await plan.click();
	await textbox.fill('No provider request is submitted.');
	await expect(panel.locator('form button[type="submit"]')).toBeDisabled();
}

async function assertAgents(page: Page, component: Locator, state: ProjectAgentState) {
	const panel = component.locator('.floating-chat-panel');
	const chat = component.getByRole('tab', { name: 'Chat', exact: true });
	const agents = component.getByRole('tab', { name: 'Agents', exact: true });
	const textbox = panel.getByRole('textbox').first();
	const draft = 'Return to this saved chat draft.';
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
	if (state === 'agents-active') {
		await expect(roster).toContainText('1 working');
		await expect(roster).toContainText('Capture component states');
		await expect(roster).toContainText('Preview agent');
		await expect(roster.locator('a[href*="/history"]')).not.toHaveCount(0);
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
		).not.toContainText('Preview agent');
	}
}
