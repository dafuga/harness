import type { RunEvent, RevisionQuery } from '../models/DesktopBridge.types';
import type { ProjectSnapshot } from '../models/Desktop.types';
interface AgentCall {
	method: string;
	input: unknown;
	requestId?: string;
	revision?: { branch: string; commit: string };
}
/** Ignore volatile context when retrying an unacknowledged start; resend its original payload. */
export function agentRequestKey(input: unknown): string {
	const value = input as Record<string, unknown>;
	return JSON.stringify(
		Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => !['conversation', 'branch', 'commit'].includes(key))
				.sort(([a], [b]) => a.localeCompare(b))
		)
	);
}
export function definitiveAgentFailure(cause: unknown): boolean {
	const status = Number((cause as { status?: number })?.status);
	return status >= 400 && status < 500 && ![408, 429].includes(status);
}
/** Public run events over an authenticated project API; credentials belong to its caller. */
export class AgentHttpAdapter {
	private pending = new Map<string, { key: string; body: AgentCall }>();
	private views = new Map<string, { branch: string; commit: string }>();
	private listeners = new Set<(event: RunEvent) => void>();
	private active = new Map<string, { projectId: string; after: number }>();
	constructor(private send: (projectId: string, body: AgentCall) => Promise<unknown>) {}
	shown(snapshot: ProjectSnapshot, query: RevisionQuery) {
		const id = snapshot.project.id!;
		if (
			!snapshot.writable ||
			!snapshot.capabilities?.agents ||
			query.commit ||
			!snapshot.revision.atTip ||
			snapshot.cache?.status === 'offline'
		)
			this.views.delete(id);
		else this.views.set(id, { branch: snapshot.revision.branch, commit: snapshot.revision.commit });
	}
	listen(listener: (event: RunEvent) => void) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
	async call(method: string, input: unknown, projectId: string): Promise<unknown> {
		const changes = ['startRun', 'approve', 'openThread'].includes(method);
		const revision = this.views.get(projectId);
		if (changes && !revision)
			throw new Error('View the current branch tip before asking an agent.');
		let body: AgentCall = {
			method,
			input,
			...(changes ? { revision, requestId: crypto.randomUUID() } : {})
		};
		if (method === 'startRun') {
			const key = agentRequestKey(input),
				pending = this.pending.get(projectId);
			if (pending && pending.key !== key)
				throw new Error(
					'Retry the previous request to establish whether it started before sending another.'
				);
			body = pending?.body ?? body;
			this.pending.set(projectId, { key, body });
		}
		const value = await this.send(projectId, body).catch((cause) => {
			if (method === 'startRun' && definitiveAgentFailure(cause)) this.pending.delete(projectId);
			throw cause;
		});
		if (method === 'startRun') this.pending.delete(projectId);
		if (method === 'startRun') {
			const runId = (value as { runId: string }).runId;
			this.active.set(runId, { projectId, after: 0 });
			setTimeout(() => void this.poll(runId), 0);
		}
		return value;
	}
	private async poll(runId: string) {
		const state = this.active.get(runId);
		if (!state) return;
		try {
			const value = (await this.send(state.projectId, {
				method: 'events',
				input: { runId, after: state.after }
			})) as {
				events: Array<{ sequence: number; value: RunEvent }>;
			};
			for (const event of value.events) {
				if (event.value.runId !== runId || event.sequence <= state.after) continue;
				state.after = event.sequence;
				for (const listener of this.listeners) listener(event.value);
				if (['finished', 'failed', 'cancelled'].includes(event.value.kind))
					this.active.delete(runId);
			}
		} catch (cause) {
			if (definitiveAgentFailure(cause)) {
				this.active.delete(runId);
				for (const listener of this.listeners)
					listener({
						runId,
						kind: 'failed',
						message: 'Access to this run was refused. Refresh project access.'
					});
				return;
			}
			for (const listener of this.listeners)
				listener({
					runId,
					kind: 'status',
					phase: 'prompting',
					detail: 'Reconnecting to the existing run…'
				});
		}
		if (this.active.has(runId)) setTimeout(() => void this.poll(runId), 350);
	}
}
