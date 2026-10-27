import { expect } from 'vitest';
import { ModuleTaskBrokerTransportAdapter } from '../../../src/adapters/agents-providers/ModuleTaskBrokerTransportAdapter';
import type {
	Client,
	ClientRequest,
	Config,
	RigOptions,
	RunInput,
	Session,
	Transport
} from './module-task-broker-transport.test.types';

export function adapter(config?: Config): Partial<Transport> {
	return new ModuleTaskBrokerTransportAdapter(config as never) as unknown as Partial<Transport>;
}

export function requireReady(value: Partial<Transport>): asserts value is Transport {
	expect(typeof value.ready).toBe('function');
}

export function requireRun(value: Partial<Transport>): asserts value is Transport {
	expect(typeof value.run).toBe('function');
}

export function input(overrides: Partial<RunInput> = {}): RunInput {
	return {
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max',
		cwd: process.cwd(),
		prompt: 'Synthetic broker verification',
		signal: new AbortController().signal,
		scope: {
			files: ['src/assigned.ts'],
			snapshot: '/tmp/contracts',
			scratch: '/tmp/task-scratch',
			readPaths: ['/tmp/runtime'],
			protectedPaths: ['src']
		},
		...overrides
	};
}

export function tools() {
	return {
		marker: 'bound',
		async readContract(unitId: string) {
			return `${this.marker}:${unitId}`;
		},
		async listContracts(kind?: string) {
			return `${this.marker}:${kind}`;
		},
		async readAssigned(path: string) {
			return { text: `${this.marker}:${path}`, sha256: 'assigned-hash' };
		},
		async writeAssigned(change: { path: string; expectedSha256: string; text: string }) {
			return { sha256: `${this.marker}:${change.expectedSha256}:${change.text}` };
		}
	};
}

export function makeRig(options: RigOptions = {}) {
	const calls = { ready: 0, open: 0, run: 0, close: 0 };
	const events: string[] = [];
	const opened: RunInput[] = [];
	const requests: ClientRequest[] = [];
	const session: Session = {
		tools: options.tools ?? tools(),
		close: async () => {
			calls.close++;
			events.push('close');
			await options.close?.();
		}
	};
	const client: Client = {
		ready: async () => {
			calls.ready++;
			events.push('ready');
			await options.clientReady?.();
		},
		run: async (request) => {
			calls.run++;
			events.push('client');
			requests.push(request);
			return options.clientRun ? options.clientRun(request) : { text: 'Synthetic completion' };
		}
	};
	const openBroker = async (value: RunInput) => {
		calls.open++;
		events.push('open');
		opened.push(value);
		return options.openBroker ? options.openBroker(value) : session;
	};
	return { adapter: adapter({ client, openBroker }), calls, events, opened, requests, session };
}

export function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

async function assertQualifiedRequest(request: ClientRequest, signal: AbortSignal) {
	expect(Object.keys(request).sort()).toEqual([
		'cwd',
		'intelligence',
		'model',
		'prompt',
		'provider',
		'signal',
		'tools'
	]);
	expect(request).toMatchObject({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max',
		cwd: '/tmp/task-scratch'
	});
	expect(request.signal).toBe(signal);
	expect(Object.keys(request.tools).sort()).toEqual([
		'listContracts',
		'readAssigned',
		'readContract',
		'writeAssigned'
	]);
	expect(Object.isFrozen(request.tools)).toBe(true);
	expect(await request.tools.readContract('service.orders')).toBe('bound:service.orders');
	expect(await request.tools.listContracts('service')).toBe('bound:service');
	expect(await request.tools.readAssigned('src/assigned.ts')).toEqual({
		text: 'bound:src/assigned.ts',
		sha256: 'assigned-hash'
	});
	expect(
		await request.tools.writeAssigned({
			path: 'src/assigned.ts',
			expectedSha256: 'old-hash',
			text: 'new'
		})
	).toEqual({ sha256: 'bound:old-hash:new' });
}

export async function runQualifiedCase() {
	const entered = deferred<void>();
	const release = deferred<void>();
	const runInput = input();
	const rig = makeRig({
		clientReady: async () => {
			entered.resolve(undefined);
			await release.promise;
		},
		clientRun: async (request) => {
			await assertQualifiedRequest(request, runInput.signal);
			return { text: 'Synthetic completion', usage: { inputTokens: 7, outputTokens: 3 } };
		}
	});
	requireRun(rig.adapter);
	const pending = rig.adapter.run(runInput);
	await entered.promise;
	runInput.model = 'mutated';
	runInput.scope!.files.push('src/ungranted.ts');
	runInput.scope!.readPaths[0] = '/tmp/changed';
	runInput.scope!.protectedPaths.push('tests');
	release.resolve(undefined);
	expect(await pending).toEqual({
		provider: 'codex',
		model: 'gpt-6-luna',
		intelligence: 'max',
		text: 'Synthetic completion',
		reportedModel: null,
		usage: {
			inputTokens: 7,
			outputTokens: 3,
			cacheReadTokens: null,
			cacheWriteTokens: null,
			cacheWriteLongTokens: null,
			reportedCostUsd: null,
			reasoningTokens: null
		}
	});
	expect(rig.opened[0]).not.toBe(runInput);
	expect(rig.opened[0].scope).not.toBe(runInput.scope);
	expect(rig.opened[0].scope?.files).toEqual(['src/assigned.ts']);
	expect(rig.opened[0].scope?.readPaths).toEqual(['/tmp/runtime']);
	expect(rig.opened[0].scope?.protectedPaths).toEqual(['src']);
	expect(rig.calls.close).toBe(1);
}
