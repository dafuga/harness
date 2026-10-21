import type { ProjectAgent } from '../../lib/stores/projectAgent.svelte';
import type { RunEvent } from '../../models/DesktopBridge.types';
import { rememberCreatedThread } from './rememberCreatedThread';

const ended = ['failed', 'cancelled', 'finished'];

function left(value: RunEvent) {
	const made = 'created' in value ? (value.created ?? null) : null;
	return { made, kept: made?.requestSaved ? made : null };
}

function tell(agent: ProjectAgent, value: RunEvent) {
	if (value.kind === 'status') {
		agent.status = value.detail;
		if (value.phase === 'recording')
			agent.messages = [
				...agent.messages.slice(-38),
				{ id: crypto.randomUUID(), author: 'agent', text: value.detail }
			];
	}
	if (value.kind === 'replay') {
		agent.said = value.text;
		agent.status = value.detail;
	}
	if (value.kind === 'text') agent.said += value.text;
	if (value.kind === 'failed') [agent.error, agent.status] = [value.message, ''];
	if (value.kind === 'cancelled')
		agent.status = value.created
			? 'Cancelled. A draft was saved.'
			: 'Cancelled. Nothing was planned.';
	if (value.kind === 'finished') agent.status = value.summary;
}

export async function projectAgentEvents(agent: ProjectAgent, value: RunEvent): Promise<void> {
	if (!agent.runId || value.runId !== agent.runId) return;
	tell(agent, value);
	if (!ended.includes(value.kind)) return;
	const { made, kept } = left(value);
	agent.saved = kept ? null : made;
	agent.messages = [
		...agent.messages,
		{
			id: value.runId,
			author: 'agent',
			text: [agent.said, agent.status, agent.error].filter(Boolean).join('\n\n')
		}
	];
	agent.runId = '';
	agent.settle?.(value.kind === 'finished' || kept !== null);
	agent.settle = null;
	await agent.workspace.refresh();
	await agent.workspace.deployments?.load();
	// Only a plan that holds the request is opened; `kept.threadId` is the thread it is in.
	if (kept) {
		rememberCreatedThread(agent.workspace, kept);
		await agent.workspace.navigate(agent.workspace.path(kept.category, kept.entityId));
	}
}
