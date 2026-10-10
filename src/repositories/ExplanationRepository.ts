import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { explanationSchema, explanationsFile, type Explanation } from '../core/explanationTypes';
import { HistoryNoteRepository } from './HistoryNoteRepository';

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

	/** Every reason known here: those kept in Git notes, then those still in the scratch file. */
	async all(): Promise<Explanation[]> {
		// Outside a repository, or before any note exists, there is nothing persisted to read.
		const notes = await new HistoryNoteRepository(this.root).all().catch(() => undefined);
		const persisted = [...(notes?.values() ?? [])].flatMap((note) =>
			note.entries.flatMap((entry) => (entry.kind === 'reason' ? [entry.explanation] : []))
		);
		return [...persisted, ...this.read()];
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

function parseLine(line: string): unknown {
	try {
		return JSON.parse(line) as unknown;
	} catch {
		return undefined;
	}
}
