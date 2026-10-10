import { existsSync, readFileSync } from 'node:fs';
import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { explanationSchema, explanationsFile, type Explanation } from '../core/explanationTypes';

/** Scratch store of reasons, kept outside the source tree until they are persisted as notes. */
export class ExplanationRepository {
	private readonly path: string;

	constructor(root: string, file = explanationsFile) {
		this.path = join(root, file);
	}

	/** Reads every well-formed reason; a damaged line is ignored and therefore explains nothing. */
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
