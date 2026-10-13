import type { ProviderState } from '../../models/Desktop.types';
import type { CreatedEntity, RunEvent } from '../../models/DesktopBridge.types';
import type { RunDraft } from '../../utils/composeModes';
import { rememberCreatedThread } from '../../utils/createdThread';
import type { Workspace } from './workspace.svelte';

const ended = ['failed', 'cancelled', 'finished'];
/** The draft a run that ended names, and whether the request is written in it. */
function left(value: RunEvent) {
	const made = 'created' in value ? (value.created ?? null) : null;
	return { made, kept: made?.requestSaved ? made : null };
}

/**
 * The conversation that adds something new to a project: one creation run, its public status
 * and what became of it. A request stays with the person until its plan exists.
 */
class ProjectAgentState {
	runId = $state('');
	status = $state('');
	error = $state('');
	/** The request that is under way or was answered last, as it was written. */
	asked = $state('');
	/** A draft the last run left without the request in it: it is linked, never opened. */
	saved = $state.raw<CreatedEntity | null>(null);
	providers = $state.raw<ProviderState[]>([]);
	private starting = $state(false);
	private settle: ((planned: boolean) => void) | null = null;
	constructor(private workspace: Workspace) {}
	get active() {
		return Boolean(this.runId) || this.starting;
	}
	/** Agents add to a project only at the writable tip of its branch, never in a past commit. */
	get allowed() {
		const { capabilities, snapshot, pinned, projectId } = this.workspace;
		return capabilities.agents && Boolean(snapshot?.writable) && !pinned && Boolean(projectId);
	}
	/** Reads who can be asked and follows the runs; what it returns stops following them. */
	listen(): (() => void) | undefined {
		const bridge = this.workspace.bridge;
		if (!bridge || !this.allowed) return undefined;
		void bridge
			.providers()
			.then((value) => (this.providers = value))
			.catch((cause) => (this.error = String(cause)));
		return bridge.onRunEvent((value) => void this.event(value));
	}
	/**
	 * Asks the chosen agent to plan something new; the catalog in view goes along as a hint.
	 * It answers true only once the request is written in a plan: until then the text stays with
	 * the person, also when a draft without it was left behind.
	 */
	send = async (draft: RunDraft): Promise<boolean> => {
		const projectId = this.workspace.projectId;
		if (this.active || draft.mode !== 'plan' || !this.allowed || !projectId) return false;
		this.starting = true;
		[this.error, this.status, this.asked, this.saved] = ['', '', draft.text, null];
		try {
			const { provider, model, effort, text } = draft;
			const run = await this.workspace.bridge!.startRun({
				...{ intent: 'create', category: this.workspace.category, mode: 'plan' },
				...{ provider, model, effort, text, projectId }
			});
			this.runId = run.runId;
			this.status = 'Request accepted';
			return await new Promise<boolean>((done) => (this.settle = done));
		} catch (cause) {
			this.error = String(cause);
			return false;
		} finally {
			this.starting = false;
		}
	};
	/** What an event says of the run, in words; a failure is said as an error. */
	private told(value: RunEvent) {
		if (value.kind === 'status') this.status = value.detail;
		if (value.kind === 'failed') [this.error, this.status] = [value.message, ''];
		if (value.kind === 'cancelled')
			this.status = value.created
				? 'Cancelled. A draft was saved.'
				: 'Cancelled. Nothing was planned.';
		if (value.kind === 'finished') this.status = value.summary;
	}
	/** The run that was started here, as it goes; a plan that was made is opened. */
	async event(value: RunEvent): Promise<void> {
		if (!this.runId || value.runId !== this.runId) return;
		this.told(value);
		if (!ended.includes(value.kind)) return;
		const { made, kept } = left(value);
		this.saved = kept ? null : made;
		this.runId = '';
		this.settle?.(value.kind === 'finished' || kept !== null);
		this.settle = null;
		await this.workspace.refresh();
		// Only a plan that holds the request is opened; `kept.threadId` is the thread it is in.
		if (kept) {
			rememberCreatedThread(this.workspace, kept);
			await this.workspace.navigate(this.workspace.path(kept.category, kept.entityId));
		}
	}
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
