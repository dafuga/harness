import { Buffer } from 'node:buffer';
import { createHash, randomUUID } from 'node:crypto';
import { chmod, lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { GameDocument } from '../../models/game-authoring/Game.types';
import { assertDocument } from '../../validators/game-authoring/gameDocument';

/** The largest game.json, in UTF-8 bytes, that is saved and read. */
const documentBytes = 1048576;
const tooLarge = 'Game document exceeds 1MB.';

export class GameDocumentRepository {
	constructor(private root: string) {}
	async read(commit?: string): Promise<{ document: GameDocument; revision: string }> {
		if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('A full commit is required.');
		const text = commit
			? execFileSync('git', ['show', commit + ':game.json'], {
					cwd: this.root,
					encoding: 'utf8',
					maxBuffer: documentBytes
				})
			: (await this.current()).text;
		if (Buffer.byteLength(text) > documentBytes) throw new Error(tooLarge);
		const document: unknown = JSON.parse(text);
		assertDocument(document);
		return { document, revision: digest(text) };
	}
	async save(document: GameDocument, expectedRevision: string): Promise<{ revision: string }> {
		assertDocument(document);
		const { text, mode } = await this.current();
		if (digest(text) !== expectedRevision)
			throw new Error('The game changed. Reload before saving.');
		const next = JSON.stringify(document, null, '\t') + '\n';
		if (Buffer.byteLength(next) > documentBytes) throw new Error(tooLarge);
		await replace(join(this.root, 'game.json'), next, mode);
		return { revision: digest(next) };
	}
	private async current(): Promise<{ text: string; mode: number }> {
		const file = join(this.root, 'game.json');
		const stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('game.json must be a regular file.');
		if (stat.size > documentBytes) throw new Error(tooLarge);
		return { text: await readFile(file, 'utf8'), mode: stat.mode & 0o777 };
	}
}
/**
 * Writes the new game beside the old one with the old one's permissions, then renames it over it:
 * a reader sees one game or the other. A failed attempt removes its own temporary file.
 */
async function replace(file: string, text: string, mode: number): Promise<void> {
	const temporary = join(dirname(file), '.game-' + randomUUID() + '.tmp');
	try {
		await writeFile(temporary, text, { flag: 'wx', mode: 0o600 });
		await chmod(temporary, mode);
		await rename(temporary, file);
	} catch (error) {
		if ((error as { code?: string }).code !== 'EEXIST')
			await rm(temporary, { force: true }).catch(() => undefined);
		throw error;
	}
}
function digest(text: string) {
	return createHash('sha256').update(text).digest('hex');
}
