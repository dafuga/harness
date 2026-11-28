// @harness-uid u_bl6xl2h4a3
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { WatchdogPane } from '../WatchdogPaneService.types';
import { transcriptFiles } from './trackerTranscriptScan';

const headerBytes = 128 * 1024;
const tailBytes = 512 * 1024;

export const trackerContextCheckpointPrefix = 'stopped: watchdog context handoff; resume from:';

import type { TrackerContextSample, TrackerTranscriptRecord } from './trackerWatchdogContext.types';

export async function sampleTrackerContexts(
	panes: readonly WatchdogPane[],
	roots: readonly string[],
	signal: AbortSignal
): Promise<WatchdogPane[]> {
	const candidates = panes.filter(
		({ live, cwd, contextTokens }) => live && cwd && contextTokens === undefined
	);
	if (!roots.length || !candidates.length) return [...panes];
	const activeSince = Math.min(...candidates.map(({ createdAt }) => createdAt - 1000));
	const samples = new Map<string, TrackerContextSample[]>();
	for (const root of new Set(roots)) {
		for await (const file of transcriptFiles(root)) {
			signal.throwIfAborted();
			const sample = await contextSample(file, activeSince, candidates);
			if (sample) {
				const rows = samples.get(sample.cwd) ?? [];
				rows.push(sample);
				samples.set(sample.cwd, rows);
			}
		}
	}
	return panes.map((pane) => withContext(pane, samples));
}

function withContext(
	pane: WatchdogPane,
	samples: ReadonlyMap<string, TrackerContextSample[]>
): WatchdogPane {
	if (!pane.cwd || pane.contextTokens !== undefined) return pane;
	const matching = samples.get(pane.cwd)?.filter(({ started }) => started >= pane.createdAt - 1000);
	// A directory may be used by two interactive sessions. Do not attribute either to the pane.
	if (matching?.length !== 1) return pane;
	const { tokens, model, effort } = matching[0];
	return {
		...pane,
		contextTokens: tokens,
		model: model ?? pane.model,
		effort: effort ?? pane.effort
	};
}

async function contextSample(
	path: string,
	activeSince: number,
	panes: readonly WatchdogPane[]
): Promise<TrackerContextSample | undefined> {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch(() => undefined);
	if (!file) return undefined;
	try {
		const stat = await file.stat();
		if (!stat.isFile() || stat.mtimeMs < activeSince) return undefined;
		const head = transcriptIdentity(await readLines(file, 0, headerBytes));
		if (
			!head ||
			!panes.some(({ cwd, createdAt }) => cwd === head.cwd && head.started >= createdAt - 1000)
		)
			return undefined;
		const lines = await readLines(file, Math.max(0, stat.size - tailBytes), tailBytes);
		const tokens = lastContextTokens(lines);
		return { ...head, tokens, ...lastProviderSelection(lines) };
	} finally {
		await file.close();
	}
}

async function readLines(file: Awaited<ReturnType<typeof open>>, offset: number, length: number) {
	const bytes = Buffer.alloc(length);
	try {
		const { bytesRead } = await file.read(bytes, 0, length, offset);
		const lines = bytes.subarray(0, bytesRead).toString('utf8').split('\n');
		return offset ? lines.slice(1) : lines;
	} finally {
		bytes.fill(0);
	}
}

function transcriptIdentity(lines: readonly string[]) {
	for (const line of lines) {
		const row = record(line);
		const payload = row.type === 'session_meta' ? object(row.payload) : row;
		const { cwd, timestamp } = payload;
		if (typeof cwd !== 'string' || typeof timestamp !== 'string') continue;
		const started = Date.parse(timestamp);
		if (Number.isFinite(started)) return { cwd, started };
	}
	return undefined;
}

function lastProviderSelection(lines: readonly string[]) {
	for (let index = lines.length - 1; index >= 0; index--) {
		const line = lines[index];
		if (!line.includes('"model"')) continue;
		const row = record(line);
		if (row.type !== 'turn_context' && row.type !== 'assistant') continue;
		const source = row.type === 'turn_context' ? object(row.payload) : object(row.message);
		const { model, effort = source.reasoning_effort } = source;
		if (typeof model !== 'string' || !/^(?:gpt|claude)-[a-z0-9._-]{1,72}$/.test(model)) continue;
		return { model, effort: sampledEffort(effort) };
	}
	return undefined;
}

function sampledEffort(effort: unknown) {
	return typeof effort === 'string' && /^(?:low|medium|high|xhigh|max|ultra)$/.test(effort)
		? effort
		: undefined;
}

function lastContextTokens(lines: readonly string[]) {
	for (let index = lines.length - 1; index >= 0; index--) {
		const tokens = contextTokens(lines[index]);
		if (tokens > 0) return tokens;
	}
	return 0;
}

function contextTokens(line: string): number {
	if (!line.includes('"token_count"') && !line.includes('"usage"')) return 0;
	const row = record(line);
	const payload = object(row.payload);
	if (row.type === 'event_msg' && payload.type === 'token_count') {
		return count(object(object(payload.info).last_token_usage).input_tokens);
	}
	if (row.type !== 'assistant') return 0;
	const usage = object(object(row.message).usage);
	return (
		count(usage.input_tokens) +
		count(usage.cache_read_input_tokens) +
		count(usage.cache_creation_input_tokens)
	);
}

function count(value: unknown): number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function record(line: string): TrackerTranscriptRecord {
	try {
		return object(JSON.parse(line) as unknown);
	} catch {
		return {};
	}
}

function object(value: unknown): TrackerTranscriptRecord {
	return value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as TrackerTranscriptRecord)
		: {};
}
