// @harness-uid u_bl6xl2h4a3
import type { Stats } from 'node:fs';
import {
	closeSync,
	constants,
	fstatSync,
	lstatSync,
	openSync,
	readFileSync,
	realpathSync
} from 'node:fs';
import { join } from 'node:path';
import type { TrackerRunReceipt } from '../../agents-providers/TrackerDispatcherService.types';
import { attemptKey } from '../../agents-providers/tracker-dispatcher-service/launchEligibility';
import type { TrackerHostSession } from './trackerHostLaunch.types';

export function trackerLegacyExitReceipt(directory: string) {
	const root = realpathSync(directory);
	if (!ownedLegacyDirectory(root)) throw new TypeError('Tracker legacy run directory is not owned');
	return (run: TrackerRunReceipt): TrackerHostSession | undefined => legacyExit(root, run);
}

function legacyExit(root: string, run: TrackerRunReceipt): TrackerHostSession | undefined {
	const { id, item_id: itemId, tmux, started_at: startedAt } = run;
	const expected = `auto-${itemId.slice(0, 6)}-r${id}`;
	if (!Number.isSafeInteger(id) || id <= 0 || tmux !== expected || startedAt === null)
		return undefined;
	const directory = join(root, `run-${id}`);
	if (realpathOfOwnedLegacyDirectory(directory) !== directory) return undefined;
	const exitCode = readLegacyExit(join(directory, 'exit'), startedAt);
	if (exitCode === undefined) return undefined;
	return {
		itemId,
		key: attemptKey(run),
		id: run.host_session_id ?? `legacy-exit:${id}`,
		state: 'exited',
		startedAt,
		tmux,
		exitCode,
		legacyRunId: id
	};
}

function readLegacyExit(path: string, startedAt: number): number | undefined {
	try {
		const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		try {
			if (!validLegacyExitFile(fstatSync(fd), startedAt)) return undefined;
			const exit = readFileSync(fd, 'utf8').trim();
			return /^(?:0|[1-9][0-9]{0,2})$/.test(exit) && Number(exit) <= 255 ? Number(exit) : undefined;
		} finally {
			closeSync(fd);
		}
	} catch (error) {
		if (
			error instanceof Error &&
			'code' in error &&
			['ENOENT', 'ELOOP'].includes(String(error.code))
		)
			return undefined;
		throw error;
	}
}

function validLegacyExitFile(file: Stats, startedAt: number): boolean {
	return (
		file.isFile() &&
		file.uid === process.getuid?.() &&
		file.nlink === 1 &&
		(file.mode & 0o022) === 0 &&
		file.size <= 16 &&
		file.mtimeMs >= startedAt - 1000
	);
}

function ownedLegacyDirectory(path: string): boolean {
	const stat = lstatSync(path);
	return stat.isDirectory() && stat.uid === process.getuid?.() && (stat.mode & 0o022) === 0;
}

function realpathOfOwnedLegacyDirectory(path: string): string | undefined {
	try {
		return ownedLegacyDirectory(path) ? realpathSync(path) : undefined;
	} catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
		throw error;
	}
}
