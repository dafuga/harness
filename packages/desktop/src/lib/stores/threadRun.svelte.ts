import type { Workspace } from './workspace.svelte';
import type { RunEvent, RunRequest } from '../../models/DesktopBridge.types';

/** One agent run of a thread: its public status and text. Only Plan and Change reach it. */
class ThreadRunState {
	runId = $state('');
	status = $state('');
	streaming = $state('');
	error = $state('');
	private starting = $state(false);
	constructor(private workspace: Workspace) {}
	get active() {
		return Boolean(this.runId) || this.starting;
	}
	/** The request is built late, as building it may open the thread it belongs to. */
	async start(build: () => Promise<RunRequest>): Promise<boolean> {
		if (this.active) return false;
		this.starting = true;
		this.error = '';
		this.streaming = '';
		try {
			const run = await this.workspace.bridge!.startRun(await build());
			this.runId = run.runId;
			this.status = 'Request accepted';
			return true;
		} catch (cause) {
			this.error = String(cause);
			return false;
		} finally {
			this.starting = false;
		}
	}
	/** Returns true when the run finished and its result is on the page. */
	async event(value: RunEvent): Promise<boolean> {
		if (value.runId !== this.runId) return false;
		if (value.kind === 'status') this.status = value.detail;
		if (value.kind === 'text') this.streaming += value.text;
		if (value.kind === 'failed') this.error = value.message;
		if (value.kind === 'cancelled') this.status = 'Run cancelled';
		if (value.kind === 'finished') this.status = value.summary;
		if (!['failed', 'cancelled', 'finished'].includes(value.kind)) return false;
		this.runId = '';
		await this.workspace.refresh();
		return value.kind === 'finished';
	}
	async cancel() {
		try {
			await this.workspace.bridge!.cancelRun({ runId: this.runId, ...this.workspace.context });
		} catch (cause) {
			this.error = String(cause);
		}
	}
}
export function createThreadRunStore(workspace: Workspace) {
	return new ThreadRunState(workspace);
}
export type ThreadRun = ThreadRunState;
