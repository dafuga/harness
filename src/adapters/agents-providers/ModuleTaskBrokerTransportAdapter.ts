import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
	BrokerClientRequest,
	BrokerClientResult,
	BrokerSession,
	BrokerTools,
	ModuleTaskBrokerTransportAdapterConfig,
	TaskUsage
} from './ModuleTaskBrokerTransportAdapter.types';
import type {
	TaskRunInput,
	TaskRunResult
} from '../../repositories/agents-providers/ModuleTaskRepository.types';

type TaskRunScope = NonNullable<TaskRunInput['scope']>;

interface QualifiedBindings {
	ready(): Promise<void>;
	run(request: BrokerClientRequest): Promise<BrokerClientResult>;
	openBroker(input: TaskRunInput): Promise<BrokerSession>;
}

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
): QualifiedBindings | undefined {
	const client = config.client;
	const ready = client?.ready;
	const run = client?.run;
	const openBroker = config.openBroker;
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

function snapshotTaskInput(input: TaskRunInput): TaskRunInput | undefined {
	if (!isRecord(input) || !isValidTaskInput(input)) return undefined;
	const { provider, model, intelligence, cwd, prompt, signal } = input;
	const scope = snapshotScope(input.scope, cwd);
	if (!scope) return undefined;
	return Object.freeze({ provider, model, intelligence, cwd, prompt, signal, scope });
}

function isValidTaskInput(input: TaskRunInput): boolean {
	const { provider, model, intelligence, cwd, prompt, signal } = input;
	return provider === 'codex' && typeof model === 'string' &&
		typeof intelligence === 'string' && typeof cwd === 'string' && cwd.length > 0 &&
		typeof prompt === 'string' && Boolean(signal) && typeof signal.aborted === 'boolean';
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
	}) as TaskRunScope;
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
	if (!isRecord(session) || !isRecord(session.tools)) throw new Error('Invalid broker session');
	const source = session.tools;
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

function sessionCloser(session: unknown): (() => Promise<void>) | undefined {
	if (!isRecord(session)) return undefined;
	const close = session.close;
	if (typeof close !== 'function') return undefined;
	return close.bind(session) as () => Promise<void>;
}

async function executeBrokerTask(
	input: TaskRunInput,
	bindings: QualifiedBindings
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
		close = sessionCloser(session);
		const tools = projectSessionTools(session);
		throwIfCancelled(input.signal);
		clientStarted = true;
		const response = await bindings.run(clientRequest(input, tools));
		throwIfCancelled(input.signal);
		result = taskResult(input, response);
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

function clientRequest(input: TaskRunInput, tools: BrokerTools): BrokerClientRequest {
	return {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		cwd: input.scope!.scratch,
		prompt: input.prompt,
		signal: input.signal,
		tools
	};
}

function taskResult(input: TaskRunInput, response: BrokerClientResult): TaskRunResult {
	const { reportedModel, usage } = response;
	const result: TaskRunResult = {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		text: response.text,
		reportedModel: typeof reportedModel === 'string' ? reportedModel || null : null
	};
	if (usage !== undefined) result.usage = copyUsage(usage);
	return result;
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
