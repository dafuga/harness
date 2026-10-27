import type { DesktopData } from './desktopData.svelte';
import type { PreviewProps } from './shared.types';
import type {
	ProjectAgentState,
	ProjectAgentStateFixtureGap,
	ProjectAgentFixtureMessage,
	ProjectAgentFixtureProjectMessage
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
	ask: 'Composer.modes documents comment, plan and change but no Ask control; projectAgentActions documents RunDraft mode ask without a typed DesktopBridge request callback to capture its identity.',
	plan: 'DesktopBridge has no committed typed RunDraft submission callback whose provider, model, effort and trimmed text can be observed.',
	'visual-plan':
		'DesktopBridge has no typed RunDraft submission callback, and the assigned preview does not expose the AgentSettingsAdapter read/write seam needed to seed and observe a saved valid design count.',
	change:
		'DesktopBridge has no committed typed RunDraft submission callback to prove Change prerequisites and that the synthetic request stops before a provider.',
	running:
		'RunEvent documents only the text event example; no public progress event shape or deterministic active-run injection seam is declared.',
	'saved-plan':
		'RunEvent has no public terminal saved-plan event shape or saved response/reference fields for a deterministic completed plan.',
	failure:
		'RunEvent has no public terminal failure event shape or deterministic failed-run injection seam.',
	'agents-many':
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

function setPermissions(data: DesktopData, agents: boolean, comments: boolean, writable: boolean) {
	data.workspace.capabilities = { ...data.workspace.capabilities, agents, comments };
	data.workspace.snapshot!.writable = writable;
}

function setConversation(data: DesktopData) {
	const human = {
		...data.message,
		id: 'preview-human-message',
		author: 'user' as const,
		text: `Please review [[unit:${data.entity.id}]] and [[unit:missing.preview-unit]]. Plain reference: preview-function-name.`
	} satisfies ProjectAgentFixtureMessage;
	const assistant = {
		...data.message,
		id: 'preview-assistant-message',
		author: 'assistant' as const,
		text: 'A deterministic assistant response wraps across the available component width. '.repeat(
			12
		)
	} satisfies ProjectAgentFixtureMessage;
	const messages = [human, assistant];
	data.bridge.messages = async () => messages;
	data.bridge.projectMessages = async () =>
		messages as unknown as ProjectAgentFixtureProjectMessage[];
}

function setAgentActivity(data: DesktopData, state: ProjectAgentState) {
	if (state === 'agents-unknown') {
		delete data.bridge.agentActivity;
		return;
	}
	const readActivity = data.bridge.agentActivity;
	if (!readActivity)
		throw new Error('Agent roster fixture did not register its typed activity bridge.');
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
