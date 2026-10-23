import type { LegacyRun } from './LegacyReportRepository.types';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

/**
 * The old report store, opened for reading only. Nothing here creates, changes or removes a
 * file, so importing can never alter the reports it reads.
 */
export class LegacyReportRepository {
	constructor(private readonly store: string) {}

	/** Every run that has a readable manifest. */
	async runs(): Promise<LegacyRun[]> {
		const runs = join(this.store, 'runs');
		const entries = await readdir(runs, { withFileTypes: true }).catch(() => []);
		const found: LegacyRun[] = [];
		for (const entry of entries.filter((item) => item.isDirectory()).sort(byName)) {
			const text = await readFile(join(runs, entry.name, 'manifest.json'), 'utf8').catch(
				() => undefined
			);
			const manifest = text === undefined ? undefined : parseJson(text);
			if (manifest !== undefined) found.push({ id: entry.name, manifest });
		}
		return found;
	}

	/** One asset of a run, or undefined when the store does not have it. */
	async asset(run: string, file: string): Promise<Buffer | undefined> {
		const assets = resolve(this.store, 'runs', run, 'assets');
		const path = resolve(assets, file);
		if (!path.startsWith(`${assets}/`)) return undefined;
		return readFile(path).catch(() => undefined);
	}
}

function byName(left: { name: string }, right: { name: string }): number {
	return left.name < right.name ? -1 : 1;
}

function parseJson(text: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch {
		return undefined;
	}
}

export type { LegacyRun } from './LegacyReportRepository.types';
