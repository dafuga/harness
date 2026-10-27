import type { ProjectAgent } from '../../lib/stores/agents-providers/projectAgent.svelte';
import type { FeaturePlanPreparationRequest } from '../../models/development-tooling/DesktopBridge.types';
import { planSchema } from '../../../../../src/repositories/agents-providers/module-task-repository/taskSchemas';
import type { RunDraft } from '../explorer-ui/composeModes';
const FEATURE_GOAL = 'Harness users review designs and contracts before dependency-ordered agents build features with live progress.';
const FEATURE_TLDR = 'For each visually affected page, generate and commit design options using current or wanted references; show the module and contract plan for selection and approval. Then schedule isolated module tasks in dependency order within memory limits, with shared Chat and Work progress and honest model, cost, and retry metrics.';
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
		const text = draft.text;
		agent.messages = [
			...agent.messages.slice(-38),
			{ id: crypto.randomUUID(), author: 'user', text }
		];
		if (draft.mode === 'plan') return await prepareFeaturePlan(agent, draft, projectId);
		const request = requestFor(agent, draft, projectId);
		const run = await agent.workspace.bridge!.startRun(request);
		agent.runId = run.runId;
		agent.status = 'Request accepted';
		return await waitFor(agent);
	} catch (cause) {
		agent.error = String(cause);
		return false;
	} finally {
		agent.starting = false;
	}
}

async function prepareFeaturePlan(agent: ProjectAgent, draft: RunDraft, projectId: string): Promise<boolean> {
	const bridge = agent.workspace.bridge, revision = agent.workspace.snapshot?.revision.commit;
	if (!bridge?.prepareFeaturePlan || !revision) throw new Error('Feature planning is unavailable for this project.');
	agent.status = 'Planning contracts and affected pages';
	const planningText = featurePlanningPrompt(draft.text, revision),
		request = requestFor(agent, { ...draft, mode: 'ask', text: planningText }, projectId),
		run = await bridge.startRun(request);
	agent.runId = run.runId;
	if (!(await waitFor(agent))) return false;
	const response = agent.said || [...agent.messages].reverse().find((message) => message.author === 'agent')?.text || '';
	agent.said = '';
	agent.messages = agent.messages.filter((message) => message.author !== 'agent' || message.text !== response);
	const candidate = parsePlanningResponse(response, revision);
	agent.status = 'Generating page design options';
	const plan = await bridge.prepareFeaturePlan.call(bridge, {
		projectId, sourceCommit: revision, originalRequest: draft.text,
		proposal: candidate.proposal, pageDesigns: candidate.pageDesigns
	} satisfies FeaturePlanPreparationRequest);
	if (agent.workspace.projectId !== projectId || agent.workspace.snapshot?.revision.commit !== revision)
		throw new Error('The selected project or source revision changed during plan preparation.');
	agent.messages = [
		...agent.messages.slice(-38),
		{ id: crypto.randomUUID(), author: 'agent', text: `Plan ${plan.feature} is ready for design and contract review in Work.` }
	];
	agent.status = 'Plan ready for review';
	return true;
}

function featurePlanningPrompt(originalRequest: string, sourceCommit: string) {
	return [
		`Overall goal: ${FEATURE_GOAL}`,
		`Feature TLDR: ${FEATURE_TLDR}`,
		'Planning task: prepare a reviewable, contract-first feature plan before any code changes or worker starts.',
		'Use Harness CLI contracts and committed module metadata only. Do not inspect application source files or test suites. Do not edit files, run tests, start workers, or generate images in this planning response.',
		`Selected source commit: ${sourceCommit}`,
		'For every changed module, include its module goal, exact assigned source files and a complete wanted contract. Every task must include its own moduleGoal, wantedContract and dependency IDs. Include every affected page with a committed current or wanted image reference (entity, commit, version, state, viewport, safe file and SHA-256) and a normalized region when only part of the page is requested. Give each affected page exactly three distinct options with IDs o1, o2 and o3, different directions and image prompts, and exactly one preferred option. Pass the exact referenced image to GPT Image. When the request targets a region, direct GPT Image to edit only that region and preserve the rest of the reference page, including its layout, content, spacing, colors and other panels. Give every affected page a page-level task; use region:null only when the whole page is in scope.',
		'Return only strict JSON with shape {"proposal":{"feature":"...","sourceCommit":"...","goal":"...","tldr":"...","changes":[...],"tasks":[...]},"pageDesigns":[{"module":"...","reference":{"kind":"current|wanted","entityId":"...","commit":"...","version":"...","state":"...","viewport":"...","file":"...","sha256":"...","option":"..."},"region":{"x":0,"y":0,"width":1,"height":1},"options":[{"id":"o1","preferred":true,"direction":"...","instruction":"..."},{"id":"o2","preferred":false,"direction":"...","instruction":"..."},{"id":"o3","preferred":false,"direction":"...","instruction":"..."}]}]}. Use region:null for a full-page design.',
		`Original user request: ${originalRequest}`
	].join('\n');
}

function parsePlanningResponse(response: string, sourceCommit: string) {
	let value: unknown;
	try { value = JSON.parse(response.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')); }
	catch { throw new Error('The planner did not return strict feature-plan JSON. No tasks were created.'); }
	if (!value || typeof value !== 'object' || !('proposal' in value) || !('pageDesigns' in value))
		throw new Error('The planner response is missing its module proposal or page references. No tasks were created.');
	const draft = value as { proposal: unknown; pageDesigns: unknown },
		proposal = planSchema.omit({ pages: true, revision: true, digest: true, approval: true }).parse(draft.proposal);
	if (proposal.sourceCommit !== sourceCommit || !Array.isArray(draft.pageDesigns))
		throw new Error('The plan proposal is stale or its page design list is invalid. No tasks were created.');
	if (!proposal.tasks.length || proposal.tasks.some((task) => !task.moduleGoal?.trim()))
		throw new Error('Every planned task needs a module goal. No tasks were created.');
	const taskModules = new Set(proposal.tasks.map((task) => task.module)), pages = draft.pageDesigns as Array<{ module?: unknown } | null>;
	if (pages.some((page) => !page || typeof page.module !== 'string' || !taskModules.has(page.module)))
		throw new Error('Every affected page needs a page-level module task. No tasks were created.');
	return { proposal, pageDesigns: draft.pageDesigns as FeaturePlanPreparationRequest['pageDesigns'] };
}

async function waitFor(agent: ProjectAgent): Promise<boolean> {
	const answer = new Promise<boolean>((done) => (agent.settle = done));
	for (const event of agent.pendingEvents.splice(0)) void agent.event(event);
	return answer;
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
