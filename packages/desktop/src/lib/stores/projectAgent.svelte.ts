import type { ProviderState } from '../../models/Desktop.types';
import type { CreatedEntity, RunEvent } from '../../models/DesktopBridge.types';
import type { ComposeMode, RunDraft } from '../../utils/composeModes';
import { projectAgentActions, projectAgentComment } from '../../utils/projectAgentActions';
import { projectAgentEvents } from '../../utils/projectAgentEvents';
import type { Workspace } from './workspace.svelte';
class ProjectAgentState {
	runId = $state('');
	status = $state('');
	error = $state('');
	/** The request that is under way or was answered last, as it was written. */
	asked = $state('');
	/** What the agent said in public of that request: its checked notes, or its question. */
	said = $state('');
	/** A draft the last run left without the request in it: it is linked, never opened. */
	saved = $state.raw<CreatedEntity | null>(null);
	providers = $state.raw<ProviderState[]>([]);
	pendingEvents: RunEvent[] = [];
	messages = $state.raw<Array<{ id: string; author: 'user' | 'agent'; text: string }>>([]);
	starting = $state(false);
	settle: ((planned: boolean) => void) | null = null;
	constructor(readonly workspace: Workspace) {}
	get active() {
		return Boolean(this.runId) || this.starting;
	}
	/** Agents add to a project only at the writable tip of its branch, never in a past commit. */
	get allowed() {
		const { capabilities, snapshot, pinned, projectId } = this.workspace;
		return (
			!this.workspace.busy &&
			!this.workspace.error &&
			capabilities.agents &&
			Boolean(snapshot?.writable) &&
			!pinned &&
			Boolean(projectId)
		);
	}
	get modes(): ComposeMode[] {
		const comments: ComposeMode[] = this.workspace.capabilities.comments ? ['comment'] : [];
		return this.allowed ? ['plan', 'ask', 'change', ...comments] : comments;
	}
	get approved() {
		return this.allowed;
	}
	get notice() {
		if (this.workspace.error) return 'Chat unavailable: ' + this.workspace.error;
		return this.allowed
			? 'Ask a question, plan a design, or request a code change.'
			: this.workspace.capabilities.reason || 'Read-only project access.';
	}
	/** Reads who can be asked and follows the runs; what it returns stops following them. */
	listen(): (() => void) | undefined {
		const bridge = this.workspace.bridge;
		if (!bridge) return undefined;
		return bridge.onRunEvent((value) => void this.event(value));
	}
	private discovered = false;
	loadProviders() {
		if (this.discovered || !this.allowed) return;
		this.discovered = true;
		void this.workspace
			.bridge!.providers()
			.then((value) => (this.providers = value))
			.catch((cause) => {
				this.error = String(cause);
				this.discovered = false;
			});
	}
	send = (draft: RunDraft) => projectAgentActions(this, draft);
	event = (value: RunEvent) => {
		if (this.starting && !this.runId) {
			this.pendingEvents = [...this.pendingEvents.slice(-511), value];
			return Promise.resolve();
		}
		return projectAgentEvents(this, value);
	};
	comment = (text: string) => projectAgentComment(this, text);
	async cancel() {
		try {
			await this.workspace.bridge!.cancelRun({ runId: this.runId, ...this.workspace.context });
		} catch (cause) {
			this.error = String(cause);
		}
	}
}
export function createProjectAgentStore(workspace: Workspace) {
	return new ProjectAgentState(workspace);
}
export type ProjectAgent = ProjectAgentState;
