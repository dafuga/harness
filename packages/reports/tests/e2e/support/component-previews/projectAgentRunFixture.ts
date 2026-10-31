import type { DesktopData } from './desktopData.svelte';
import type { RunEvent } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';

export const projectConversation =
	'Please review [[unit:app.page.orders]] and [[unit:missing.preview-unit]]. Plain reference: preview-function-name.';
export const projectReply =
	'A deterministic assistant response wraps across the available component width. '.repeat(12);

/** Synthetic request, event and comment ports stop every operation before a provider or host. */
export function projectAgentRunFixture(data: DesktopData, state: ProjectAgentState): void {
	let listener: ((event: RunEvent) => void) | undefined;
	let sequence = 0;
	data.bridge.onRunEvent = (receive) => {
		listener = receive;
		return () => {
			listener = undefined;
		};
	};
	data.workspace.refresh = async () => {};
	data.workspace.deployments.load = async () => {};
	data.bridge.startRun = async (request) => {
		const runId = 'synthetic-project-run-' + ++sequence;
		sessionStorage.setItem('harness.preview.request', JSON.stringify(request));
		setTimeout(() => respond(data, state, runId, (event) => listener?.(event)), 20);
		return { runId };
	};
	data.bridge.cancelRun = async ({ runId }) => {
		listener?.({ runId, kind: 'cancelled' });
		return true;
	};
	comments(data, state);
	if (['local-comment', 'hosted-comment', 'comment-retry'].includes(state))
		data.workspace.capabilities = {
			...data.workspace.capabilities,
			agents: false,
			comments: true,
			source: state === 'hosted-comment' ? 'github' : 'local',
			reason: 'Comments remain available in this workspace.'
		};
	if (state === 'plan') data.workspace.category = 'functions';
}
function comments(data: DesktopData, state: ProjectAgentState) {
	data.bridge.addComment = async (input) => {
		sessionStorage.setItem('harness.preview.comment', JSON.stringify(input));
		if (state === 'comment-retry') throw new Error('Synthetic comment save refused.');
		const projectId = data.workspace.projectId!;
		if (state === 'hosted-comment')
			return {
				kind: 'shared',
				projectId,
				thread: {
					id: 'synthetic-thread',
					projectId,
					anchor: input.anchor,
					comments: [],
					collaborationCommit: data.workspace.snapshot!.revision.commit
				}
			};
		return {
			kind: 'pending',
			projectId,
			draftId: 'synthetic-draft',
			savedAt: '2026-10-20T10:00:05Z',
			input,
			reason: 'Synthetic local comment fixture.'
		};
	};
}

function respond(
	data: DesktopData,
	state: ProjectAgentState,
	runId: string,
	emit: (event: RunEvent) => void
) {
	if (state === 'running') {
		emit({
			runId,
			kind: 'status',
			phase: 'prompting',
			detail: 'Reviewing the synthetic project request…'
		});
		return;
	}
	if (state === 'failure') {
		emit({ runId, kind: 'failed', message: 'Synthetic agent request failed.' });
		return;
	}
	emit({ runId, kind: 'text', text: projectReply });
	const created =
		state === 'saved-plan'
			? {
					category: 'components' as const,
					entityId: data.visualEntity.id,
					threadId: null,
					requestSaved: false
				}
			: undefined;
	emit({
		runId,
		kind: 'finished',
		summary: 'Synthetic request completed.',
		verified: false,
		...(created ? { created } : {})
	});
	if (state === 'read-only') {
		data.workspace.capabilities = {
			...data.workspace.capabilities,
			agents: false,
			comments: false
		};
		data.workspace.snapshot!.writable = false;
	}
	if (state === 'historical') {
		data.workspace.pinned = true;
		data.workspace.snapshot!.revision.atTip = false;
	}
}
