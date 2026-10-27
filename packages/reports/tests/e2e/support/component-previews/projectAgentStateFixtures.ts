import { expect, type Locator, type Page } from '@playwright/test';
import type { DesktopBridge } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import type {
	ProjectAgentState,
	ProjectAgentStateFixtureGap
} from './projectAgentStateFixtures.types';

const gaps: Partial<Record<ProjectAgentState, string>> = {
	'local-comment':
		'DesktopBridge has no committed typed human-comment save callback; projectAgentComment documents Promise<boolean> but not the bridge field that invokes it.',
	'hosted-comment':
		'DesktopBridge has no committed typed connected-comment save callback or hosted permission input for a comment-only workspace.',
	'comment-retry':
		'DesktopBridge has no committed typed comment-save refusal result and visible refusal contract; Composer documents no handling for rejected callbacks.',
	historical:
		'The assigned workspace fixture selects only commits.tip and publishes no typed prior-commit selection seam for a pinned historical revision.',
	ask:
		'Composer.modes documents comment, plan and change but no Ask control; projectAgentActions documents RunDraft mode ask without a typed DesktopBridge request callback to capture its identity.',
	plan:
		'DesktopBridge has no committed typed RunDraft submission callback whose provider, model, effort and trimmed text can be observed.',
	'visual-plan':
		'DesktopBridge has no typed RunDraft submission callback, and the assigned preview does not expose the AgentSettingsAdapter read/write seam needed to seed and observe a saved valid design count.',
	change:
		'DesktopBridge has no committed typed RunDraft submission callback to prove Change prerequisites and that the synthetic request stops before a provider.',
	running:
		'RunEvent documents only the text event example; no public progress event shape or deterministic active-run injection seam is declared.',
	saved-plan:
		'RunEvent has no public terminal saved-plan event shape or saved response/reference fields for a deterministic completed plan.',
	failure:
		'RunEvent has no public terminal failure event shape or deterministic failed-run injection seam.',
	agents-many:
		'Agent activity contracts do not name the roster identity and task fields needed to create distinct validated sessions; the existing fixture exposes only its single copied roster.'
};

export function projectAgentStateFixtureGap(
	state: ProjectAgentState
): ProjectAgentStateFixtureGap | undefined {
	const missingPublicSeam = gaps[state];
	return missingPublicSeam ? { state, missingPublicSeam } : undefined;
}

export function projectAgentStateFixture(
	data: DesktopData,
	base: PreviewProps,
	state: ProjectAgentState
): PreviewProps {
	const gap = projectAgentStateFixtureGap(state);
	if (gap) throw new Error(`unsupported-state ${state}: ${gap.missingPublicSeam}`);
	const props = { ...base, workspace: data.workspace, open: state !== 'closed' };
	if (state === 'read-only') {
		setPermissions(data, false, false, false);
		setConversation(data);
	}
	if (state === 'no-provider') {
		setPermissions(data, true, true, true);
		data.bridge.providers = async () => [];
	}
	if (state === 'conversation') setConversation(data);
	if (state.startsWith('agents-')) setAgentActivity(data, state);
	return props;
}

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

function setPermissions(data: DesktopData, agents: boolean, comments: boolean, writable: boolean) {
	data.workspace.capabilities = { ...data.workspace.capabilities, agents, comments };
	data.workspace.snapshot!.writable = writable;
}

function setConversation(data: DesktopData) {
	type Message = Awaited<ReturnType<NonNullable<DesktopBridge['messages']>>>[number];
	type ProjectMessage = Awaited<ReturnType<NonNullable<DesktopBridge['projectMessages']>>>[number];
	const human = {
		...data.message,
		id: 'preview-human-message',
		author: 'user' as const,
		text: `Please review [[unit:${data.entity.id}]] and [[unit:missing.preview-unit]]. Plain reference: preview-function-name.`
	} satisfies Message;
	const assistant = {
		...data.message,
		id: 'preview-assistant-message',
		author: 'assistant' as const,
		text: 'A deterministic assistant response wraps across the available component width. '.repeat(12)
	} satisfies Message;
	const messages = [human, assistant];
	data.bridge.messages = async () => messages;
	data.bridge.projectMessages = async () => messages as unknown as ProjectMessage[];
}

async function assertClosedLauncher(component: Locator) {
	const launcher = component.locator('.floating-chat-bubble');
	const panel = component.locator('.floating-chat-panel');
	await expect(launcher).toHaveCount(1);
	await expect(launcher).toHaveRole('button');
	await expect(launcher).toHaveAccessibleName();
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
		await expect(roster).toContainText(/unknown|unavailable|not available|unsupported|not tracked/i);
		await expect(roster).not.toContainText(/no (active )?(agents|sessions)|empty/i);
	}
	if (state === 'agents-stale') {
		await expect(roster).toContainText(/stale/i);
		await expect(roster.getByRole('region', { name: /modules being worked on/i })).not.toContainText('Preview agent');
	}
}

function setAgentActivity(data: DesktopData, state: ProjectAgentState) {
	if (state === 'agents-unknown') {
		delete data.bridge.agentActivity;
		return;
	}
	const readActivity = data.bridge.agentActivity;
	if (!readActivity) throw new Error('Agent roster fixture did not register its typed activity bridge.');
	data.bridge.agentActivity = async (...args) => {
		const reading = await readActivity(...args);
		return {
			...reading,
			sampledAt: state === 'agents-stale' ? '2020-01-01T00:00:00Z' : reading.sampledAt,
			agents: {
				...reading.agents,
				roster: state === 'agents-empty' ? [] : reading.agents.roster
			}
		};
	};
}
