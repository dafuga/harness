import { moduleReviewDigest } from '../../../repositories/git-source-history/module-data-repository/readModuleSource';
import { ModuleDataSnapshotValidator } from '../../../validators/development-tooling/ModuleDataSnapshotValidator';
import { GitAdapter } from '../../../adapters/git-source-history/GitAdapter';
import { moduleDataProducer } from './moduleDataProtocol';
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { ModuleDataIdentity } from '../../../repositories/git-source-history/ModuleDataRepository.types';
import type { ModuleDataRepository } from '../../../repositories/git-source-history/ModuleDataRepository';
import type { ModuleData } from '../ModuleDataService.types';
export class ModuleDataCache {
	private directory?: Promise<string>;
	constructor(
		private repository: ModuleDataRepository,
		private maximumBytes = 64 * 1024 * 1024
	) {}
	async read(identity: ModuleDataIdentity, source = false): Promise<ModuleData | undefined> {
		const current = await this.readVersion(identity, source, moduleDataProducer);
		if (current || !source) return current;
		// Reuse sealed version 5 facts only when they could not have cataloged planning logs.
		const prior = await this.readVersion(identity, true, 'harness-module-data-v1.2026-10-25.5');
		return prior && new ModuleDataSnapshotValidator().sourceProducer(prior) ? prior : undefined;
	}
	private async readVersion(identity: ModuleDataIdentity, source: boolean, producer: string) {
		try {
			const data = JSON.parse(await this.text(identity, source, producer)) as ModuleData;
			const { digest, ...body } = data;
			return data.producer === producer &&
				(data.reviews ?? [])
					.map((item) => item.digest)
					.sort()
					.join() === (await moduleReviewDigest(this.repository.root, identity)) &&
				new ModuleDataSnapshotValidator().validate(data).valid &&
				digest === this.repository.digest(body) &&
				(source
					? data.commit === identity.commit && data.tree === identity.tree
					: this.repository.key(data) === this.repository.key(identity))
				? data
				: undefined;
		} catch {
			return undefined;
		}
	}

	async write(data: ModuleData) {
		const directory = await this.cacheDirectory();
		await mkdir(directory, { recursive: true });
		const text = JSON.stringify(data);
		for (const source of [false, true]) {
			const path = join(directory, this.filename(data, source)),
				temporary = `${path}.${randomUUID()}.tmp`;
			await writeFile(temporary, text);
			await rename(temporary, path);
		}
		await this.prune(directory);
	}
	/** Source history remains in Git; diagnostic eviction must never remove committed facts. */
	private async prune(directory: string) {
		const names = (await readdir(directory)).filter((name) =>
			/^(?:source-)?[a-f0-9]{64}\.json$/.test(name)
		);
		const entries = (
			await Promise.all(
				names.map(async (name) => {
					const path = join(directory, name);
					const info = await stat(path).catch(() => undefined);
					return info ? { path, size: info.size, modified: info.mtimeMs } : undefined;
				})
			)
		)
			.filter((entry) => entry !== undefined)
			.sort((a, b) => a.modified - b.modified);
		let bytes = entries.reduce((total, entry) => total + entry.size, 0);
		for (const entry of entries) {
			if (bytes <= this.maximumBytes) break;
			await rm(entry.path, { force: true });
			bytes -= entry.size;
		}
	}

	private filename(identity: ModuleDataIdentity, source = false, producer = moduleDataProducer) {
		return `${source ? 'source-' + this.repository.digest([identity.commit, identity.tree, producer]) : this.repository.key(identity)}.json`;
	}
	private cacheDirectory() {
		return (this.directory ??= new GitAdapter(this.repository.root)
			.run(['rev-parse', '--absolute-git-dir'])
			.then((directory) => join(directory, 'harness/module-data')));
	}
	private async text(identity: ModuleDataIdentity, source: boolean, producer: string) {
		const name = this.filename(identity, source, producer);
		try {
			return await readFile(join(await this.cacheDirectory(), name), 'utf8');
		} catch (error) {
			if ((error as { code?: string }).code !== 'ENOENT') throw error;
			// Existing sealed caches remain readable; new cache files never enter source worktrees.
			return readFile(join(this.repository.root, '.cache/harness/module-data', name), 'utf8');
		}
	}
}
