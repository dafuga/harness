import { randomUUID, createHash } from 'node:crypto';
import { ProjectSessionService } from '../../../../../desktop/src/services/project-session-service/ProjectSessionService';
import { DesktopRunService } from '../../../../../desktop/src/services/desktop-run-service/DesktopRunService';
import { DesktopBridgeService } from '../../../../../desktop/src/services/desktop-bridge-service/DesktopBridgeService';
import { ProviderDiscoveryService } from '../../../../../desktop/src/services/provider-discovery-service/ProviderDiscoveryService';
import { CodexAppServerAdapter } from '../../../../../desktop/src/adapters/codex-app-server-adapter/CodexAppServerAdapter';
import { ClaudeCliAdapter } from '../../../../../desktop/src/adapters/claude-cli-adapter/ClaudeCliAdapter';
import { RepositoryArbiterService } from '../../../../../desktop/src/services/RepositoryArbiterService';
import { IpcRequestValidator } from '../../../../../desktop/src/validators/IpcRequestValidator';
import { channels, type RunEvent } from '../../../../../desktop/src/models/DesktopBridge.types';
import type { RevisionQuery } from '../../../../../desktop/src/models/DesktopBridge.types';
import { join } from 'node:path';
import { CommentOutboxService } from '../../../../../desktop/src/services/CommentOutboxService';
import { reportSite } from '../../../utils/reports-media/reportSite';

const arbiter = new RepositoryArbiterService();
const outbox = new CommentOutboxService(join(reportSite().root, 'work/console-comments.json'));
const allowed = [
	'snapshot',
	'entity',
	'history',
	'createPlan',
	'openThread',
	'messages',
	'approve',
	'providers',
	'startRun',
	'cancelRun',
	'capabilities',
	'addComment',
	'pendingComments',
	'source',
	'image',
	'evidence',
	'artifact'
];
/** Owner-only HTTP sessions use the same validated bridge and repository lock as the desktop. */
export class ConsoleAgentService {
	private session = new ProjectSessionService({ arbiter, outbox });
	private events: Array<{ sequence: number; value: RunEvent }> = [];
	private sequence = 0;
	private requests = new Map<string, { digest: string; work: Promise<unknown> }>();
	private replay = new Map<string, { text: string; detail: string; terminal?: RunEvent }>();
	private touched = Date.now();
	private codex = new CodexAppServerAdapter();
	private providers = new ProviderDiscoveryService({
		codex: this.codex,
		claude: new ClaudeCliAdapter()
	});
	private runs = new DesktopRunService(this.session, this.providers, this.codex, (value) => {
		this.events = [...this.events.slice(-511), { sequence: ++this.sequence, value }];
		const held = this.replay.get(value.runId) ?? { text: '', detail: '' };
		if (value.kind === 'text') held.text = (held.text + value.text).slice(-128000);
		if (value.kind === 'status') held.detail = value.detail;
		if (['finished', 'failed', 'cancelled'].includes(value.kind)) held.terminal = value;
		this.replay.set(value.runId, held);
		if (this.replay.size > 4) this.replay.delete(this.replay.keys().next().value!);
	});
	private bridge = new DesktopBridgeService(
		this.session,
		this.providers,
		this.runs,
		async () => null
	).bridge();
	async open() {
		return this.session.open(reportSite().root);
	}
	close() {
		this.runs.cancelActive();
	}
	get busy() {
		return this.session.busy;
	}
	get expired() {
		return Date.now() - this.touched > 60 * 60 * 1000 && !this.session.busy;
	}
	private progress(input: unknown) {
		const after = Number((input as { after?: number })?.after ?? 0);
		if (!Number.isSafeInteger(after) || after < 0) throw new Error('Invalid event cursor.');
		return {
			events: this.events.filter((event) => event.sequence > after),
			gap: after < (this.events[0]?.sequence ?? 1) - 1,
			replay: Object.fromEntries(this.replay),
			sequence: this.sequence
		};
	}

	async call(method: string, input: unknown, requestId?: string): Promise<unknown> {
		this.touched = Date.now();
		const reads = { events: () => this.progress(input), registry: () => this.registry(input) };
		if (Object.hasOwn(reads, method)) return reads[method as keyof typeof reads]();
		if (!allowed.includes(method)) throw new Error('Operation unavailable in this web session.');
		if (method === 'startRun') {
			if (!requestId || !/^[a-f0-9-]{36}$/.test(requestId))
				throw new Error('Request identity required.');
			const prior = this.requests.get(requestId);
			if (prior) {
				if (prior.digest !== createHash('sha256').update(JSON.stringify(input)).digest('hex'))
					throw new Error('Request identity conflict.');
				return prior.work;
			}
		}
		const key = method as keyof typeof channels;
		const payload = new IpcRequestValidator().parse(channels[key], input);
		const operation = this.bridge[key] as (value: unknown) => Promise<unknown>;
		const work = operation(payload);
		if (method === 'startRun') {
			if (this.requests.size >= 64) this.requests.delete(this.requests.keys().next().value!);
			this.requests.set(requestId!, {
				digest: createHash('sha256').update(JSON.stringify(input)).digest('hex'),
				work
			});
		}
		return work;
	}
	private async registry(input: unknown) {
		const query = new IpcRequestValidator().parse(channels.snapshot, input) as RevisionQuery;
		this.session.assertProject(query.projectId);
		const { source } = this.session.requireProject();
		const revision = await source.revision(query);
		return { commit: revision.commit, units: await source.units(revision.commit) };
	}
}
const key = Symbol.for('harness.console.agents');
const state = globalThis as typeof globalThis & { [key]?: Map<string, ConsoleAgentService> };
const clients = (state[key] ??= new Map());
/** Tokens stay in the tab's memory and request body; no cookie, URL, or disk contains them. */
export async function consoleAgent(input: Record<string, unknown>): Promise<unknown> {
	if (input.method === 'connect') {
		availableSessionSlot();
		const client = new ConsoleAgentService(),
			token = randomUUID();
		clients.set(token, client);
		try {
			const snapshot = await client.open();
			return { token, snapshot };
		} catch (cause) {
			clients.delete(token);
			throw cause;
		}
	}
	if (typeof input.token !== 'string' || !clients.has(input.token))
		throw new Error('Chat session expired. Reopen the page.');
	const client = clients.get(input.token)!;
	if (input.method === 'disconnect') {
		client.close();
		clients.delete(input.token);
		return null;
	}
	return client.call(
		String(input.method),
		input.input,
		typeof input.requestId === 'string' ? input.requestId : undefined
	);
}

function availableSessionSlot() {
	for (const [id, client] of clients) if (client.expired) clients.delete(id);
	while (clients.size >= 8) {
		const idle = [...clients].find(
			([, client]) => !client['session'].busy && client['session'].root !== null
		);
		if (!idle) throw new Error('All chat sessions are active. Finish one before opening another.');
		idle[1].close();
		clients.delete(idle[0]);
	}
}
