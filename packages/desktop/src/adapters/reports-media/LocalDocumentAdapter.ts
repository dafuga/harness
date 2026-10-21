import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
/** Private app-data only. Never use this document for session credentials or canonical artifacts. */
export class LocalDocumentAdapter<T> {
	private queue: Promise<unknown> = Promise.resolve();
	private memory: T;
	constructor(
		private file: string | undefined,
		private empty: () => T
	) {
		this.memory = empty();
	}
	async read(): Promise<T> {
		if (!this.file) return structuredClone(this.memory);
		try {
			return JSON.parse(await readFile(this.file, 'utf8')) as T;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.empty();
			throw error;
		}
	}
	update<R>(change: (value: T) => R): Promise<R> {
		const operation = this.queue.then(async () => {
			const value = await this.read();
			const result = change(value);
			await this.write(value);
			return result;
		});
		this.queue = operation.catch(() => undefined);
		return operation;
	}
	private async write(value: T): Promise<void> {
		if (!this.file) {
			this.memory = structuredClone(value);
			return;
		}
		await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
		const temporary = `${this.file}.${randomUUID()}.tmp`;
		await writeFile(temporary, JSON.stringify(value), { mode: 0o600 });
		await rename(temporary, this.file);
	}
}
