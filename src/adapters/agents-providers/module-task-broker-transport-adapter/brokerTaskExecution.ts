import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
	BrokerClientRequest,
	BrokerClientResult,
	BrokerTools,
	BrokerTransportBindings,
	ModuleTaskBrokerTransportAdapterConfig,
	TaskRunInput,
	TaskRunResult,
	TaskRunScope,
	TaskRunSnapshot,
	TaskUsage
} from '../ModuleTaskBrokerTransportAdapter.types';

export function qualifiedBindings(
	config: ModuleTaskBrokerTransportAdapterConfig
): BrokerTransportBindings | undefined {
	const { client, openBroker } = config;
	const ready = client?.ready;
	const run = client?.run;
	if (
		!client ||
		typeof ready !== 'function' ||
		typeof run !== 'function' ||
		typeof openBroker !== 'function'
	)
		return undefined;
	return {
		ready: ready.bind(client),
		run: run.bind(client),
		openBroker: openBroker.bind(config)
	};
}

export function snapshotTaskInput(input: TaskRunInput): TaskRunSnapshot | undefined {
	if (!isRecord(input)) return undefined;
	const fields = readTaskFields(input);
	if (!fields) return undefined;
	const scope = snapshotScope(fields.scope, fields.cwd);
	if (!scope) return undefined;
	return Object.freeze({ ...fields, scope });
}

type TaskFields = Omit<TaskRunSnapshot, 'scope'> & { scope: unknown };

function readTaskFields(input: TaskRunInput): TaskFields | undefined {
	const { provider, model, intelligence, cwd, prompt, signal, scope } = input;
	if (
		provider !== 'codex' ||
		typeof model !== 'string' ||
		typeof intelligence !== 'string' ||
		typeof cwd !== 'string' ||
		cwd.length === 0 ||
		typeof prompt !== 'string' ||
		typeof signal?.aborted !== 'boolean'
	)
		return undefined;
	return { provider, model, intelligence, cwd, prompt, signal, scope };
}

function snapshotScope(value: unknown, cwd: string): TaskRunScope | undefined {
	if (!isRecord(value)) return undefined;
	const { files, snapshot, scratch, readPaths, protectedPaths, binDirectory } = value;
	if (
		!isStringArray(files) ||
		!isStringArray(readPaths) ||
		!isStringArray(protectedPaths) ||
		typeof snapshot !== 'string' ||
		typeof scratch !== 'string' ||
		(binDirectory !== undefined && typeof binDirectory !== 'string') ||
		!isAbsolute(scratch) ||
		!isOutsideEditableCwd(cwd, scratch)
	)
		return undefined;
	return Object.freeze({
		files: freezeStrings(files),
		snapshot,
		scratch,
		readPaths: freezeStrings(readPaths),
		protectedPaths: freezeStrings(protectedPaths),
		...(binDirectory === undefined ? {} : { binDirectory })
	});
}

function isOutsideEditableCwd(cwd: string, scratch: string): boolean {
	const fromCwd = relative(resolve(cwd), resolve(scratch));
	return (
		fromCwd !== '' && (fromCwd === '..' || fromCwd.startsWith(`..${sep}`) || isAbsolute(fromCwd))
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

export async function executeBrokerTask(
	input: TaskRunSnapshot,
	bindings: BrokerTransportBindings
): Promise<TaskRunResult> {
	const execution: BrokerExecution = { clientStarted: false };
	let hasFailure = false;
	let failure: unknown;
	let result: TaskRunResult | undefined;
	try {
		result = await runBrokerClient(input, bindings, execution);
	} catch (error) {
		hasFailure = true;
		failure = execution.clientStarted && input.signal.aborted ? cancelledError() : error;
	}
	return settleBrokerTask(execution, result, hasFailure, failure);
}

interface BrokerExecution {
	close?: () => Promise<void>;
	clientStarted: boolean;
}

async function runBrokerClient(
	input: TaskRunSnapshot,
	bindings: BrokerTransportBindings,
	execution: BrokerExecution
): Promise<TaskRunResult> {
	await bindings.ready();
	throwIfCancelled(input.signal);
	const session = await bindings.openBroker(input);
	const closeMethod = isRecord(session) ? session.close : undefined;
	if (typeof closeMethod === 'function') execution.close = closeMethod.bind(session);
	const tools = projectSessionTools(session);
	throwIfCancelled(input.signal);
	execution.clientStarted = true;
	const response = await bindings.run(createClientRequest(input, tools));
	throwIfCancelled(input.signal);
	return createTaskResult(input, response);
}

function createClientRequest(input: TaskRunSnapshot, tools: BrokerTools): BrokerClientRequest {
	return {
		provider: input.provider,
		model: input.model,
		intelligence: input.intelligence,
		cwd: input.scope.scratch,
		prompt: input.prompt,
		signal: input.signal,
		tools
	};
}

function createTaskResult(input: TaskRunSnapshot, response: BrokerClientResult): TaskRunResult {
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

async function settleBrokerTask(
	execution: BrokerExecution,
	result: TaskRunResult | undefined,
	hasFailure: boolean,
	failure: unknown
): Promise<TaskRunResult> {
	if (execution.close) {
		try {
			await execution.close();
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

function projectSessionTools(session: unknown): BrokerTools {
	if (!isRecord(session)) throw new Error('Invalid broker session');
	const source = session.tools;
	if (!isRecord(source)) throw new Error('Invalid broker session');
	const { readContract, listContracts, readAssigned, writeAssigned } = source;
	if (
		typeof readContract !== 'function' ||
		typeof listContracts !== 'function' ||
		typeof readAssigned !== 'function' ||
		typeof writeAssigned !== 'function'
	)
		throw new Error('Invalid broker session');
	return Object.freeze({
		readContract: readContract.bind(source) as BrokerTools['readContract'],
		listContracts: listContracts.bind(source) as BrokerTools['listContracts'],
		readAssigned: readAssigned.bind(source) as BrokerTools['readAssigned'],
		writeAssigned: writeAssigned.bind(source) as BrokerTools['writeAssigned']
	});
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

export function throwIfCancelled(signal: AbortSignal): void {
	if (signal.aborted) throw cancelledError();
}

function cancelledError(): Error {
	const error = new Error('Broker task cancelled');
	error.name = 'AbortError';
	return error;
}
