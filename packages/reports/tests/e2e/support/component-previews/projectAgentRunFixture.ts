import type { DesktopData } from './desktopData.svelte';
import type { RunEvent } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { ProjectAgentState } from './projectAgentStateFixtures.types';
import { desktopFixtureCommits as commits } from './desktopFixtureCommits';

export const projectConversation =
	'Please review [[unit:app.page.orders]] and the earlier [[unit:app.function.archive-orders]] proposal. Confirm filterOrders preserves the order of matches.';
export const projectReply =
	'The search matches order names without regard to letter case and preserves their order. An empty query returns every order. Add checks for mixed-case names and no matches before approving the change.';

const savedReply = 'Review completed. The proposed checks are ready.';

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
		const runId = 'order-review-run-' + ++sequence;
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
		if (state === 'comment-retry') throw new Error("Couldn't save the comment. Try again.");
		const projectId = data.workspace.projectId!;
		if (state === 'hosted-comment')
			return {
				kind: 'shared',
				projectId,
				thread: {
					id: 'order-search-review',
					projectId,
					anchor: input.anchor,
					comments: [],
					collaborationCommit: data.workspace.snapshot!.revision.commit
				}
			};
		return {
			kind: 'pending',
			projectId,
			draftId: 'order-search-review-comment',
			savedAt: '2026-10-20T10:00:05Z',
			input,
			reason: 'Saved on this device; share the comment when the connection is available.'
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
			detail: 'Reviewing order search behavior…'
		});
		return;
	}
	if (state === 'failure') {
		emit({
			runId,
			kind: 'failed',
			message: 'The agent connection closed before the review finished. Try again.'
		});
		return;
	}
	emit({ runId, kind: 'text', text: state === 'saved-plan' ? savedReply : projectReply });
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
		summary: savedReply,
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
		data.workspace.snapshot!.revision.commit = commits.middle;
	}
}
