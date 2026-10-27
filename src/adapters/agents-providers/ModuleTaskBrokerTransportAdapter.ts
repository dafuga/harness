import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
	BrokerTools,
	BrokerTransportBindings,
	ModuleTaskBrokerTransportAdapterConfig,
	TaskRunInput,
	TaskRunResult,
	TaskRunScope,
	TaskRunSnapshot,
	TaskUsage
} from './ModuleTaskBrokerTransportAdapter.types';

export class ModuleTaskBrokerTransportAdapter {
	constructor(private readonly config: ModuleTaskBrokerTransportAdapterConfig = {}) {}

	async ready(): Promise<void> {
		const bindings = qualifiedBindings(this.config);
		if (!bindings) throw new Error('Broker transport is unqualified');
		await bindings.ready();
	}

	async run(input: TaskRunInput): Promise<TaskRunResult> {
		const snapshot = snapshotTaskInput(input);
		if (!snapshot) throw new Error('Invalid broker task input');
		throwIfCancelled(snapshot.signal);
		const bindings = qualifiedBindings(this.config);
		if (!bindings) throw new Error('Broker transport is unqualified');
		return executeBrokerTask(snapshot, bindings);
	}
}

function qualifiedBindings(
	config: ModuleTaskBrokerTransportAdapterConfig
): BrokerTransportBindings | undefined {
	const { client, openBroker } = config;
	const ready = client?.ready;
	const run = client?.run;
	if (
		!client || typeof ready !== 'function' || typeof run !== 'function' ||
		typeof openBroker !== 'function'
	) return undefined;
	return {
		ready: ready.bind(client),
		run: run.bind(client),
		openBroker: openBroker.bind(config)
	};
}

function snapshotTaskInput(input: TaskRunInput): TaskRunSnapshot | undefined {
	if (!isRecord(input)) return undefined;
	const { provider, model, intelligence, cwd, prompt, signal, scope } = input;
	if (
		provider !== 'codex' || typeof model !== 'string' ||
		typeof intelligence !== 'string' || typeof cwd !== 'string' || cwd.length === 0 ||
		typeof prompt !== 'string' || typeof signal?.aborted !== 'boolean'
	) return undefined;
	const scopeSnapshot = snapshotScope(scope, cwd);
	if (!scopeSnapshot) return undefined;
	return Object.freeze({ provider, model, intelligence, cwd, prompt, signal, scope: scopeSnapshot });
}

function snapshotScope(value: unknown, cwd: string): TaskRunScope | undefined {
	if (!isRecord(value)) return undefined;
	const { files, snapshot, scratch, readPaths, protectedPaths, binDirectory } = value;
	if (
		!hasValidScopePaths([files, readPaths, protectedPaths]) || typeof snapshot !== 'string' ||
		typeof scratch !== 'string' ||
		(binDirectory !== undefined && typeof binDirectory !== 'string') ||
		!isAbsolute(scratch) || !isOutsideEditableCwd(cwd, scratch)
	) return undefined;
	return Object.freeze({
		files: freezeStrings(files as string[]),
		snapshot,
		scratch,
		readPaths: freezeStrings(readPaths as string[]),
		protectedPaths: freezeStrings(protectedPaths as string[]),
		...(binDirectory === undefined ? {} : { binDirectory })
	});
}

const hasValidScopePaths = (paths: unknown[]): boolean => paths.every(isStringArray);

function isOutsideEditableCwd(cwd: string, scratch: string): boolean {
	const fromCwd = relative(resolve(cwd), resolve(scratch));
	return fromCwd !== '' && (
		fromCwd === '..' || fromCwd.startsWith(`..${sep}`) || isAbsolute(fromCwd)
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item: unknown) => typeof item === 'string');
}

function freezeStrings(values: string[]): string[] {
	return Object.freeze([...values]) as unknown as string[];
}

function projectSessionTools(session: unknown): BrokerTools {
	if (!isRecord(session)) throw new Error('Invalid broker session');
	const source = session.tools;
	if (!isRecord(source)) throw new Error('Invalid broker session');
	const { readContract, listContracts, readAssigned, writeAssigned } = source;
	if (
		typeof readContract !== 'function' || typeof listContracts !== 'function' ||
		typeof readAssigned !== 'function' || typeof writeAssigned !== 'function'
	) throw new Error('Invalid broker session');
	return Object.freeze({
		readContract: readContract.bind(source) as BrokerTools['readContract'],
		listContracts: listContracts.bind(source) as BrokerTools['listContracts'],
		readAssigned: readAssigned.bind(source) as BrokerTools['readAssigned'],
		writeAssigned: writeAssigned.bind(source) as BrokerTools['writeAssigned']
	});
}

async function executeBrokerTask(
	input: TaskRunSnapshot,
	bindings: BrokerTransportBindings
): Promise<TaskRunResult> {
	let close: (() => Promise<void>) | undefined;
	let hasFailure = false;
	let failure: unknown;
	let result: TaskRunResult | undefined;
	let clientStarted = false;
	try {
		await bindings.ready();
		throwIfCancelled(input.signal);
		const session = await bindings.openBroker(input);
		const closeMethod = isRecord(session) ? session.close : undefined;
		if (typeof closeMethod === 'function') close = closeMethod.bind(session);
		const tools = projectSessionTools(session);
		throwIfCancelled(input.signal);
		clientStarted = true;
		const response = await bindings.run({
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			cwd: input.scope.scratch,
			prompt: input.prompt,
			signal: input.signal,
			tools
		});
		throwIfCancelled(input.signal);
		const { reportedModel, usage } = response;
		result = {
			provider: input.provider,
			model: input.model,
			intelligence: input.intelligence,
			text: response.text,
			reportedModel: typeof reportedModel === 'string' ? reportedModel || null : null
		};
		if (usage !== undefined) result.usage = copyUsage(usage);
	} catch (error) {
		hasFailure = true;
		failure = clientStarted && input.signal.aborted ? cancelledError() : error;
	}
	if (close) {
		try {
			await close();
		} catch (error) {
			if (!hasFailure) {
				hasFailure = true;
				failure = error;
			}
		}
	}
	if (hasFailure) throw failure;
	return result as TaskRunResult;
}

function copyUsage(usage: TaskUsage): TaskUsage {
	return {
		inputTokens: usage.inputTokens ?? null,
		outputTokens: usage.outputTokens ?? null,
		cacheReadTokens: usage.cacheReadTokens ?? null,
		cacheWriteTokens: usage.cacheWriteTokens ?? null,
		cacheWriteLongTokens: usage.cacheWriteLongTokens ?? null,
		reportedCostUsd: usage.reportedCostUsd ?? null,
		reasoningTokens: usage.reasoningTokens ?? null
	};
}

function throwIfCancelled(signal: AbortSignal): void {
	if (signal.aborted) throw cancelledError();
}

function cancelledError(): Error {
	const error = new Error('Broker task cancelled');
	error.name = 'AbortError';
	return error;
}
