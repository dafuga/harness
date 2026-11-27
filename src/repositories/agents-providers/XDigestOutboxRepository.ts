// @harness-uid u_ybg7mk7jxe
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { XDigestOutbox } from '../../core/agents-providers/xDigest.types';

const keptDays = 7;
const dayFile = /^\d{4}-\d{2}-\d{2}\.json$/u;

/** Owner-only daily files the sender fetches. Only the last week is kept. */
export class XDigestOutboxRepository {
	constructor(private readonly directory: string) {
		if (!isAbsolute(directory))
			throw new TypeError('The X digest outbox must be an absolute path.');
	}

	async write(entry: XDigestOutbox): Promise<void> {
		await mkdir(this.directory, { recursive: true, mode: 0o700 });
		const path = join(this.directory, `${entry.day}.json`);
		const next = `${path}.${process.pid}.tmp`;
		await writeFile(next, JSON.stringify(entry) + '\n', { mode: 0o600 });
		await rename(next, path);
		const files = (await readdir(this.directory)).filter((name) => dayFile.test(name)).sort();
		for (const old of files.slice(0, -keptDays)) await rm(join(this.directory, old));
	}
}
