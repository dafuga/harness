import {
	agentRequestKey,
	definitiveAgentFailure
} from '../../../../desktop/src/adapters/AgentHttpAdapter';
import type { DesktopBridge, RunEvent } from '../../../../desktop/src/models/DesktopBridge.types';
import type { ProjectSnapshot } from '../../../../desktop/src/models/Desktop.types';
/** Per-tab owner transport. Event polling is active only while a run has listeners. */
export class ConsoleBridgeAdapter {
	private token = '';
	private pending: { key: string; input: unknown; id: string } | null = null;
	private connected: Promise<ProjectSnapshot> | null = null;
	private listeners = new Set<(event: RunEvent) => void>();
	private sequence = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private generation = 0;
	private running = false;
	private runId = '';
	private request = (method: string, input: unknown, requestId?: string, token = this.token) =>
		consoleRequest({ method, input, requestId, token });

	connect(): Promise<ProjectSnapshot> {
		if (this.connected) return this.connected;
		const generation = this.generation;
		return (this.connected = this.request('connect', {})
			.then((value) => {
				if (generation !== this.generation) {
					void this.request('disconnect', {}, undefined, value.token).catch(() => undefined);
					throw new Error('Chat closed while connecting.');
				}
				this.token = value.token;
				return value.snapshot as ProjectSnapshot;
			})
			.catch((cause) => {
				this.connected = null;
				throw cause;
			}));
	}
	bridge(): DesktopBridge {
		const adapter = this;
		return new Proxy({} as DesktopBridge, {
			get(_target, method: string) {
				if (method === 'onRunEvent')
					return (listener: (event: RunEvent) => void) => {
						adapter.listeners.add(listener);
						return () => adapter.listeners.delete(listener);
					};
				if (['onCacheStatus', 'hostedStatus', 'history', 'artifact', 'evidence'].includes(method))
					return undefined;
				if (method === 'openProject') return () => adapter.connect();
				if (method === 'listProjects') return async () => [];
				if (method === 'selectProject')
					return async () => {
						throw new Error('This web preview has one project.');
					};
				return async (input: unknown = {}) => {
					await adapter.connect();
					const value =
						method === 'startRun'
							? await adapter.start(input)
							: await adapter.request(method, input);
					if (method === 'startRun') {
						adapter.runId = value.runId;
						adapter.running = true;
						void adapter.poll();
					}
					return value;
				};
			}
		});
	}
	private start = async (input: unknown) => {
		const key = agentRequestKey(input);
		if (this.pending && this.pending.key !== key)
			throw new Error('Retry the previous request before sending another.');
		const pending = this.pending ?? { key, input: structuredClone(input), id: crypto.randomUUID() };
		this.pending = pending;
		try {
			const value = await this.request('startRun', pending.input, pending.id);
			this.pending = null;
			return value;
		} catch (cause) {
			if (definitiveAgentFailure(cause)) this.pending = null;
			throw cause;
		}
	};
	private async poll() {
		if (!this.running) return;
		try {
			const value = await this.request('events', { after: this.sequence });
			const progress = consoleProgress(this.runId, this.sequence, value);
			this.sequence = progress.sequence;
			for (const event of progress.events) {
				for (const listener of this.listeners) listener(event);
				if (event.runId === this.runId && ['finished', 'failed', 'cancelled'].includes(event.kind))
					this.running = false;
			}
		} catch {
			/* Keep the run attached through a temporary network interruption. */
		}
		if (this.running) this.timer = setTimeout(() => void this.poll(), 250);
	}
	close() {
		this.generation++;
		this.running = false;
		clearTimeout(this.timer);
		if (this.token) void this.request('disconnect', {}).catch(() => undefined);
		this.token = '';
		this.connected = null;
	}
}

async function consoleRequest(body: {
	method: string;
	input: unknown;
	requestId?: string;
	token: string;
}) {
	const response = await fetch('/api/agent', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		keepalive: body.method === 'disconnect',
		body: JSON.stringify(body)
	});
	const value = await response.json();
	if (!response.ok)
		throw Object.assign(new Error(value.error || 'Chat unavailable.'), {
			status: response.status
		});
	return value;
}

interface EventBatch {
	gap?: boolean;
	sequence: number;
	events: Array<{ sequence: number; value: RunEvent }>;
	replay: Record<string, { text: string; detail: string; terminal?: RunEvent }>;
}
function consoleProgress(runId: string, after: number, value: EventBatch) {
	const events: RunEvent[] = [];
	const replay = value.replay?.[runId];
	if (value.gap && replay) {
		events.push({
			runId,
			kind: 'replay',
			text: replay.text,
			detail: 'Reconnected. Earlier output may be shortened. ' + replay.detail
		});
		if (replay.terminal) events.push(replay.terminal);
		after = value.sequence;
	}
	for (const event of value.events) {
		if (event.sequence <= after) continue;
		after = event.sequence;
		events.push(event.value);
	}
	return { events, sequence: after };
}
