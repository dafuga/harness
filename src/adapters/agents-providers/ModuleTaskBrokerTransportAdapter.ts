import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
	BrokerClientRequest,
	BrokerClientResult,
	BrokerSession,
	BrokerTools,
	ModuleTaskBrokerTransportAdapterConfig
} from './ModuleTaskBrokerTransportAdapter.types';
import type { TaskRunInput, TaskRunResult } from '../../repositories/agents-providers/ModuleTaskRepository.types';

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
	if (!client || typeof ready !== 'function' || typeof run !== 'function' ||
		typeof openBroker !== 'function') return undefined;
	return {
		ready: ready.bind(client),
		run: run.bind(client),
		openBroker: openBroker.bind(config)
	};
}

function snapshotTaskInput(input: TaskRunInput): TaskRunInput | undefined {
	if (!isRecord(input)) return undefined;
	const { provider, model, intelligence, cwd, prompt, signal, scope } = input;
	if (
		provider !== 'codex' || typeof model !== 'string' || typeof intelligence !== 'string' ||
		typeof cwd !== 'string' || cwd.length === 0 || typeof prompt !== 'string' ||
		!signal || typeof signal.aborted !== 'boolean' || !isRecord(scope)
	) return undefined;
	const { files, snapshot, scratch, readPaths, protectedPaths, binDirectory } = scope;
	if (
		!isStringArray(files) || typeof snapshot !== 'string' || typeof scratch !== 'string' ||
		!isStringArray(readPaths) || !isStringArray(protectedPaths) ||
		(binDirectory !== undefined && typeof binDirectory !== 'string') ||
		!isAbsolute(scratch) || !isOutsideEditableCwd(cwd, scratch)
	) return undefined;
	const pinnedScope = Object.freeze({
		files: freezeStrings(files),
		snapshot,
		scratch,
		readPaths: freezeStrings(readPaths),
		protectedPaths: freezeStrings(protectedPaths),
		...(binDirectory === undefined ? {} : { binDirectory })
	});
	return Object.freeze({ provider, model, intelligence, cwd, prompt, signal, scope: pinnedScope });
}

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
	if (!isRecord(session) || typeof session.close !== 'function' || !isRecord(session.tools)) {
		throw new Error('Invalid broker session');
	}
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

async function executeBrokerTask(
	input: TaskRunInput,
	bindings: QualifiedBindings
): Promise<TaskRunResult> {
	let session: unknown;
	let sessionCreated = false;
	let hasFailure = false;
	let failure: unknown;
	let result: TaskRunResult | undefined;
	let clientStarted = false;
	try {
		await bindings.ready();
		throwIfCancelled(input.signal);
		session = await bindings.openBroker(input);
		sessionCreated = true;
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
	if (sessionCreated) {
		try {
			await closeSession(session);
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
	const identity = response.reportedModel;
	const result: TaskRunResult = {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		text: response.text,
		reportedModel: typeof identity === 'string' && identity.length > 0 ? identity : null
	};
	if (response.usage !== undefined) result.usage = { ...response.usage };
	return result;
}

async function closeSession(session: unknown): Promise<void> {
	if (!isRecord(session)) return;
	const close = session.close;
	if (typeof close !== 'function') return;
	await close.call(session);
}

function throwIfCancelled(signal: AbortSignal): void {
	if (signal.aborted) throw cancelledError();
}

function cancelledError(): Error {
	const error = new Error('Broker task cancelled');
	error.name = 'AbortError';
	return error;
}
