import type { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
const pattern = /^static\/game\/checkpoints\/[a-f0-9]{64}\.png$/;
export class CheckpointImageRepository {
	constructor(private root: string) {}
	async save(bytes: Buffer): Promise<string> {
		const hash = createHash('sha256').update(bytes).digest('hex');
		const path = 'static/game/checkpoints/' + hash + '.png';
		await this.directories(true);
		try {
			await writeFile(join(this.root, path), bytes, { flag: 'wx' });
		} catch (error) {
			if ((error as { code?: string }).code !== 'EEXIST') throw error;
			await this.read(path);
		}
		return path;
	}
	async read(path: string, commit?: string): Promise<string> {
		if (!pattern.test(path)) throw new Error('Invalid checkpoint image path.');
		if (commit && !/^[a-f0-9]{40}$/.test(commit)) throw new Error('A full commit is required.');
		const bytes = commit
			? execFileSync('git', ['show', commit + ':' + path], {
					cwd: this.root,
					maxBuffer: 12_000_000
				})
			: await this.current(path);
		const hash = createHash('sha256').update(bytes).digest('hex');
		if (
			!path.endsWith(hash + '.png') ||
			bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
		)
			throw new Error('Checkpoint image integrity failed.');
		return 'data:image/png;base64,' + bytes.toString('base64');
	}
	private async current(path: string): Promise<Buffer> {
		await this.directories(false);
		const file = join(this.root, path),
			stat = await lstat(file);
		if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 12_000_000)
			throw new Error('Invalid checkpoint image file.');
		return readFile(file);
	}
	private async directories(create: boolean) {
		let parent = this.root;
		for (const part of ['static', 'game', 'checkpoints']) {
			parent = join(parent, part);
			if (create)
				await mkdir(parent).catch((error: { code?: string }) => {
					if (error.code !== 'EEXIST') throw error;
				});
			const stat = await lstat(parent);
			if (!stat.isDirectory() || stat.isSymbolicLink())
				throw new Error('Unsafe checkpoint image directory.');
		}
	}
}
