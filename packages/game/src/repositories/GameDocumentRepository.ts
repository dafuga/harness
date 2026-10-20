import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { GameDocument } from '../models/Game.types';
import { assertDocument } from '../validators/gameDocument';

export class GameDocumentRepository {
	constructor(private root: string) {}
	async read(commit?: string): Promise<{ document: GameDocument; revision: string }> {
		if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('A full commit is required.');
		const text = commit
			? execFileSync('git', ['show', commit + ':game.json'], {
					cwd: this.root,
					encoding: 'utf8',
					maxBuffer: 1048576
				})
			: await this.text();
		if (text.length > 1048576) throw new Error('Game document exceeds 1MB.');
		const document: unknown = JSON.parse(text);
		assertDocument(document);
		return { document, revision: digest(text) };
	}
	async save(document: GameDocument, expectedRevision: string): Promise<{ revision: string }> {
		assertDocument(document);
		const text = await this.text();
		if (digest(text) !== expectedRevision)
			throw new Error('The game changed. Reload before saving.');
		const next = JSON.stringify(document, null, '\t') + '\n';
		if (next.length > 1048576) throw new Error('Game document exceeds 1MB.');
		const temporary = join(this.root, '.game-' + randomUUID() + '.tmp');
		await writeFile(temporary, next, { flag: 'wx', mode: 0o600 });
		await rename(temporary, join(this.root, 'game.json'));
		return { revision: digest(next) };
	}
	private async text(): Promise<string> {
		const file = join(this.root, 'game.json');
		const stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink())
			throw new Error('game.json must be a regular file.');
		if (stat.size > 1048576) throw new Error('Game document exceeds 1MB.');
		return readFile(file, 'utf8');
	}
}
function digest(text: string) {
	return createHash('sha256').update(text).digest('hex');
}
