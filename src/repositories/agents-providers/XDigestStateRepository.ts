// @harness-uid u_epe6zctrdy
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import type { XDigestState } from '../../core/agents-providers/xDigest.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';

/** Owner-only memory of what was already sent: post ids only, never post text. */
export class XDigestStateRepository {
	constructor(private readonly path: string) {
		if (!isAbsolute(path)) throw new TypeError('The X digest state requires an absolute path.');
	}

	/** Only a missing file means a first run; an unreadable one must not resend old posts. */
	async load(): Promise<XDigestState> {
		let raw: string;
		try {
			raw = await readFile(this.path, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			return { version: 1, seen: [] };
		}
		const state = JSON.parse(raw) as XDigestState;
		if (state.version !== 1 || !Array.isArray(state.seen))
			throw new ExpectedCliError('The X digest state file has an unknown format.');
		return state;
	}

	async save(state: XDigestState): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
		const next = `${this.path}.${process.pid}.tmp`;
		await writeFile(next, JSON.stringify(state) + '\n', { mode: 0o600 });
		await rename(next, this.path);
	}
}
