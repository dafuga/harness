import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
	explanationSchema,
	explanationsFile,
	type Explanation
} from '../../core/development-tooling/explanationTypes';
import { HistoryNoteRepository } from '../git-source-history/history-note-repository/HistoryNoteRepository';

/**
 * Reasons live in two places: a scratch file while a change is being written, and the notes of
 * the commit once a record or a range has been attached. Both explain a change equally.
 */
export class ExplanationRepository {
	private readonly path: string;

	constructor(
		private readonly root: string,
		file = explanationsFile
	) {
		this.path = join(root, file);
	}

	/** Every reason known here: noted ones once each, by when they were recorded, then scratch. */
	async all(): Promise<Explanation[]> {
		// Outside a repository, or before any note exists, there is nothing persisted to read.
		const notes = await new HistoryNoteRepository(this.root).all().catch(() => undefined);
		const persisted = [...(notes?.values() ?? [])].flatMap((note) =>
			note.entries.flatMap((entry) => (entry.kind === 'reason' ? [entry.explanation] : []))
		);
		// Notes keep no order: by UTC date, then content; text without one sorts first.
		const held = new Map(
			persisted.map((entry) => {
				const time = utc.test(entry.recordedAt) ? entry.recordedAt.slice(0, -1) : '';
				return [`${time} ${JSON.stringify(entry)}`, entry];
			})
		);
		const order = [...held.keys()].sort().map((key) => held.get(key) as Explanation);
		return [...order, ...this.read()];
	}

	/** Reads the scratch file; a damaged line is ignored and therefore explains nothing. */
	read(): Explanation[] {
		if (!existsSync(this.path)) return [];
		return readFileSync(this.path, 'utf8')
			.split('\n')
			.filter(Boolean)
			.flatMap((line) => {
				const parsed = explanationSchema.safeParse(parseLine(line));
				return parsed.success ? [parsed.data] : [];
			});
	}

	async append(entries: Explanation[]): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		await appendFile(this.path, entries.map((entry) => `${JSON.stringify(entry)}\n`).join(''));
	}
}

const utc = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z$/;

function parseLine(line: string): unknown {
	try {
		return JSON.parse(line) as unknown;
	} catch {
		return undefined;
	}
}
