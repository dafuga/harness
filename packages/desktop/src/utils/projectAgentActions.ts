import type { ProjectAgent } from '../lib/stores/projectAgent.svelte';
import type { RunDraft } from './composeModes';
/** Starts one explicitly selected project request; retains its text until acknowledged. */
export async function projectAgentActions(agent: ProjectAgent, draft: RunDraft): Promise<boolean> {
	const projectId = agent.workspace.projectId;
	if (agent.active || !agent.allowed || !projectId) return false;
	agent.starting = true;
	[agent.error, agent.status, agent.asked, agent.saved, agent.said] = [
		'',
		'',
		draft.text,
		null,
		''
	];
	try {
		const request = requestFor(agent, draft, projectId);
		const text = draft.text;
		agent.messages = [
			...agent.messages.slice(-38),
			{ id: crypto.randomUUID(), author: 'user', text }
		];
		const run = await agent.workspace.bridge!.startRun(request);
		agent.runId = run.runId;
		agent.status = 'Request accepted';
		const answer = new Promise<boolean>((done) => (agent.settle = done));
		for (const event of agent.pendingEvents.splice(0)) void agent.event(event);
		return await answer;
	} catch (cause) {
		agent.error = String(cause);
		return false;
	} finally {
		agent.starting = false;
	}
}
export async function projectAgentComment(agent: ProjectAgent, text: string): Promise<boolean> {
	const { snapshot, projectId, capabilities, bridge, entity } = agent.workspace;
	if (!snapshot || !projectId || !capabilities.comments || !bridge?.addComment) return false;
	try {
		const result = await bridge.addComment({
			projectId,
			requestId: crypto.randomUUID(),
			text,
			anchor: {
				branch: snapshot.revision.branch,
				commit: snapshot.revision.commit,
				entityId: entity?.id ?? 'harness.project.discussion',
				version: null,
				imageSha256: null,
				state: null,
				viewport: null,
				region: null
			}
		});
		agent.messages = [
			...agent.messages.slice(-38),
			{ id: crypto.randomUUID(), author: 'user', text }
		];
		agent.status =
			result.kind === 'shared'
				? 'Comment saved to GitHub.'
				: 'Comment saved on this device; not shared yet.';
		return true;
	} catch (cause) {
		agent.error = String(cause);
		return false;
	}
}

function requestFor(agent: ProjectAgent, draft: RunDraft, projectId: string) {
	const { provider, model, effort, text, designOptions } = draft;
	const common = {
		provider,
		model,
		effort,
		text,
		projectId,
		category: agent.workspace.category
	};
	const revision = agent.workspace.snapshot!.revision;
	return draft.mode === 'plan'
		? {
				...common,
				intent: 'create' as const,
				mode: 'plan' as const,
				...(designOptions === undefined ? {} : { designOptions })
			}
		: {
				...common,
				intent: 'task' as const,
				mode: draft.mode,
				...(draft.mode === 'change' && agent.workspace.deployments?.selected?.available
					? { environment: agent.workspace.deployments.environment }
					: {}),
				branch: revision.branch,
				commit: revision.commit,
				conversation: agent.messages
					.slice(-20)
					.map(({ author, text }) => ({ author, text: text.slice(0, 4000) }))
			};
}
