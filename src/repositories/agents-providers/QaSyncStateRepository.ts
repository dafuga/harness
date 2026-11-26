// @harness-uid u_gqup2qrdk5
import { QaSyncError } from '../../core/agents-providers/QaSyncError';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import type { QaSyncState, QaSyncStore } from '../../core/agents-providers/qaSync.types';

/** Owner-only QA sync state, replaced atomically so a crash never leaves half a file. */
export class QaSyncStateRepository implements QaSyncStore {
	constructor(private readonly path: string) {
		if (!isAbsolute(path)) throw new TypeError('The QA sync state requires an absolute path.');
	}

	/** Only a missing file means a first run. Anything unreadable fails rather than resetting. */
	async load(): Promise<QaSyncState | undefined> {
		let raw: string;
		try {
			raw = await readFile(this.path, 'utf8');
		} catch (error) {
			if (code(error) === 'ENOENT') return undefined;
			throw error;
		}
		const state = JSON.parse(raw) as QaSyncState;
		if (state.version !== 1 || typeof state.since !== 'string' || !state.threads)
			throw new QaSyncError('The QA sync state file has an unknown format.');
		return state;
	}

	async save(state: QaSyncState): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
		const next = `${this.path}.${process.pid}.tmp`;
		await writeFile(next, JSON.stringify(state, null, '\t') + '\n', { mode: 0o600 });
		await rename(next, this.path);
	}

	/** Runs one sync at a time per state file; a lock left by a dead process is replaced. */
	async exclusive<T>(run: () => Promise<T>): Promise<T> {
		await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
		const lock = `${this.path}.lock`;
		await this.acquire(lock);
		try {
			return await run();
		} finally {
			await rm(lock, { force: true });
		}
	}

	private async acquire(lock: string): Promise<void> {
		const claim = () => writeFile(lock, String(process.pid), { flag: 'wx', mode: 0o600 });
		try {
			await claim();
		} catch (error) {
			if (code(error) !== 'EEXIST') throw error;
			const owner = Number(await readFile(lock, 'utf8').catch(() => ''));
			if (!owner || alive(owner)) throw new QaSyncError(`Another QA sync holds ${lock}.`);
			await rm(lock, { force: true });
			await claim();
		}
	}
}

function code(error: unknown): string | undefined {
	return (error as { code?: string }).code;
}

function alive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		return code(error) === 'EPERM';
	}
}
