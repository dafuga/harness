// @harness-uid u_nivrvbu66a
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import type { XDigestSendState } from '../../core/agents-providers/xDigestSend.types';
import { ExpectedCliError } from '../../core/development-tooling/errors';

/** What the sender already delivered. It never stores message text. */
export class XDigestSendStateRepository {
	constructor(private readonly path: string) {
		if (!isAbsolute(path)) throw new TypeError('The X digest send state needs an absolute path.');
	}

	/** Only a missing file means a first run; an unreadable one must not post again. */
	async load(): Promise<XDigestSendState> {
		let raw: string;
		try {
			raw = await readFile(this.path, 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			return { version: 1, next: 0, closed: false };
		}
		const state = JSON.parse(raw) as XDigestSendState;
		if (state.version !== 1 || !Number.isInteger(state.next))
			throw new ExpectedCliError('The X digest send state file has an unknown format.');
		return state;
	}

	async save(state: XDigestSendState): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
		const next = `${this.path}.${process.pid}.tmp`;
		await writeFile(next, JSON.stringify(state) + '\n', { mode: 0o600 });
		await rename(next, this.path);
	}
}
