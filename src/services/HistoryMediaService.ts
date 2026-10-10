import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ResolvedMedia } from '../utils/recordView';

const directory = 'media';

/**
 * Writes original evidence bytes into the output, named by their hash. Bytes that are missing,
 * or that are not the bytes the record names, become a stated gap; nothing stands in for them.
 */
export class HistoryMediaService {
	readonly counts = { resolved: 0, missing: 0 };
	private readonly written = new Set<string>();

	constructor(private readonly out: string) {}

	async place(
		bytes: Buffer | undefined,
		file: { path: string; sha256: string },
		gap: string
	): Promise<ResolvedMedia> {
		const actual = bytes ? createHash('sha256').update(bytes).digest('hex') : undefined;
		if (!bytes || actual !== file.sha256) {
			this.counts.missing += 1;
			return { media: null, gap };
		}
		const extension = /\.([a-z0-9]+)$/i.exec(file.path)?.[1].toLowerCase() ?? 'bin';
		const name = `${directory}/${file.sha256}.${extension}`;
		if (!this.written.has(name)) {
			await mkdir(join(this.out, directory), { recursive: true });
			await writeFile(join(this.out, name), bytes);
			this.written.add(name);
		}
		this.counts.resolved += 1;
		return { media: name };
	}
}
