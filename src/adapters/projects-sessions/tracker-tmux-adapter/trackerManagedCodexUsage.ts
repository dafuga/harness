// @harness-uid u_fyf7e7kyi5
import { constants } from 'node:fs';
import { open, readdir } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { join } from 'node:path';
import { taskUsage } from '../../agents-providers/module-task-runner-adapter/taskUsage';
import { attemptKey } from '../../../services/agents-providers/tracker-dispatcher-service/launchEligibility';
import { trackerManagedToken } from './trackerManagedLaunchReceipt';
import type { TrackerHostLaunchPort } from '../../../services/projects-sessions/tracker-native-runtime-service/trackerHostLaunch.types';
import type { TrackerReceiptUsage } from '../../../services/agents-providers/TrackerDispatcherService.types';

const codexHeaderBytes = 16 * 1024;
const codexTailBytes = 512 * 1024;
const codexRolloutName = /^rollout-.+-([a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\.jsonl$/i;

/** Read only counters from one rollout bound to the native attempt. */
export function trackerManagedCodexUsage(
	directory: string,
	profile: string | undefined,
	transcriptRoots: readonly string[]
): TrackerHostLaunchPort['readUsage'] {
	if (!profile) return undefined;
	const roots = [join(profile, '.codex', 'sessions'), ...transcriptRoots];
	return async (run, signal) => {
		const attempt = trackerManagedToken(run.node, attemptKey(run));
		if (run.cli !== 'codex' || run.started_at === null || run.session_id !== attempt)
			return undefined;
		return ownedRolloutUsage(roots, join(directory, attempt, 'worktree'), run.started_at, signal);
	};
}

async function ownedRolloutUsage(
	roots: readonly string[],
	worktree: string,
	startedAt: number,
	signal: AbortSignal
): Promise<TrackerReceiptUsage | undefined> {
	let matched = false;
	let usage: TrackerReceiptUsage | undefined;
	for (const directory of codexRolloutDirectories(roots, startedAt)) {
		for (const name of await readdir(directory).catch(() => [])) {
			signal.throwIfAborted();
			const id = codexRolloutName.exec(name)?.[1];
			if (!id) continue;
			const result = await codexRolloutUsage(join(directory, name), { id, worktree, startedAt });
			if (!result) continue;
			if (matched) return undefined;
			matched = true;
			usage = result.usage;
		}
	}
	return usage;
}

function codexRolloutDirectories(roots: readonly string[], startedAt: number) {
	const dates = [-1, 0, 1].map((offset) =>
		new Date(startedAt + offset * 86_400_000).toISOString().slice(0, 10).replaceAll('-', '/')
	);
	return [...new Set(roots.flatMap((root) => dates.map((date) => join(root, date))))];
}

async function codexRolloutUsage(
	path: string,
	{ id, worktree, startedAt }: { id: string; worktree: string; startedAt: number }
) {
	const file = await open(
		path,
		constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
	).catch(() => undefined);
	if (!file) return undefined;
	try {
		const stat = await file.stat();
		if (
			!stat.isFile() ||
			stat.uid !== process.getuid?.() ||
			stat.nlink !== 1 ||
			(stat.mode & 0o022) !== 0 ||
			stat.mtimeMs < startedAt - 1000
		)
			return undefined;
		const [header] = await codexRolloutLines(file, 0, codexHeaderBytes);
		const row = parseCodexLine(header);
		const meta = row?.payload;
		const started = typeof meta?.timestamp === 'string' ? Date.parse(meta.timestamp) : NaN;
		if (
			row?.type !== 'session_meta' ||
			meta?.id !== id ||
			meta?.cwd !== worktree ||
			!Number.isFinite(started) ||
			started < startedAt - 1000 ||
			started > Date.now() + 1000
		)
			return undefined;
		const tail = await codexRolloutLines(
			file,
			Math.max(0, stat.size - codexTailBytes),
			codexTailBytes
		);
		return { usage: lastCodexUsage(tail) };
	} finally {
		await file.close();
	}
}

async function codexRolloutLines(file: FileHandle, offset: number, length: number) {
	const buffer = Buffer.alloc(length);
	try {
		const { bytesRead } = await file.read(buffer, 0, length, offset);
		const lines = buffer.toString('utf8', 0, bytesRead).split('\n');
		return offset ? lines.slice(1) : lines;
	} finally {
		buffer.fill(0);
	}
}

function lastCodexUsage(lines: readonly string[]): TrackerReceiptUsage | undefined {
	for (let i = lines.length - 1; i >= 0; i--) {
		const line = lines[i];
		if (!line.includes('"token_count"')) continue;
		const row = parseCodexLine(line);
		if (row?.type !== 'event_msg' || row.payload?.type !== 'token_count') continue;
		const usage = row.payload.info?.total_token_usage;
		if (!usage || typeof usage !== 'object' || Array.isArray(usage)) continue;
		const {
			inputTokens: input,
			cacheReadTokens: cached,
			outputTokens: output
		} = taskUsage('codex', [{ type: 'turn.completed', usage }]);
		if (
			input === null ||
			cached === null ||
			output === null ||
			cached > input ||
			![input, cached, output].every(Number.isSafeInteger)
		)
			continue;
		return {
			input_tokens: input - cached,
			cache_read_tokens: cached,
			cache_write_tokens: 0,
			output_tokens: output
		};
	}
	return undefined;
}

function parseCodexLine(line: string) {
	try {
		return JSON.parse(line);
	} catch {
		return undefined;
	}
}
